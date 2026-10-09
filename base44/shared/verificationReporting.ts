import { recorder } from './verificationLinks.ts';
import { number, near } from './verificationMath.ts';
export async function checkReporting(entities, type, rows, add) {
  for (const r of rows) {
    const emit = recorder(type, r, add, type === 'FiscalGoal' ? 'Dashboard' : 'Reports', ['Dashboard','Reports']);
    if (type === 'CompanySettings' && r.fiscal_year_start_month !== 10) emit('fiscal-start', 'Company fiscal setting disagrees with the approved October start.', 10, r.fiscal_year_start_month, 'high');
    if (type === 'FiscalGoal') {
      if (!Number.isInteger(Number(r.fiscal_year))) emit('fiscal-key', 'Fiscal target has an invalid starting-year identifier.', 'Integer starting calendar year', r.fiscal_year, 'high');
      if (r.gross_profit_target == null || number(r.gross_profit_target) <= 0) emit('gp-target', 'Gross Profit progress cannot be verified without a positive target.', 'Configured annual Gross Profit target', r.gross_profit_target ?? 'Missing', 'medium', 'investigate');
      if (r.revenue_target > 0 && r.gross_margin_target != null && r.gross_profit_target != null && !near(number(r.revenue_target) * number(r.gross_margin_target) / 100, r.gross_profit_target)) emit('target-consistency', 'Revenue × target margin differs from the GP target; confirm intended planning assumptions.', number(r.revenue_target) * number(r.gross_margin_target) / 100, r.gross_profit_target, 'low', 'investigate');
    }
  }
  if (type === 'CompanySettings') {
    const year = new Date().getUTCFullYear() - (new Date().getUTCMonth() < 9 ? 1 : 0);
    const total = await entities.FiscalGoal.count({ fiscal_year: year });
    if (!total) recorder('CompanySettings', rows[0] || { id: 'current-fiscal-settings', title: 'Current fiscal year' }, add, 'Dashboard', ['Dashboard','Reports'])('current-fiscal-goal', 'Current fiscal year has no target record.', `FY ${year}/${String(year+1).slice(-2)} target`, 'Missing FiscalGoal', 'medium', 'investigate');
    if (rows.length > 1) recorder(type, rows[0], add, 'Reports', ['Dashboard','Reports'])('multiple-settings', 'Multiple company settings records can produce inconsistent defaults.', 'One canonical company settings record', rows.length, 'medium', 'investigate');
  }
}