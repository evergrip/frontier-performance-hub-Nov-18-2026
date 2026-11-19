import { orderedSteps, datePlus } from './preconRehearsalGraph.ts';
import { stageRows, sections } from './preconMasterStages.ts';
import { roles, gates, rules, forms, decisions, alternatePermit } from './preconMasterPolicy.ts';

export class MasterInputError extends Error {}
const requireRule = (condition, message) => { if (!condition) throw new MasterInputError(message); };
const risks = [6,8,16,18,21,22,23,25,29,30,31,33,34];
const clean = value => typeof value === 'string' ? value.trim() : '';
const title = 'Frontier Pre-Construction Master Workflow v1.0 (Draft)';
const waits = ['Client','Consultant','Subcontractor','Municipality'];
const draftText = (s, max = 400) => clean(s) && clean(s).length <= max;

export function masterTemplate(path) {
  const stages = stageRows.map(([id, name, purpose, output, authority, participants, automation], index) => {
    const [deps, owner, reviewers] = rules[index];
    return { id, name, purpose, evidence: output.split('|'), authority, participants, automation, owner, reviewers,
      deps: path === 'early' && alternatePermit[id] ? alternatePermit[id] : deps, forms: forms[id] || [], gate: gates[id] || '',
      section: [5,8,21,26,30,34].findIndex(n => id <= n), risk: risks.includes(id) ? 'High' : 'Standard' };
  });
  return { title, version: '1.0', status: 'Draft for management validation', source: 'Frontier_Preconstruction_Process_Manual_REBUILT_Functional.docx · April 2026 · management-provided transcription', stages, sections, roles, decisions };
}

export function masterRun(path, history, command, now) {
  requireRule(['detailed','early'].includes(path), 'Select a draft permit sequence.');
  requireRule(Array.isArray(history) && history.length <= 450 && (!command || history.length < 450), 'This rehearsal has reached its history limit. Start a new run.');
  const template = masterTemplate(path);
  const ordered = orderedSteps(template.stages);
  const tasks = Object.fromEntries(ordered.map(s => [s.id, { ...s, status: 'Locked', revisions: [], approvals: {}, due: null, audit: [] }]));
  const reverse = new Map();
  for (const s of ordered.slice().reverse()) reverse.set(s.id, [...new Set(ordered.filter(other => other.deps.includes(s.id)).flatMap(other => [other.id, ...reverse.get(other.id)]))]);
  function derive(at) {
    for (const s of Object.values(tasks)) {
      s.unmet = s.deps.filter(id => tasks[id].status !== 'Verified');
      if (s.status === 'Locked' || s.status === 'Ready') {
        s.status = s.unmet.length ? 'Locked' : 'Ready';
        if (s.status === 'Ready' && !s.due) s.due = datePlus(at, 5);
      }
    }
  }
  function apply(event) {
    const { id, actor, action, at } = event || {};
    const s = Number.isInteger(id) && tasks[id];
    requireRule(s && typeof actor === 'string' && Object.hasOwn(roles, actor) && typeof at === 'string' && Number.isFinite(Date.parse(at)), 'Invalid draft action.');
    requireRule(!s.unmet.length, 'Required prerequisites are not verified.');
    const latest = s.revisions.at(-1);
    const note = clean(event.note);
    const owner = actor === s.owner;
    if (action === 'start') {
      requireRule(owner && s.status === 'Ready', 'Only the assigned role can start ready work.');
      s.status = 'In progress';
    } else if (action === 'hold') {
      requireRule(owner && ['In progress','Revision required','Waiting','Blocked'].includes(s.status) && draftText(note) && (waits.includes(event.party) || event.party === 'Management'), 'Select who must respond and record a follow-up or exception.');
      s.status = event.party === 'Management' ? 'Blocked' : 'Waiting'; s.party = event.party; s.issue = note; s.followup = datePlus(at, 2);
    } else if (action === 'resume') {
      requireRule(owner && ['Waiting','Blocked'].includes(s.status), 'Only the assigned role can resume held work.');
      s.status = 'In progress'; delete s.issue; delete s.party; delete s.followup;
    } else if (action === 'permitSubmitted') {
      requireRule(id === 33 && owner && ['In progress','Waiting','Revision required'].includes(s.status) && draftText(note) && note !== s.permitSubmission, 'Record a new simulated municipal submission reference while the permit is in progress.');
      s.permitSubmission = note; s.status = 'Waiting'; s.party = 'Municipality'; s.issue = 'Submitted; awaiting municipal review and issuance.'; s.followup = datePlus(at, 2);
    } else if (action === 'submit') {
      requireRule(owner && ['In progress','Revision required','Verified','Review','No-Go','Waiting','Blocked'].includes(s.status), 'Only the assigned role can submit or revise evidence after starting.');
      requireRule(Array.isArray(event.evidence) && event.evidence.length === s.evidence.length && event.evidence.every(value => draftText(value)), 'Every deliverable requires a simulated record or document reference (up to 400 characters).');
      const evidence = event.evidence.map(clean);
      const exceptions = event.exceptions ?? [];
      requireRule(Array.isArray(exceptions) && new Set(exceptions).size === exceptions.length && exceptions.every(index => id === 32 && [0,1].includes(index)), 'Only applicable Stage 32 evidence items can be proposed as not applicable.');
      requireRule(id !== 33 || (s.permitSubmission && evidence[0] === s.permitSubmission), 'Record the permit submission first, and include its exact reference and the issued permit reference.');
      requireRule(!latest || JSON.stringify([evidence, exceptions]) !== JSON.stringify([latest.evidence, latest.exceptions]), 'Submit changed evidence or applicability decisions as a new version.');
      requireRule(!latest || draftText(note), 'Describe the reason and downstream impacts of the revision.');
      s.revisions.push({ version: s.revisions.length + 1, actor, at, evidence, exceptions, impact: note });
      s.status = 'Review'; s.approvals = {}; delete s.issue; delete s.party; delete s.followup;
      for (const downstream of reverse.get(id)) {
        const dep = tasks[downstream];
        if (dep.status === 'Locked') continue;
        dep.status = 'Locked'; dep.due = null; dep.approvals = {}; delete dep.issue; delete dep.party; delete dep.followup; delete dep.permitSubmission;
        dep.audit.push({ action: 'Reopened after upstream revision', at, actor, note: `Stage ${id} evidence changed.` });
      }
    } else if (['approve','revise','noGo'].includes(action)) {
      requireRule(s.status === 'Review' && s.reviewersForVersion.includes(actor) && actor !== latest?.actor && !s.approvals[actor] && draftText(note), 'Only a pending independent authority can decide; provide a decision record or evidence reference.');
      requireRule(action !== 'noGo' || id === 6, 'No-Go is reserved for feasibility.');
      s.approvals[actor] = { actor, outcome: action === 'approve' ? (id === 6 ? 'Go' : 'Approved') : action === 'noGo' ? 'No-Go' : 'Revision required', version: latest.version, at, note };
      if (action !== 'approve') { s.status = action === 'noGo' ? 'No-Go' : 'Revision required'; s.issue = note; }
      else if (s.reviewersForVersion.every(role => s.approvals[role]?.version === latest.version)) s.status = 'Verified';
    } else throw new MasterInputError('Unknown draft action.');
    s.reviewersForVersion = [...s.reviewers, ...(s.revisions.at(-1)?.exceptions.length ? ['management'] : [])];
    s.audit.push({ action, actor, at, version: s.revisions.at(-1)?.version, note, ...(action === 'hold' ? { party: event.party } : {}) });
    derive(at);
  }
  derive(history[0]?.at && Number.isFinite(Date.parse(history[0].at)) ? history[0].at : now);
  for (const event of history) apply(event);
  if (command) {
    const {id, actor, action, note, evidence, exceptions, party} = command;
    const event = {id, actor, action, note, evidence, exceptions, party, at: now};
    apply(event);
    history = [...history, event];
  }
  const all = Object.values(tasks);
  const today = now.slice(0,10);
  const queue = all.filter(s => (s.owner === 'coordinator' && ['Ready','In progress','Revision required'].includes(s.status)) || (s.status === 'Review' && s.reviewersForVersion.includes('coordinator') && !s.approvals.coordinator));
  queue.sort((a,b) => Number(b.due < today) - Number(a.due < today) || Number(b.status === 'Revision required') - Number(a.status === 'Revision required') || reverse.get(b.id).length - reverse.get(a.id).length || Number(b.risk === 'High') - Number(a.risk === 'High') || a.due.localeCompare(b.due));
  const required = all.filter(s => s.gate);
  return { history, tasks, queue: queue.map(s => s.id), waits, readiness: required.every(s => s.status === 'Verified'), gatesVerified: required.filter(s => s.status === 'Verified').length };
}