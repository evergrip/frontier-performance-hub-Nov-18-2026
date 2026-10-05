import { calculateProjectFinancials } from '@/lib/projectFinancials';
import { getCurrentFiscalYear } from '@/components/utils/fiscalYear';

export const allocationDate = a => {
  const [py, pm] = (a.period || '').split('-').map(Number);
  const year = Number(a.year) || py, month = Number(a.month) || pm;
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12 ? new Date(year, month - 1, 1) : null;
};
export const projectStartDate = p => {
  const dates = [p.start_date, ...(p.status_history || []).filter(h => ['mobilization', 'active_construction'].includes(h.status)).map(h => h.entered_date)].filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d));
  return dates.length ? new Date(Math.min(...dates)) : new Date(p.created_date);
};
export const projectClosedDate = p => {
  const entry = [...(p.status_history || [])].reverse().find(h => h.status === 'closed');
  return new Date(p.actual_completion_date || entry?.entered_date || p.created_date);
};
export function allocationPercentage(record, range, pastOnly = false, now = new Date()) {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  const allocations = record.monthly_revenue_allocations || [];
  const dates = allocations.map(a => allocationDate(a)?.getTime());
  if (dates.some(d => d == null) || new Set(dates).size !== dates.length || allocations.some(a => !Number.isFinite(Number(a.percentage)) || Number(a.percentage) < 0 || Number(a.percentage) > 100) || allocations.reduce((s, a) => s + Number(a.percentage), 0) > 100.1) return 0;
  return allocations.reduce((sum, a) => {
    const date = allocationDate(a), pct = Number(a.percentage);
    if (!date || !Number.isFinite(pct) || pct < 0 || pct > 100) return sum;
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    if (range?.start && monthEnd < range.start || range?.end && date > range.end || pastOnly && date >= cutoff) return sum;
    return sum + pct;
  }, 0);
}
export function projectPeriodFinancials(project, range, scheduled = false, startMonth = 10) {
  const f = calculateProjectFinancials(project);
  const margin = project.actual_margin;
  const grossProfit = margin !== null && margin !== undefined && margin !== '' ? f.revenue * Number(margin) / 100 : f.grossProfit;
  let percentage = allocationPercentage(project, range, !scheduled && project.status !== 'closed');
  if (!project.monthly_revenue_allocations?.length && project.status === 'closed') {
    const end = projectClosedDate(project), start = projectStartDate(project);
    const sameYear = getCurrentFiscalYear(startMonth, start) === getCurrentFiscalYear(startMonth, end);
    percentage = sameYear && (!range?.start || end >= range.start) && (!range?.end || end <= range.end) ? 100 : 0;
  }
  const revenue = f.revenue * percentage / 100, profit = grossProfit * percentage / 100;
  return { percentage, revenue, grossProfit: profit, costs: revenue - profit, grossMargin: f.revenue ? grossProfit / f.revenue * 100 : 0 };
}
export function carryoverIssue(project, range) {
  if (!range?.start || !range?.end || project.project_type !== 'construction') return null;
  if (projectStartDate(project) >= range.start || project.status === 'closed' && projectClosedDate(project) < range.start) return null;
  const allocations = project.monthly_revenue_allocations || [], periods = allocations.map(a => allocationDate(a)?.getTime());
  const total = allocations.reduce((s, a) => s + (Number(a.percentage) || 0), 0);
  if (!allocations.length) return 'Missing monthly allocations';
  if (periods.some(p => p == null) || allocations.some(a => !Number.isFinite(Number(a.percentage)) || Number(a.percentage) < 0 || Number(a.percentage) > 100)) return 'Invalid allocation entries';
  if (new Set(periods).size !== periods.length) return 'Duplicate monthly periods';
  if (Math.abs(total - 100) > 0.1) return `Total allocations are ${total.toFixed(1)}%, not 100%`;
  if (!allocationPercentage(project, range) && project.status !== 'closed') return 'No allocation for this fiscal year; verify remaining work';
  return null;
}