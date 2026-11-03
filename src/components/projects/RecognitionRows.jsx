import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export default function RecognitionRows({ rows, onChange, held, disabled }) {
  const update = (index, field, value) => onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  return <div className="space-y-3">
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Month', 'Costs incurred ($)', 'Revenue ($)', 'Realized GP ($)', 'Actions'].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead><tbody>
      {rows.map((row, index) => <tr key={index} className="border-t border-border">
        <td className="p-1"><Input aria-label={`Month ${index + 1}`} type="month" required value={row.period} disabled={disabled} onChange={e => update(index, 'period', e.target.value)} /></td>
        {['costs', 'revenue', 'gp'].map(field => <td key={field} className="p-1"><Input aria-label={`${field} ${index + 1}`} className="min-w-28" type="number" step="0.01" min={field === 'gp' ? undefined : 0} required value={held && field !== 'costs' ? 0 : row[field]} disabled={disabled || held && field !== 'costs'} onChange={e => update(index, field, e.target.value)} /></td>)}
        <td><Button type="button" variant="ghost" disabled={disabled || rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove</Button></td>
      </tr>)}
    </tbody></table></div>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange([...rows, { period: '', costs: 0, revenue: 0, gp: 0 }])}>Add month</Button>
  </div>;
}