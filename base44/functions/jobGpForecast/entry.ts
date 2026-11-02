import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { effectiveSchedule, dateTime, WEEK } from '../../shared/weeklyGpForecast.ts';
import { resolveGpJob, legacyOverrides, syncGpTiming, OPEN_PRECON } from '../../shared/gpAllocationJob.ts';
import { allocationIssues } from '../../shared/verificationMath.ts';
import { monthlyGpAllocations } from '../../shared/monthlyGpAllocations.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const input = await req.json(), action = input.action || 'load', offset = input.offset || 0;
    if (!['load', 'save', 'handoff', 'validateCloseout', 'preview'].includes(action) || !Number.isInteger(offset) || offset < 0) throw new Error('Invalid request.');
    if (action === 'preview') return Response.json(effectiveSchedule(input.forecast));
    if (!input.saleId && !input.projectId && !input.forecastId) throw new Error('Select a job.');
    const job = await resolveGpJob(base44, input), existing = job.existing;
    if (input.allocationMode === 'monthly' && ['load', 'save'].includes(action)) return await monthlyGpAllocations(base44, job, input, action);
    if (action === 'handoff') {
      if (existing && job.project) { const forecast = await base44.entities.GrossProfitForecast.update(existing.id, { job_key: job.key, project_id: job.project.id }); await syncGpTiming(base44, job, forecast); }
      return Response.json({ ok: true });
    }
    const legacy = existing ? { start: '', overrides: [] } : legacyOverrides(job.project?.monthly_revenue_allocations || job.precon?.monthly_revenue_allocations || [], Math.max(0, job.estimatedGP));
    const start = (input.probableStartDate ?? existing?.probable_start_date ?? legacy.start) || job.project?.start_date || '';
    const goalYear = start ? Number(start.slice(0, 4)) - (Number(start.slice(5, 7)) < 10 ? 1 : 0) : new Date().getUTCFullYear() - (new Date().getUTCMonth() < 9 ? 1 : 0);
    const goal = (await base44.entities.FiscalGoal.filter({ fiscal_year: goalYear }, { limit: 1, fields: ['gross_profit_target'] })).items[0];
    const target = Number(goal?.gross_profit_target) || 0;
    const budget = input.totalGP == null ? existing?.total_gp ?? Math.max(0, job.estimatedGP) : Number(input.totalGP);
    let overrides = existing?.weekly_overrides || legacy.overrides;
    if (existing && start && start !== existing.probable_start_date) overrides = overrides.map(row => ({ ...row, date: new Date(dateTime(start) + dateTime(row.date) - dateTime(existing.probable_start_date)).toISOString().slice(0, 10) }));
    const patch = input.overrideChanges || {};
    if (typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length > 1000) throw new Error('Invalid weekly overrides.');
    const byDate = new Map(overrides.map(row => [row.date, row.amount]));
    for (const [date, amount] of Object.entries(patch)) { if (amount === null) byDate.delete(date); else { if (amount === '' || !Number.isFinite(Number(amount))) throw new Error('Enter a valid GP dollar amount.'); byDate.set(date, Number(amount)); } }
    const forecast = { job_key: job.key, precon_sale_id: job.precon?.id || '', project_id: job.project?.id || '', title: job.title, probable_start_date: start, total_gp: budget, annual_gp_goal: job.project ? existing?.annual_gp_goal ?? target : target, goal_fiscal_year: job.project ? existing?.goal_fiscal_year ?? goalYear : goalYear, weekly_gp: job.project ? existing?.weekly_gp ?? (job.project.status === 'closed' ? 0 : target / 52) : target / 52, weekly_overrides: [...byDate].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)), revision: (existing?.revision || 0) + 1 };
    if (existing?.allocation_mode === 'monthly') Object.assign(forecast, { allocation_mode: 'monthly', monthly_allocations: existing.monthly_allocations, total_revenue: existing.total_revenue });
    const info = start ? effectiveSchedule(forecast) : { rows: [], weeks: 0, allocatedGP: 0, unallocatedGP: budget };
    if (action === 'validateCloseout') {
      if (!Number.isFinite(Number(input.finalTotalGP))) throw new Error('Enter valid final GP dollars.');
      const timing = job.project?.monthly_revenue_allocations || [];
      if (Number(input.finalTotalGP) <= 0 && timing.length && !allocationIssues(timing).length && Math.abs(timing.reduce((sum, row) => sum + Number(row.percentage), 0) - 100) < 0.1) return Response.json({ ok: true, finalGP: Number(input.finalTotalGP) });
      if (!existing) throw new Error('Save the GP dollar schedule before closing this job.');
      if (Math.abs(existing.total_gp - Number(input.finalTotalGP)) > 0.01 || Math.abs(info.unallocatedGP) > 0.01) throw new Error('Reconcile the saved GP dollar budget and weekly allocations to the final contract less costs before closeout.');
      return Response.json({ ok: true });
    }
    let saved = existing;
    if (action === 'save') {
      if (!job.project && !OPEN_PRECON.includes(job.precon.status)) throw new Error('Only open pre-con jobs or existing construction projects can be allocated.');
      if (!start || !(budget > 0)) throw new Error('Enter a start date and a positive total GP budget.');
      if (input.revision != null && Number(input.revision) !== Number(existing?.revision || 0)) return Response.json({ error: 'Another editor changed this job. Reload before saving.' }, { status: 409 });
      if (job.project?.status === 'closed' && Math.abs(budget - job.estimatedGP) > 0.01) throw new Error('Closed project GP allocations must match final contract less costs.');
      if (existing) saved = await base44.entities.GrossProfitForecast.update(existing.id, forecast);
      else saved = (await base44.entities.GrossProfitForecast.upsert([forecast], { key: 'job_key' })).records[0];
      await syncGpTiming(base44, job, forecast);
    }
    const visible = start ? Array.from({ length: 12 }, (_, index) => { const week = offset + index; return info.rows[week] || { week: week + 1, date: new Date(dateTime(start) + week * WEEK).toISOString().slice(0, 10), amount: 0, remaining: info.unallocatedGP, manual: byDate.has(new Date(dateTime(start) + week * WEEK).toISOString().slice(0, 10)) }; }) : [];
    const revenueValue = job.project?.contract_value ?? job.precon?.estimated_construction_budget;
    const totalRevenue = revenueValue != null && revenueValue !== '' && Number.isFinite(Number(revenueValue)) ? Number(revenueValue) : null;
    return Response.json({ totalRevenue, forecast: saved, draft: forecast, title: job.title, estimatedGP: job.estimatedGP, phase: job.project ? 'Construction' : 'Pre-construction', annualTarget: forecast.annual_gp_goal, weeklyGP: forecast.weekly_gp, goalYear: forecast.goal_fiscal_year, ...info, rows: visible, hasMore: !!start && dateTime(start) + (offset + 12) * WEEK < Date.UTC(2200, 11, 31), migratingLegacy: !existing && legacy.overrides.length > 0 });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}