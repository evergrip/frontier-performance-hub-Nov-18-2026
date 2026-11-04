import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCloseoutCommissionDecision } from '@/lib/projectFinancials';
import { closeoutTotals, closeoutCostVariance } from '@/components/projects/closeoutFinancials';
export default function useCloseoutApproval({ onSaved, onSuccess }) {
  const client = useQueryClient();
  return useMutation({ mutationFn: async ({ financials, linkedSale, form, threshold, auditPassed }) => {
    const totals = closeoutTotals(financials);
    if (!auditPassed) throw new Error('Resolve or skip all audit items before closing.');
    if (!totals.ready) throw new Error(totals.error);
    if (closeoutCostVariance(financials) > threshold && !form.variance_explanation?.trim()) throw new Error('Explain the change from the previously entered project costs.');
    if (linkedSale?.estimated_margin != null && Math.abs(totals.margin - linkedSale.estimated_margin) > 2 && !form.margin_variance_explanation?.trim()) throw new Error('Explain the difference between estimated and final gross margin.');
    const project = financials.project, actual = project.recognition_mode === 'monthly_actual';
    const response = await base44.functions.invoke('jobGpForecast', actual ? { action: 'saveRecognition', projectId: project.id, inventoryStatus: project.inventory_status || 'none', saleDate: project.inventory_sale_date || '', salePrice: project.inventory_sale_price ?? '', revision: financials.revision, rows: financials.rows.map(row => ({ period: row.period, costs: Number(row.costs), revenue: Number(row.revenue), gp: Number(row.gp) })) } : { action: 'save', projectId: project.id, allocationMode: 'monthly', revision: financials.revision, totalGP: totals.gp, totalRevenue: totals.revenue, monthlyAllocations: financials.rows.map(row => ({ period: row.period, gp: Number(row.gp), revenue: Number(row.revenue) })) });
    if (response.data.error) throw new Error(response.data.error);
    onSaved(actual ? response.data.project.recognition_revision : response.data.forecast.revision);
    if (!actual) {
      const validation = await base44.functions.invoke('jobGpForecast', { action: 'validateCloseout', projectId: project.id, finalTotalGP: totals.gp });
      if (validation.data.error) throw new Error(validation.data.error);
    }
    const decision = getCloseoutCommissionDecision(project, linkedSale);
    let warning = decision.shouldProcess ? decision.hasContractMismatch ? 'Project and linked Sale contract values differ; the linked Sale value was used' : null : decision.reason;
    if (decision.shouldProcess) {
      try { await base44.functions.invoke('processCommission', { sale_id: linkedSale.id, sale_type: 'construction', final_amount: decision.finalAmount, is_closeout: true }); }
      catch (error) { warning = `commission processing failed: ${error.message || error}`; }
    }
    const freshProject = await base44.entities.Project.get(project.id);
    let notes = freshProject.notes || '';
    notes = `${notes}\n\nApproved Closeout Results: Expected project contract revenue $${Number(project.contract_value || 0).toFixed(2)}; final revenue $${totals.revenue.toFixed(2)}; final costs $${totals.costs.toFixed(2)}; final GP $${totals.gp.toFixed(2)}.`.trim();
    if (form.variance_explanation) notes = `${notes}\n\nCloseout Variance Explanation: ${form.variance_explanation}`.trim();
    if (form.margin_variance_explanation) notes = `${notes}\n\nMargin Variance Explanation: ${form.margin_variance_explanation}`.trim();
    await base44.entities.Project.update(project.id, { status: 'closed', status_history: [...(freshProject.status_history || []), { status: 'closed', entered_date: new Date().toISOString(), source: 'project' }], contract_value: totals.revenue, actual_costs: totals.costs, actual_margin: totals.margin, notes });
    return { warning, title: project.title };
  }, onSuccess: async result => {
    await Promise.all(['projects', 'sales', 'commission-transactions', 'weeklyGpForecast', 'monthlyGpForecast', 'fiscalProfitProgress', 'quarterProfitBreakdown', 'gpForecastTable', 'dashboardMonthlyAllocations'].map(key => client.invalidateQueries({ queryKey: [key] })));
    onSuccess(result);
  } });
}