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