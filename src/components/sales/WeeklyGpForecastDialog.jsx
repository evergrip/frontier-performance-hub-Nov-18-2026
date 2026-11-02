import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MonthlyGpAllocationEditor from '@/components/sales/MonthlyGpAllocationEditor';
export default function WeeklyGpForecastDialog({ saleId, projectId, forecastId, onClose, onSaved }) {
  const identifiers = { saleId, projectId, forecastId };
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['monthlyGpForecast', saleId, projectId, forecastId], queryFn: async () => {
    const response = await base44.functions.invoke('jobGpForecast', { ...identifiers, allocationMode: 'monthly' });
    if (response.data.error) throw new Error(response.data.error);
    return response.data;
  }, retry: false });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Monthly GP & revenue allocations{data?.title ? ` · ${data.title}` : ''}</DialogTitle></DialogHeader>
    {isPending ? <p role="status">Loading monthly allocations…</p> : error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error.response?.data?.error || error.message}</p><Button type="button" variant="outline" onClick={() => refetch()}>Reload allocations</Button></div> : <MonthlyGpAllocationEditor data={data} identifiers={identifiers} onClose={onClose} onSaved={onSaved} />}
  </DialogContent></Dialog>;
}