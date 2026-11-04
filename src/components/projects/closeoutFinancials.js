const cents = value => Math.round(Number(value) * 100) / 100;
export function closeoutTotals(financials) {
  if (!financials) return { ready: false, error: 'Load the saved allocations before approving closeout.' };
  const actual = financials.project.recognition_mode === 'monthly_actual';
  const sum = field => cents(financials.rows.reduce((total, row) => total + Number(row[field]), 0));
  const revenue = actual ? sum('revenue') : cents(financials.totalRevenue), gp = actual ? sum('gp') : cents(financials.totalGP);
  const costs = actual ? sum('costs') : cents(revenue - gp), margin = revenue ? gp / revenue * 100 : 0;
  const valid = value => value !== '' && value != null && Number.isFinite(Number(value));
  let error = '';
  if (!financials.rows.length || financials.rows.some(row => !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) || row.period > '2200-12' || !(actual ? ['revenue', 'gp', 'costs'] : ['revenue', 'gp']).every(field => valid(row[field]) && (field === 'gp' && actual || Number(row[field]) >= 0))) || new Set(financials.rows.map(row => row.period)).size !== financials.rows.length) error = 'Enter unique valid months and complete dollar amounts.';
  else if (![revenue, gp, costs].every(Number.isFinite) || revenue < 0 || costs < 0 || !actual && (!valid(financials.totalRevenue) || !valid(financials.totalGP) || gp < 0)) error = 'Enter valid final amounts. Revenue and costs cannot be negative.';
  else if (!actual && (Math.abs(sum('gp') - gp) > 0.01 || Math.abs(sum('revenue') - revenue) > 0.01)) error = 'Allocate all final GP and revenue to months before approving closeout.';

  return { revenue, gp, costs, margin, ready: !error, error };
}
export function closeoutCostVariance(financials) {
  if (!financials) return 0;
  const difference = Math.abs(closeoutTotals(financials).costs - financials.baselineCosts);
  return financials.baselineCosts ? difference / Math.abs(financials.baselineCosts) * 100 : difference ? 100 : 0;
}