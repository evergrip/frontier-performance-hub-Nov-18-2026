import { weeklyRows } from './weeklyGpForecast.ts';
const OPEN = ['feasibility', 'design_material_selections', 'engineering_permits', 'pending_construction_sale'];
export async function fiscalWeeklyForecasts(base44, user, start, end) {
  const rows = [], overriddenProjectIds = new Set();
  let cursor;
  do {
    const page = await base44.entities.GrossProfitForecast.filter({}, { limit: 100, cursor });
    const saleIds = [...new Set(page.items.map(record => record.precon_sale_id))];
    const projectIds = [...new Set(page.items.map(record => record.project_id).filter(Boolean))];
    const [sales, projects] = await Promise.all([
      saleIds.length ? base44.entities.Sale.filter({ id: { $in: saleIds } }, { limit: 100, fields: ['status', 'include_in_forecast', 'assigned_to', 'sale_contributors'] }) : { items: [] },
      projectIds.length ? base44.entities.Project.filter({ id: { $in: projectIds } }, { limit: 100, fields: ['status', 'include_in_forecast', 'project_manager_id', 'sale_id'] }) : { items: [] },
    ]);
    const salesById = Object.fromEntries(sales.items.map(sale => [sale.id, sale]));
    const projectsById = Object.fromEntries(projects.items.map(project => [project.id, project]));
    const linkedSaleIds = [...new Set(projects.items.map(project => project.sale_id).filter(Boolean))];
    const projectSales = linkedSaleIds.length ? await base44.entities.Sale.filter({ id: { $in: linkedSaleIds } }, { limit: 100, fields: ['assigned_to', 'sale_contributors'] }) : { items: [] };
    const projectSalesById = Object.fromEntries(projectSales.items.map(sale => [sale.id, sale]));
    const owns = sale => sale?.assigned_to === user.id || sale?.sale_contributors?.some(person => person.user_id === user.id);
    for (const forecast of page.items) {
      const sale = salesById[forecast.precon_sale_id], project = projectsById[forecast.project_id];
      if (forecast.project_id) {
        if (!project || project.status === 'closed' || project.include_in_forecast === false || (user.role !== 'admin' && project.project_manager_id !== user.id && !owns(projectSalesById[project.sale_id]))) continue;
        overriddenProjectIds.add(project.id);
      } else if (!sale || !OPEN.includes(sale.status) || sale.include_in_forecast === false || (user.role !== 'admin' && !owns(sale))) continue;
      const weeks = weeklyRows(forecast, `${start}-01`, `${end}-${new Date(Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)), 0)).getUTCDate()}`, 0, 54);
      rows.push({ forecast, weeks, phase: project ? 'Construction' : 'Pre-construction' });
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return { rows, overriddenProjectIds };
}