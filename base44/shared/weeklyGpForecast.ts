const WEEK = 7 * 86400000;
export function scheduleInfo(start, total, weekly) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(start || '') ? new Date(`${start}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== start || !Number.isFinite(total) || total < 0 || !Number.isFinite(weekly) || weekly <= 0) throw new Error('Use a valid probable start date, positive annual GP goal, and non-negative estimated GP.');
  const weeks = Math.ceil(total / weekly);
  const endTime = date.getTime() + Math.max(0, weeks - 1) * WEEK;
  if (endTime > Date.UTC(2201, 0, 1)) throw new Error('This schedule extends beyond 2200. Review the annual target and estimated GP.');
  return { startTime: date.getTime(), weeks, endDate: new Date(endTime).toISOString().slice(0, 10) };
}
export function weeklyRows(forecast, fromDate, toDate, offset = 0, limit = 50) {
  const info = scheduleInfo(forecast.probable_start_date, forecast.total_gp, forecast.weekly_gp);
  const first = fromDate ? Math.max(0, Math.ceil((new Date(`${fromDate}T00:00:00Z`).getTime() - info.startTime) / WEEK)) : 0;
  const last = toDate ? Math.min(info.weeks - 1, Math.floor((new Date(`${toDate}T00:00:00Z`).getTime() - info.startTime) / WEEK)) : info.weeks - 1;
  return Array.from({ length: Math.max(0, Math.min(limit, last - first - offset + 1)) }, (_, index) => {
    const n = first + offset + index;
    const allocated = Math.min(forecast.total_gp, n * forecast.weekly_gp);
    const amount = Math.min(forecast.weekly_gp, Math.max(0, forecast.total_gp - allocated));
    return { week: n + 1, date: new Date(info.startTime + n * WEEK).toISOString().slice(0, 10), amount, remaining: Math.max(0, forecast.total_gp - allocated - amount) };
  });
}