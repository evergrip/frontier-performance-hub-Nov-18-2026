import { monthlyProjectForecasts, forecastProfitMonths } from './monthlyProjectForecasts.ts';
import { recognitionMonths } from './projectRecognition.ts';
export async function monthlyPeriodTotals(base44, input) {
  if (!Array.isArray(input.projectIds) || input.projectIds.some(id => typeof id !== 'string')) return Response.json({ error: 'Select valid project IDs.' }, { status: 400 });
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (input.start && !datePattern.test(input.start) || input.end && !datePattern.test(input.end)) return Response.json({ error: 'Select a valid reporting range.' }, { status: 400 });
  if (!input.projectIds.length) return Response.json({ projects: {} });
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Halifax', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const currentPeriod = `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
  const forecasts = await monthlyProjectForecasts(base44, input.projectIds);
  const projects = {}; let cursor;
  do {
    const page = await base44.entities.Project.filter({ id: { $in: input.projectIds } }, { limit: 100, cursor });
    for (const project of page.items) {
      const independent = project.recognition_mode === 'monthly_actual', forecast = forecasts[project.id];
      if (!independent && !forecast) continue;
      const rows = independent ? recognitionMonths(project, currentPeriod) : forecastProfitMonths(forecast, project, currentPeriod);
      const matching = rows.filter(row => {
        const monthEnd = new Date(Date.UTC(Number(row.period.slice(0, 4)), Number(row.period.slice(5, 7)), 0)).toISOString().slice(0, 10);
        return (!input.start || monthEnd >= input.start) && (!input.end || `${row.period}-01` <= input.end);
      });
      const sum = field => Math.round(matching.reduce((total, row) => total + row[field], 0) * 100) / 100;
      const revenue = sum('revenue'), grossProfit = sum('grossProfit'), costs = sum('costs');
      projects[project.id] = { revenue, grossProfit, costs, grossMargin: revenue ? grossProfit / revenue * 100 : 0, percentage: revenue || grossProfit || costs ? 100 : 0 };
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return Response.json({ projects });
}