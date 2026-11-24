import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const api = 'https://developer.buildertrend.com/api';
const jsonError = (error, status) => Response.json({ error }, { status });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const absentOn404 = (e) => e.status === 404 ? null : Promise.reject(e);
const jobSummary = (job) => ({ id: job.id, name: job.name, status: job.status, jobType: job.jobType });

export default async function(req: Request): Promise<Response> {
  let step = 'pilot status';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return jsonError('Sign in to continue.', 401);
    if (user.role !== 'admin') return jsonError('Only Hub admins can run this pilot.', 403);
    const { action, saleId, jobId, cursor } = (await req.json().catch(() => null)) || {};
    if (!['status', 'jobs', 'link'].includes(action)) return jsonError('Choose a valid pilot action.', 400);
    if (action === 'jobs' && cursor != null && (typeof cursor !== 'string' || cursor.length > 4096)) return jsonError('Invalid jobs page.', 400);
    if (action === 'link' && (typeof saleId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(saleId) || typeof jobId !== 'string' || !uuid.test(jobId))) {
      return jsonError('Select a pre-con sale and a Buildertrend job.', 400);
    }
    const links = base44.asServiceRole.entities.PreconBuildertrendPilotLink;
    const existing = async () => (await links.list({ sort: 'created_date', limit: 1 })).items[0] ?? null;
    const link = await existing();
    if (action === 'status') return Response.json({ link });
    if (link) return jsonError('The pilot already has a linked job.', 409);

    step = 'credentials';
    const key = secrets.get('BUILDERTREND_CONSUMER_KEY');
    const secret = secrets.get('BUILDERTREND_CONSUMER_SECRET');
    if (!key || !secret) return jsonError('Buildertrend credentials have not been configured yet.', 503);
    step = 'Buildertrend token';
    const tokenRes = await fetch(`${api}/token`, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Basic ${btoa(`${key.trim()}:${secret.trim()}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (tokenRes.status === 401) {
      const failure = await tokenRes.json().catch(() => null);
      if (failure?.error === 'invalid_client') return jsonError('Buildertrend rejected the consumer key or secret. Check that both are from the same Buildertrend developer app.', 502);
      if (['api_key_not_linked', 'reauthorization_required'].includes(failure?.error)) return jsonError('Link or reauthorize the developer app in Buildertrend with an account that can view the pilot job.', 502);
      return jsonError('Buildertrend rejected the connection. Check the credentials and link or reauthorize the developer app in Buildertrend.', 502);
    }
    if (tokenRes.status === 429) return jsonError('Buildertrend is limiting requests. Try again in a minute.', 429);
    if (!tokenRes.ok) return jsonError('Buildertrend could not connect. Try again later.', 502);
    const { access_token } = await tokenRes.json();
    if (!access_token) return jsonError('Buildertrend did not return a connection token.', 502);
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);
    const path = action === 'jobs' ? `/v1/jobs?${params}` : `/v1/jobs/${jobId}`;
    step = 'Buildertrend jobs';
    const res = await fetch(`${api}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${access_token}` } });
    if (res.status === 404 && action === 'link') return jsonError('This job no longer exists or is not visible to the linked Buildertrend account.', 404);
    if (res.status === 401) return jsonError('Reauthorize the developer app in Buildertrend and try again.', 502);
    if (res.status === 429) return jsonError('Buildertrend is limiting requests. Try again in a minute.', 429);
    if (!res.ok) return jsonError('Buildertrend could not load the jobs. Try again later.', 502);
    const data = await res.json();
    if (action === 'jobs') return Response.json({ items: data.data.map(jobSummary), nextCursor: data.pagination?.hasMore ? data.pagination.nextCursor : null });

    const sale = await base44.entities.Sale.get(saleId).catch(absentOn404);
    if (sale?.sale_type !== 'preconstruction') return jsonError('Choose an existing Hub pre-con sale.', 404);
    if (data.id?.toLowerCase() !== jobId.toLowerCase() || typeof data.name !== 'string' || !data.name.trim()) return jsonError('Buildertrend did not return the selected job.', 502);
    if (await existing()) return jsonError('The pilot already has a linked job.', 409);
    const saved = await links.create({ sale_id: sale.id, sale_title: sale.title, job_id: data.id, job_name: data.name, linked_by: user.id });
    return Response.json({ link: saved });
  } catch (error) {
    console.warn('Buildertrend pilot request failed', step, error?.name);
    return jsonError(error?.name === 'TimeoutError' ? 'Buildertrend did not respond in time. Try again.' : 'The pilot could not complete the request. Try again.', 500);
  }
}