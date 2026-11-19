import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { currentMailbox, GmailPilotError, gmailPage, gmailThread, sdkStatus } from '../../shared/preconGmailReader.ts';
import { authorizeGmailPilot } from '../../shared/preconGmailAccess.ts';
import { gmailOutgoing } from '../../shared/preconGmailSend.ts';

export default async function(req: Request): Promise<Response> {
  const json = (data, status = 200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
  try {
    const base44 = createClientFromRequest(req);
    await authorizeGmailPilot(base44);
    const input = await req.json().catch(() => null);
    if (['prepare','send'].includes(input?.action)) return json(await gmailOutgoing(base44,input));
    if (!input || !['inbox','thread'].includes(input.action)) return json({error:'Invalid Gmail request.'},400);
    const api = await currentMailbox(base44);
    return json(input.action === 'thread' ? await gmailThread(api,input.threadId) : await gmailPage(api,input));
  } catch (e) {
    if (e instanceof GmailPilotError) return json({error:e.message},e.status);
    if (sdkStatus(e) === 429) return json({error:'Too many requests. Try again shortly.'},429);
    return json({error:'Could not load your private Gmail inbox.'},502);
  }
}