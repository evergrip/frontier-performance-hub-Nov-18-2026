export const WEEK = 7 * 86400000;
export function dateTime(value) {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? Date.parse(`${value}T00:00:00Z`) : NaN;
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Use a valid calendar date.');
  return time;
}
export function effectiveSchedule(forecast) {
  const start = dateTime(forecast.probable_start_date), budget = Math.round(Number(forecast.total_gp) * 100), rate = Math.round(Number(forecast.weekly_gp) * 100);
  if (!Number.isSafeInteger(budget) || budget < 0 || !Number.isSafeInteger(rate) || rate < 0) throw new Error('GP dollars and weekly rate must be finite and non-negative.');
  const overrides = new Map();
  for (const row of forecast.weekly_overrides || []) {
    const index = (dateTime(row.date) - start) / WEEK, amount = Math.round(Number(row.amount) * 100);
    if (!Number.isInteger(index) || index < 0 || dateTime(row.date) > Date.UTC(2200, 11, 31)) throw new Error('Each override must be a week date on the seven-day schedule, through 2200.');
    if (overrides.has(index)) throw new Error('Duplicate week dates are not allowed.');
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Week amounts must be non-negative GP dollars.');
    overrides.set(index, amount);
  }
  const reserved = [...overrides.values()].reduce((sum, value) => sum + value, 0);
  if (reserved > budget) throw new Error('Manual weekly GP exceeds the total job GP budget.');
  let automatic = budget - reserved;
  const last = Math.max(-1, ...overrides.keys(), rate > 0 ? Math.ceil(automatic / rate) + overrides.size - 1 : -1);
  if (start + Math.max(0, last) * WEEK > Date.UTC(2200, 11, 31)) throw new Error('Schedule extends beyond 2200; review the annual GP goal.');
  const rows = []; let cumulative = 0;
  for (let index = 0; index <= last; index++) {
    const manual = overrides.has(index), cents = manual ? overrides.get(index) : Math.min(rate, automatic);
    if (!manual) automatic -= cents;
    cumulative += cents;
    rows.push({ week: index + 1, date: new Date(start + index * WEEK).toISOString().slice(0, 10), amount: cents / 100, remaining: (budget - cumulative) / 100, manual });
  }
  while (rows.length && !rows.at(-1).manual && rows.at(-1).amount === 0) rows.pop();
  return { rows, weeks: rows.length, endDate: rows.at(-1)?.date || forecast.probable_start_date, allocatedGP: cumulative / 100, unallocatedGP: (budget - cumulative) / 100 };
}
export function scheduleInfo(start, total, weekly) { return effectiveSchedule({ probable_start_date: start, total_gp: total, weekly_gp: weekly }); }
export function weeklyRows(forecast, fromDate, toDate, offset = 0, limit = 50) {
  return effectiveSchedule(forecast).rows.filter(row => (!fromDate || row.date >= fromDate) && (!toDate || row.date <= toDate)).slice(offset, offset + limit);
}
export function monthlyShares(forecast) {
  const amounts = new Map();
  for (const row of effectiveSchedule(forecast).rows) amounts.set(row.date.slice(0, 7), (amounts.get(row.date.slice(0, 7)) || 0) + row.amount);
  return [...amounts].filter(([, amount]) => amount > 0).map(([period, amount]) => ({ period, year: Number(period.slice(0, 4)), month: Number(period.slice(5, 7)), percentage: forecast.total_gp > 0 ? amount / forecast.total_gp * 100 : 0 }));
}