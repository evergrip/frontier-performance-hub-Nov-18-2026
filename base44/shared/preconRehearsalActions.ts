import { cleared, waiting, workStates } from './preconRehearsalGraph.ts';

export class RehearsalError extends Error {}
function requireRule(ok, message) { if (!ok) throw new RehearsalError(message); }
const text = value => typeof value === 'string' ? value.trim() : '';
const version = task => task.evidence.at(-1);

export function available(task, actor) {
  const actions = [];
  if (!task.applicable) return actions;
  if (task.owner === actor && !task.unmet.length) {
    if (task.status === 'Ready to Begin') actions.push('start');
    if (waiting.includes(task.status) || task.status === 'Blocked') actions.push('resume');
    if (['In Progress', 'Revisions Required'].includes(task.status)) actions.push('evidence', task.reviewer ? 'submit' : 'complete', 'waitClient', 'waitConsultant', 'block');
    if (task.status === 'Approved') actions.push('complete');
    if (['Submitted for Review', 'Approved', 'Completed'].includes(task.status)) actions.push('evidence');
  }
  if (task.status === 'Submitted for Review' && !task.unmet.length && task.reviewer === actor && task.owner !== actor && version(task)?.author !== actor) actions.push('approve', 'reject');
  if (actor === 'chris' && task.owner !== actor && !cleared(task)) actions.push('exception');
  return actions;
}

export function applyAction(task, tasks, { action, actor, reason, evidence, resolution, at }) {
  requireRule(available(task, actor).includes(action), 'This action is not allowed for this role or task state.');
  const note = text(reason), document = text(evidence), plan = text(resolution);
  const current = version(task);
  if (action === 'start' || action === 'resume') {
    task.status = 'In Progress'; task.issue = ''; task.resolution = ''; task.issueAt = null;
  } else if (action === 'evidence') {
    requireRule(document && document.length <= 3000 && document !== current?.text, 'Provide a new, distinct evidence revision (up to 3,000 characters).');
    const invalidate = cleared(task) || task.status === 'Approved';
    task.evidence.push({ version: task.evidence.length + 1, author: actor, at, text: document });
    task.approvedVersion = null; task.submittedVersion = null; task.status = 'In Progress'; task.needsEvidence = false;
    if (invalidate) for (const id of task.downstream) {
      const dep = tasks[id];
      if (!dep.applicable || dep.status === 'Not Applicable' || dep.status === 'Not Started') continue;
      dep.status = 'Not Started'; dep.needsEvidence = true; dep.approvedVersion = null; dep.submittedVersion = null; dep.due = null;
      dep.issue = ''; dep.resolution = ''; dep.issueAt = null;
      dep.audit.push({ action: 'invalidated', actor, at, note: `Upstream evidence changed on ${task.id}.` }); dep.touchedAt = at;
    }
  } else if (action === 'submit') {
    requireRule(current && !task.needsEvidence, 'Save a current evidence version before submitting for review.');
    task.submittedVersion = current.version; task.status = 'Submitted for Review';
  } else if (action === 'approve' || action === 'reject') {
    requireRule(current && current.version === task.submittedVersion && !task.needsEvidence, 'The submitted evidence is no longer current.');
    if (action === 'reject') {
      requireRule(note && note.length <= 1000, 'Enter revision instructions.');
      task.feedback = note; task.needsEvidence = true; task.submittedVersion = null; task.status = 'Revisions Required';
    } else {
      task.approvedVersion = current.version; task.status = 'Approved'; task.feedback = '';
    }
  } else if (action === 'complete') {
    requireRule(current && !task.needsEvidence, 'Save a current evidence version before completing this task.');
    requireRule(!task.reviewer || task.approvedVersion === current.version, 'Independent approval of the current evidence is required.');
    task.status = 'Completed';
  } else if (action === 'exception') {
    requireRule(note && note.length <= 1000, 'A management exception requires a reason.');
    task.status = 'Not Applicable'; task.issue = ''; task.issueAt = null; task.resolution = '';
    task.approvedVersion = null; task.submittedVersion = null;
  } else {
    requireRule(workStates.includes(task.status) && note && note.length <= 1000, 'Describe what is preventing progress.');
    if (action === 'block') requireRule(plan && plan.length <= 1000, 'Enter a proposed resolution.');
    task.status = action === 'block' ? 'Blocked' : action === 'waitClient' ? waiting[0] : waiting[1];
    task.issue = note; task.resolution = action === 'block' ? plan : ''; task.issueAt = at;
  }
  task.touchedAt = at;
  task.audit.push({ action, actor, at, version: version(task)?.version, ...(note && action !== 'evidence' && note.length <= 1000 ? { note } : {}), ...(action === 'block' ? { resolution: plan } : {}) });
}