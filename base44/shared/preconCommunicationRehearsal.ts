import { MasterInputError, masterRun } from './preconMasterEngine.ts';
import { datePlus } from './preconRehearsalGraph.ts';

const taskId = 23;
const project = 'Harbourview Kitchen Renovation';
const contact = 'engineering@example.invalid';
const thread = 'example-thread-2301';
const folder = 'Harbourview / Engineering';
const request = 'Signed structural drawing set with the beam schedule';
const draft = 'Could you send the signed structural drawing set with the beam schedule? We need it to complete technical review.';
const messages = {
  incoming: { id:'example-msg-01', thread, from:contact, subject:'Harbourview Kitchen — structural drawings v1', text:'Please review the attached structural set. The signed beam schedule is still outstanding.', file:1 },
  ambiguous: { id:'example-msg-02', thread:'example-thread-unknown', from:contact, subject:'Drawings and next steps', text:'Can you confirm which drawings to use?' },
  partial: { id:'example-msg-03', thread, from:contact, subject:'Re: Harbourview Kitchen', text:'Thanks, I will send the schedule shortly.' },
  revised: { id:'example-msg-04', thread, from:contact, subject:'Re: Harbourview Kitchen — signed structural drawings v2', text:'The revised signed structural set includes the beam schedule.', file:2, addressesRequest:true },
};
const check = (ok, message) => { if (!ok) throw new MasterInputError(message); };
function seed(at) {
  let run = masterRun('detailed', [], null, at);
  const act = command => { run = masterRun('detailed', run.history, command, at); };
  for (let id = 1; id < taskId; id++) {
    const t = run.tasks[id];
    act({id, actor:t.owner, action:'start'});
    act({id, actor:t.owner, action:'submit', evidence:t.evidence.map((_, i) => `Fixture-${id}-${i}`)});
    for (const actor of t.reviewers) act({id, actor, action:'approve', note:'Fictional prerequisite fixture'});
  }
  return run;
}

export function communicationRehearsal(history, command, now) {
  check(Array.isArray(history) && history.length <= 50 && (!command || history.length < 50), 'Restart the communication rehearsal to continue.');
  let workflow = seed(history[0]?.at || now), processed = {}, documents = [], followUp = null, failure = '', selected = null, previewed = null;
  const audit = [];
  for (const event of [...history, ...(command ? [{ action:command.action, confirmed:command.confirmed === true, at:now }] : [])]) {
    const {action, at} = event || {};
    check(typeof action === 'string' && typeof at === 'string' && Number.isFinite(Date.parse(at)), 'Invalid rehearsal action.');
    const current = documents.at(-1);
    const t = workflow.tasks[taskId];
    const act = (action, actor, extra = {}) => { workflow = masterRun('detailed', workflow.history, { id:taskId, action, actor, ...extra }, at); };
    if (Object.hasOwn(messages, action)) {
      check(!failure.startsWith('Google account disconnected') && !failure.startsWith('Synchronization failed'), 'Restore simulated synchronization before receiving messages.');
      const msg = messages[action];
      if (processed[msg.id]) { audit.push({ at, note:`Duplicate ${msg.id} ignored.` }); continue; }
      check(!['partial','revised'].includes(action) || followUp, 'Confirm the simulated request before receiving a reply.');
      const match = msg.thread === thread && msg.from === contact && (msg.subject.includes('Harbourview') || Object.values(processed).some(p => p.thread === thread && p.project));
      selected = msg.id;
      processed[msg.id] = { ...msg, project:match ? project : null, category:msg.file ? 'Engineering correspondence' : 'Requests for information' };
      if (match && msg.file) documents.push({ version:msg.file, id:'example-drive-structural', name:`Structural drawings v${msg.file}.pdf`, folder, messageId:msg.id, status:'Evidence received' });
      if (msg.addressesRequest && match && followUp?.state === 'Waiting') followUp = { ...followUp, state:'Needs response validation' };
    } else if (action === 'associate') {
      const id = messages.ambiguous.id;
      check(processed[id] && !processed[id].project && event.confirmed === true, 'Confirm the project match first.');
      processed[id].project = project;
    } else if (action === 'restore') {
      check(failure, 'The simulated connection is working.'); failure = '';
    } else if (action === 'preview') {
      check(current && !failure, 'Receive a document and restore access before previewing it.'); previewed = current.version;
    } else if (['permission','disconnect','syncFailure'].includes(action)) {
      failure = {permission:'Drive access denied. The linked document is unchanged.',disconnect:'Google account disconnected. No files or email were fetched.',syncFailure:'Synchronization failed. Existing evidence and follow-ups are unchanged.'}[action];
    } else if (action === 'submit') {
      check(current?.status === 'Evidence received' && previewed === current.version && !failure, 'Open a current document with working access before submitting.');
      if (t.status === 'Ready') act('start','engineer');
      act('submit','engineer',{evidence:[`${current.id} · v${current.version} · ${current.messageId}`],note:'Review new engineering issue; check changes to structural scope.'});
      current.status = 'Submitted for independent review';
    } else if (action === 'review') {
      check(current?.status === 'Submitted for independent review', 'Submit the evidence to the independent reviewer first.');
      current.status = 'Evidence reviewed';
    } else if (action === 'accept') {
      check(current?.status === 'Evidence reviewed', 'Review the evidence before accepting it.');
      current.status = 'Evidence accepted';
    } else if (action === 'approve') {
      check(current?.status === 'Evidence accepted', 'Accept this evidence version before separately approving the task.');
      act('approve','coordinator',{note:`Independent technical review of fictional version ${current.version}`});
      current.status = 'Work approved';
    } else if (action === 'send') {
      check(current && !followUp && !failure && event.confirmed === true, 'Confirm the simulated send; duplicate sends are blocked.');
      processed['example-sent-01'] = {id:'example-sent-01',thread,from:'Coordinator (fictional)',subject:'Re: Harbourview Kitchen',text:draft,project,category:'Request sent'};
      followUp = {state:'Waiting',project,contact,request,sent:at,expected:datePlus(at,3),blocks:'Stage 24 relies on verified Stage 23 output.'};
    } else if (action === 'validate') {
      check(followUp?.state === 'Needs response validation' && event.confirmed === true, 'A relevant reply must be checked before clearing the request.');
      followUp = {...followUp,state:'Response validated'};
    } else throw new MasterInputError('Unknown communication rehearsal action.');
    audit.push({ at, note:action });
  }
  return { history:[...history,...(command ? [{action:command.action,confirmed:command.confirmed === true,at:now}] : [])], project, contact, draft, messages:Object.values(processed), selected, documents:documents.map((item,i) => ({...item,current:i === documents.length-1})), followUp, failure, audit, previewed, task:{id:taskId,status:workflow.tasks[taskId].status,downstream:workflow.tasks[24].status}, attention:documents.at(-1)?.status === 'Evidence received' ? (documents.length > 1 ? 'Revised drawing received: recheck existing approvals and submit the current version.' : 'Review recommendation: submit the structural set to the independent Stage 23 reviewer.') : workflow.tasks[taskId].status === 'Review' ? 'Stage 23 awaits an independent technical decision.' : followUp?.state === 'Response validated' ? 'External response validated; check remaining workflow gates.' : '' };
}