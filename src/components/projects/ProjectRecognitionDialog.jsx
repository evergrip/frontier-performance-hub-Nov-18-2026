import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import RecognitionRows from '@/components/projects/RecognitionRows';
import InventorySaleInputs from '@/components/projects/InventorySaleInputs';
export default function ProjectRecognitionDialog({ project, onClose }) {
  const client = useQueryClient();
  const [title, setTitle] = useState(project?.title || '');
  const [state, setState] = useState(project?.inventory_status || (project ? 'none' : 'held'));
  const [date, setDate] = useState(project?.inventory_sale_date || ''), [price, setPrice] = useState(project?.inventory_sale_price ?? '');
  const [rows, setRows] = useState(project?.monthly_actual_allocations?.length ? project.monthly_actual_allocations : [{ period: new Date().toISOString().slice(0, 7), costs: 0, revenue: 0, gp: 0 }]);
  const costs = rows.reduce((sum, row) => sum + Number(row.costs || 0), 0), gp = rows.reduce((sum, row) => sum + Number(row.gp || 0), 0);
  const applySale = () => {
    const period = date.slice(0, 7), next = rows.map(row => ({ ...row, revenue: 0, gp: 0 }));
    if (!next.some(row => row.period === period)) next.push({ period, costs: 0, revenue: 0, gp: 0 });
    setRows(next.map(row => row.period === period ? { ...row, revenue: Number(price), gp: Math.round((Number(price) - costs) * 100) / 100 } : row));
  };
  const save = useMutation({ mutationFn: async () => {
    const result = await base44.functions.invoke('jobGpForecast', { action: 'saveRecognition', projectId: project?.id, title, inventoryStatus: state, saleDate: date, salePrice: price, revision: project?.recognition_revision || 0, rows: rows.map(row => ({ ...row, costs: Number(row.costs), revenue: state === 'held' ? 0 : Number(row.revenue), gp: state === 'held' ? 0 : Number(row.gp) })) });
    if (result.data.error) throw new Error(result.data.error);
  }, onSuccess: async () => { await Promise.all(['projects', 'inventoryProjects', 'dashboardMonthlyAllocations', 'fiscalProfitProgress', 'quarterProfitBreakdown', 'gpForecastTable', 'monthlyGpForecast'].map(key => client.invalidateQueries({ queryKey: [key] }))); onClose(); } });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{project ? `${title} · Costs & GP timing` : 'New FBG inventory project'}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); e.stopPropagation(); save.mutate(); }}>
      {!project && <div><Label htmlFor="inventory-title">Project title</Label><Input id="inventory-title" required value={title} onChange={e => setTitle(e.target.value)} disabled={save.isPending} /></div>}
      <div><Label htmlFor="recognition-state">Recognition / inventory status</Label><select id="recognition-state" className="w-full rounded-md border border-input bg-background p-2" value={state} disabled={save.isPending} onChange={e => setState(e.target.value)}>{project && <option value="none">Project with independent costs & GP timing</option>}<option value="held">Held in FBG inventory (no GP)</option><option value="sold">Sold from FBG inventory</option></select></div>
      <p className="text-sm text-muted-foreground">Record costs in the months incurred and net GP in the months realized, independently. Costs are tracked separately, not deducted a second time from GP. Saving replaces automatic profit recognition for this project; existing forecast schedules remain stored but no longer count.</p>
      {project?.recognition_mode !== 'monthly_actual' && <p className="text-sm text-muted-foreground">Enter the complete cost, revenue and realized GP history before saving this timing override.</p>}
      {state === 'sold' && <InventorySaleInputs date={date} price={price} onDate={setDate} onPrice={setPrice} onApply={applySale} disabled={save.isPending} />}
      <RecognitionRows rows={rows} onChange={setRows} held={state === 'held'} disabled={save.isPending} />
      <p className="text-sm">Total incurred costs: ${costs.toLocaleString()} · Total realized GP: ${(state === 'held' ? 0 : gp).toLocaleString()}</p>
      {save.error && <p role="alert" className="text-destructive">{save.error.response?.data?.error || save.error.message}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button><Button disabled={save.isPending}>{save.isPending ? 'Saving…' : state === 'sold' ? 'Save inventory sale & allocations' : 'Save costs & GP timing'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}