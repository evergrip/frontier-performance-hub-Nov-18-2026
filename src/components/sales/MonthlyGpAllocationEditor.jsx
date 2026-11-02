import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import MonthlyAllocationRows from '@/components/sales/MonthlyAllocationRows';
const money = value => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function MonthlyGpAllocationEditor({ data, identifiers, onClose, onSaved }) {
  const client = useQueryClient();
  const [gp, setGp] = useState(data.draft.total_gp), [revenue, setRevenue] = useState(data.draft.total_revenue), [rows, setRows] = useState(data.draft.monthly_allocations);
  const allocatedGP = rows.reduce((sum, row) => sum + Number(row.gp || 0), 0), allocatedRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const overBudget = allocatedGP > Number(gp) + 0.01 || allocatedRevenue > Number(revenue) + 0.01;
  const save = useMutation({ mutationFn: async () => {
    const response = await base44.functions.invoke('jobGpForecast', { ...identifiers, forecastScope: data.forecastScope || identifiers.forecastScope, action: 'save', allocationMode: 'monthly', totalGP: Number(gp), totalRevenue: Number(revenue), monthlyAllocations: rows, revision: data.forecast?.revision || 0 });
    if (response.data.error) throw new Error(response.data.error);
    return response.data;
  }, onSuccess: () => { ['weeklyGpForecast', 'monthlyGpForecast', 'fiscalProfitProgress', 'quarterProfitBreakdown', 'sales', 'projects', 'gpForecastTable'].forEach(key => client.invalidateQueries({ queryKey: [key] })); onSaved?.(); onClose(); } });
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); e.stopPropagation(); save.mutate(); }}>
    <p className="text-sm text-muted-foreground">{data.phase}. Set GP and revenue dollars independently for each month. These are planning estimates, not accounting approvals.</p>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="monthly-gp-budget">Total job GP budget ($)</Label><Input id="monthly-gp-budget" type="number" required min="0" step="0.01" value={gp} disabled={save.isPending} onChange={e => setGp(e.target.value)} /></div><div><Label htmlFor="monthly-revenue-budget">Total forecast revenue ($)</Label><Input id="monthly-revenue-budget" type="number" required min="0" step="0.01" value={revenue} disabled={save.isPending} onChange={e => setRevenue(e.target.value)} /></div></div>
    {data.forecastScope === 'precon' && <p className="text-xs text-muted-foreground">Revenue starts from the pre-con contract value. Enter the expected GP for pre-con services only; construction budgets and allocations remain separate.</p>}
    {data.migratingWeekly && <p className="text-xs text-muted-foreground">Existing weekly allocations are grouped into months without changing their totals. Save to switch this job to monthly allocations.</p>}
    <MonthlyAllocationRows rows={rows} onChange={setRows} disabled={save.isPending} />
    <div className="grid gap-2 text-sm sm:grid-cols-2"><div><p>Allocated GP: <strong>{money(allocatedGP)}</strong></p><p>Unallocated GP: {money(Number(gp) - allocatedGP)}</p></div><div><p>Allocated revenue: <strong>{money(allocatedRevenue)}</strong></p><p>Unallocated revenue: {money(Number(revenue) - allocatedRevenue)}</p></div></div>
    {overBudget && <p role="alert" className="text-sm text-destructive">Allocations exceed a job budget. Increase the budget or reduce the monthly amounts.</p>}
    {save.error && <p role="alert" className="text-sm text-destructive">{save.error.response?.data?.error || save.error.message}</p>}
    <p className="text-xs text-muted-foreground">Saving replaces this job’s previous allocation schedule and updates the forecast table and dashboard. Forecast revenue does not change the signed contract value.</p>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending || overBudget}>{save.isPending ? 'Saving…' : 'Save monthly allocations'}</Button></div>
  </form>;
}