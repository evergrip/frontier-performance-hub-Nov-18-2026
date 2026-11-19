import { requireWorkflow } from './preconOperationalPolicy.ts';

export async function attachWorkflow(entities, sale, state) {
  requireWorkflow(!sale.precon_workflow_run_id, 'This Sale already has an active workflow.',409);
  const runs = entities.PreconWorkflowRun;
  const candidate = await runs.create({sale_id:sale.id, revision:0, state});
  // Only the winner of this atomic conditional write is reachable as an active run.
  // If the write result is ambiguous, do not delete the candidate: it could be the winner.
  const result = await entities.Sale.updateMany({id:sale.id, sale_type:'preconstruction', status:{$nin:['closed_won','closed_lost']}, $or:[{converted_to_project_id:{$exists:false}},{converted_to_project_id:''}], precon_workflow_run_id:{$exists:false}}, {$set:{precon_workflow_run_id:candidate.id}});
  if (result.updated === 0) {
    await runs.delete(candidate.id);
    requireWorkflow(false, 'This Sale was already activated or changed. Refresh the Command Centre.',409);
  }
  requireWorkflow(result.updated === 1,'Could not confirm workflow activation.',503);
  return candidate;
}
export async function appendWorkflowEvent(runs, run, event) {
  const state = {...run.state, events:[...run.state.events,event]};
  requireWorkflow(new TextEncoder().encode(JSON.stringify(state)).length <= 220000, 'This controlled run has reached its audit capacity. No history was removed.',409);
  const next = run.revision + 1;
  const result = await runs.updateMany({id:run.id, revision:run.revision}, {$set:{state,revision:next}});
  requireWorkflow(result.updated === 1,'Another update was saved first. Refresh and retry from the current task state.',409);
  return {...run,state,revision:next};
}