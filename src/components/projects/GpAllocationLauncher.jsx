import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import WeeklyGpForecastDialog from '@/components/sales/WeeklyGpForecastDialog';
export default function GpAllocationLauncher({ projectId, saleId, onSaved, label = 'Edit GP dollar allocations' }) {
  const [open, setOpen] = useState(false);
  if (!projectId && !saleId) return null;
  return <div className="space-y-2 border-t border-border pt-3">
    <p className="text-xs text-muted-foreground">One GP dollar schedule follows this job from pre-construction through construction. Manual weekly amounts replace automatic amounts; the remainder is redistributed without increasing total GP.</p>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>{label}</Button>
    {open && <WeeklyGpForecastDialog key={projectId || saleId} projectId={projectId} saleId={saleId} onClose={() => setOpen(false)} onSaved={onSaved} />}
  </div>;
}