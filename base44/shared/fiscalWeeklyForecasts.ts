import { weeklyRows } from './weeklyGpForecast.ts';
import { OPEN_PRECON } from './gpAllocationJob.ts';
async function matching(entity, query, fields) {
  let cursor; const items = [];
  do { const page = await entity.filter(query, { sort: '-created_date', limit: 100, fields, cursor }); items.push(...page.items); cursor = page.has_more ? page.next_cursor : null; } while (cursor);
  return items;
}
export async function fiscalWeeklyForecasts(base44, user, start, end) {
  const rows = [], overriddenProjectIds = new Set(), seenProjects = new Set(), seenPrecons = new Set(); let cursor;
  do {
    const page = await base44.entities.GrossProfitForecast.filter({}, { sort: '-updated_date', limit: 100, cursor });
    const preconIds = [...new Set(page.items.map(row => row.precon_sale_id).filter(Boolean))], projectIds = [...new Set(page.items.map(row => row.project_id).filter(Boolean))];
    const [precons, children] = await Promise.all([
      preconIds.length ? matching(base44.entities.Sale, { id: { $in: preconIds } }, ['status', 'title', 'include_in_forecast', 'assigned_to', 'sale_contributors', 'estimated_construction_budget', 'monthly_revenue_allocations']) : [],
      preconIds.length ? matching(base44.entities.Sale, { linked_precon_sale_id: { $in: preconIds }, sale_type: 'construction' }, ['linked_precon_sale_id', 'assigned_to', 'sale_contributors']) : [],
    ]);
    const projectConditions = [];
    if (projectIds.length) projectConditions.push({ id: { $in: projectIds } });
    if (children.length) projectConditions.push({ sale_id: { $in: children.map(row => row.id) } });
    const projects = projectConditions.length ? await matching(base44.entities.Project, { $or: projectConditions }, ['title', 'status', 'include_in_forecast', 'project_manager_id', 'sale_id', 'contract_value', 'monthly_revenue_allocations']) : [];
    const childrenById = Object.fromEntries(children.map(row => [row.id, row]));
    const otherIds = [...new Set(projects.map(project => project.sale_id).filter(id => id && !childrenById[id]))];
    const otherSales = otherIds.length ? await matching(base44.entities.Sale, { id: { $in: otherIds } }, ['assigned_to', 'sale_contributors']) : [];
    const saleMap = Object.fromEntries([...children, ...otherSales].map(row => [row.id, row])), preconMap = Object.fromEntries(precons.map(row => [row.id, row]));
    const owns = sale => sale?.assigned_to === user.id || sale?.sale_contributors?.some(person => person.user_id === user.id);
    for (const forecast of page.items) {
      const project = projects.find(row => row.id === forecast.project_id) || projects.find(row => childrenById[row.sale_id]?.linked_precon_sale_id === forecast.precon_sale_id);
      const precon = preconMap[forecast.precon_sale_id];
      if (project && seenProjects.has(project.id) || forecast.precon_sale_id && seenPrecons.has(forecast.precon_sale_id)) continue;
      if (project) seenProjects.add(project.id);
      if (forecast.precon_sale_id) seenPrecons.add(forecast.precon_sale_id);
      if (project) {
        if (project.status === 'closed' || project.include_in_forecast === false || user.role !== 'admin' && project.project_manager_id !== user.id && !owns(saleMap[project.sale_id])) continue;
        overriddenProjectIds.add(project.id);
      } else if (!precon || !OPEN_PRECON.includes(precon.status) || precon.include_in_forecast === false || user.role !== 'admin' && !owns(precon)) continue;
      const lastDay = new Date(Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)), 0)).getUTCDate();
      const weeks = weeklyRows(forecast, `${start}-01`, `${end}-${lastDay}`, 0, 54);
      rows.push({ forecast: { ...forecast, project_id: project?.id || '', title: project?.title || precon?.title || forecast.title }, weeks, revenueValue: project ? project.contract_value : precon?.estimated_construction_budget, revenueAllocations: (project || precon)?.monthly_revenue_allocations || [], phase: project ? 'Construction' : 'Pre-construction' });
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return { rows, overriddenProjectIds, monthlyProjectIds: new Set(rows.filter(row => row.forecast.allocation_mode === 'monthly').map(row => row.forecast.project_id).filter(Boolean)) };
}