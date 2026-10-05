import React from 'react';
import { Button } from '@/components/ui/button';
import { allocationDate } from '@/components/utils/projectPeriod';

export default function InvalidAllocationRows({ allocations, onChange }) {
  const invalid = allocations.map((a, index) => ({ a, index })).filter(({ a }) => !allocationDate(a));
  if (!invalid.length) return null;
  return <div className="space-y-2 border border-destructive p-3 rounded-md">
    <p className="text-sm text-destructive">Correct undated allocations before saving. These entries have not been discarded.</p>
    {invalid.map(({ a, index }) => <div key={index} className="flex flex-wrap gap-2 items-center">
      <input aria-label="Allocation month" type="month" className="bg-background border rounded p-1" value="" onChange={e => { const [year, month] = e.target.value.split('-').map(Number); onChange(allocations.map((row, i) => i === index ? { ...row, year, month, period: e.target.value } : row)); }} />
      <span className="text-sm">{Number(a.percentage) || 0}%</span>
      <Button size="sm" variant="outline" onClick={() => onChange(allocations.filter((_, i) => i !== index))}>Remove entry</Button>
    </div>)}
  </div>;
}