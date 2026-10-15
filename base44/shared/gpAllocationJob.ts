import { dateTime, WEEK, monthlyShares } from './weeklyGpForecast.ts';
export const OPEN_PRECON = ['feasibility', 'design_material_selections', 'engineering_permits', 'pending_construction_sale'];
export async function resolveGpJob(base44, input) {
  const pointed = input.forecastId ? await base44.entities.GrossProfitForecast.get(input.forecastId) : null;
  let project = input.projectId ? await base44.entities.Project.get(input.projectId) : null;
  let sale = project?.sale_id ? await base44.entities.Sale.get(project.sale_id) : null;
  const preconId = sale?.linked_precon_sale_id || input.saleId || pointed?.precon_sale_id;
  let precon = preconId ? await base44.entities.Sale.get(preconId) : null;
  if (!project && pointed?.project_id) project = (await base44.entities.Project.filter({ id: pointed.project_id }, { limit: 1 })).items[0];
  if (!project && precon) {
    const children = await base44.entities.Sale.filter({ linked_precon_sale_id: precon.id, sale_type: 'construction' }, { sort: '-created_date', limit: 100 });
    if (children.items.length) project = (await base44.entities.Project.filter({ sale_id: { $in: children.items.map(row => row.id) } }, { sort: '-created_date', limit: 1 })).items[0];
  }
  if (!project && !precon && !pointed) throw new Error('Job not found.');
  if (project && !sale) sale = await base44.entities.Sale.get(project.sale_id);
  if (!precon && sale?.linked_precon_sale_id) precon = await base44.entities.Sale.get(sale.linked_precon_sale_id);
  if (precon && precon.sale_type !== 'preconstruction') throw new Error('Invalid pre-construction job.');
  if (input.saleId && project && sale?.linked_precon_sale_id !== input.saleId) throw new Error('Construction project does not belong to this pre-con job.');
  const key = precon ? `precon:${precon.id}` : `project:${project.id}`;
  const conditions = [{ job_key: key }];
  if (precon) conditions.push({ precon_sale_id: precon.id });
  if (project) conditions.push({ project_id: project.id });
  const matches = await base44.entities.GrossProfitForecast.filter({ $or: conditions }, { sort: '-updated_date', limit: 1 });
  const existing = matches.items[0] || null;
  const margin = project?.actual_margin ?? sale?.estimated_margin ?? precon?.estimated_margin;
  const estimatedGP = project ? project.status === 'closed' ? Number(project.contract_value || 0) - Number(project.actual_costs || 0) : Number(project.contract_value || 0) * Number(margin || 0) / 100 : Number(precon.estimated_construction_budget || 0) * Number(precon.estimated_margin || 0) / 100;
  return { key, project, sale, precon, existing, estimatedGP: Math.round(estimatedGP * 100) / 100, title: project?.title || precon.title };
}
export function legacyOverrides(allocations, totalGP) {
  const months = new Map();
  for (const row of allocations || []) {
    const period = row.period || `${row.year}-${String(row.month).padStart(2, '0')}`;
    dateTime(`${period}-01`);
    const share = Number(row.percentage);
    if (!Number.isFinite(share) || share < 0 || share > 100) throw new Error('Correct invalid legacy allocation percentages before migrating.');
    months.set(period, (months.get(period) || 0) + share);
  }
  if ([...months.values()].reduce((sum, value) => sum + value, 0) > 100.1) throw new Error('Legacy allocations exceed 100%; review before migration.');
  const periods = [...months.keys()].sort(), start = periods[0] ? `${periods[0]}-01` : '';
  if (!start) return { start: '', overrides: [] };
  const anchor = dateTime(start), overrides = []; let assigned = 0;
  for (const period of periods) {
    const monthStart = dateTime(`${period}-01`), next = new Date(monthStart); next.setUTCMonth(next.getUTCMonth() + 1);
    const first = Math.ceil((monthStart - anchor) / WEEK), count = Math.ceil((next.getTime() - anchor) / WEEK) - first;
    const cents = Math.min(Math.round(totalGP * months.get(period)), Math.round(totalGP * 100) - assigned); assigned += cents;
    for (let index = 0; index < count; index++) overrides.push({ date: new Date(anchor + (first + index) * WEEK).toISOString().slice(0, 10), amount: (Math.floor(cents / count) + (index < cents % count ? 1 : 0)) / 100 });
  }
  return { start, overrides };
}
export async function syncGpTiming(base44, job, forecast) {
  const entity = job.project ? base44.entities.Project : base44.entities.Sale;
  await entity.update(job.project?.id || job.precon.id, { monthly_revenue_allocations: monthlyShares(forecast) });
}