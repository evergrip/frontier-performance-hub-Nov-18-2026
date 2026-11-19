import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PreconWorkflowTaskForm from '@/components/precon/PreconWorkflowTaskForm';

export default function PreconWorkflowTask({project,task,config,isAdmin,busy,error,onCommand,onClose}) {
  const stageName = id => {const s = project.tasks.find(t=>t.id===id); return `${id}. ${s.name}`;};
  const name = id => project.names[id] || id;
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>{task.id}. {task.name}</DialogTitle><DialogDescription>{project.title} · {task.status}{task.gate ? ` · Decision gate: ${task.gate}` : ''}</DialogDescription></DialogHeader>
    <div className="space-y-3 text-sm">
      <p>{task.purpose}</p><p>{task.automation}</p>
      <p><strong>Owner:</strong> {name(task.ownerId)}{task.due && <> · <strong>Due:</strong> {task.due}</>}</p>
      <p><strong>Completion requirements:</strong> {task.authority}</p>
      <div><strong>Required evidence</strong><ul className="list-disc pl-5">{task.evidence.map(e=><li key={e}>{e}</li>)}</ul></div>
      {!!task.forms.length && <p><strong>Supporting forms:</strong> {task.forms.join('; ')}</p>}
      <p><strong>Prerequisites:</strong> {task.deps.map(stageName).join('; ') || 'None'}</p>
      {!!task.unmet.length && <p><strong>Blocking prerequisites:</strong> {task.unmet.map(stageName).join('; ')}</p>}
      <p><strong>Next dependent activities:</strong> {task.dependents.map(stageName).join('; ') || 'None'}</p>
      {task.wait && <p><strong>Waiting on {task.wait.party}:</strong> {task.wait.note} · Follow up {task.wait.followup}</p>}
      {task.issue && <p>{task.issue}</p>}
      {task.permitSubmission && <p><strong>Permit submission:</strong> {task.permitSubmission}</p>}
      <div><strong>Assigned reviewers</strong><ul className="list-disc pl-5">{task.reviewersAssigned.map(r=><li key={r.role}>{name(r.userId)} ({config.roles?.[r.role] || r.role}) · {task.approvals[r.role]?.action === 'approve' ? `Approved revision ${task.approvals[r.role].version}` : task.approvals[r.role]?.action || (task.status==='Review' ? 'Pending' : 'Not yet requested')}</li>)}</ul></div>
      {!!task.revisions.length && <div><strong>Evidence versions</strong>{task.revisions.map(r=><details key={r.version} className="border-b py-2" open={r.version===task.revisions.length}><summary>Revision {r.version} · {name(r.actor)} · {r.at.slice(0,10)}</summary><ol className="list-decimal break-words pl-5">{r.evidence.map((item,i)=><li key={i}>{task.evidence[i]}: {/^https:\/\/[^\s]+$/i.test(item) ? <a className="underline" href={item} target="_blank" rel="noreferrer">{item}</a> : item}</li>)}</ol>{r.note && <p>{r.note}</p>}</details>)}</div>}
      <details><summary>Task history</summary><ol className="space-y-1">{task.audit.map((e,i)=><li className="break-words" key={i}>{new Date(e.at).toLocaleString()} · {name(e.actor)} · {e.action}{e.version && ` · revision ${e.version}`}{e.note && ` · ${e.note}`}{e.reference && ` · ${e.reference}`}</li>)}</ol></details>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <PreconWorkflowTaskForm key={`${task.id}-${project.revision}`} task={task} project={project} isAdmin={isAdmin} parties={config.waitingParties} busy={busy} onCommand={onCommand} />
    </div>
  </DialogContent></Dialog>;
}