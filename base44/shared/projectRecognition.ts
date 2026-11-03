export function recognitionMonths(project, currentPeriod) {
  const held = project.inventory_status === 'held';
  return (project.monthly_actual_allocations || []).map(row => {
    const actual = row.period <= currentPeriod;
    const gp = held ? 0 : Number(row.gp || 0), revenue = held ? 0 : Number(row.revenue || 0);
    return { period: row.period, percentage: 100, reportedPercentage: actual ? 100 : 0, revenue: actual ? revenue : 0, costs: actual ? Number(row.costs || 0) : 0, grossProfit: actual ? gp : 0, forecastGrossProfit: gp, allocatedRevenue: revenue, forecastMissing: false, forecastBasis: held ? 'FBG inventory: costs incurred, no GP until sold' : 'Independent monthly costs and realized GP', margin: null };
  });
}