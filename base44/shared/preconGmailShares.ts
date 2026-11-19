import { isShareViewer } from './preconGmailAccess.ts';
import { currentMailbox, gmailId, gmailPartData, GmailPilotError, partKey, unpackGmail } from './preconGmailReader.ts';

const MAX_BYTES = 4 * 1024 * 1024;
const unavailable = () => new GmailPilotError('This project or shared email is not available to you.',404);
const requireId = value => {
  if (typeof value !== 'string' || !/^[\w-]{1,100}$/.test(value)) throw unavailable();
  return value;
};
const pageMembership = (db, query, limit = 100) => db.PreconGmailProjectMember.filter(query,{limit});
export async function requireProjectMembership(db, projectId, userId) {
  const { items } = await pageMembership(db,{project_id:requireId(projectId),user_id:userId},1);
  if (!items.length) throw unavailable();
}

export async function gmailProjects(db, userId) {
  const {items,has_more} = await pageMembership(db,{user_id:userId});
  if (has_more) throw new GmailPilotError('The pilot supports up to 100 project memberships per person.',422);
  if (!items.length) return { projects:[] };
  const ids = [...new Set(items.map(m => m.project_id))];
  const projects = await db.Project.filter({id:{$in:ids}},{limit:100,sort:'title'});
  return { projects:projects.items.map(({id,title}) => ({id,title})) };
}

async function projectTeam(db, projectId, actorId) {
  const { items,has_more } = await pageMembership(db,{project_id:projectId});
  if (has_more) throw new GmailPilotError('The pilot supports teams of up to 100 members.',422);
  const ids = [...new Set(items.map(m => m.user_id))].filter(id => id !== actorId);
  if (!ids.length) return [];
  const members = await db.User.filter({id:{$in:ids}},'full_name',100);
  return members.map(({id,full_name,email}) => ({id,name:full_name || email || 'Team member'}));
}

export async function saveGmailShare(base44, db, user, input) {
  const { projectId, attachmentIds, recipientIds } = input;
  await requireProjectMembership(db,projectId,user.id);
  if (input.confirmed !== true) throw new GmailPilotError('Confirm this message and the selected attachments and recipients before sharing.');
  if (!Array.isArray(recipientIds) || !recipientIds.length || recipientIds.length > 99 || !Array.isArray(attachmentIds) || attachmentIds.length > 20) throw new GmailPilotError('Confirm a recipient and choose up to 20 attachments.');
  const team = await projectTeam(db,projectId,user.id);
  const recipients = [...new Set(recipientIds)].map(id => team.find(p => p.id === id));
  if (recipients.some(person => !person)) throw new GmailPilotError('The project team changed. Refresh and confirm the recipients again.',409);
  const project = await db.Project.filter({id:projectId},{limit:1});
  if (!project.items.length) throw unavailable();
  const api = await currentMailbox(base44);
  const raw = await api(`messages/${gmailId(input.messageId)}`,{format:'full'});
  const {message,parts} = await unpackGmail(api,raw);
  const selected = [...new Set(attachmentIds)].map(id => parts.find(part => partKey(part) === id));
  if (selected.some(p => !p)) throw new GmailPilotError('One of the selected attachments is not part of this email.');
  if (selected.reduce((sum,p) => sum + (Number(p.body?.size) || 0),0) > MAX_BYTES) throw new GmailPilotError('Selected attachments exceed the 4 MB pilot limit.',413);
  const attachments = [];
  for (const part of selected) {
    const info = message.attachments.find(a => a.id === partKey(part));
    attachments.push({...info, data:await gmailPartData(api,raw.id,part)});
  }
  const snapshot = {...message, attachments, recipients};
  const file = new File([JSON.stringify(snapshot)],'precon-email.json',{type:'application/json'});
  if (file.size > Math.ceil(MAX_BYTES * 4 / 3) + 64000) throw new GmailPilotError('The confirmed email and attachments are too large for the pilot.',413);
  const storage = base44.asServiceRole.integrations.Core;
  const { file_uri } = await storage.UploadPrivateFile({file});
  const record = await db.PreconGmailProjectShare.create({project_id:projectId,actor_id:user.id,actor_name:user.full_name || user.email,recipient_ids:recipients.map(p=>p.id),gmail_message_id:message.id,gmail_thread_id:message.threadId,shared_at:new Date().toISOString(),attachment_names:attachments.map(a=>a.name),subject:message.subject.slice(0,500),snapshot_uri:file_uri});
  return { id:record.id };
}

const audit = s => ({id:s.id, subject:s.subject || 'Shared email', sharedBy:s.actor_name, sharedAt:s.shared_at, attachmentNames:s.attachment_names});

export async function readGmailShare(base44, db, user, input) {
  await requireProjectMembership(db,input.projectId,user.id);
  if (input.action === 'team') return { members:await projectTeam(db,input.projectId,user.id) };
  if (input.action === 'history') {
    if (input.cursor != null && (typeof input.cursor !== 'string' || input.cursor.length > 2000)) throw new GmailPilotError('Invalid history cursor.');
    const {items,next_cursor} = await db.PreconGmailProjectShare.filter({$and:[{project_id:input.projectId},{$or:[{actor_id:user.id},{recipient_ids:{$in:[user.id]}}]}]}, {limit:20,sort:'-shared_at', ...(input.cursor ? {cursor:input.cursor} : {})});
    return { shares:items.filter(s => isShareViewer(user.id,s)).map(audit), nextCursor:next_cursor || '' };
  }
  const { items } = await db.PreconGmailProjectShare.filter({id:requireId(input.shareId),project_id:input.projectId},{limit:1});
  const share = items[0];
  if (!share || !isShareViewer(user.id,share)) throw unavailable();
  const {signed_url} = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({file_uri:share.snapshot_uri,expires_in:60});
  const response = await fetch(signed_url,{signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new GmailPilotError('The private shared copy could not be loaded.',502);
  const snapshot = await response.json();
  if (input.action === 'download') {
    const attachment = snapshot.attachments.find(a=>a.id === input.attachmentId);
    if (!attachment) throw unavailable();
    return { attachment };
  }
  const {attachments,recipients,...message} = snapshot;
  return { ...audit(share), recipients, message:{...message,attachments:attachments.map(({id,name,size})=>({id,name,size}))} };
}