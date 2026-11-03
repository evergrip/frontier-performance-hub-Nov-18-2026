export async function monthlyProjectForecasts(base44, projectIds) {
  const result = {}; let cursor;
  if (!projectIds.length) return result;
  do {
    const page = await base44.entities.GrossProfitForecast.filter({ project_id: { $in: projectIds }, allocation_mode: 'monthly' }, { sort: '-updated_date', limit: 100, cursor });
    for (const forecast of page.items) if (!result[forecast.project_id]) result[forecast.project_id] = forecast;
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return result;
}
export function forecastProfitMonths(forecast, project, currentPeriod) {
  return (forecast.monthly_allocations || []).map(row => {
    const recognized = project.status === 'closed' ? row.period <= currentPeriod : row.period < currentPeriod;
    const revenue = Number(row.revenue || 0), gp = Number(row.gp || 0);
    const percentage = forecast.total_revenue > 0 ? revenue / forecast.total_revenue * 100 : forecast.total_gp > 0 ? gp / forecast.total_gp * 100 : 0;
    return { period: row.period, percentage: percentage || (revenue || gp ? 100 : 0), reportedPercentage: recognized ? percentage : 0, revenue: recognized ? revenue : 0, costs: recognized ? revenue - gp : 0, grossProfit: recognized ? gp : 0, allocatedRevenue: revenue, forecastGrossProfit: gp, forecastMissing: false, forecastBasis: 'Saved monthly GP and revenue dollar allocations', margin: revenue ? gp / revenue * 100 : null };
  });
}