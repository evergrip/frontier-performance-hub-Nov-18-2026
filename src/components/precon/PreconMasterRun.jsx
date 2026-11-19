import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PreconMasterTaskForm from './PreconMasterTaskForm';

export default function PreconMasterRun({ run, template, send, pending, error, resetError }) {
  const [actor, setActor] = useState('sales');
  const [id, setId] = useState(null);
  const { tasks, queue, waits, readiness, gatesVerified } = run;
  const task = tasks[id];
  const all = Object.values(tasks);
  const roles = template.roles;
  const open = next => { resetError(); setId(next); };
  const isDue = date => date && date <= new Date().toISOString().slice(0,10);
  const row = t => <button type="button" key={t.id} className="block w-full border-t px-2 py-2 text-left text-sm hover:bg-accent/20" onClick={() => open(t.id)}><strong>{t.id}. {t.name}</strong><span className="block text-xs text-muted-foreground">{t.status}{t.party ? ` · ${t.party}` : ''}{t.followup ? ` · Follow-up ${t.followup}${isDue(t.followup) ? ' (due)' : ''}` : t.due && t.status !== 'Verified' ? ` · Target ${t.due}` : ''}{t.unmet.length ? ` · Waiting on stages ${t.unmet.join(', ')}` : ''}</span></button>;
  const work = all.filter(t => t.owner === actor && ['Ready','In progress','Revision required'].includes(t.status) || t.status === 'Review' && t.reviewersForVersion.includes(actor) && !t.approvals[actor]);
  const held = all.filter(t => ['Waiting','Blocked','No-Go'].includes(t.status)).sort((a,b) => Number(b.status !== 'Waiting') - Number(a.status !== 'Waiting') || (a.followup || '').localeCompare(b.followup || ''));
  return <div className="space-y-4">
    <p className="text-sm" role="status"><strong>{readiness ? 'Rehearsal ready' : 'Not ready'}</strong> · {gatesVerified} of 13 critical gates verified. This does not change construction conversion.</p>
    <label className="block text-sm">Simulate as<select disabled={pending} className="mt-1 block rounded border bg-background p-2" value={actor} onChange={e => { resetError(); setActor(e.target.value); }}>{Object.entries(roles).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <section><h3 className="mb-2 font-semibold">Work for this role</h3>{work.length ? work.map(row) : <p className="text-sm">No open work for this role.</p>}</section>
      <section><h3 className="mb-2 font-semibold">Michael’s priority queue</h3>{queue.length ? queue.map(key => row(tasks[key])) : <p className="text-sm">No actionable work in Michael’s queue.</p>}</section>
      <section><h3 className="mb-2 font-semibold">Waiting on external responses</h3>{held.some(t => t.status === 'Waiting') ? held.filter(t => t.status === 'Waiting').map(row) : <p className="text-sm">No external responses pending.</p>}</section>
      <section><h3 className="mb-2 font-semibold">Management exceptions</h3>{held.some(t => t.status !== 'Waiting') ? held.filter(t => t.status !== 'Waiting').map(row) : <p className="text-sm">No escalated exceptions.</p>}</section>
    </div>
    <details><summary className="mb-2 cursor-pointer font-semibold">All stage statuses</summary>{all.map(row)}</details>
    <Dialog open={!!task} onOpenChange={value => { if (!value && !pending) open(null); }}>
      {task && <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{task.id}. {task.name}</DialogTitle><DialogDescription>{task.status} · {roles[task.owner]} · {task.authority}</DialogDescription></DialogHeader>
        <div className="space-y-2 text-sm"><p>{task.automation}</p><p><strong>Prerequisites:</strong> {task.deps.join(', ') || 'None'}{task.unmet.length > 0 && ` · Not verified: ${task.unmet.join(', ')}`}</p>
        <p><strong>Authorities:</strong> {(task.reviewersForVersion || task.reviewers).map(role => `${roles[role]}${task.approvals[role] ? ` (${task.approvals[role].outcome}, v${task.approvals[role].version})` : ''}`).join(', ')}</p>
        {task.permitSubmission && <p><strong>Municipal submission:</strong> {task.permitSubmission} · {task.status === 'Verified' ? 'Permit issuance verified' : 'Issuance not verified'}</p>}
        {task.issue && <p><strong>Outstanding:</strong> {task.issue}</p>}
        <details><summary className="cursor-pointer font-semibold">Evidence revisions and decision history</summary>{task.revisions.map(v => <div className="my-2 border-b pb-2" key={v.version}><strong>v{v.version} · {roles[v.actor]} · {v.at}</strong><ul className="list-disc pl-4">{v.evidence.map((entry, i) => <li className="break-words" key={i}>{task.evidence[i]}: {entry}{v.exceptions.includes(i) && ' (exception proposed)'}</li>)}</ul>{v.impact && <p>Revision impact: {v.impact}</p>}</div>)}{task.audit.map((e,i) => <p className="break-words" key={i}>{e.at} · {roles[e.actor]} · {e.action}{e.version ? ` · v${e.version}` : ''}{e.party ? ` · ${e.party}` : ''}{e.note ? ` · ${e.note}` : ''}</p>)}{!task.audit.length && <p>No actions recorded.</p>}</details></div>
        <PreconMasterTaskForm key={`${task.id}-${actor}-${task.audit.length}`} task={task} actor={actor} waits={waits} send={send} pending={pending} error={error} />
      </DialogContent>}
    </Dialog>
  </div>;
}