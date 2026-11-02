import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { allocationIssues, periodOf } from '../../shared/verificationMath.ts';
import { projectProfitMonths, contributionForQuarter } from '../../shared/quarterProfitMath.ts';
import { fiscalWeeklyForecasts } from '../../shared/fiscalWeeklyForecasts.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { fiscalYear, quarter, detailCursor, detailYear = false, assignedUserId, omittedCursor } = await req.json();
    const omittedOffset = omittedCursor == null ? null : Number(omittedCursor);
    if (omittedOffset !== null && (!Number.isInteger(omittedOffset) || omittedOffset < 0)) return Response.json({ error: 'Invalid omitted-project cursor' }, { status: 400 });
    const omittedItems = [];
    const scopeUser = user.role === 'admin' && assignedUserId ? { id: String(assignedUserId), role: 'user' } : user;
    const requestedQuarter = detailYear ? 1 : quarter == null ? null : Number(quarter);
    const offset = detailCursor == null ? 0 : Number(detailCursor);
    if ((requestedQuarter !== null && (!Number.isInteger(requestedQuarter) || requestedQuarter < 1 || requestedQuarter > 4)) || !Number.isInteger(offset) || offset < 0) return Response.json({ error: 'Invalid quarter or cursor' }, { status: 400 });
    const contributions = [];
    const revenueProjectIds = new Set();
    const year = Number(fiscalYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return Response.json({ error: 'Invalid fiscal year' }, { status: 400 });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const currentPeriod = today.slice(0, 7);
    const start = `${year}-10`, end = `${year + 1}-09`;
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(year, 9 + index, 1));
      return { period: date.toISOString().slice(0, 7), revenue: 0, allocatedRevenue: 0, costs: 0, grossProfit: 0, forecastGrossProfit: 0 };

    });
    const byPeriod = Object.fromEntries(months.map(month => [month.period, month]));
    const missingMargins = Array.from({ length: 4 }, () => new Set());
    const detailStart = detailYear ? start : requestedQuarter ? months[(requestedQuarter - 1) * 3].period : null;
    const detailEnd = detailYear ? end : requestedQuarter ? months[requestedQuarter * 3 - 1].period : null;
    const goalPage = await base44.entities.FiscalGoal.filter({ fiscal_year: year }, { limit: 1, fields: ['gross_profit_target'] });
    const target = Number(goalPage.items[0]?.gross_profit_target) || 0;
    const saleIds = [];
    if (scopeUser.role !== 'admin') {
      let cursor;
      do {
        const page = await base44.entities.Sale.filter({ $or: [{ assigned_to: scopeUser.id }, { 'sale_contributors.user_id': scopeUser.id }] }, { limit: 100, fields: ['id'], cursor });
        saleIds.push(...page.items.map(sale => sale.id));
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
    }
    const query = scopeUser.role === 'admin' ? { project_type: 'construction' } : { project_type: 'construction', $or: [{ project_manager_id: scopeUser.id }, { sale_id: { $in: saleIds } }] };
    let cursor, excludedProjects = 0, incompleteProjects = 0;
    let forecastContractValue = 0, forecastEstimatedGP = 0, forecastProjectCount = 0, forecastSkippedCount = 0;
    const dateKey = value => {
      if (!value) return null;
      const text = String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    };
    const weeklyForecast = await fiscalWeeklyForecasts(base44, scopeUser, start, end);
    do {
      const page = await base44.entities.Project.filter(query, { limit: 100, cursor, fields: ['title', 'sale_id', 'contract_value', 'actual_costs', 'actual_margin', 'include_in_forecast', 'monthly_revenue_allocations', 'status', 'status_history', 'start_date', 'actual_completion_date', 'created_date'] });
      const linkedIds = [...new Set(page.items.filter(project => project.status !== 'closed' && project.include_in_forecast !== false && (project.actual_margin == null || project.actual_margin === '')).map(project => project.sale_id).filter(Boolean))];
      const linkedSales = linkedIds.length ? await base44.entities.Sale.filter({ id: { $in: linkedIds } }, { limit: 100, fields: ['estimated_margin'] }) : { items: [] };
      const salesById = Object.fromEntries(linkedSales.items.map(sale => [sale.id, sale]));
      for (const project of page.items) {
        let allocations = project.monthly_revenue_allocations || [];
        if (!allocations.length && project.status === 'closed') {
          const history = project.status_history || [];
          const close = dateKey(project.actual_completion_date || [...history].reverse().find(item => item.status === 'closed')?.entered_date || project.created_date);
          const startDates = [project.start_date, ...history.filter(item => ['mobilization', 'active_construction'].includes(item.status)).map(item => item.entered_date)].map(dateKey).filter(Boolean).sort();
          const began = startDates[0] || dateKey(project.created_date);
          const fy = value => Number(value.slice(0, 4)) - (Number(value.slice(5, 7)) < 10 ? 1 : 0);
          if (began && close && fy(began) === fy(close)) allocations = [{ period: close.slice(0, 7), percentage: 100 }];
        }
        if (!allocations.length || allocationIssues(allocations).length) { excludedProjects++; continue; }
        const relevant = allocations.some(item => { const period = periodOf(item); return period >= start && period <= end; });
        if (!relevant) continue;
        const forecastEligible = project.status !== 'closed' && project.include_in_forecast !== false && allocations.some(item => periodOf(item) >= start && periodOf(item) <= end && Number(item.percentage) > 0);
        if (forecastEligible) {
          const rawMargin = project.actual_margin != null && project.actual_margin !== '' ? project.actual_margin : salesById[project.sale_id]?.estimated_margin;
          const margin = rawMargin == null || rawMargin === '' ? NaN : Number(rawMargin);
          const contractValue = Number(project.contract_value);
          if (Number.isFinite(contractValue) && contractValue > 0 && Number.isFinite(margin) && margin > 0 && margin <= 100) {
            forecastContractValue += contractValue;
            forecastEstimatedGP += contractValue * margin / 100;
            forecastProjectCount++;
          } else {
            if (omittedOffset !== null && forecastSkippedCount >= omittedOffset && omittedItems.length < 50) {
              const issues = [];
              if (!Number.isFinite(contractValue) || contractValue <= 0) issues.push('Contract value must be greater than zero.');
              if (!Number.isFinite(margin) || margin <= 0 || margin > 100) issues.push('Forecast margin must be greater than zero and at most 100%.');
              omittedItems.push({ id: project.id, title: project.title, status: project.status, contract_value: project.contract_value ?? null, actual_margin: project.actual_margin ?? null, effective_margin: Number.isFinite(margin) ? margin : null, issues });
            }
            forecastSkippedCount++;
          }
        }
        if (allocations.reduce((sum, item) => sum + Number(item.percentage), 0) < 99.9) incompleteProjects++;
        const revenue = Number(project.contract_value), costs = Number(project.actual_costs);
        if (!Number.isFinite(revenue) || !Number.isFinite(costs)) { excludedProjects++; continue; }
        const profitMonths = projectProfitMonths(project, salesById[project.sale_id], allocations, currentPeriod).filter(row => byPeriod[row.period]);
        revenueProjectIds.add(project.id);
        for (const row of profitMonths) {
          row.allocatedRevenue = revenue * row.percentage / 100;
          byPeriod[row.period].allocatedRevenue += row.allocatedRevenue;
          if (weeklyForecast.overriddenProjectIds.has(project.id)) { row.forecastGrossProfit = 0; row.forecastMissing = false; row.forecastBasis = 'Weekly GP schedule (shown separately)'; }
          const month = byPeriod[row.period];
          month.revenue += row.revenue;
          month.costs += row.costs;
          month.grossProfit = month.revenue - month.costs;
          month.forecastGrossProfit += row.forecastGrossProfit;
          if (row.forecastMissing) missingMargins[Math.floor(months.indexOf(month) / 3)].add(project.id);
        }
        if (requestedQuarter) {
          const quarterRows = profitMonths.filter(row => row.period >= detailStart && row.period <= detailEnd && row.percentage > 0);
          if (quarterRows.length) contributions.push(contributionForQuarter(project, quarterRows));
        }
      }
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);
    for (const entry of weeklyForecast.rows) {
      const revenueMonths = Object.fromEntries(months.map(month => [month.period, 0]));
      if (Number.isFinite(Number(entry.revenueValue)) && !allocationIssues(entry.revenueAllocations).length) {
        for (const allocation of entry.revenueAllocations) {
          const period = periodOf(allocation);
          if (byPeriod[period]) revenueMonths[period] += Number(entry.revenueValue) * Number(allocation.percentage) / 100;
        }
      }
      if (!revenueProjectIds.has(entry.forecast.project_id)) for (const month of months) month.allocatedRevenue += revenueMonths[month.period];
      for (const week of entry.weeks) byPeriod[week.date.slice(0, 7)].forecastGrossProfit += week.amount;
      if (requestedQuarter) {
        const weeks = entry.weeks.filter(week => week.date.slice(0, 7) >= detailStart && week.date.slice(0, 7) <= detailEnd);
        const existingRow = entry.forecast.project_id ? contributions.find(row => row.id === entry.forecast.project_id) : null;
        const fields = { revenueMonths, allocatedRevenue: Object.entries(revenueMonths).filter(([period]) => period >= detailStart && period <= detailEnd).reduce((sum, [, value]) => sum + value, 0), forecastId: entry.forecast.id, projectId: entry.forecast.project_id, kind: 'weekly_forecast', title: entry.forecast.title, phase: entry.phase, totalGP: entry.forecast.total_gp, weeklyGP: entry.forecast.weekly_gp, probableStartDate: entry.forecast.probable_start_date, forecastGrossProfit: weeks.reduce((sum, week) => sum + week.amount, 0), weeks };
        if (existingRow) Object.assign(existingRow, fields);
        else if (weeks.length) contributions.push({ id: entry.forecast.project_id || `forecast-${entry.forecast.id}`, grossProfit: 0, ...fields });
      }
    }
    const total = rows => rows.reduce((sum, month) => ({ revenue: sum.revenue + month.revenue, costs: sum.costs + month.costs, grossProfit: sum.grossProfit + month.grossProfit }), { revenue: 0, costs: 0, grossProfit: 0 });
    const quarters = Array.from({ length: 4 }, (_, index) => {
      const rows = months.slice(index * 3, index * 3 + 3);
      return { quarter: index + 1, start: rows[0].period, end: rows[2].period, target: target / 4, isCurrent: rows[0].period <= currentPeriod && rows[2].period >= currentPeriod, upcoming: rows[0].period > currentPeriod, ...total(rows), forecastGrossProfit: rows.reduce((sum, row) => sum + row.forecastGrossProfit, 0), forecastMissingMargins: missingMargins[index].size };
    });
    for (const contribution of contributions) {
      const grouped = Object.fromEntries(months.map(month => [month.period, 0]));
      if (contribution.kind === 'weekly_forecast') for (const week of contribution.weeks) grouped[week.date.slice(0, 7)] += week.amount;
      else for (const month of contribution.months) grouped[month.period] += month.forecastGrossProfit;
      contribution.forecastMonths = grouped;
      if (!contribution.revenueMonths) {
        contribution.revenueMonths = Object.fromEntries(months.map(month => [month.period, 0]));
        for (const month of contribution.months || []) contribution.revenueMonths[month.period] += month.allocatedRevenue;
        contribution.allocatedRevenue = Object.values(contribution.revenueMonths).reduce((sum, value) => sum + value, 0);
      }
    }
    contributions.sort((a, b) => b.grossProfit - a.grossProfit || String(a.title).localeCompare(String(b.title)) || a.id.localeCompare(b.id));
    const details = requestedQuarter ? { items: contributions.slice(offset, offset + 50), total: contributions.length, has_more: offset + 50 < contributions.length, next_cursor: offset + 50 < contributions.length ? String(offset + 50) : null } : undefined;
    const weightedMargin = forecastContractValue > 0 ? forecastEstimatedGP / forecastContractValue : null;
    const omittedProjects = omittedOffset === null ? undefined : { items: omittedItems, total: forecastSkippedCount, has_more: omittedOffset + 50 < forecastSkippedCount, next_cursor: omittedOffset + 50 < forecastSkippedCount ? omittedOffset + 50 : null };
    const revenueRequirement = { omittedProjects, weightedMargin, requiredRevenue: Number.isFinite(target) && target > 0 && weightedMargin > 0 ? target / weightedMargin : null, projectCount: forecastProjectCount, skippedCount: forecastSkippedCount };
    return Response.json({ fiscalYear: year, target, revenueRequirement, asOf: today, scope: user.role === 'admin' ? 'company' : 'own', annual: { ...total(months), allocatedRevenue: months.reduce((sum, month) => sum + month.allocatedRevenue, 0), forecastGrossProfit: months.reduce((sum, month) => sum + month.forecastGrossProfit, 0) }, months, quarters, excludedProjects, incompleteProjects, details });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}