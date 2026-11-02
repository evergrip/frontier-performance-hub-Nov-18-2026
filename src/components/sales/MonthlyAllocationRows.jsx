import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export default function MonthlyAllocationRows({ rows, onChange, disabled }) {
  const update = (index, field, value) => onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  const add = () => {
    const last = rows.map(row => row.period).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 7);
    const [year, month] = last.split('-').map(Number);
    const period = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
    onChange([...rows, { period, gp: 0, revenue: 0 }]);
  };
  return <div className="space-y-3"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Month</th><th className="p-2">GP allocation ($)</th><th className="p-2">Revenue allocation ($)</th><th className="p-2"><span className="sr-only">Remove</span></th></tr></thead><tbody>
    {rows.map((row, index) => <tr key={index} className="border-t border-border">
      <td className="p-2"><Input aria-label={`Month ${index + 1}`} type="month" required max="2200-12" value={row.period} disabled={disabled} onChange={e => update(index, 'period', e.target.value)} /></td>
      <td className="p-2"><Input aria-label={`GP dollars for ${row.period}`} className="min-w-28" type="number" required min="0" step="0.01" value={row.gp} disabled={disabled} onChange={e => update(index, 'gp', e.target.value)} /></td>
      <td className="p-2"><Input aria-label={`Revenue dollars for ${row.period}`} className="min-w-28" type="number" required min="0" step="0.01" value={row.revenue} disabled={disabled} onChange={e => update(index, 'revenue', e.target.value)} /></td>
      <td className="p-2"><Button type="button" variant="ghost" size="sm" disabled={disabled || rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove</Button></td>
    </tr>)}
  </tbody></table></div><Button type="button" variant="outline" disabled={disabled} onClick={add}>Add month</Button></div>;
}