import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
export default function MoveProjectToInventoryDialog({ project, onClose, onMoved }) {
  const client = useQueryClient();
  const [period, setPeriod] = useState('');
  const preview = useQuery({ queryKey: ['inventoryMovePreview', project.id], staleTime: 0, queryFn: async () => {
    const result = await base44.functions.invoke('jobGpForecast', { action: 'moveToInventory', projectId: project.id, preview: true });
    if (result.data.error) throw new Error(result.data.error);
    return result.data;
  } });
  const move = useMutation({ mutationFn: async () => {
    const result = await base44.functions.invoke('jobGpForecast', { action: 'moveToInventory', projectId: project.id, convertAllHistory: true, updatedDate: preview.data.updatedDate, costPeriod: period });
    if (result.data.error) throw new Error(result.data.error);
  }, onSuccess: async () => {
    await Promise.all(['projects', 'inventoryProjects', 'dashboardMonthlyAllocations', 'fiscalProfitProgress', 'quarterProfitBreakdown', 'quarterProfitProject', 'gpForecastTable', 'monthlyGpForecast', 'weeklyGpForecast'].map(key => client.invalidateQueries({ queryKey: [key] })));
    toast.success('Project moved to FBG Inventory'); onMoved?.(); onClose();
  } });
  const error = move.error || preview.error;
  return <Dialog open onOpenChange={open => { if (!open && !move.isPending) onClose(); }}><DialogContent onClick={e => e.stopPropagation()}><DialogHeader><DialogTitle>Move to FBG Inventory</DialogTitle></DialogHeader>
    {preview.isPending ? <p role="status">Loading recorded project costs…</p> : preview.data && <div className="space-y-3">
      <p className="font-semibold">{preview.data.title}</p>
      <p className="text-sm">This moves the existing project, without creating a duplicate. All historical project revenue and GP will be removed from reporting, and GP will remain zero until an inventory sale is recorded.</p>
      <p className="text-sm">Recorded costs retained: <strong>${preview.data.costs.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>. Existing forecasts stop counting. Linked sales and commission transactions are not changed.</p>
      {preview.data.hasMonthlyCosts ? <p className="text-sm text-muted-foreground">Existing monthly cost entries keep their recorded months.</p> : <div><Label htmlFor="inventory-move-period">Month for existing recorded costs</Label><Input id="inventory-move-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} disabled={move.isPending} /><p className="text-xs text-muted-foreground mt-1">No monthly cost history is recorded. Choose where to place the existing cost total; costs can be split by month in inventory afterward.</p></div>}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error.response?.data?.error || error.message}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={move.isPending} onClick={onClose}>Cancel</Button><Button type="button" disabled={preview.isFetching || !preview.data || move.isPending || (!preview.data.hasMonthlyCosts && !period)} onClick={() => move.mutate()}>{move.isPending ? 'Moving…' : 'Confirm move & convert all history'}</Button></div>
  </DialogContent></Dialog>;
}