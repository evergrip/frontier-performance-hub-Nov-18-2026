import MailComposer from 'npm:nodemailer@7.0.13/lib/mail-composer/index.js';
import addressparser from 'npm:nodemailer@7.0.13/lib/addressparser/index.js';
import { currentGmailToken, currentMailbox, gmailId, GmailPilotError, googleDiagnostics, unpackGmail } from './preconGmailReader.ts';

const scope = value => `https://www.googleapis.com/auth/${value}`;
const modes = ['compose','reply','replyAll','forward'];
const header = (mail, key) => mail?.payload?.headers?.find(h => h.name.toLowerCase() === key.toLowerCase())?.value || '';
const address = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
const unique = (values, excluded = []) => [...new Map(values.filter(v => !excluded.some(x => x.toLowerCase() === v.toLowerCase())).map(v => [v.toLowerCase(),v])).values()];
const parse = text => addressparser(text || '',{flatten:true}).map(a=>a.address).filter(a=>address.test(a || ''));
const ids = text => (text || '').match(/<[^<>\s]+>/g) || [];
const clean = (value, limit, multiline = false) => {
  if (typeof value !== 'string' || value.length > limit || (multiline ? /\0/ : /[\x00-\x1f\x7f]/).test(value)) throw new GmailPilotError('Check the message fields and length.');
  return value;
};
const recipients = value => {
  const list = clean(value,3000).split(',').map(v=>v.trim()).filter(Boolean);
  if (list.length > 25 || list.some(v=>!address.test(v))) throw new GmailPilotError('Enter valid email addresses separated by commas (up to 25 per field).');
  return unique(list);
};
const missing = details => new GmailPilotError('Gmail read and send access are both required. Choose Reconnect Gmail and approve both permissions for the same mailbox.',412,details);

export async function gmailOutgoing(base44, input, fetcher = fetch) {
  if (!modes.includes(input.mode) || (input.action === 'send' && input.confirmed !== true)) throw new GmailPilotError('Review the message and explicitly confirm it before sending.');
  const token = await currentGmailToken(base44);
  const infoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
  infoUrl.searchParams.set('access_token',token);
  // Never follow a redirect on a request containing the employee's access token.
  const inspection = await fetcher(infoUrl.toString(),{signal:AbortSignal.timeout(10000),redirect:'manual'}).catch(() => {
    throw new GmailPilotError('Could not reach Google to verify Gmail permissions. Try again.',502,{step:'scope_check'});
  });
  if (!inspection.ok) {
    const details = await googleDiagnostics(inspection,'scope_check');
    if ([400,401].includes(inspection.status)) throw new GmailPilotError('Google could not validate the Gmail connection. Choose Reconnect Gmail.',412,details);
    throw new GmailPilotError('Google could not verify Gmail permissions. Try again.',502,details);
  }
  const {scope: grant} = await inspection.json();
  if (typeof grant !== 'string') throw new GmailPilotError('Google did not report the Gmail permissions. Try again.',502,{step:'scope_check',googleStatus:inspection.status});
  const approved = new Set(grant.split(/\s+/));
  const missingPermissions = ['gmail.readonly','gmail.send'].filter(permission => !approved.has(scope(permission)));
  if (missingPermissions.length) throw missing({step:'scope_check',googleStatus:inspection.status,missingPermissions});
  const api = await currentMailbox(base44,fetcher,token);
  const {emailAddress: from} = await api('profile');
  if (!address.test(from || '')) throw new GmailPilotError('Gmail did not identify the connected mailbox.',502);
  if (input.action === 'send' && input.from !== from) throw new GmailPilotError('The connected Gmail account changed. Reopen the composer and review the message again.',409);
  const mail = input.mode === 'compose' ? null : await api(`messages/${gmailId(input.messageId)}`,{format:input.mode === 'forward' && input.action === 'prepare' ? 'full' : 'metadata'});
  const subject = header(mail,'Subject');
  const replying = ['reply','replyAll'].includes(input.mode);
  const messageId = ids(header(mail,'Message-ID'))[0];
  if (replying && (!messageId || !mail.threadId)) throw new GmailPilotError('This message lacks the information Gmail needs to reply in the original conversation.',422);
  if (input.action === 'prepare') {
    const fromAddress = parse(header(mail,'Reply-To') || header(mail,'From'));
    const originalTo = parse(header(mail,'To'));
    const direct = replying ? unique(fromAddress.some(v=>v.toLowerCase() === from.toLowerCase()) ? originalTo : fromAddress,[from]) : [];
    const to = input.mode === 'replyAll' ? unique([...direct,...originalTo],[from]) : direct;
    const cc = input.mode === 'replyAll' ? unique(parse(header(mail,'Cc')),[from,...to]) : [];
    let body = '';
    if (input.mode === 'forward') {
      const {message} = await unpackGmail(api,mail);
      const plain = message.body.filter(p=>p.type === 'text/plain').map(p=>p.text).join('\n');
      if (!plain && message.body.some(p=>p.type === 'text/html')) throw new GmailPilotError('This message has no plain-text version. Open it in Gmail to forward the original.',422);
      body = `\n\n---------- Forwarded message ----------\nFrom: ${message.from}\nSubject: ${message.subject}\nTo: ${message.to}\n\n${plain}`;
      if (body.length > 50000) throw new GmailPilotError('This message is too long to forward here. Open it in Gmail.',422);
    }
    return {from,to:to.join(', '),cc:cc.join(', '),subject:input.mode === 'forward' ? `Fwd: ${subject}` : subject,body};
  }
  const to = recipients(input.to), cc = unique(recipients(input.cc),to);
  const text = clean(input.body,50000,true);
  const outgoingSubject = clean(replying ? subject : input.subject,1000);
  if (!to.length || !text.trim()) throw new GmailPilotError('Enter at least one To recipient and a message.');
  const message = new MailComposer({from,to,cc,subject:outgoingSubject,text,disableFileAccess:true,disableUrlAccess:true,
    ...(replying ? {inReplyTo:messageId,references:unique([...ids(header(mail,'References')).slice(-20),messageId])} : {})});
  const raw = (await message.compile().build()).toString('base64url');
  const response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({raw,...(replying ? {threadId:mail.threadId} : {})}),signal:AbortSignal.timeout(15000),redirect:'manual'
  }).catch(()=>{throw new GmailPilotError('Gmail did not confirm whether the message was sent. Check Sent mail before trying again.',502,{step:'gmail_send'});});
  if (!response.ok) {
    const details = await googleDiagnostics(response,'gmail_send');
    if (response.status === 401) throw new GmailPilotError('Your Gmail connection expired. Choose Reconnect Gmail before sending.',412,details);
    if (response.status === 403 && ['ACCESS_TOKEN_SCOPE_INSUFFICIENT','insufficientPermissions'].includes(details.googleCode)) throw missing(details);
    if (response.status === 403) throw new GmailPilotError('Google blocked this send. Check your Google Workspace policy.',403,details);
    if (response.status === 429) throw new GmailPilotError('Gmail is busy. Check Sent mail before trying again.',429,details);
    throw new GmailPilotError('Gmail did not confirm the send. Check Sent mail before trying again.',502,details);
  }
  const sent = await response.json();
  return {id:sent.id,threadId:sent.threadId};
}