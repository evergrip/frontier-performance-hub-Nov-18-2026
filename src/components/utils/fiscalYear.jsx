// Fiscal years are keyed by their starting calendar year.
export const getCurrentFiscalYear = (fiscalStartMonth = 10, date = new Date()) =>
  date.getFullYear() - (date.getMonth() + 1 < fiscalStartMonth ? 1 : 0);

export const getFiscalYearDates = (fiscalYear, fiscalStartMonth = 10, isCurrent = false) => {
  const year = Number(fiscalYear);
  const startDate = new Date(year, fiscalStartMonth - 1, 1);
  const endDate = new Date(year + 1, fiscalStartMonth - 1, 0, 23, 59, 59, 999);
  const span = fiscalStartMonth === 1 ? `${year}` : `${year}/${String(year + 1).slice(-2)}`;
  const current = isCurrent && year === getCurrentFiscalYear(fiscalStartMonth) ? ' (Current)' : '';
  const display = date => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return { startDate, endDate, label: `FY ${span}${current} (${display(startDate)} – ${display(endDate)})` };
};

export const getFiscalYearLabel = (year, month = 10, current = false) =>
  getFiscalYearDates(year, month, current).label;

// Parse 'YYYY-MM-DD' / 'YYYY-MM' as a LOCAL date (new Date('2026-10-01') would be UTC midnight,
// i.e. Sep 30 evening in Toronto). Full ISO timestamps are parsed normally.
export const parseLocalDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value).trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1) : new Date(value);
  return isNaN(d) ? null : d;
};

export const endOfLocalDay = (value) => {
  const d = parseLocalDate(value);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) : null;
};

// Fiscal quarter q (1-4) of fiscal year fy (keyed by starting calendar year). Q1 = first 3 months of the FY.
export const getFiscalQuarterDates = (fiscalYear, quarter, fiscalStartMonth = 10) => {
  const startDate = new Date(Number(fiscalYear), fiscalStartMonth - 1 + (Number(quarter) - 1) * 3, 1);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

export const getCurrentFiscalQuarter = (fiscalStartMonth = 10, date = new Date()) =>
  Math.floor(((date.getMonth() + 1 - fiscalStartMonth + 12) % 12) / 3) + 1;

export const getFiscalQuarterLabel = (fiscalYear, quarter, fiscalStartMonth = 10) => {
  const { startDate, endDate } = getFiscalQuarterDates(fiscalYear, quarter, fiscalStartMonth);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short' });
  const span = fiscalStartMonth === 1 ? `${fiscalYear}` : `${fiscalYear}/${String(Number(fiscalYear) + 1).slice(-2)}`;
  return `Q${quarter} FY ${span} (${fmt(startDate)}–${fmt(endDate)})`;
};

// ---- KPI reporting periods (fiscal quarters/years, local calendar dates) ----
// Stored KPI period boundaries: the calendar date is the first 10 characters. Older entries were saved as
// UTC midnight of that date ("2026-10-01T00:00:00.000Z"), newer ones with the Toronto offset.
export const periodStartDate = (value) => (value ? parseLocalDate(String(value).slice(0, 10)) : null);
export const periodEndDate = (value) => (value ? endOfLocalDay(String(value).slice(0, 10)) : null);

const pad2 = (n) => String(n).padStart(2, '0');
const localKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localOffset = (d) => { const o = -d.getTimezoneOffset(); const a = Math.abs(o); return `${o >= 0 ? '+' : '-'}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`; };
// Serialize a period boundary as "YYYY-MM-DDT00:00:00-04:00" (start) / "YYYY-MM-DDT23:59:59-04:00" (end).
export const toPeriodBoundary = (date, isEnd = false) => `${localKey(date)}T${isEnd ? '23:59:59' : '00:00:00'}${localOffset(date)}`;

export const getKpiPeriodRange = (periodType, fiscalStartMonth = 10, now = new Date()) => {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (periodType) {
    case 'daily': return { start: new Date(y, m, d), end: new Date(y, m, d, 23, 59, 59, 999) };
    case 'weekly': { const s = new Date(y, m, d - now.getDay()); return { start: s, end: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59, 999) }; }
    case 'quarterly': { const q = getFiscalQuarterDates(getCurrentFiscalYear(fiscalStartMonth, now), getCurrentFiscalQuarter(fiscalStartMonth, now), fiscalStartMonth); return { start: q.startDate, end: q.endDate }; }
    case 'yearly': { const f = getFiscalYearDates(getCurrentFiscalYear(fiscalStartMonth, now), fiscalStartMonth); return { start: f.startDate, end: f.endDate }; }
    case 'monthly':
    default: return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59, 999) };
  }
};
