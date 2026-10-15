import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import WeeklyGpSchedule from '@/components/sales/WeeklyGpSchedule';
export default function WeeklyGpForecastDialog({ saleId, projectId, forecastId, onClose, onSaved }) {
  const client = useQueryClient(), [start, setStart] = useState(''), [budget, setBudget] = useState(''), [offset, setOffset] = useState(0), [changes, setChanges] = useState({});
  const invoke = async payload => { const response = await base44.functions.invoke('jobGpForecast', { saleId, projectId, forecastId, probableStartDate: start || undefined, totalGP: budget === '' ? undefined : Number(budget), overrideChanges: changes, offset, ...payload }); if (response.data.error) throw new Error(response.data.error); return response.data; };
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['weeklyGpForecast', saleId, projectId, forecastId, start, budget, offset, changes], queryFn: () => invoke({}), retry: false });
  const save = useMutation({ mutationFn: () => invoke({ action: 'save', revision: data?.forecast?.revision || 0 }), onSuccess: () => { ['weeklyGpForecast', 'fiscalProfitProgress', 'quarterProfitBreakdown', 'sales', 'projects', 'gpForecastTable'].forEach(key => client.invalidateQueries({ queryKey: [key] })); onSaved?.(); onClose(); } });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>GP dollar allocations{data?.title ? ` · ${data.title}` : ''}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); event.stopPropagation(); save.mutate(); }}>
      <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="probable-gp-start">Probable construction start</Label><Input id="probable-gp-start" type="date" required disabled={save.isPending || Object.keys(changes).length > 0} value={start || data?.draft?.probable_start_date || ''} onChange={event => { setStart(event.target.value); setOffset(0); }} /></div><div><Label htmlFor="gp-budget">Total job GP budget ($)</Label><Input id="gp-budget" type="number" min="0.01" step="0.01" required disabled={save.isPending} value={budget === '' ? data?.draft?.total_gp ?? '' : budget} onChange={event => setBudget(event.target.value)} /></div></div>
      {isPending ? <p role="status">Calculating GP allocation…</p> : error ? <p role="alert" className="text-destructive">{error.response?.data?.error || error.message} <Button type="button" variant="outline" onClick={() => { setBudget(''); setChanges({}); refetch(); }}>Reload saved schedule</Button></p> : <WeeklyGpSchedule data={data} offset={offset} onOffset={setOffset} onOverride={(date, amount) => setChanges(previous => ({ ...previous, [date]: amount }))} disabled={save.isPending} />}
      {save.error && <p role="alert" className="text-destructive">{save.error.response?.data?.error || save.error.message}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={isPending || !!error || save.isPending || !(data?.draft?.total_gp > 0) || !data?.draft?.probable_start_date}>{save.isPending ? 'Saving…' : 'Save GP allocations'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}