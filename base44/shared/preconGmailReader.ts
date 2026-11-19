export const GMAIL_CONNECTOR = '6afefd8bd586a64d6638c478';
export class GmailPilotError extends Error {
  status;
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const sdkStatus = e => e.status ?? e.response?.status;
export const gmailId = value => {
  if (typeof value !== 'string' || !/^[\w-]{1,200}$/.test(value)) throw new GmailPilotError('Invalid Gmail reference.');
  return value;
};

export async function currentMailbox(base44, fetcher = fetch) {
  const connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR).catch(e => {
    if ([401, 404].includes(sdkStatus(e))) return null;
    throw e;
  });
  if (!connection?.accessToken) throw new GmailPilotError('Connect your Gmail account to continue.', 412);
  return async (path, params = {}) => {
    const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`);
    url.search = new URLSearchParams(params).toString();
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${connection.accessToken}` }, signal: AbortSignal.timeout(12000) });
    if (response.status === 404) throw new GmailPilotError('This email is not available in your Gmail account.', 404);
    if (response.status === 401) throw new GmailPilotError('Reconnect your Gmail account to continue.', 412);
    if (response.status === 403) throw new GmailPilotError('Google denied read access. Check your Gmail consent or Workspace policy.', 403);
    if (response.status === 429) throw new GmailPilotError('Gmail is busy. Try again shortly.', 429);
    if (!response.ok) throw new GmailPilotError('Gmail did not respond successfully. Try again.', 502);
    return response.json();
  };
}

const header = (m, name) => m?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
export const summarizeGmail = m => ({ id:m.id, threadId:m.threadId, subject:header(m.payload,'Subject') || '(No subject)', from:header(m.payload,'From'), to:header(m.payload,'To'), cc:header(m.payload,'Cc'), date:Number(m.internalDate) || 0 });
export const standard64 = data => data.replace(/-/g,'+').replace(/_/g,'/');
const decode = (data, part) => {
  const charset = header(part,'Content-Type').match(/charset\s*=\s*"?([^";\s]+)/i)?.[1];
  let decoder;
  try { decoder = new TextDecoder(charset || 'utf-8'); } catch { decoder = new TextDecoder(); }
  return decoder.decode(Uint8Array.from(atob(standard64(data)), c => c.charCodeAt(0)));
};

function collect(part, bodies, attachments) {
  if (!part) return;
  const disposition = header(part,'Content-Disposition');
  if (part.filename || /^attachment\b/i.test(disposition) || (part.body?.attachmentId && !part.mimeType?.startsWith('text/'))) {
    attachments.push(part);
  } else if (['text/plain','text/html'].includes(part.mimeType) && (part.body?.data || part.body?.attachmentId)) {
    bodies.push(part);
  } else {
    for (const child of part.parts || []) collect(child,bodies,attachments);
  }
}
export const partKey = part => part.partId || 'root';
export async function gmailPartData(api, id, part) {
  const data = part.body?.attachmentId ? (await api(`messages/${gmailId(id)}/attachments/${gmailId(part.body.attachmentId)}`)).data : part.body?.data;
  return standard64(data || '');
}
export async function unpackGmail(api, raw) {
  const bodies = [], parts = [];
  collect(raw.payload,bodies,parts);
  const plain = bodies.filter(p => p.mimeType === 'text/plain');
  const preferred = plain.length ? plain : bodies;
  const body = [];
  for (const part of preferred) body.push({ type: part.mimeType, text: decode(await gmailPartData(api, raw.id, part), part) });
  return { parts, message: { ...summarizeGmail(raw), body, attachments: parts.map(p => ({ id:partKey(p), name:p.filename || 'Unnamed attachment', size:Number(p.body?.size) || 0 })) } };
}

export async function gmailPage(api, {query = '', cursor = ''} = {}) {
  if (typeof query !== 'string' || query.length > 500 || typeof cursor !== 'string' || cursor.length > 1000) throw new GmailPilotError('Invalid Gmail search.');
  const list = await api('messages', { maxResults:'10', ...(query.trim() ? {q:query.trim()} : {labelIds:'INBOX'}), ...(cursor ? {pageToken:cursor} : {}) });
  const refs = list.messages || [];
  const messages = [];
  for (let offset = 0; offset < refs.length; offset += 5) {
    const batch = await Promise.all(refs.slice(offset,offset+5).map(async ({id}) => {
      try { return summarizeGmail(await api(`messages/${gmailId(id)}`, {format:'metadata'})); }
      catch (e) { if (e instanceof GmailPilotError && e.status === 404) return null; throw e; }
    }));
    messages.push(...batch.filter(Boolean));
  }
  return { messages:messages.sort((a,b) => b.date-a.date), nextCursor:list.nextPageToken || '' };
}

export async function gmailThread(api, id) {
  const thread = await api(`threads/${gmailId(id)}`, {format:'full'});
  const messages = [];
  for (const raw of thread.messages || []) messages.push((await unpackGmail(api,raw)).message);
  return { messages:messages.sort((a,b) => a.date-b.date) };
}