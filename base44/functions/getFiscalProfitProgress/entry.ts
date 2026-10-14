import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { allocationIssues, periodOf } from '../../shared/verificationMath.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { fiscalYear } = await req.json();
    const year = Number(fiscalYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return Response.json({ error: 'Invalid fiscal year' }, { status: 400 });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const currentPeriod = today.slice(0, 7);
    const start = `${year}-10`, end = `${year + 1}-09`;
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(year, 9 + index, 1));
      return { period: date.toISOString().slice(0, 7), revenue: 0, costs: 0, grossProfit: 0 };
    });
    const byPeriod = Object.fromEntries(months.map(month => [month.period, month]));
    const goalPage = await base44.entities.FiscalGoal.filter({ fiscal_year: year }, { limit: 1, fields: ['gross_profit_target'] });
    const target = Number(goalPage.items[0]?.gross_profit_target) || 0;
    const saleIds = [];
    if (user.role !== 'admin') {
      let cursor;
      do {
        const page = await base44.entities.Sale.filter({ $or: [{ assigned_to: user.id }, { 'sale_contributors.user_id': user.id }] }, { limit: 100, fields: ['id'], cursor });
        saleIds.push(...page.items.map(sale => sale.id));
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
    }
    const query = user.role === 'admin' ? { project_type: 'construction' } : { project_type: 'construction', $or: [{ project_manager_id: user.id }, { sale_id: { $in: saleIds } }] };
    let cursor, excludedProjects = 0, incompleteProjects = 0;
    const dateKey = value => {
      if (!value) return null;
      const text = String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    };
    do {
      const page = await base44.entities.Project.filter(query, { limit: 100, cursor, fields: ['contract_value', 'actual_costs', 'monthly_revenue_allocations', 'status', 'status_history', 'start_date', 'actual_completion_date', 'created_date'] });
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
        if (allocations.reduce((sum, item) => sum + Number(item.percentage), 0) < 99.9) incompleteProjects++;
        const revenue = Number(project.contract_value), costs = Number(project.actual_costs);
        if (!Number.isFinite(revenue) || !Number.isFinite(costs)) { excludedProjects++; continue; }
        for (const item of allocations) {
          const period = periodOf(item), month = byPeriod[period];
          if (!month || period > currentPeriod) continue;
          const share = Number(item.percentage) / 100;
          month.revenue += revenue * share;
          month.costs += costs * share;
          month.grossProfit = month.revenue - month.costs;
        }
      }
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);
    const total = rows => rows.reduce((sum, month) => ({ revenue: sum.revenue + month.revenue, costs: sum.costs + month.costs, grossProfit: sum.grossProfit + month.grossProfit }), { revenue: 0, costs: 0, grossProfit: 0 });
    const quarters = Array.from({ length: 4 }, (_, index) => {
      const rows = months.slice(index * 3, index * 3 + 3);
      return { quarter: index + 1, start: rows[0].period, end: rows[2].period, target: target / 4, isCurrent: rows[0].period <= currentPeriod && rows[2].period >= currentPeriod, upcoming: rows[0].period > currentPeriod, ...total(rows) };
    });
    return Response.json({ fiscalYear: year, target, asOf: today, scope: user.role === 'admin' ? 'company' : 'own', annual: total(months), quarters, excludedProjects, incompleteProjects });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}