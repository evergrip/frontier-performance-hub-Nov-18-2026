import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PreconRehearsalActions from './PreconRehearsalActions';
import { handoff } from './PreconRehearsalFixture';

export default function PreconRehearsalTask({ task, tasks, group, actor, onClose, submit, busy, error }) {
  return <Dialog open={!!task} onOpenChange={open => { if (!open) onClose(); }}>
    {task && <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{task.title}</DialogTitle><DialogDescription>{task.id} · {group} · {task.status}</DialogDescription></DialogHeader>
      <div className="space-y-4 text-sm">
        <p>{task.why}</p>
        <p><strong>Responsible:</strong> {task.ownerName} · <strong>Reviewer:</strong> {task.reviewerName || 'Not required in this rehearsal'}</p>
        <p><strong>Suggested due:</strong> {task.due || 'Set when ready'} · <strong>Duration:</strong> {task.days} calendar day(s)</p>
        <div><h4 className="font-semibold">Inputs</h4><p>{task.inputs.join(' · ')}</p>{task.id === 'SIM-01' && <blockquote className="mt-2 border-l-2 border-primary pl-3">{handoff}</blockquote>}
          {task.deps.map(id => { const item = tasks[id]; const evidence = item.evidence.at(-1); return item.status === 'Completed' && evidence ? <details className="mt-2" key={id}><summary className="cursor-pointer">{item.title} · v{evidence.version}</summary><p className="whitespace-pre-wrap break-words pl-3">{evidence.text}</p></details> : null; })}</div>
        <div><h4 className="font-semibold">What to do</h4><ol className="list-decimal pl-5">{task.instructions.map(item => <li key={item}>{item}</li>)}</ol></div>
        <p><strong>Completion evidence:</strong> {task.requiredOutput}</p>
        {task.quality && <p><strong>Quality check:</strong> {task.quality}</p>}
        <p><strong>Prerequisites:</strong> {task.deps.map(id => `${tasks[id].title} (${tasks[id].status})`).join(', ') || 'None'}</p>
        <p><strong>Downstream:</strong> {task.downstream.map(id => tasks[id].title).join(', ') || 'None'}</p>
        {task.feedback && <p role="status"><strong>Revision instructions:</strong> {task.feedback}</p>}
        <div><h4 className="font-semibold">Evidence history</h4>{!task.evidence.length && <p>No evidence yet.</p>}{task.evidence.map(e => <details key={e.version} className="mt-1"><summary className="cursor-pointer">Version {e.version}{task.approvedVersion === e.version ? ' · Approved' : ''}</summary><p className="whitespace-pre-wrap break-words pl-3">{e.text}</p></details>)}</div>
        {!!task.audit.length && <details><summary className="cursor-pointer font-semibold">Audit history</summary><ul className="mt-2 space-y-1">{task.audit.map((event, index) => <li key={index}>{event.at} · {event.actor} · {event.action}{event.version ? ` · v${event.version}` : ''}{event.note ? ` · ${event.note}` : ''}</li>)}</ul></details>}
        <PreconRehearsalActions key={`${task.id}-${actor}`} task={task} actor={actor} submit={submit} busy={busy} error={error} />
      </div>
    </DialogContent>}
  </Dialog>;
}