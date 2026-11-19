import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { authorizeGmailPilot } from '../../shared/preconGmailAccess.ts';
import { GmailPilotError, sdkStatus } from '../../shared/preconGmailReader.ts';
import { gmailProjects, readGmailShare, saveGmailShare } from '../../shared/preconGmailShares.ts';

export default async function(req: Request): Promise<Response> {
  const json = (value, status = 200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
  try {
    const base44 = createClientFromRequest(req);
    const user = await authorizeGmailPilot(base44);
    const input = await req.json().catch(() => null);
    const db = base44.asServiceRole.entities;
    if (input?.action === 'projects') return json(await gmailProjects(db,user.id));
    if (input?.action === 'share') return json(await saveGmailShare(base44,db,user,input),201);
    if (['team','history','open','download'].includes(input?.action)) return json(await readGmailShare(base44,db,user,input));
    return json({error:'Invalid project email request.'},400);
  } catch (e) {
    if (e instanceof GmailPilotError) return json({error:e.message},e.status);
    if (sdkStatus(e) === 429) return json({error:'Too many requests. Try again shortly.'},429);
    return json({error:'Could not complete the project email request.'},502);
  }
}