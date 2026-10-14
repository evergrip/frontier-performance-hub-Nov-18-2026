import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import WeeklyGpSchedule from '@/components/sales/WeeklyGpSchedule';
export default function WeeklyGpForecastDialog({ saleId, forecastId, onClose, onSaved }) {
  const client = useQueryClient();
  const [start, setStart] = useState('');
  const [offset, setOffset] = useState(0);
  const invoke = async payload => { const response = await base44.functions.invoke('jobGpForecast', { saleId, forecastId, probableStartDate: start || undefined, ...payload }); if (response.data.error) throw new Error(response.data.error); return response.data; };
  const { data, isPending, error } = useQuery({ queryKey: ['weeklyGpForecast', saleId, forecastId, start, offset], queryFn: () => invoke({ offset }) });
  const save = useMutation({ mutationFn: () => invoke({ action: 'save' }), onSuccess: () => { ['weeklyGpForecast', 'fiscalProfitProgress', 'quarterProfitBreakdown', 'sales', 'projects'].forEach(key => client.invalidateQueries({ queryKey: [key] })); onSaved?.(); onClose(); } });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Weekly GP forecast{data?.title ? ` · ${data.title}` : ''}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <div className="space-y-1"><Label htmlFor="probable-gp-start">Date of probable construction start</Label><Input id="probable-gp-start" type="date" required disabled={save.isPending} value={start || data?.forecast?.probable_start_date || ''} onChange={event => { setStart(event.target.value); setOffset(0); }} /></div>
      {isPending ? <p role="status">Calculating weekly forecast…</p> : error ? <p role="alert" className="text-destructive">{error.message}</p> : <WeeklyGpSchedule data={data} offset={offset} onOffset={setOffset} />}
      {save.error && <p role="alert" className="text-destructive">{save.error.message}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={isPending || !!error || save.isPending || !(data?.annualTarget > 0) || !(data?.estimatedGP > 0)}>{save.isPending ? 'Saving…' : 'Save GP forecast'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}