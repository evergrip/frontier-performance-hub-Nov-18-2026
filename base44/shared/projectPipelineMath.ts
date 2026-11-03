import { effectiveSchedule } from './weeklyGpForecast.ts';
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const hasNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0);
export function remainingProjectPipeline(project, sale, forecast, currentPeriod) {
  const contract = number(project.contract_value);
  const margin = hasNumber(project.actual_margin) ? number(project.actual_margin) : number(sale?.estimated_margin);
  let revenueBudget = contract, gpBudget = contract * margin / 100, rows;
  if (project.recognition_mode === 'monthly_actual') {
    rows = project.monthly_actual_allocations || [];
    gpBudget = sum(rows, 'gp');
  } else if (forecast?.allocation_mode === 'monthly') {
    rows = forecast.monthly_allocations || [];
    revenueBudget = hasNumber(forecast.total_revenue) ? number(forecast.total_revenue) : contract;
    gpBudget = number(forecast.total_gp);
  } else {
    rows = (project.monthly_revenue_allocations || []).map(row => ({ period: row.period || `${row.year}-${String(row.month).padStart(2, '0')}`, revenue: contract * number(row.percentage) / 100, gp: gpBudget * number(row.percentage) / 100 }));
    if (forecast) {
      gpBudget = number(forecast.total_gp);
      rows = [...rows.map(row => ({ ...row, gp: 0 })), ...effectiveSchedule(forecast).rows.map(row => ({ period: row.date.slice(0, 7), gp: row.amount, revenue: 0 }))];
    }
  }
  const future = rows.filter(row => row.period > currentPeriod);
  return { revenue: Math.max(0, revenueBudget - sum(rows, 'revenue')) + sum(future, 'revenue'), grossProfit: Math.max(0, gpBudget - sum(rows, 'gp')) + sum(future, 'gp') };
}
export function projectClosedInFiscalYear(project, fiscalYear) {
  const entry = [...(project.status_history || [])].reverse().find(row => row.status === 'closed');
  const date = String(project.actual_completion_date || entry?.entered_date || project.created_date || '').slice(0, 10);
  return date >= `${fiscalYear}-10-01` && date < `${fiscalYear + 1}-10-01`;
}