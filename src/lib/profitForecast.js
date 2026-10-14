import { calculateProjectFinancials } from '@/lib/projectFinancials';
import { projectPeriodFinancials } from '@/components/utils/projectPeriod';
import { buildPipelineForecast } from '@/lib/pipelineForecast';

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function getProjectGrossProfit(project, sale) {
  const revenue = number(project.contract_value);
  const recordedMargin = project.actual_margin;
  const hasRecordedMargin = recordedMargin !== null && recordedMargin !== undefined && recordedMargin !== '';
  const margin = hasRecordedMargin ? number(recordedMargin) : number(sale?.estimated_margin);
  const financials = calculateProjectFinancials(project);
  // Active jobs always use the recorded/estimated margin; partial actual_costs never drive margin.
  const useMarginForecast = project.status !== 'closed';
  return {
    revenue,
    costs: financials.costs,
    grossProfit: useMarginForecast ? revenue * margin / 100 : financials.grossProfit,
    grossMargin: useMarginForecast ? margin : financials.grossMargin,
  };
}

// Realized (recognized to date) + remaining FY forecast, built on the shared pipeline forecast.
// For active jobs the margin is the recorded actual_margin, else the sale's estimated_margin —
// never (contract - partial actual_costs), which inflates margin early in a job.
export function calculateAnnualProfitForecast({ projects, sales, allSales = sales, dateRange, settings = {}, now = new Date() }) {
  const salesById = Object.fromEntries((allSales || []).map((s) => [s.id, s]));
  const construction = projects.filter((p) => p.project_type === 'construction');
  const realizedGP = construction.reduce((sum, p) => {
    const period = projectPeriodFinancials(p, dateRange);
    if (!period.percentage) return sum;
    if (p.status === 'closed') return sum + period.grossProfit;
    const { grossMargin } = getProjectGrossProfit(p, salesById[p.sale_id]);
    return sum + number(p.contract_value) * period.percentage / 100 * grossMargin / 100;
  }, 0);
  const closedCount = construction.filter((p) => p.status === 'closed' && projectPeriodFinancials(p, dateRange).percentage > 0).length;
  const f = buildPipelineForecast({ projects, sales, allSales, range: dateRange, settings, now });
  const inProgressGP = f.totals.activeFYGP;
  const signedGP = f.totals.signedFYGP;
  const pipelineGP = f.totals.preconFYGP;
  return {
    realizedGP,
    inProgressGP,
    signedGP,
    pipelineGP,
    projectedGP: realizedGP + inProgressGP + signedGP + pipelineGP,
    conversionRate: f.conversion.rate,
    conversion: f.conversion,
    probabilities: f.probabilities,
    closedCount,
    activeCount: f.activeProjects.filter((r) => r.fyValue > 0).length,
    signedCount: f.signedNoProject.filter((r) => r.fyValue > 0).length,
    pipelineCount: f.precon.filter((r) => r.fyValue > 0).length,
    assumedScheduleCount: [...f.activeProjects, ...f.signedNoProject, ...f.precon].filter((r) => r.assumedSchedule && r.fyValue > 0).length,
  };
}
