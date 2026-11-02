export async function monthlyPeriodTotals(base44, input) {
  if (!Array.isArray(input.projectIds) || input.projectIds.some(id => typeof id !== 'string')) return Response.json({ error: 'Select valid project IDs.' }, { status: 400 });
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (input.start && !datePattern.test(input.start) || input.end && !datePattern.test(input.end)) return Response.json({ error: 'Select a valid reporting range.' }, { status: 400 });
  if (!input.projectIds.length) return Response.json({ projects: {} });
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Halifax', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const currentPeriod = `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
  const projects = {}; let cursor;
  do {
    const page = await base44.entities.GrossProfitForecast.filter({ project_id: { $in: input.projectIds }, allocation_mode: 'monthly' }, { sort: '-updated_date', limit: 100, cursor });
    for (const forecast of page.items) {
      if (projects[forecast.project_id]) continue;
      let revenue = 0, grossProfit = 0;
      for (const row of forecast.monthly_allocations || []) {
        const monthEnd = new Date(Date.UTC(Number(row.period.slice(0, 4)), Number(row.period.slice(5, 7)), 0)).toISOString().slice(0, 10);
        if (row.period >= currentPeriod || input.start && monthEnd < input.start || input.end && `${row.period}-01` > input.end) continue;
        revenue += Number(row.revenue || 0); grossProfit += Number(row.gp || 0);
      }
      revenue = Math.round(revenue * 100) / 100; grossProfit = Math.round(grossProfit * 100) / 100;
      projects[forecast.project_id] = { revenue, grossProfit, costs: Math.round((revenue - grossProfit) * 100) / 100, grossMargin: revenue ? grossProfit / revenue * 100 : 0, percentage: forecast.total_revenue > 0 ? revenue / forecast.total_revenue * 100 : forecast.total_gp > 0 ? grossProfit / forecast.total_gp * 100 : 0 };
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return Response.json({ projects });
}