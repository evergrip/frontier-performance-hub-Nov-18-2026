const preconStages = ['feasibility', 'design_material_selections', 'engineering_permits', 'pending_construction_sale'];
const activeStages = ['mobilization', 'active_construction', 'substantial_completion_closeout'];

export async function scan(entity, query = {}) {
  const rows = [];
  let cursor;
  do {
    const page = await entity.filter(query, { sort: 'created_date', limit: 250, ...(cursor ? { cursor } : {}) });
    rows.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}

export async function getDeliveryJobs(entities) {
  const [sales, projects, estimates] = await Promise.all([
    scan(entities.Sale, { sale_type: { $in: ['preconstruction', 'construction'] } }),
    scan(entities.Project, { project_type: 'construction' }), scan(entities.DeliveryEstimate),
  ]);
  const saleById = new Map(sales.map(sale => [sale.id, sale]));
  const projectBySale = new Map(projects.map(project => [project.sale_id, project]));
  const convertedFrom = new Map();
  for (const sale of sales) if (sale.converted_to_project_id) {
    const linked = convertedFrom.get(sale.converted_to_project_id) || [];
    linked.push(sale.id);
    convertedFrom.set(sale.converted_to_project_id, linked);
  }
  const won = new Set(sales.filter(s => s.sale_type === 'construction' && s.status === 'closed_won').map(s => s.linked_precon_sale_id));
  const salesWithProject = new Set(projects.flatMap(p => [p.sale_id, ...(convertedFrom.get(p.id) || [])].filter(Boolean)));
  const preconWithProject = new Set([...salesWithProject, ...Array.from(salesWithProject, id => saleById.get(id)?.linked_precon_sale_id)].filter(Boolean));
  const bySale = new Map(estimates.filter(e => e.sale_id).map(e => [e.sale_id, e]));
  const byProject = new Map(estimates.filter(e => e.project_id).map(e => [e.project_id, e]));
  const makeJob = (record, type, bucket, saleIds, saleId) => {
    const inherited = saleIds.map(id => bySale.get(id)).find(Boolean);
    return { id: record.id, type, bucket, saleId, title: record.title, clientId: record.client_id,
      hubValue: bucket === 'Pipeline' ? record.estimated_construction_budget : record.contract_value,
      allocations: record.monthly_revenue_allocations || [], buildType: record.forecast_build_type,
      margin: record.estimated_margin, estimate: inherited || (type === 'Project' ? byProject.get(record.id) : null) || null };
  };
  const jobs = [...projects.flatMap(p => {
    const bucket = p.status === 'closed' ? 'Complete' : p.status === 'awaiting_to_be_scheduled' ? 'Signed' : activeStages.includes(p.status) ? 'In construction' : null;
    if (!bucket || p.include_in_forecast === false) return [];
    const from = convertedFrom.get(p.id) || [];
    const linked = saleById.get(p.sale_id)?.linked_precon_sale_id || from.find(id => saleById.get(id)?.sale_type === 'preconstruction');
    const paths = [linked, p.sale_id, ...from].filter(Boolean);
    return [makeJob(p, 'Project', bucket, paths, paths[0])];
  }), ...sales.flatMap(s => {
    if (s.include_in_forecast === false || s.converted_to_project_id || projectBySale.has(s.id)) return [];
    if (s.sale_type === 'preconstruction' && preconStages.includes(s.status) && !won.has(s.id) && !preconWithProject.has(s.id)) return [makeJob(s, 'Sale', 'Pipeline', [s.id], s.id)];
    if (s.sale_type === 'construction' && s.status === 'closed_won' && (!s.linked_precon_sale_id || !preconWithProject.has(s.linked_precon_sale_id))) return [makeJob(s, 'Sale', 'Signed', [s.linked_precon_sale_id, s.id].filter(Boolean), s.linked_precon_sale_id || s.id)];
    return [];
  })];
  const seen = new Set();
  return jobs.sort((a, b) => Number(a.bucket === 'Complete') - Number(b.bucket === 'Complete')).filter(job => {
    const key = job.saleId || job.estimate?.id || job.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const committed = (job) => job.bucket === 'Signed' || job.bucket === 'In construction';
export const costFields = ['sub_quote', 'materials_by_frontier', 'selections', 'equipment', 'other'];
export function forecastValues(estimate, scopes, settings) {
  const baseline = scopes.reduce((sum, s) => sum + costFields.reduce((cost, key) => cost + (s[key] || 0), 0), 0);
  const price = estimate.override_contract_price > 0 ? estimate.override_contract_price : baseline / (1 - (settings.baseline_gm ?? 25) / 100);
  const rate = estimate.labour_rate_override ?? settings.labour_rate ?? 50;
  const valid = scopes.filter(s => s.inhouse_feasible && s.inhouse_hours > 0 && s.inhouse_share > 0);
  const added = valid.reduce((sum, s) => sum + ((s.sub_quote || 0) - s.inhouse_hours * rate - (s.inhouse_extra_materials || 0)) * s.inhouse_share / 100, 0);
  return { estimated_margin: price > 0 ? ((baseline > 0 ? price - baseline : 0) + added) / price * 100 : 0, forecast_build_type: valid.length ? 'mixed' : 'subcontractor' };
}