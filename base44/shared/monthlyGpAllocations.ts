import { effectiveSchedule } from './weeklyGpForecast.ts';
import { periodOf } from './verificationMath.ts';
import { syncGpTiming, OPEN_PRECON } from './gpAllocationJob.ts';
const cents = value => Math.round(Number(value) * 100) / 100;
const valid = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
function initialRows(job, totalGP, totalRevenue, start) {
  if (job.existing?.allocation_mode === 'monthly') return job.existing.monthly_allocations || [];
  const grouped = new Map();
  const month = period => { if (!grouped.has(period)) grouped.set(period, { period, gp: 0, revenue: 0 }); return grouped.get(period); };
  if (job.existing) for (const row of effectiveSchedule(job.existing).rows) month(row.date.slice(0, 7)).gp += row.amount;
  const allocations = job.forecastScope === 'precon' ? [] : job.project?.monthly_revenue_allocations || job.precon?.monthly_revenue_allocations || [];
  for (const row of allocations) {
    const period = periodOf(row);
    if (!period || !valid(row.percentage) || Number(row.percentage) < 0) throw new Error('Correct the existing monthly allocation dates or percentages first.');
    const entry = month(period);
    entry.revenue += totalRevenue * Number(row.percentage) / 100;
    if (!job.existing) entry.gp += totalGP * Number(row.percentage) / 100;
  }
  if (!allocations.length && job.existing && totalGP > 0) for (const entry of grouped.values()) entry.revenue = totalRevenue * entry.gp / totalGP;
  if (!grouped.size) Object.assign(month(start.slice(0, 7)), { gp: totalGP, revenue: totalRevenue });
  const raw = [...grouped.values()].sort((a, b) => a.period.localeCompare(b.period));
  const result = raw.map(row => ({ ...row, gp: cents(row.gp), revenue: cents(row.revenue) }));
  for (const field of ['gp', 'revenue']) {
    const difference = cents(raw.reduce((sum, row) => sum + row[field], 0) - result.reduce((sum, row) => sum + row[field], 0));
    const last = [...result].reverse().find(row => row[field] > 0) || result.at(-1);
    last[field] = cents(last[field] + difference);
  }
  return result;
}
export async function monthlyGpAllocations(base44, job, input, action) {
  const existing = job.existing;
  const sourceRevenue = job.forecastScope === 'precon' ? job.precon.contract_value : [job.project?.contract_value, job.sale?.sale_type === 'construction' ? job.sale.contract_value : null, job.precon?.estimated_construction_budget].find(value => valid(value) && Number(value) > 0);
  const totalRevenue = cents(input.totalRevenue ?? existing?.total_revenue ?? sourceRevenue ?? 0);
  const totalGP = cents(input.totalGP ?? existing?.total_gp ?? Math.max(0, job.estimatedGP));
  if (!Number.isFinite(totalGP) || totalGP < 0 || !Number.isFinite(totalRevenue) || totalRevenue < 0) throw new Error('Enter non-negative GP and revenue budgets.');
  const start = existing?.probable_start_date || job.project?.start_date || new Date().toISOString().slice(0, 7) + '-01';
  const source = input.monthlyAllocations ?? initialRows(job, totalGP, totalRevenue, start);
  if (!Array.isArray(source) || !source.length || source.length > 1200) throw new Error('Add at least one month, up to 1200 months.');
  const monthly = source.map(row => {
    if (!periodOf({ period: row.period }) || row.period > '2200-12' || !valid(row.gp) || !valid(row.revenue) || Number(row.gp) < 0 || Number(row.revenue) < 0) throw new Error('Enter a valid month and non-negative dollar amounts for GP and revenue.');
    return { period: row.period, gp: cents(row.gp), revenue: cents(row.revenue) };
  }).sort((a, b) => a.period.localeCompare(b.period));
  if (new Set(monthly.map(row => row.period)).size !== monthly.length) throw new Error('Each month can appear only once.');
  const allocatedGP = cents(monthly.reduce((sum, row) => sum + row.gp, 0)), allocatedRevenue = cents(monthly.reduce((sum, row) => sum + row.revenue, 0));
  if (action === 'save' && (allocatedGP > totalGP + 0.01 || allocatedRevenue > totalRevenue + 0.01)) throw new Error('Monthly allocations exceed the job budget. Increase the budget or reduce the allocations.');
  const goalYear = Number(monthly[0].period.slice(0, 4)) - (Number(monthly[0].period.slice(5, 7)) < 10 ? 1 : 0);
  const forecast = { job_key: job.key, precon_sale_id: job.precon?.id || '', project_id: job.project?.id || '', title: job.title, probable_start_date: monthly[0].period + '-01', total_gp: totalGP, total_revenue: totalRevenue, allocation_mode: 'monthly', monthly_allocations: monthly, weekly_overrides: [], weekly_gp: existing?.weekly_gp || 0, annual_gp_goal: existing?.annual_gp_goal || 0, goal_fiscal_year: goalYear, revision: (existing?.revision || 0) + 1 };
  let saved = existing;
  if (action === 'save') {
    if (job.forecastScope === 'precon' ? ![...OPEN_PRECON, 'closed_won'].includes(job.precon.status) : !job.project && !OPEN_PRECON.includes(job.precon.status)) throw new Error('This job is not eligible for allocations.');
    if (Number(input.revision ?? 0) !== Number(existing?.revision || 0)) return Response.json({ error: 'Another editor changed this job. Reload before saving.' }, { status: 409 });
    saved = existing ? await base44.entities.GrossProfitForecast.update(existing.id, forecast) : (await base44.entities.GrossProfitForecast.upsert([forecast], { key: 'job_key' })).records[0];
    await syncGpTiming(base44, job, forecast);
  }
  return Response.json({ forecast: saved, draft: forecast, title: job.title, phase: job.forecastScope === 'precon' ? 'Pre-construction services' : job.project ? 'Construction' : 'Future construction', forecastScope: job.forecastScope || 'construction', allocatedGP, allocatedRevenue, unallocatedGP: cents(totalGP - allocatedGP), unallocatedRevenue: cents(totalRevenue - allocatedRevenue), migratingWeekly: !!existing && existing.allocation_mode !== 'monthly' });
}