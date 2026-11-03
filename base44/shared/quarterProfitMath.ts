import { periodOf } from './verificationMath.ts';
import { recognitionMonths } from './projectRecognition.ts';

const hasNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export function projectProfitMonths(project, sale, allocations, currentPeriod) {
  if (project.recognition_mode === 'monthly_actual') return recognitionMonths(project, currentPeriod);
  const revenue = Number(project.contract_value), costs = Number(project.actual_costs);
  const closed = project.status === 'closed';
  const margin = hasNumber(project.actual_margin) ? Number(project.actual_margin) : hasNumber(sale?.estimated_margin) ? Number(sale.estimated_margin) : null;
  const included = closed || project.include_in_forecast !== false;
  const forecastMissing = included && !closed && margin === null;
  const forecastBasis = !included ? 'Excluded from forecast' : closed ? 'Closed project: contract less final costs' : margin === null ? 'Missing forecast margin' : hasNumber(project.actual_margin) ? 'Project margin' : 'Linked sale estimated margin';
  const fullProfit = closed ? revenue - costs : margin === null ? 0 : revenue * margin / 100;
  return allocations.map(item => {
    const period = periodOf(item), percentage = Number(item.percentage);
    const reportedPercentage = period <= currentPeriod ? percentage : 0;
    const share = reportedPercentage / 100;
    return { period, percentage, reportedPercentage, revenue: revenue * share, costs: costs * share, grossProfit: (revenue - costs) * share, forecastGrossProfit: included ? fullProfit * percentage / 100 : 0, forecastMissing: forecastMissing && percentage > 0, forecastBasis, margin };
  });
}

export function contributionForQuarter(project, rows) {
  const sum = field => rows.reduce((total, row) => total + row[field], 0);
  return { id: project.id, title: project.title, status: project.status, contractValue: Number(project.contract_value), actualCosts: Number(project.actual_costs), percentage: sum('percentage'), reportedPercentage: sum('reportedPercentage'), revenue: sum('revenue'), costs: sum('costs'), grossProfit: sum('grossProfit'), forecastGrossProfit: sum('forecastGrossProfit'), forecastBasis: rows[0].forecastBasis, margin: rows[0].margin, forecastMissing: rows.some(row => row.forecastMissing), months: rows };
}