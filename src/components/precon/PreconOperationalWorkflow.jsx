import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PreconWorkflowActivation from '@/components/precon/PreconWorkflowActivation';
import PreconWorkflowProject from '@/components/precon/PreconWorkflowProject';
import PreconWorkflowTask from '@/components/precon/PreconWorkflowTask';

const request = async payload => (await base44.functions.invoke('preconOperationalWorkflow',payload)).data;
const getError = error => error?.response?.data?.error || 'The workflow request could not be completed.';
export default function PreconOperationalWorkflow({user}) {
  const [selection,setSelection] = useState(null), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const client = useQueryClient();
  const key = ['precon-operational-projects',user.id];
  const {data:config,isLoading:loadingConfig,error:configError} = useQuery({queryKey:['precon-operational-config',user.id],queryFn:()=>request({action:'config'}),retry:false});
  const {data:list,isLoading,error:listError,refetch} = useQuery({queryKey:key,queryFn:()=>request({action:'list'}),enabled:config?.enabled===true,retry:false});
  const projects = list?.projects || [];
  const project = projects.find(p=>p.id===selection?.saleId);
  const task = project?.tasks?.find(t=>t.id===selection?.taskId);
  const send = async input => {
    if (busy) return;
    setBusy(true); setError('');
    try { const next = await request(input); client.setQueryData(key,old=>({...old,projects:old.projects.map(p=>p.id===next.id ? next : p)})); }
    catch (e) { setError(getError(e)); if (e?.response?.status === 409) await refetch(); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 border bg-card p-5">
    <h2 className="font-heading text-xl font-semibold">Operational workflow</h2>
    {loadingConfig ? <p role="status">Checking workflow availability…</p> : configError ? <p role="alert" className="text-destructive">{getError(configError)}</p> : !config?.enabled ? <p className="text-sm">Controlled activation is off. No live Sales have been enrolled by this change.</p> : <>
      {isLoading ? <p role="status">Loading assigned workflows…</p> : listError ? <p role="alert" className="text-destructive">{getError(listError)}</p> : !projects.length ? <p className="text-sm">No controlled Sales are assigned to you.</p> : projects.map(p=>p.active ? <PreconWorkflowProject key={p.id} project={p} onOpen={(saleId,taskId)=>{setError('');setSelection({saleId,taskId});}} /> : <PreconWorkflowActivation key={p.id} project={p} roles={config.roles} users={list.users} busy={busy} onActivate={send} />)}
      {error && !task && <p role="alert" className="text-destructive">{error}</p>}
      {task && <PreconWorkflowTask project={project} task={task} config={config} isAdmin={user.role==='admin'} error={error} busy={busy} onClose={()=>{setSelection(null);setError('');}} onCommand={command=>send({action:'command',saleId:project.id,revision:project.revision,command})} />}
    </>}
    {config?.decisions && <details className="space-y-2 border-t pt-3" open={!config.enabled}><summary className="cursor-pointer font-semibold">Management decisions required before production</summary><dl className="space-y-2 text-sm">{config.decisions.map(([title,body])=><div key={title}><dt className="font-semibold">{title}</dt><dd>{body}</dd></div>)}</dl></details>}
  </section>;
}