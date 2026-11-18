import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { masterRun, masterTemplate, MasterInputError } from '../../shared/preconMasterEngine.ts';

// Draft-only simulator. No Sale lookup, entity writes, or external actions are available.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Sign in to open the draft.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Management preview is restricted to app admins.' }, { status: 403 });
    const body = await req.text();
    if (body.length > 750000) return Response.json({ error: 'Draft rehearsal is too large.' }, { status: 413 });
    const input = (() => { try { return JSON.parse(body); } catch { return null; } })();
    if (!input || !['reference','simulate'].includes(input.mode) || !['detailed','early'].includes(input.path)) return Response.json({ error: 'Invalid draft request.' }, { status: 400 });
    if (input.mode === 'reference') return Response.json(masterTemplate(input.path));
    return Response.json(masterRun(input.path, input.history ?? [], input.command, new Date().toISOString()));
  } catch (error) {
    if (error instanceof MasterInputError) return Response.json({ error: error.message }, { status: 422 });
    console.error('Master draft simulator failed', error);
    return Response.json({ error: 'Could not open or update the draft.' }, { status: 500 });
  }
}