import { datePlus, orderedSteps } from './preconRehearsalGraph.ts';
import { requireWorkflow, waitingParties } from './preconOperationalPolicy.ts';

const text = (x, max = 500) => typeof x === 'string' && x.trim() && x.trim().length <= max ? x.trim() : '';
const editable = ['In progress','Revision required','Waiting','Blocked','Review','Approved'];
const external = ['client','municipality'];
const validDate = x => typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
// References, not file uploads: pin a document revision or attributable external record.
const reference = x => !!text(x, 300) && (!/^[a-z][\w+.-]*:/i.test(x.trim()) || /^https:\/\//i.test(x.trim()));

export function workflowView(state, now, input = null, actor = null) {
  const order = orderedSteps(state.template.stages);
  const tasks = Object.fromEntries(order.map(s => [s.id, {...s, ownerId:state.assignments[s.owner], status:'Locked', approvals:{}, revisions:[], audit:[], due:null, dependents:order.filter(n => n.deps.includes(s.id)).map(n => n.id)}]));
  const affected = new Map();
  for (const s of [...order].reverse()) affected.set(s.id, [...new Set(tasks[s.id].dependents.flatMap(id => [id, ...affected.get(id)]))]);
  const derive = at => {
    for (const s of order) {
      const task = tasks[s.id];
      task.unmet = s.deps.filter(id => tasks[id].status !== 'Approved');
      if (task.status === 'Locked' && !task.unmet.length) { task.status = 'Ready'; task.due = datePlus(at,state.days); }
      task.pendingReviewers = task.status === 'Review' ? s.reviewers.filter(role => !task.approvals[role]) : [];
      task.reviewersAssigned = s.reviewers.map(role => ({role, userId:state.assignments[role]}));
    }
  };
  const apply = (command, user, at) => {
    const t = Number.isInteger(command.stage) && tasks[command.stage];
    requireWorkflow(t && !t.unmet.length, 'This stage is locked by unapproved prerequisites.', 409);
    const { action } = command;
    const note = text(command.note);
    const event: any = { stage:t.id, action, actor:user.id, at, ...(note ? {note} : {}) };
    const latest = t.revisions.at(-1);
    const owner = t.ownerId === user.id;
    if (action === 'start' || action === 'resume') {
      requireWorkflow(owner, 'Only the assigned owner can change this task.', 403);
      requireWorkflow(action === 'start' ? t.status === 'Ready' : ['Waiting','Blocked'].includes(t.status), 'This action is not available for the current task state.', 409);
      t.status = 'In progress'; t.wait = null;
    } else if (action === 'hold' || action === 'permitSubmitted') {
      requireWorkflow(owner, 'Only the assigned owner can put this task on hold.', 403);
      requireWorkflow(['In progress','Waiting','Blocked','Revision required'].includes(t.status), 'Start this task before putting it on hold.', 409);
      requireWorkflow(validDate(command.followup) && command.followup >= at.slice(0,10), 'Enter a follow-up date on or after today.');
      event.party = action === 'permitSubmitted' ? 'Municipality' : command.party;
      event.followup = command.followup;
      requireWorkflow(note && waitingParties.includes(event.party), 'Record who is holding up the task and why.');
      if (action === 'permitSubmitted') {
        requireWorkflow(t.id === 33 && reference(command.reference), 'Record the municipal submission reference at Stage 33.');
        event.reference = command.reference.trim(); t.permitSubmission = event.reference;
      }
      t.status = event.party === 'Internal blocker' ? 'Blocked' : 'Waiting';
      t.wait = { party:event.party, followup:event.followup, note };
    } else if (action === 'submit') {
      requireWorkflow(owner, 'Only the assigned owner can submit evidence.', 403);
      requireWorkflow(editable.includes(t.status), 'Start the task (or obtain reconsideration of a No-Go) before submitting evidence.', 409);
      requireWorkflow(Array.isArray(command.evidence) && command.evidence.length === t.evidence.length && command.evidence.every(reference), 'Provide a document revision or reference for every required item.');
      const evidence = command.evidence.map(x => x.trim());
      requireWorkflow(t.id !== 33 || (t.permitSubmission && evidence[0] === t.permitSubmission && evidence[1] !== evidence[0]), 'Record the submission first, then provide a separate issued permit reference.');
      requireWorkflow(!latest || (note && JSON.stringify(evidence) !== JSON.stringify(latest.evidence)) || (note && t.needsRevalidation), 'A revision needs changed evidence and an impact note, or a revalidation note after an upstream change.');
      event.evidence = evidence; event.version = t.revisions.length + 1;
      t.revisions.push(event); t.approvals = {}; t.status = 'Review'; t.wait = null; t.issue = null; t.needsRevalidation = false;
      for (const id of affected.get(t.id)) {
        const dep = tasks[id];
        if (dep.status === 'Locked') continue;
        dep.status = 'Locked'; dep.due = null; dep.wait = null; dep.approvals = {}; dep.permitSubmission = null; dep.needsRevalidation = !!dep.revisions.length;
        dep.issue = `Stage ${t.id} changed. Revalidate this stage after prerequisites are approved.`;
        dep.audit.push({action:'Reopened after upstream revision',at,actor:user.id,note:dep.issue});
      }
    } else if (['approve','reject','noGo'].includes(action)) {
      const role = t.reviewers.find(key => state.assignments[key] === user.id);
      requireWorkflow(role && !owner && latest?.actor !== user.id, 'Only an assigned independent reviewer can decide.', 403);
      requireWorkflow(t.status === 'Review' && latest && !t.approvals[role], 'There is no pending review for this account.', 409);
      requireWorkflow(note && (action !== 'noGo' || t.id === 6), 'Record the decision and use No-Go only for feasibility.');
      if (external.includes(role) && action === 'approve') requireWorkflow(reference(command.reference), 'Provide an attributable client or municipal approval reference.');
      if (reference(command.reference)) event.reference = command.reference.trim();
      event.role = role; event.version = latest.version;
      t.approvals[role] = event;
      if (action !== 'approve') { t.status = action === 'noGo' ? 'No-Go' : 'Revision required'; t.issue = note; }
      else if (t.reviewers.every(key => t.approvals[key]?.action === 'approve')) t.status = 'Approved';
    } else if (action === 'reconsider') {
      requireWorkflow(user.role === 'admin', 'Only an app admin can record authorized reconsideration.', 403);
      requireWorkflow(t.id === 6 && t.status === 'No-Go' && note, 'Record why management reopened the feasibility decision; all evidence and review requirements still apply.');
      event.management = true; t.status = 'Revision required'; t.issue = note;
    } else requireWorkflow(false,'Unknown workflow action.',400);
    t.audit.push(event);
    derive(at);
    return event;
  };
  derive(state.activatedAt);
  for (const event of state.events) apply(event, {id:event.actor, role:event.management ? 'admin' : 'user'}, event.at);
  const event = input ? apply(input,actor,now) : null;
  const list = Object.values(tasks).sort((a,b) => a.id-b.id);
  return { tasks:list, event, completed:list.every(t => t.status === 'Approved'), today:now.slice(0,10) };
}