import { remainingProjectPipeline, projectClosedInFiscalYear } from './projectPipelineMath.ts';
export async function projectPipelineSummary(base44, user, input) {
  if (input.assignedUserId != null && typeof input.assignedUserId !== 'string') return Response.json({ error: 'Select a valid salesperson.' }, { status: 400 });
  const assignedId = user.role === 'admin' ? input.assignedUserId : user.id;
  const scopeSales = []; let cursor;
  if (assignedId) do {
    const page = await base44.entities.Sale.filter({ assigned_to: assignedId }, { limit: 100, cursor, fields: ['id'] });
    scopeSales.push(...page.items.map(sale => sale.id)); cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Halifax', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const year = Number(parts.find(part => part.type === 'year').value), month = Number(parts.find(part => part.type === 'month').value);
  const currentPeriod = `${year}-${String(month).padStart(2, '0')}`, fiscalYear = year - (month < 10 ? 1 : 0);
  const totals = { revenue: 0, grossProfit: 0, currentMonthRevenue: 0, currentMonthGrossProfit: 0, activeCount: 0, closedCount: 0, fiscalYear, currentPeriod };
  const query = { inventory_status: { $nin: ['held', 'sold'] }, ...(assignedId ? { $or: [{ project_manager_id: assignedId }, { sale_id: { $in: scopeSales } }] } : {}) };
  cursor = null;
  do {
    const page = await base44.entities.Project.filter(query, { limit: 100, cursor });
    const active = page.items.filter(project => project.status !== 'closed');
    const ids = active.map(project => project.id), saleIds = [...new Set(active.map(project => project.sale_id).filter(Boolean))];
    const forecasts = {}, sales = {}; let forecastCursor, saleCursor;
    if (ids.length) do {
      const found = await base44.entities.GrossProfitForecast.filter({ project_id: { $in: ids } }, { sort: '-updated_date', limit: 100, cursor: forecastCursor });
      for (const row of found.items) if (!forecasts[row.project_id]) forecasts[row.project_id] = row;
      forecastCursor = found.has_more ? found.next_cursor : null;
    } while (forecastCursor);
    if (saleIds.length) do {
      const found = await base44.entities.Sale.filter({ id: { $in: saleIds } }, { limit: 100, cursor: saleCursor, fields: ['id', 'estimated_margin'] });
      for (const row of found.items) sales[row.id] = row;
      saleCursor = found.has_more ? found.next_cursor : null;
    } while (saleCursor);
    for (const project of page.items) {
      if (project.status === 'closed') { if (projectClosedInFiscalYear(project, fiscalYear)) totals.closedCount++; continue; }
      totals.activeCount++;
      const remaining = remainingProjectPipeline(project, sales[project.sale_id], forecasts[project.id], currentPeriod);
      totals.revenue += remaining.revenue; totals.grossProfit += remaining.grossProfit;
      totals.currentMonthRevenue += remaining.currentMonthRevenue; totals.currentMonthGrossProfit += remaining.currentMonthGrossProfit;
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  for (const field of ['revenue', 'grossProfit', 'currentMonthRevenue', 'currentMonthGrossProfit']) totals[field] = Math.round(totals[field] * 100) / 100;
  return Response.json(totals);
}