import { Button } from '@/components/ui/button';

export default function PreconRehearsalStatus({ title, rows, tasks, onOpen, empty }) {
  return <section className="min-w-0 border border-border bg-card p-4">
    <h3 className="font-heading font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span></h3>
    {!rows.length && <p className="mt-3 text-sm text-muted-foreground">{empty}</p>}
    {rows.map(task => <div key={task.id} className="mt-3 border-t border-border pt-3">
      <Button variant="link" className="h-auto whitespace-normal p-0 text-left font-semibold" onClick={() => onOpen(task.id)}>{task.title}</Button>
      <p className="mt-1 text-xs text-muted-foreground">{task.status}{task.due ? ` · Due ${task.due}` : ''} · {task.ownerName}</p>
      {!!task.unmet.length && <p className="mt-1 text-xs">Waiting for: {task.unmet.map(id => tasks[id].title).join(', ')}</p>}
      {task.issue && <p className="mt-1 text-xs">{task.issue}</p>}
      {task.status === 'Blocked' && <p className="mt-1 text-xs">Open {task.ageDays} day(s) · {task.downstream.length} downstream · Resolution: {task.resolution}</p>}
      {task.status === 'Revisions Required' && <p className="mt-1 text-xs">Reviewer: {task.feedback}</p>}
    </div>)}
  </section>;
}