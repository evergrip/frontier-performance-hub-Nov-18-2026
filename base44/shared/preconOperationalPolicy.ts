import { masterTemplate } from './preconMasterEngine.ts';
import { orderedSteps } from './preconRehearsalGraph.ts';

// Both controls must be explicitly configured for a controlled Sale. No production template is available.
export const PRECON_OPERATIONAL_ENABLED = false;
export const PRECON_CONTROLLED_SALES = new Set<string>();
export const PRECON_TEST_ACCOUNTS = new Set<string>();
export const waitingParties = ['Client','Designer','Engineer','Municipality','Subcontractor','Internal blocker'];
export class PreconWorkflowError extends Error {
  status: number;
  constructor(message, status = 422) { super(message); this.status = status; }
}
export function requireWorkflow(condition, message, status = 422) {
  if (!condition) throw new PreconWorkflowError(message, status);
}
export function pilotTemplate(path) {
  requireWorkflow(['detailed','early'].includes(path), 'Choose a controlled permit sequence. This does not approve production policy.');
  const draft = masterTemplate(path);
  orderedSteps(draft.stages);
  const stageRoles = [...new Set(draft.stages.flatMap(s => [s.owner, ...s.reviewers]))].sort();
  return { ...draft, roles:{...draft.roles,coordinator:'Pre-Construction Coordinator'}, path, version:`frontier-34-controlled-1-${path}`, stageRoles, title:'Frontier 34-stage controlled workflow' };
}
export function initialWorkflow(template, assignments, days, actor, at) {
  requireWorkflow(Number.isInteger(days) && days >= 1 && days <= 60, 'Enter a controlled target of 1 to 60 days after a task becomes ready.');
  requireWorkflow(assignments && template.stageRoles.every(role => typeof assignments[role] === 'string' && assignments[role]), 'Assign a named user to every required role.');
  for (const task of template.stages) {
    const users = [task.owner, ...task.reviewers].map(role => assignments[role]);
    requireWorkflow(new Set(users).size === users.length, `Stage ${task.id} requires a different account for each owner and reviewer.`);
  }
  return { template, assignments:Object.fromEntries(template.stageRoles.map(role => [role, assignments[role]])), days, activatedBy:actor, activatedAt:at, events:[] };
}