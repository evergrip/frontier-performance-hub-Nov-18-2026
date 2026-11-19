import { actors, groups, project, steps } from './preconRehearsalTemplate.ts';
import { orderedSteps, derive, cleared, waiting } from './preconRehearsalGraph.ts';
import { available, applyAction, RehearsalError } from './preconRehearsalActions.ts';

const validType = ['renovation', 'addition', 'garage_conversion', 'custom_home'];
const stepOrder = () => orderedSteps(steps);
const daysSince = (at, now) => at ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(at)) / 86400000)) : 0;

export function rehearsal(history, command, now) {
  if (!Array.isArray(history) || history.length > 120) throw new RehearsalError('Invalid rehearsal history.');
  let instance = null;
  const tasks = {};
  function run(event) {
    if (!event || !Object.hasOwn(actors, event.actor) || !Number.isFinite(Date.parse(event.at)) || typeof event.at !== 'string') throw new RehearsalError('Invalid rehearsal action.');
    if (event.action === 'activate') {
      if (event.actor !== 'chris') throw new RehearsalError('Only the management role can activate the rehearsal.');
      if (instance) return false;
      if (!validType.includes(event.type)) throw new RehearsalError('Select a supported project type.');
      instance = { ...project, type: event.type, startedAt: event.at, startedBy: event.actor };
      for (const step of stepOrder()) {
        const applicable = !step.types || step.types.includes(instance.type);
        tasks[step.id] = { ...step, applicable, status: applicable ? 'Not Started' : 'Not Applicable', evidence: [], audit: applicable ? [] : [{ action: 'excluded_by_fixture_rule', actor: 'template', at: event.at, note: 'This step does not apply to the selected project type.' }], touchedAt: event.at };
      }
      derive(tasks, event.at);
      return true;
    }
    const task = typeof event.id === 'string' && Object.hasOwn(tasks, event.id) && tasks[event.id];
    if (!task) throw new RehearsalError('Activate the rehearsal and select a task.');
    applyAction(task, tasks, event);
    derive(tasks, event.at);
    return true;
  }
  history.forEach(run);
  if (command) {
    if (history.length >= 120) throw new RehearsalError('This rehearsal is full. Reset to start a new run.');
    const { action, actor, id, reason, evidence, resolution, type } = command;
    const event = { action, actor, id, reason, evidence, resolution, type, at: now };
    if (run(event)) history = [...history, event];
  }
  const all = Object.values(tasks);
  const maxRemaining = Math.max(0, ...all.map(task => task.remainingDays));
  const longest = new Set();
  function trace(task) {
    if (!task.remainingDays || longest.has(task.id)) return;
    longest.add(task.id);
    const next = all.filter(other => other.deps.includes(task.id));
    const maxNext = Math.max(0, ...next.map(other => other.remainingDays));
    next.filter(other => other.remainingDays === maxNext).forEach(trace);
  }
  all.filter(task => task.remainingDays === maxRemaining).forEach(trace);
  for (const task of all) {
    task.ownerName = actors[task.owner]; task.reviewerName = actors[task.reviewer] || '';
    task.actions = Object.fromEntries(Object.keys(actors).map(actor => [actor, available(task, actor)]));
    task.ageDays = daysSince(task.issueAt, now); task.inactiveDays = daysSince(task.touchedAt, now);
    task.onLongestPath = longest.has(task.id) && !cleared(task);
  }
  const today = now.slice(0, 10);
  const queue = all.filter(t => t.owner === 'michael' && ['Ready to Begin', 'In Progress', 'Revisions Required', 'Approved'].includes(t.status))
    .sort((a, b) => Number(b.due < today) - Number(a.due < today) || Number(b.status === 'Revisions Required') - Number(a.status === 'Revisions Required') || Number(b.onLongestPath) - Number(a.onLongestPath) || (a.due || '').localeCompare(b.due || '') || b.risk - a.risk || b.downstream.length - a.downstream.length || b.inactiveDays - a.inactiveDays);
  return { history, instance, tasks, actors, groups, queue: queue.map(t => t.id), external: all.filter(t => waiting.includes(t.status)).map(t => t.id), reviews: all.filter(t => t.status === 'Submitted for Review').map(t => t.id), blockers: all.filter(t => t.status === 'Blocked' || (t.applicable && t.unmet.length && !cleared(t))).map(t => t.id), milestones: all.filter(t => t.applicable && !cleared(t) && t.due).sort((a, b) => a.due.localeCompare(b.due)).map(t => t.id), progress: { total: all.filter(t => t.applicable).length, verified: all.filter(t => t.status === 'Completed').length, exceptions: all.filter(t => t.applicable && t.status === 'Not Applicable').length, ready: !!instance && all.every(cleared) } };
}