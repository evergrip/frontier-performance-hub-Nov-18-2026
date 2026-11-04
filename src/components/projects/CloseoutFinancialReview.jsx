import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import MonthlyAllocationRows from '@/components/sales/MonthlyAllocationRows';
import GpAllocationBudgetInputs from '@/components/sales/GpAllocationBudgetInputs';
import RecognitionRows from '@/components/projects/RecognitionRows';
import CloseoutFinancialTotals from '@/components/projects/CloseoutFinancialTotals';
import { Button } from '@/components/ui/button';
export default function CloseoutFinancialReview({ projectId, financials, onChange, disabled }) {
  const query = useQuery({ queryKey: ['projectCloseoutFinancials', projectId], staleTime: Infinity, gcTime: 0, queryFn: async () => {
    const project = await base44.entities.Project.get(projectId);
    if (project.recognition_mode === 'monthly_actual') {
      const rows = project.monthly_actual_allocations?.length ? project.monthly_actual_allocations : [{ period: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Halifax' }).slice(0, 7), costs: project.actual_costs ?? 0, revenue: 0, gp: 0 }];
      return { project, rows, revision: project.recognition_revision || 0, baselineCosts: rows.reduce((sum, row) => sum + Number(row.costs || 0), 0), saved: !!project.monthly_actual_allocations?.length };
    }
    const response = await base44.functions.invoke('jobGpForecast', { action: 'load', projectId, allocationMode: 'monthly' });
    if (response.data.error) throw new Error(response.data.error);
    const data = response.data;
    return { project, rows: data.draft.monthly_allocations, totalRevenue: data.draft.total_revenue, totalGP: data.draft.total_gp, revision: data.forecast?.revision || 0, baselineCosts: data.draft.total_revenue - data.draft.total_gp, saved: !!data.forecast || !!project.monthly_revenue_allocations?.length };
  } });
  useEffect(() => { if (query.data) onChange(query.data); }, [query.data, onChange]);
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading the PM’s saved financial allocations…</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{query.error.response?.data?.error || query.error.message}</p><Button type="button" variant="outline" onClick={() => query.refetch()}>Reload allocations</Button></div>;
  if (!financials) return null;
  const actual = financials.project.recognition_mode === 'monthly_actual';
  const update = patch => onChange(previous => ({ ...previous, ...patch }));
  return <section className="space-y-4">
    <div><h3 className="font-semibold">Review & approve saved financials</h3><p className="text-sm text-muted-foreground">{financials.saved ? 'Loaded from the PM’s existing allocations. Approve them as entered, or adjust the budgets and monthly amounts below.' : 'No saved allocation schedule was found. These starting figures come from the project estimates; review and complete the monthly amounts before approving.'}</p></div>
    {!actual && <><GpAllocationBudgetInputs gp={financials.totalGP} revenue={financials.totalRevenue} onGpChange={totalGP => update({ totalGP })} onRevenueChange={totalRevenue => update({ totalRevenue })} disabled={disabled} /><p className="text-xs text-muted-foreground">Final costs are revenue less GP, using the same monthly allocation method. All final budget dollars must be allocated. The signed contract is not changed here.</p></>}
    {actual ? <><p className="text-xs text-muted-foreground">Costs and realized GP retain their independently entered monthly timing. GP is not reduced by costs a second time.</p><RecognitionRows rows={financials.rows} onChange={rows => update({ rows })} held={financials.project.inventory_status === 'held'} disabled={disabled} /></> : <MonthlyAllocationRows rows={financials.rows} onChange={rows => update({ rows })} disabled={disabled} />}
    <CloseoutFinancialTotals financials={financials} />
  </section>;
}