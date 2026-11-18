import PreconRehearsalStatus from './PreconRehearsalStatus';

export default function PreconRehearsalBoard({ state, onOpen }) {
  const { tasks, groups, progress } = state;
  const rows = ids => ids.map(id => tasks[id]);
  const all = Object.values(tasks);
  return <div className="space-y-4">
    <div className="border border-border bg-card p-4" role="status"><h3 className="font-heading font-semibold">Management readiness</h3><p className="mt-1 text-sm">{progress.verified} of {progress.total} applicable tasks completed · {progress.exceptions} authorized exceptions · {progress.ready ? 'Rehearsal ready' : 'Not ready'}</p><p className="mt-1 text-xs text-muted-foreground">Readiness here does not control construction conversion.</p></div>
    <section className="border border-border bg-card p-4"><h3 className="font-heading font-semibold">Michael’s Priority Queue</h3>
      {!state.queue.length && <p className="mt-2 text-sm text-muted-foreground">No actionable tasks for Michael. Check reviews, blockers and external responses below.</p>}
      {rows(state.queue).map((task, i) => <button type="button" key={task.id} onClick={() => onOpen(task.id)} className="block w-full border-t border-border py-3 text-left hover:bg-accent/20 first:mt-2"><span className="font-semibold">{i + 1}. {task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.status} · Due {task.due} · Risk {['', 'low', 'medium', 'high'][task.risk]} · {task.downstream.length} downstream · {task.inactiveDays} day(s) inactive{task.onLongestPath ? ' · Longest remaining dependency path' : ''}</span></button>)}
    </section>
    <div className="grid gap-4 sm:grid-cols-2">
      <PreconRehearsalStatus title="Awaiting External Responses" rows={rows(state.external)} tasks={tasks} onOpen={onOpen} empty="No responses manually marked as pending." />
      <PreconRehearsalStatus title="Approvals and Quality Reviews" rows={rows(state.reviews)} tasks={tasks} onOpen={onOpen} empty="No submitted evidence awaiting a reviewer." />
      <PreconRehearsalStatus title="Blocked Work" rows={rows(state.blockers)} tasks={tasks} onOpen={onOpen} empty="No blocked or dependency-held work." />
      <PreconRehearsalStatus title="Upcoming Milestones" rows={rows(state.milestones)} tasks={tasks} onOpen={onOpen} empty="No open tasks with suggested deadlines." />
    </div>
    <details className="border border-border bg-card p-4"><summary className="cursor-pointer font-semibold">All rehearsal tasks by operating group</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{groups.map((group, index) => <PreconRehearsalStatus key={group} title={group} rows={all.filter(task => task.group === index)} tasks={tasks} onOpen={onOpen} empty="No tasks." />)}</div></details>
  </div>;
}