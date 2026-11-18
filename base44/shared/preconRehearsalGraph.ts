export function orderedSteps(steps) {
  const byId = new Map(steps.map(step => [step.id, step]));
  if (byId.size !== steps.length) throw new Error('Duplicate step ID.');
  const visiting = new Set(), visited = new Set(), ordered = [];
  function visit(id) {
    if (visiting.has(id)) throw new Error('Circular dependency.');
    if (visited.has(id)) return;
    if (!byId.has(id)) throw new Error('Unknown prerequisite.');
    visiting.add(id);
    byId.get(id).deps.forEach(visit);
    visiting.delete(id); visited.add(id); ordered.push(byId.get(id));
  }
  steps.forEach(step => visit(step.id));
  return ordered;
}

export const cleared = task => task.status === 'Completed' || task.status === 'Not Applicable';
export const datePlus = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
export const waiting = ['Waiting on Client', 'Waiting on Consultant/Subcontractor'];
export const workStates = ['In Progress', 'Revisions Required', ...waiting, 'Blocked'];

export function derive(tasks, date) {
  const order = orderedSteps(Object.values(tasks));
  for (const task of order) {
    const prereqs = task.deps.map(id => tasks[id]);
    task.unmet = prereqs.filter(dep => !cleared(dep)).map(dep => dep.id);
    if (task.applicable && ['Not Started', 'Ready to Begin'].includes(task.status)) {
      task.status = task.unmet.length ? 'Not Started' : 'Ready to Begin';
      if (!task.unmet.length && !task.due) task.due = datePlus(date, task.days);
    }
  }
  for (const task of order.slice().reverse()) {
    const next = order.filter(other => other.deps.includes(task.id));
    task.downstream = [...new Set(next.flatMap(other => [...(other.applicable ? [other.id] : []), ...other.downstream]))];
    task.remainingDays = (task.applicable && !cleared(task) ? task.days : 0) + Math.max(0, ...next.map(other => other.remainingDays));
  }
}