import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
const working = ['In progress','Waiting','Blocked','Revision required'];
const actionLabels = {start:'Start task',resume:'Resume work',submit:'Submit evidence',hold:'Record hold',permitSubmitted:'Record permit submission',approve:'Approve',reject:'Request revision',noGo:'Record No-Go',reconsider:'Record management reconsideration'};

export default function PreconWorkflowTaskForm({task,project,isAdmin,parties,busy,onCommand}) {
  const [action,setAction] = useState('');
  const assigned = task.ownerId === project.userId;
  const reviewRole = task.reviewersAssigned.find(r=>r.userId===project.userId && task.pendingReviewers.includes(r.role))?.role;
  const actions = [];
  if (assigned && task.status === 'Ready') actions.push('start');
  if (assigned && ['Waiting','Blocked'].includes(task.status)) actions.push('resume');
  if (assigned && working.includes(task.status)) actions.push('hold', ...(task.id===33 ? ['permitSubmitted'] : []));
  if (assigned && [...working,'Review','Approved'].includes(task.status)) actions.push('submit');
  if (reviewRole) actions.push('approve','reject', ...(task.id === 6 ? ['noGo'] : []));
  if (isAdmin && task.status === 'No-Go') actions.push('reconsider');
  if (!actions.length) return null;
  const chosen = actions.includes(action) ? action : '';
  const latest = task.revisions.at(-1);
  const hold = ['hold','permitSubmitted'].includes(chosen);
  const needsReference = chosen === 'permitSubmitted' || (chosen === 'approve' && ['client','municipality'].includes(reviewRole));
  return <form className="space-y-3 border-t pt-3" onSubmit={e=>{
    e.preventDefault(); const f = new FormData(e.currentTarget);
    onCommand({stage:task.id,action:chosen,note:f.get('note'),reference:f.get('reference'),party:f.get('party'),followup:f.get('followup'),evidence:f.getAll('evidence')});
  }}>
    <label className="block text-sm">Task action<select className="block w-full rounded border bg-background p-2" value={chosen} onChange={e=>setAction(e.target.value)} required><option value="">Choose an action</option>{actions.map(a=><option value={a} key={a}>{a === 'approve' && task.id === 6 ? 'Record Go' : actionLabels[a]}</option>)}</select></label>
    {chosen==='submit' && task.evidence.map((label,i)=><label key={label} className="block text-sm">{label}<Input name="evidence" maxLength={300} required defaultValue={(task.id===33 && i===0 ? task.permitSubmission : latest?.evidence[i]) || ''} placeholder="Document link and revision, or record reference" /></label>)}
    {chosen==='hold' && <label className="block text-sm">Waiting on<select name="party" required className="block w-full rounded border bg-background p-2"><option value="">Select a party</option>{parties.map(p=><option key={p}>{p}</option>)}</select></label>}
    {hold && <label className="block text-sm">Follow-up date<Input name="followup" type="date" min={project.today} required defaultValue={task.wait?.followup} /></label>}
    {needsReference && <label className="block text-sm">External record reference<Input name="reference" maxLength={300} required /></label>}
    {chosen && !['start','resume'].includes(chosen) && <label className="block text-sm">{chosen==='submit' && latest ? 'Revision reason and downstream impact' : 'Notes'}<Textarea name="note" maxLength={500} required={chosen!=='submit' || !!latest} /></label>}
    {chosen && <Button disabled={busy}>{busy ? 'Saving…' : chosen==='approve' && task.id===6 ? 'Record Go' : actionLabels[chosen]}</Button>}
  </form>;
}