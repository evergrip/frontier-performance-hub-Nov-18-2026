import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { rehearsal } from '../../shared/preconRehearsal.ts';
import { RehearsalError } from '../../shared/preconRehearsalActions.ts';

// This endpoint can only replay the bundled fictional scenario. No entity or integration calls.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'The role-playing rehearsal is restricted to app admins.' }, { status: 403 });
    const body = await req.text();
    if (body.length > 450000) return Response.json({ error: 'Rehearsal request is too large.' }, { status: 413 });
    let input;
    try { input = JSON.parse(body); } catch { return Response.json({ error: 'Invalid rehearsal request.' }, { status: 400 }); }
    if (!input || typeof input !== 'object') return Response.json({ error: 'Invalid rehearsal request.' }, { status: 400 });
    return Response.json(rehearsal(input.history ?? [], input.command, new Date().toISOString()));
  } catch (error) {
    if (error instanceof RehearsalError) return Response.json({ error: error.message }, { status: 422 });
    console.error('Pre-Con rehearsal failed', error);
    return Response.json({ error: 'The rehearsal could not be processed.' }, { status: 500 });
  }
}