export class EmailShareError extends Error {}
export function assertEmailShare(ok, message = 'Not available to this account.') {
  if (!ok) throw new EmailShareError(message);
}

export function canViewShare(actorId, share, project) {
  return !!project?.team.includes(actorId) && (share.owner === actorId || share.access.includes(actorId));
}

export function createEmailShare({ actorId, project, messages, audience, attachmentKeys, note, at, id }) {
  assertEmailShare(project?.team.includes(actorId), 'Choose an authorized project.');
  assertEmailShare(messages.length && messages.every(m => m.owner === actorId), 'Message not available in this mailbox.');
  assertEmailShare(messages.every(m => !m.projectHint || m.projectHint === project.id), 'The selected correspondence points to a different project.');
  assertEmailShare(Array.isArray(audience) && audience.length && audience.every(id => id !== actorId && project.team.includes(id)), 'Choose recipients from this project’s authorized team.');
  const candidates = messages.flatMap(m => m.attachments.map(a => `${m.id}:${a.id}`));
  assertEmailShare(Array.isArray(attachmentKeys) && attachmentKeys.every(key => candidates.includes(key)), 'Choose only attachments from the selected messages.');
  assertEmailShare(typeof note === 'string' && note.length <= 1000, 'Keep the optional note under 1,000 characters.');
  const access = [...new Set(audience)];
  return { id, owner:actorId, projectId:project.id, sharedAt:at, note:note.trim(), access,
    audit:[{ action:'shared', by:actorId, at, projectId:project.id, recipients:[...access] }],
    messages:messages.map(({id, thread, from, to, cc, date, subject, body, attachments}) => ({ id, thread, from, to, cc, date, subject, body,
      attachments:attachments.filter(a => attachmentKeys.includes(`${id}:${a.id}`)) })),
  };
}

export function revokeEmailShare(actorId, share, recipient, at) {
  assertEmailShare(share?.owner === actorId && share.access.includes(recipient));
  share.access = share.access.filter(id => id !== recipient);
  share.audit.push({ action:'revoked', by:actorId, at, projectId:share.projectId, recipients:[recipient] });
}

export function openSharedAttachment(actorId, share, project, messageId, attachmentId) {
  assertEmailShare(share && canViewShare(actorId, share, project));
  const attachment = share.messages.find(m => m.id === messageId)?.attachments.find(a => a.id === attachmentId);
  assertEmailShare(attachment);
  return attachment;
}