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

export function calculateAnnualProfitForecast({ projects, sales, fiscalProjects }) {
  const constructionSales = sales.filter((sale) => sale.sale_type === 'construction');
  const saleForProject = (project) => constructionSales.find((sale) => sale.id === project.sale_id);
  const closed = fiscalProjects.filter((project) => project.status === 'closed' && project.project_type === 'construction');
  const active = projects.filter((project) => project.status !== 'closed' && project.project_type === 'construction');
  const historicalPrecon = sales.filter((sale) => sale.sale_type === 'preconstruction' && ['closed_won', 'closed_lost'].includes(sale.status));
  const converted = historicalPrecon.filter((sale) => sale.status === 'closed_won' && constructionSales.some((construction) => construction.linked_precon_sale_id === sale.id)).length;
  const conversionRate = historicalPrecon.length >= 3 ? converted / historicalPrecon.length : 0.5;
  const pipelineSales = sales.filter((sale) => sale.sale_type === 'preconstruction' && !['closed_won', 'closed_lost'].includes(sale.status) && sale.include_in_forecast !== false);
  const realizedGP = closed.reduce((sum, project) => sum + getProjectGrossProfit(project, saleForProject(project)).grossProfit, 0);
  const inProgressGP = active.reduce((sum, project) => sum + getProjectGrossProfit(project, saleForProject(project)).grossProfit, 0);
  const pipelineGP = pipelineSales.reduce((sum, sale) => sum + number(sale.estimated_construction_budget) * conversionRate * number(sale.estimated_margin) / 100, 0);
  return { realizedGP, inProgressGP, pipelineGP, projectedGP: realizedGP + inProgressGP + pipelineGP, conversionRate, closedCount: closed.length, activeCount: active.length, pipelineCount: pipelineSales.length };
}