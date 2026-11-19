import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { PRECON_OPERATIONAL_ENABLED, PRECON_CONTROLLED_SALES, PRECON_TEST_ACCOUNTS, PreconWorkflowError, initialWorkflow, pilotTemplate, requireWorkflow, waitingParties } from '../../shared/preconOperationalPolicy.ts';
import { workflowView } from '../../shared/preconOperationalEngine.ts';
import { appendWorkflowEvent, attachWorkflow } from '../../shared/preconOperationalStore.ts';

const missing = e => e.status === 404 ? null : Promise.reject(e);
const hasAccess = (run,user) => user.role === 'admin' || Object.values(run.state.assignments).includes(user.id);
const summary = (sale,run) => ({id:sale.id,title:sale.title,active:!!run});
const view = (sale,run,user,at) => ({...summary(sale,run),revision:run.revision, version:run.state.template.version, assignments:run.state.assignments, names:run.state.names, history:run.state.events, activatedAt:run.state.activatedAt, activatedBy:run.state.activatedBy, ...workflowView(run.state,at), userId:user.id});

export default async function(req: Request): Promise<Response> {
  const json = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    requireWorkflow(user,'Sign in to use the Pre-Con workflow.',401);
    const input = await req.json().catch(() => null);
    const action = input?.action;
    const enabled = PRECON_OPERATIONAL_ENABLED && PRECON_CONTROLLED_SALES.size > 0 && PRECON_TEST_ACCOUNTS.size > 0;
    if (action === 'config') {
      const isAdmin = user.role === 'admin';
      const t = isAdmin ? pilotTemplate('detailed') : null;
      return json({enabled,decisions:t?.decisions, roles:t ? Object.fromEntries(t.stageRoles.map(key => [key,t.roles[key]])) : null, waitingParties});
    }
    requireWorkflow(enabled,'The controlled workflow is disabled. No Sales can be activated.',403);
    requireWorkflow(['list','open','activate','command'].includes(action), 'Unknown workflow request.',400);
    const entities = base44.asServiceRole.entities, runs = entities.PreconWorkflowRun;
    const at = new Date().toISOString();
    if (action === 'list') {
      const {items:sales} = await entities.Sale.filter({id:{$in:[...PRECON_CONTROLLED_SALES]},sale_type:'preconstruction'},{limit:50});
      const ids = sales.map(s=>s.precon_workflow_run_id).filter(Boolean);
      const records = ids.length ? (await runs.filter({id:{$in:ids}},{limit:50})).items : [];
      const projects = sales.flatMap(sale => {
        const run = records.find(r => r.id === sale.precon_workflow_run_id && r.sale_id === sale.id);
        return run && hasAccess(run,user) ? [view(sale,run,user,at)] : !sale.precon_workflow_run_id && user.role === 'admin' ? [summary(sale,null)] : [];
      });
      const users = user.role === 'admin' && projects.some(p => !p.active) ? await entities.User.filter({id:{$in:[...PRECON_TEST_ACCOUNTS]}}) : [];
      return json({projects, users:users.map(u=>({id:u.id,name:u.full_name || u.id}))});
    }
    requireWorkflow(PRECON_CONTROLLED_SALES.has(input.saleId),'This Sale is not authorized for the controlled workflow.',404);
    const sale = await entities.Sale.get(input.saleId).catch(missing);
    requireWorkflow(sale?.sale_type === 'preconstruction','Pre-Construction Sale not found.',404);
    if (action === 'activate') {
      requireWorkflow(user.role === 'admin','Only an app admin may activate a controlled workflow.',403);
      requireWorkflow(input.confirm === true,'Confirm this is a controlled test Sale.',400);
      requireWorkflow(!sale.precon_workflow_run_id,'This Sale already has an active workflow.',409);
      requireWorkflow(!['closed_won','closed_lost'].includes(sale.status) && !sale.converted_to_project_id,'Only an open Pre-Construction Sale can be activated.',409);
      const state = initialWorkflow(pilotTemplate(input.path),input.assignments,input.days,user.id,at);
      const ids = [...new Set(Object.values(state.assignments))];
      requireWorkflow(ids.every(id=>PRECON_TEST_ACCOUNTS.has(id)), 'Only explicitly authorized test accounts may be assigned.',403);
      const users = await entities.User.filter({id:{$in:ids}});
      requireWorkflow(users.length === ids.length,'One or more assignees are not app users.');
      const run = await attachWorkflow(entities,sale,{...state,names:Object.fromEntries(users.map(u=>[u.id,u.full_name || u.id]))});
      return json(view(sale,run,user,at));
    }
    requireWorkflow(sale.precon_workflow_run_id,'This Sale has no activated workflow.',404);
    const run = await runs.get(sale.precon_workflow_run_id).catch(missing);
    requireWorkflow(run?.sale_id === sale.id && hasAccess(run,user),'Workflow not found.',404);
    if (action === 'open') return json(view(sale,run,user,at));
    requireWorkflow(input.revision === run.revision,'This workflow changed. Refresh before saving.',409);
    const {event} = workflowView(run.state,at,input.command,user);
    requireWorkflow(event,'Choose a workflow action.',400);
    const updated = await appendWorkflowEvent(runs,run,event);
    return json(view(sale,updated,user,at));
  } catch (e) {
    if (e instanceof PreconWorkflowError) return json({error:e.message},e.status);
    console.error('Operational Pre-Con request failed', {status:e.status, name:e.name});
    return json({error:'The Pre-Con workflow request could not be completed.'},500);
  }
}