export const GMAIL_CONNECTOR = '6afefd8bd586a64d6638c478';
export class GmailPilotError extends Error {
  status;
  diagnostics;
  constructor(message, status = 400, diagnostics = undefined) { super(message); this.status = status; this.diagnostics = diagnostics; }
}
export const sdkStatus = e => e?.status ?? e?.response?.status;
export async function googleDiagnostics(response, step) {
  const body = await response.json().catch(() => null);
  const error = body?.error;
  const codes = [typeof error === 'string' ? error : error?.status, ...((Array.isArray(error?.errors) ? error.errors : []).map(item => item?.reason)), ...((Array.isArray(error?.details) ? error.details : []).map(item => item?.reason))];
  const allowed = new Set(['invalid_token','invalid_grant','invalid_request','UNAUTHENTICATED','PERMISSION_DENIED','ACCESS_TOKEN_SCOPE_INSUFFICIENT','SERVICE_DISABLED','RESOURCE_EXHAUSTED','NOT_FOUND','INVALID_ARGUMENT','authError','insufficientPermissions','forbidden','domainPolicy','notFound','rateLimitExceeded','userRateLimitExceeded','accessNotConfigured','backendError']);
  const googleCode = codes.filter(code => allowed.has(code)).at(-1);
  return {step,googleStatus:response.status,...(googleCode ? {googleCode} : {})};
}
export const gmailId = value => {
  if (typeof value !== 'string' || !/^[\w-]{1,200}$/.test(value)) throw new GmailPilotError('Invalid Gmail reference.');
  return value;
};

export async function currentGmailToken(base44) {
  const connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR).catch(e => {
    const status = sdkStatus(e);
    if ([401, 404, 412].includes(status)) return null;
    throw e;
  });
  if (!connection?.accessToken) throw new GmailPilotError('No active Gmail connection was found for your sign-in. Choose Reconnect Gmail to continue.', 412,{step:'employee_connection'});
  return connection.accessToken;
}

export async function currentMailbox(base44, fetcher = fetch, accessToken = null) {
  const token = accessToken ?? await currentGmailToken(base44);
  return async (path, params = {}) => {
    const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`);
    url.search = new URLSearchParams(params).toString();
    const step = path === 'profile' ? 'gmail_profile' : 'gmail_read';
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, redirect:'manual', signal: AbortSignal.timeout(12000) }).catch(() => {
      throw new GmailPilotError('Could not reach Gmail. Try again.',502,{step});
    });
    if (!response.ok) {
      const details = await googleDiagnostics(response,step);
      if (response.status === 404) throw new GmailPilotError('This email is not available in your Gmail account.',404,details);
      if (response.status === 401) throw new GmailPilotError('Google rejected the Gmail connection. Choose Reconnect Gmail.',412,details);
      if (response.status === 403 && ['ACCESS_TOKEN_SCOPE_INSUFFICIENT','insufficientPermissions'].includes(details.googleCode)) throw new GmailPilotError('Gmail read access was not granted. Choose Reconnect Gmail and approve read access.',412,details);
      if (response.status === 403) throw new GmailPilotError('Google denied access to Gmail. Check your Google Workspace policy or whether the Gmail API is enabled.',403,details);
      if (response.status === 429) throw new GmailPilotError('Gmail is busy. Try again shortly.',429,details);
      throw new GmailPilotError('Gmail did not respond successfully. Try again.',502,details);
    }
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
      try {
        const message = await api(`messages/${gmailId(id)}`, {format:'metadata'});
        return { ...summarizeGmail(message), isSent: message.labelIds?.includes('SENT') ?? false };
      }
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