import { assertEmailShare, canViewShare, createEmailShare, openSharedAttachment, revokeEmailShare } from './preconEmailSharePolicy.ts';

const people = { michael:'Michael', karen:'Karen', reviewer:'Project reviewer', admin:'Administrator (not on project team)' };
const projects = [
  {id:'harbourview', name:'Harbourview Kitchen', team:['michael','karen','reviewer']},
  {id:'oak', name:'Oak Street Addition', team:['michael','reviewer']},
];
const fixture = (owner, id, thread, subject, body, projectHint, attachments = [], date = '2026-11-18T14:00:00Z') => ({owner,id,thread,from:'engineering@example.invalid',to:[`${owner}@example.invalid`],cc:[],date,subject,body,projectHint,attachments});
const initial = [
  fixture('michael','m-01','t-01','Harbourview — engineering update','Structural drawings are ready for review.', 'harbourview',[{id:'a-01',name:'Structural notes.txt',text:'Fictional structural package. Beam schedule is for independent review.'}]),
  fixture('michael','m-02','t-01','Re: Harbourview — engineering update','Please confirm receipt by Friday.', 'harbourview'),
  fixture('karen','k-01','t-02','Harbourview — consultant notes','Please review the consultant’s revised schedule.', 'harbourview',[{id:'a-02',name:'Consultant notes.txt',text:'Fictional consultant notes. This file is only available if selected.'}]),
  fixture('michael','m-03','t-03','Personal appointment','Fictional personal message. Not shared.', null),
  fixture('karen','k-02','t-04','Personal reminder','Fictional private reminder. Not shared.', null),
];
const future = fixture('michael','m-04','t-01','Re: Harbourview — later reply','This reply arrived after sharing. It remains private.', 'harbourview', [], '2026-11-19T16:00:00Z');
const findProject = id => projects.find(p => p.id === id);
const validActor = id => typeof id === 'string' && Object.hasOwn(people,id);
const metadata = ({attachments,...message}) => ({...message, attachments:attachments.map(({id,name}) => ({id,name}))});
const options = ['connect','disconnect','laterReply','share','revoke'];

// Admin-only role-play uses fictional data exclusively. Browser replay is not durable storage or authentication.
export function emailSharePreview(input, now) {
  const { actor, history = [], command } = input;
  assertEmailShare(validActor(actor) && Array.isArray(history) && history.length <= 100, 'Invalid preview session.');
  const connected = new Set(['michael','karen']);
  const mail = [...initial], shares = [];
  let attachment = null;
  const replay = (event, index) => {
    const {actor:who, action, at} = event || {};
    assertEmailShare(validActor(who) && options.includes(action) && typeof at === 'string' && Number.isFinite(Date.parse(at)), 'Invalid preview action.');
    if (action === 'connect') connected.add(who);
    if (action === 'disconnect') connected.delete(who);
    if (action === 'laterReply') {
      assertEmailShare(who === 'michael' && connected.has(who) && !mail.some(m => m.id === future.id));
      mail.push(future);
    }
    if (action === 'share') {
      assertEmailShare(connected.has(who), 'The fictional mailbox is disconnected.');
      const root = mail.find(m => m.owner === who && m.id === event.messageId);
      assertEmailShare(root, 'Message not available in this mailbox.');
      const ids = event.messageIds;
      assertEmailShare(Array.isArray(ids) && ids.length > 0 && ids.includes(root.id) && (event.mode === 'conversation' || (event.mode === 'message' && ids.length === 1)), 'Explicitly select messages from this conversation.');
      const selected = [...new Set(ids)].map(id => mail.find(m => m.id === id && m.owner === who && m.thread === root.thread));
      assertEmailShare(selected.every(Boolean), 'Message not available in this conversation.');
      shares.push(createEmailShare({ actorId:who, project:findProject(event.projectId), messages:selected, audience:event.audience, attachmentKeys:event.attachmentKeys, note:event.note, at, id:`share-${index}` }));
    }
    if (action === 'revoke') revokeEmailShare(who, shares.find(s => s.id === event.shareId), event.recipient, at);
  };
  history.forEach(replay);
  let nextHistory = history;
  if (command?.action === 'attachment') {
    const share = shares.find(s => s.id === command.shareId);
    attachment = openSharedAttachment(actor, share, findProject(share?.projectId), command.messageId, command.attachmentId);
  } else if (command?.action === 'message') {
    assertEmailShare(connected.has(actor) && mail.some(m => m.owner === actor && m.id === command.messageId));
  } else if (command) {
    assertEmailShare(history.length < 100, 'Reset this preview to continue.');
    const {action,messageId,messageIds,mode,projectId,audience,attachmentKeys,note,shareId,recipient} = command;
    const event = {actor,at:now,action,messageId,messageIds,mode,projectId,audience,attachmentKeys,note,shareId,recipient};
    replay(event,history.length);
    nextHistory = [...history,event];
  }
  return { history:nextHistory, actor, people, connected:connected.has(actor), attachment,
    laterReplyAvailable:actor === 'michael' && connected.has(actor) && !mail.some(m => m.id === future.id),
    inbox:connected.has(actor) ? mail.filter(m => m.owner === actor).map(metadata) : [],
    projects:projects.filter(p => p.team.includes(actor)),
    shares:shares.filter(s => canViewShare(actor,s,findProject(s.projectId))).map(s => ({...s, audit:s.owner === actor ? s.audit : undefined, access:s.owner === actor ? s.access : undefined, messages:s.messages.map(metadata), suggestion:'Consider asking the project coordinator to review this correspondence for a task or follow-up. Nothing has been assigned or approved.'})),
  };
}