import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { currentMailbox, GmailPilotError, gmailPage, gmailThread, sdkStatus } from '../../shared/preconGmailReader.ts';
import { authorizeGmailPilot } from '../../shared/preconGmailAccess.ts';
import { gmailOutgoing } from '../../shared/preconGmailSend.ts';

export default async function(req: Request): Promise<Response> {
  const json = (data, status = 200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
  let action = 'unknown', stage = 'employee_access';
  try {
    const base44 = createClientFromRequest(req);
    await authorizeGmailPilot(base44);
    const input = await req.json().catch(() => null);
    if (!['prepare','send','inbox','thread'].includes(input?.action)) return json({error:'Invalid Gmail request.'},400);
    action = input.action;
    stage = 'employee_connection';
    if (['prepare','send'].includes(action)) return json(await gmailOutgoing(base44,input));
    const api = await currentMailbox(base44);
    stage = 'gmail_read';
    return json(action === 'thread' ? await gmailThread(api,input.threadId) : await gmailPage(api,input));
  } catch (e) {
    const status = sdkStatus(e);
    const diagnostics = e instanceof GmailPilotError ? e.diagnostics : undefined;
    console.warn('Pre-Con Gmail request failed', {action,stage,status:Number.isInteger(status) ? status : null,...diagnostics});
    if (e instanceof GmailPilotError) return json({error:e.message,...diagnostics},e.status);
    if (status === 429) return json({error:'Too many requests. Try again shortly.'},429);
    return json({error:stage === 'employee_access' ? 'Could not verify your Gmail pilot access. Try again.' : action === 'prepare' ? 'Could not check your Gmail connection for Compose. Try again.' : action === 'send' ? 'Gmail did not confirm the send. Check Sent mail before trying again.' : 'Could not load your private Gmail inbox. Try again.'},502);
  }
}