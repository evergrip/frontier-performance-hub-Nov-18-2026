import { calculateProjectFinancials } from '@/lib/projectFinancials';

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function getProjectGrossProfit(project, sale) {
  const revenue = number(project.contract_value);
  const recordedMargin = project.actual_margin;
  const hasRecordedMargin = recordedMargin !== null && recordedMargin !== undefined && recordedMargin !== '';
  const margin = hasRecordedMargin ? number(recordedMargin) : number(sale?.estimated_margin);
  const financials = calculateProjectFinancials(project);
  const useMarginForecast = hasRecordedMargin || margin > 0;
  return {
    revenue,
    costs: financials.costs,
    grossProfit: useMarginForecast ? revenue * margin / 100 : financials.grossProfit,
    grossMargin: useMarginForecast ? margin : financials.grossMargin,
  };
}

const getAllocationPercentageInRange = (record, dateRange) => {
  if (!dateRange?.start || !dateRange?.end) return 0;
  return (record.monthly_revenue_allocations || []).reduce((total, allocation) => {
    const [periodYear, periodMonth] = (allocation.period || '').split('-').map(Number);
    const year = Number(allocation.year) || periodYear;
    const month = Number(allocation.month) || periodMonth;
    if (!year || !month) return total;
    const allocationDate = new Date(year, month - 1, 1);
    return allocationDate >= dateRange.start && allocationDate <= dateRange.end
      ? total + number(allocation.percentage)
      : total;
  }, 0);
};

export function calculateAnnualProfitForecast({ projects, sales, fiscalProjects, dateRange }) {
  const constructionSales = sales.filter((sale) => sale.sale_type === 'construction');
  const saleForProject = (project) => constructionSales.find((sale) => sale.id === project.sale_id);
  const closed = fiscalProjects.filter((project) => project.status === 'closed' && project.project_type === 'construction');
  const active = projects.filter((project) => project.status !== 'closed' && project.project_type === 'construction');
  const historicalPrecon = sales.filter((sale) => sale.sale_type === 'preconstruction' && ['closed_won', 'closed_lost'].includes(sale.status));
  const converted = historicalPrecon.filter((sale) => sale.status === 'closed_won' && constructionSales.some((construction) => construction.linked_precon_sale_id === sale.id)).length;
  const conversionRate = historicalPrecon.length >= 3 ? converted / historicalPrecon.length : 0.5;
  const pipelineSales = sales.filter((sale) => sale.sale_type === 'preconstruction' && !['closed_won', 'closed_lost'].includes(sale.status) && sale.include_in_forecast !== false);
  const realizedGP = closed.reduce((sum, project) => sum + getProjectGrossProfit(project, saleForProject(project)).grossProfit, 0);
  const activeAllocations = active.map((project) => ({ project, percentage: getAllocationPercentageInRange(project, dateRange) }));
  const inProgressGP = activeAllocations.reduce((sum, { project, percentage }) => sum + getProjectGrossProfit(project, saleForProject(project)).grossProfit * percentage / 100, 0);
  const pipelineAllocations = pipelineSales.map((sale) => ({ sale, percentage: getAllocationPercentageInRange(sale, dateRange) }));
  const pipelineGP = pipelineAllocations.reduce((sum, { sale, percentage }) => sum + number(sale.estimated_construction_budget) * conversionRate * number(sale.estimated_margin) * percentage / 10000, 0);
  return {
    realizedGP,
    inProgressGP,
    pipelineGP,
    projectedGP: realizedGP + inProgressGP + pipelineGP,
    conversionRate,
    closedCount: closed.length,
    activeCount: activeAllocations.filter(({ percentage }) => percentage > 0).length,
    pipelineCount: pipelineAllocations.filter(({ percentage }) => percentage > 0).length,
  };
}