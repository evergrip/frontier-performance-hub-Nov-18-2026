export const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const near = (a, b, tolerance = 0.02) => Math.abs(Number(a) - Number(b)) <= tolerance;
export function periodOf(a) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(a.period || '');
  const year = a.year == null ? Number(match?.[1]) : Number(a.year);
  const month = a.month == null ? Number(match?.[2]) : Number(a.month);
  if (!Number.isInteger(year) || year < 1900 || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (a.period && (!match || Number(match[1]) !== year || Number(match[2]) !== month)) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}
export function allocationIssues(rows, field = 'percentage', requireFull = false) {
  const issues = [], periods = new Set(); let total = 0;
  for (const a of rows || []) {
    const period = periodOf(a), percentage = Number(a[field]);
    if (!period || a[field] == null || a[field] === '' || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) issues.push('Invalid period or percentage');
    if (period && periods.has(period)) issues.push('Duplicate monthly period');
    periods.add(period); total += Number.isFinite(percentage) ? percentage : 0;
  }
  if (field === 'percentage' && (total > 100.1 || requireFull && !near(total, 100, 0.1))) issues.push(`Total is ${total.toFixed(2)}%, expected ${requireFull ? '100%' : 'at most 100%'}`);
  return [...new Set(issues)];
}
export function phaseRelease(total, initialAvailable, alreadyReleased, targetPercent) {
  const target = number(total) * number(targetPercent) / 100;
  return Math.max(0, Math.min(number(total) - number(initialAvailable) - number(alreadyReleased), target - number(initialAvailable) - number(alreadyReleased)));
}
export const availableAfterPayouts = (releasedAndImmediate, paid) => number(releasedAndImmediate) - number(paid);
export function selectCommissionRule(rules, type) {
  const active = rules.filter(r => r.is_active !== false);
  return active.find(r => r.sale_type === type) || active.find(r => r.sale_type === 'both');
}