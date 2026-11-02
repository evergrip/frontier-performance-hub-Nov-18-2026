import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const rounded = value => Math.round(value * 100) / 100;
export default function GpAllocationBudgetInputs({ gp, revenue, onGpChange, onRevenueChange, disabled }) {
  const [basis, setBasis] = useState('dollars');
  const [rate, setRate] = useState('');
  const percent = basis === 'percent' ? rate : Number(revenue) > 0 && gp !== '' ? rounded(Number(gp) / Number(revenue) * 100) : '';
  const changePercent = value => {
    setBasis('percent');
    setRate(value);
    onGpChange(value === '' ? '' : rounded(Number(revenue) * Number(value) / 100));
  };
  const changeRevenue = value => {
    onRevenueChange(value);
    if (basis === 'percent') onGpChange(rate === '' ? '' : rounded(Number(value) * Number(rate) / 100));
  };
  return <div className="space-y-2">
    <div className="grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="monthly-gp-percent">GP margin (%)</Label><Input id="monthly-gp-percent" type="number" min="0" step="any" value={percent} disabled={disabled} onChange={e => changePercent(e.target.value)} /></div>
      <div><Label htmlFor="monthly-gp-budget">Total job GP budget ($)</Label><Input id="monthly-gp-budget" type="number" required min="0" step="0.01" value={gp} disabled={disabled} onChange={e => { setBasis('dollars'); onGpChange(e.target.value); }} /></div>
      <div><Label htmlFor="monthly-revenue-budget">Total forecast revenue ($)</Label><Input id="monthly-revenue-budget" type="number" required min="0" step="0.01" value={revenue} disabled={disabled} onChange={e => changeRevenue(e.target.value)} /></div>
    </div>
    <p className="text-xs text-muted-foreground">GP % = total GP ÷ forecast revenue. Editing either GP field updates the other. Revenue changes keep the last-edited GP percentage or dollar amount; monthly allocations stay unchanged.</p>
  </div>;
}