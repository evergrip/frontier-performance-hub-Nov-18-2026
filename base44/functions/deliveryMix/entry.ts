import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { getDeliveryJobs, scan, committed, costFields, forecastValues } from '../../shared/deliveryMixJobs.ts';

const reply = (error, status = 400) => Response.json({ error }, { status });
const month = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const num = (value, min = 0, max = Infinity) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const str = (value, max = 3000) => typeof value === 'string' && value.length <= max;
const staffShape = ({ id, name, department, hours_per_week, start_date, end_date }) => ({ id, name, department, hours_per_week, start_date, end_date });
const firstSettings = async E => (await E.CompanySettings.list({ sort: 'created_date', limit: 1 })).items[0];
const validScopeCosts = r => str(r.scope_name, 200) && r.scope_name.trim() && str(r.cost_code, 100) && str(r.subtrade_id, 100) && str(r.sub_name, 200) && costFields.every(k => num(r[k]));
const scopeCosts = r => ({ scope_name: r.scope_name.trim(), cost_code: r.cost_code, subtrade_id: r.subtrade_id, sub_name: r.subtrade_id ? '' : r.sub_name, ...Object.fromEntries(costFields.map(k => [k, r[k]])) });
const validSheetOps = r => typeof r.inhouse_feasible === 'boolean' && num(r.inhouse_hours) && num(r.inhouse_extra_materials) && num(r.inhouse_share, 0, 100) && (!r.inhouse_share || (r.inhouse_feasible && r.inhouse_hours > 0)) && (r.scheduled_start_month === '' || month(r.scheduled_start_month)) && Number.isInteger(r.duration_months) && num(r.duration_months, 1, 120);
const sheetOps = r => r == null ? {} : ({ inhouse_feasible: r.inhouse_feasible, inhouse_hours: r.inhouse_hours, inhouse_extra_materials: r.inhouse_extra_materials, inhouse_share: r.inhouse_share, scheduled_start_month: r.scheduled_start_month, duration_months: r.duration_months });

export default async function(req: Request): Promise<Response> {
  try {
    const app = createClientFromRequest(req);
    const user = await app.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return reply('Please sign in.', 401);
    const admin = user.role === 'admin';
    const canEstimate = admin || (Array.isArray(user.permissions) && user.permissions.includes('delivery_mix_estimate'));
    const canOperate = admin || (Array.isArray(user.permissions) && user.permissions.includes('delivery_mix_operations'));
    if (!canEstimate && !canOperate) return reply('You do not have access to Delivery Mix.', 403);
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload.action !== 'string') return reply('Invalid request.');
    const { action, jobId, data = {}, scopeId } = payload;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply('Invalid values.');
    const E = app.asServiceRole.entities;
    if (action === 'load') {
      const [jobs, settings, goals, holidays, subtrades] = await Promise.all([
        getDeliveryJobs(E), firstSettings(E), scan(E.FiscalGoal), scan(E.Holiday), scan(E.Subtrade),
      ]);
      const crewIds = settings?.delivery_mix?.crew_staff_ids ?? [];
      const clientIds = [...new Set(jobs.map(j => j.clientId).filter(Boolean))];
      const estimateIds = [...new Set(jobs.map(j => j.estimate?.id).filter(Boolean))];
      const [staff, availability, clients, scopes] = await Promise.all([
        admin ? scan(E.StaffDetail) : crewIds.length ? scan(E.StaffDetail, { id: { $in: crewIds } }) : [],
        crewIds.length ? scan(E.CrewAvailability, { staff_detail_id: { $in: crewIds } }) : [],
        clientIds.length ? scan(E.Client, { id: { $in: clientIds } }) : [],
        estimateIds.length ? scan(E.DeliveryScope, { estimate_id: { $in: estimateIds } }) : [],
      ]);
      const names = new Map(clients.map(c => [c.id, c.company_name || c.contact_name]));
      return Response.json({ jobs: jobs.map(j => ({ ...j, client: names.get(j.clientId) || 'No client' })), settings: settings?.delivery_mix ?? {}, fiscalStart: settings?.fiscal_year_start_month ?? 10,
        staff: staff.map(staffShape), availability, scopes, goals: goals.map(({ fiscal_year, gross_profit_target, revenue_target }) => ({ fiscal_year, gross_profit_target, revenue_target })),
        holidays: holidays.map(({ date }) => ({ date })), subtrades: subtrades.map(({ id, name }) => ({ id, name })) });
    }
    if (action === 'settings') {
      if (!admin) return reply('Only admins can change settings.', 403);
      const { labour_rate, baseline_gm, benchmark_gm, hst_rate, forecast_months, crew_staff_ids } = data;
      if (!num(labour_rate) || !num(baseline_gm, 0, 99.99) || !num(benchmark_gm, 0, 100) || !num(hst_rate, 0, 100) || !Number.isInteger(forecast_months) || !num(forecast_months, 12, 60) || !Array.isArray(crew_staff_ids) || !crew_staff_ids.every(id => str(id, 100) && id)) return reply('Check settings and crew selection.');
      const ids = [...new Set(crew_staff_ids)];
      if (ids.length && (await E.StaffDetail.count({ id: { $in: ids } })) !== ids.length) return reply('One or more staff records no longer exist.');
      const settings = await firstSettings(E);
      const value = { delivery_mix: { labour_rate, baseline_gm, benchmark_gm, hst_rate, forecast_months, crew_staff_ids: ids } };
      if (settings) await E.CompanySettings.update(settings.id, value); else await E.CompanySettings.create(value);
      return Response.json({ ok: true });
    }
    if (['availability', 'resetAvailability'].includes(action)) {
      if (!canOperate) return reply('Operations access is required.', 403);
      const { staff_detail_id, month: period, available_hours, reserved_hours, notes } = data;
      if (!month(period) || !str(staff_detail_id, 100) || !staff_detail_id) return reply('Choose a crew member and month.');
      const settings = await firstSettings(E);
      if (!settings?.delivery_mix?.crew_staff_ids?.includes(staff_detail_id)) return reply('This staff member is not on the crew roster.');
      const key = { staff_detail_id, month: period };
      if (action === 'resetAvailability') await E.CrewAvailability.deleteMany(key);
      else {
        if (!num(available_hours) || !num(reserved_hours) || !str(notes)) return reply('Enter valid non-negative hours.');
        await E.CrewAvailability.upsert([{ ...key, available_hours, reserved_hours, notes }], { key: ['staff_detail_id', 'month'] });
      }
      return Response.json({ ok: true });
    }
    const estimatorActions = ['estimate', 'scopeEstimate', 'deleteScope', 'applyForecast'];
    const opsActions = ['scopeOps', 'applyShares'];
    if (!estimatorActions.includes(action) && !opsActions.includes(action)) return reply('Unknown action.');
    if ((estimatorActions.includes(action) && !canEstimate) || (opsActions.includes(action) && !canOperate)) return reply('You do not have permission for this change.', 403);
    const jobs = await getDeliveryJobs(E);
    if (action === 'applyShares') {
      const rows = data.rows;
      if (!Array.isArray(rows) || !rows.length || !rows.every(r => r && str(r.id, 100) && r.id && (r.share === 0 || r.share === 100) && str(r.version, 80)) || new Set(rows.map(r => r.id)).size !== rows.length) return reply('Invalid allocation preview.');
      const ids = new Set(jobs.filter(committed).map(j => j.estimate?.id));
      const existing = await scan(E.DeliveryScope, { id: { $in: rows.map(r => r.id) } });
      const byId = new Map(existing.map(s => [s.id, s]));
      if (rows.some(r => { const s = byId.get(r.id); return !s || !ids.has(s.estimate_id) || r.version !== s.updated_date || (r.share > 0 && (!s.inhouse_feasible || !s.inhouse_hours)); })) return reply('The scopes changed after preview. Refresh and suggest again.', 409);
      for (let i = 0; i < rows.length; i += 250) await E.DeliveryScope.bulkUpdate(rows.slice(i, i + 250).map(r => ({ id: r.id, inhouse_share: r.share })));
      return Response.json({ ok: true });
    }
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.bucket === 'Complete') return reply('This job is not available for edits.', 404);
    if (action === 'estimate') {
      const { start_month, job_number, override_contract_price, labour_rate_override, notes, rows = [] } = data;
      if (!month(start_month) || !str(job_number, 100) || !str(notes) || (override_contract_price != null && !num(override_contract_price)) || (labour_rate_override != null && !num(labour_rate_override))) return reply('Check the estimate details.');
      if (!Array.isArray(rows) || rows.length > 500 || rows.some(r => !r || (r.id != null && (!str(r.id, 100) || !r.id)) || !validScopeCosts(r))) return reply('Check the scope names and costs (up to 500 changed rows per save).');
      const ids = rows.filter(r => r.id).map(r => r.id);
      if (new Set(ids).size !== ids.length || (ids.length && (!job.estimate || await E.DeliveryScope.count({ id: { $in: ids }, estimate_id: job.estimate.id }) !== ids.length))) return reply('A scope no longer belongs to this estimate. Reopen the editor.', 409);
      const trades = [...new Set(rows.map(r => r.subtrade_id).filter(Boolean))];
      if (trades.length && await E.Subtrade.count({ id: { $in: trades } }) !== trades.length) return reply('A selected subtrade no longer exists.');
      if (rows.some(r => r.operations != null) && (!canOperate || !committed(job))) return reply('Only Operations can save in-house allocations, and only on committed jobs.', 403);
      if (rows.some(r => r.operations != null && !validSheetOps(r.operations))) return reply('Check the in-house hours, mix and schedule. A nonzero mix requires in-house hours.');
      const patch = { start_month, job_number, override_contract_price, labour_rate_override, notes, ...(job.type === 'Project' ? { project_id: job.id } : {}) };
      const link = job.saleId ? { sale_id: job.saleId } : { project_id: job.id };
      const estimate = job.estimate ? await E.DeliveryEstimate.update(job.estimate.id, patch) :
        (await E.DeliveryEstimate.upsert([{ ...patch, ...link, prepared_by: user.id }], { key: Object.keys(link)[0] })).records[0];
      const edits = rows.filter(r => r.id).map(r => ({ id: r.id, ...scopeCosts(r), ...sheetOps(r.operations) }));
      const fresh = rows.filter(r => !r.id).map(r => ({ estimate_id: estimate.id, ...scopeCosts(r), ...sheetOps(r.operations) }));
      if (edits.length) await E.DeliveryScope.bulkUpdate(edits);
      if (fresh.length) await E.DeliveryScope.bulkCreate(fresh);
      return Response.json(estimate);
    }
    if (!job.estimate) return reply('Create the estimate first.', 404);
    if (action === 'applyForecast') {
      const [scopes, settings] = await Promise.all([scan(E.DeliveryScope, { estimate_id: job.estimate.id }), firstSettings(E)]);
      if (!scopes.length) return reply('Add a scope before applying the forecast.');
      const values = forecastValues(job.estimate, scopes, settings?.delivery_mix ?? {});
      if (job.type === 'Project') delete values.estimated_margin;
      if (data.buildType !== (job.buildType ?? null) || data.margin !== (job.type === 'Sale' ? job.margin ?? null : null) || data.nextBuildType !== values.forecast_build_type || (job.type === 'Sale' && (!num(Math.abs(data.nextMargin), 0) || Math.abs(data.nextMargin - values.estimated_margin) > 1e-7))) return reply('Forecast inputs changed. Review the new values before applying.', 409);
      await E[job.type].update(job.id, values);
      return Response.json({ ok: true });
    }
    if (scopeId != null && (!str(scopeId, 100) || !scopeId)) return reply('Invalid scope.');
    const scope = scopeId ? (await E.DeliveryScope.filter({ id: scopeId, estimate_id: job.estimate.id }, { limit: 1 })).items[0] : null;
    if ((scopeId && !scope) || (!scope && action !== 'scopeEstimate')) return reply('Scope not found on this estimate.', 404);
    if (action === 'deleteScope') {
      await E.DeliveryScope.delete(scope.id);
    } else if (action === 'scopeEstimate') {
      if (!validScopeCosts(data)) return reply('Enter a scope name and valid costs.');
      if (data.subtrade_id && !(await E.Subtrade.count({ id: data.subtrade_id }))) return reply('The selected subtrade no longer exists.');
      const patch = scopeCosts(data);
      if (scope) await E.DeliveryScope.update(scope.id, patch); else await E.DeliveryScope.create({ ...patch, estimate_id: job.estimate.id });
    } else {
      const patch = {};
      if ('inhouse_share' in data) {
        if (!num(data.inhouse_share, 0, 100) || !committed(job)) return reply('Only signed or in-construction jobs can allocate shares.');
        patch.inhouse_share = data.inhouse_share;
      }
      if ('inhouse_feasible' in data) {
        const { inhouse_feasible, inhouse_hours, inhouse_extra_materials, scheduled_start_month, duration_months, decision_notes } = data;
        if (typeof inhouse_feasible !== 'boolean' || !num(inhouse_hours) || !num(inhouse_extra_materials) || (scheduled_start_month !== '' && !month(scheduled_start_month)) || !Number.isInteger(duration_months) || !num(duration_months, 1, 120) || !str(decision_notes)) return reply('Check the scope schedule and crew inputs.');
        Object.assign(patch, { inhouse_feasible, inhouse_hours, inhouse_extra_materials, scheduled_start_month, duration_months, decision_notes });
      }
      if (!Object.keys(patch).length) return reply('No operations fields submitted.');
      await E.DeliveryScope.update(scope.id, patch);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Delivery Mix:', error.message);
    return reply('Delivery Mix could not complete this request. Refresh before retrying.', 500);
  }
}