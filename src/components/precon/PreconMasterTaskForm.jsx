import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const labels = {start:'Start work', submit:'Submit evidence for review', hold:'Record wait or exception', resume:'Resume work', permitSubmitted:'Record permit submission', approve:'Record approval', revise:'Request revision', noGo:'Record No-Go'};
export default function PreconMasterTaskForm({ task, actor, waits, send, pending, error }) {
  const latest = task.revisions.at(-1);
  const [selected, setSelected] = useState('');
  const [evidence, setEvidence] = useState(latest?.evidence || task.evidence.map(() => ''));
  const [exceptions, setExceptions] = useState(latest?.exceptions || []);
  const [party, setParty] = useState('Client');
  const [note, setNote] = useState('');
  const own = task.owner === actor, status = task.status;
  const actions = task.unmet.length ? [] : [
    ...(own && status === 'Ready' ? ['start'] : []),
    ...(own && ['In progress','Revision required','Verified','Review','No-Go','Waiting','Blocked'].includes(status) && (task.id !== 33 || task.permitSubmission) ? ['submit'] : []),
    ...(own && ['In progress','Revision required','Waiting','Blocked'].includes(status) ? ['hold'] : []),
    ...(own && ['Waiting','Blocked'].includes(status) ? ['resume'] : []),
    ...(own && task.id === 33 && ['In progress','Waiting','Revision required'].includes(status) ? ['permitSubmitted'] : []),
    ...(status === 'Review' && task.reviewersForVersion.includes(actor) && latest.actor !== actor && !task.approvals[actor] ? ['approve','revise',...(task.id === 6 ? ['noGo'] : [])] : []),
  ];
  const action = actions.includes(selected) ? selected : actions[0];
  if (!action) return <p className="text-sm">No action available for this role in the current state.</p>;
  const needsNote = !['start','resume','submit'].includes(action) || !!latest && action === 'submit';
  const noteLabel = action === 'submit' ? 'Revision reason and impact' : action === 'hold' ? 'What is outstanding, and what follow-up is needed?' : action === 'permitSubmitted' ? 'Municipal submission reference' : 'Decision evidence or instructions';
  return <form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); send({ id: task.id, actor, action, ...(needsNote ? { note } : {}), ...(action === 'submit' ? { evidence: evidence.map((value, i) => task.id === 33 && i === 0 ? task.permitSubmission : value), exceptions } : {}), ...(action === 'hold' ? { party } : {}) }); }}>
    <label className="block text-sm">Action<select className="mt-1 block rounded border bg-background p-2" value={action} onChange={e => { setSelected(e.target.value); setNote(''); }}>{actions.map(key => <option key={key} value={key}>{key === 'approve' && task.id === 6 ? 'Record Go' : labels[key]}</option>)}</select></label>
    {action === 'submit' && <div className="space-y-3">{task.evidence.map((item, i) => <div key={item}><label className="block text-sm">{item}{exceptions.includes(i) ? ' · Exception rationale' : ' · Example reference'}<Input className="mt-1" value={task.id === 33 && i === 0 ? task.permitSubmission || '' : evidence[i]} readOnly={task.id === 33 && i === 0} required maxLength={400} onChange={e => setEvidence(prev => prev.map((value, n) => n === i ? e.target.value : value))} /></label>{task.id === 32 && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={exceptions.includes(i)} onChange={e => setExceptions(prev => e.target.checked ? [...prev, i] : prev.filter(n => n !== i))} /> Propose not applicable; requires Management approval</label>}</div>)}</div>}
    {action === 'hold' && <label className="block text-sm">Waiting on<select className="ml-2 rounded border bg-background p-2" value={party} onChange={e => setParty(e.target.value)}>{[...waits,'Management'].map(p => <option key={p}>{p}</option>)}</select></label>}
    {needsNote && <label className="block text-sm">{noteLabel}<Textarea className="mt-1" required maxLength={400} value={note} onChange={e => setNote(e.target.value)} /></label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={pending}>{pending ? 'Recording…' : 'Record action'}</Button>
  </form>;
}