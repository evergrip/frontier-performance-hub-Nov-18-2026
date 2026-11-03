import React from 'react';
import { Button } from '@/components/ui/button';
import ProjectProfitActions from '@/components/projects/ProjectProfitActions';

const money = value => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
export default function QuarterProfitContribution({ row, onEdit }) {
  return <div className="space-y-3 rounded-md border border-border bg-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold text-foreground">{row.title}</h3><p className="text-xs text-muted-foreground">{row.status.replaceAll('_', ' ')} · {row.reportedPercentage.toFixed(2)}% reported / {row.percentage.toFixed(2)}% scheduled this quarter</p></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(row.id, 'financials')}>Edit financials</Button>{row.recognitionMode === 'monthly_actual' ? <ProjectProfitActions project={row.project} /> : <Button size="sm" variant="outline" onClick={() => onEdit(row.id, 'gp')}>Edit GP allocations</Button>}</div>
    </div>
    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
      <div><p className="text-xs text-muted-foreground">Allocated revenue</p><p>{money(row.revenue)}</p></div>
      <div><p className="text-xs text-muted-foreground">Allocated costs</p><p>{money(row.costs)}</p></div>
      <div><p className="text-xs text-muted-foreground">Reported GP</p><p className="font-semibold">{money(row.grossProfit)}</p></div>
      <div><p className="text-xs text-muted-foreground">Full-quarter forecast GP</p><p className="font-semibold">{row.forecastMissing ? 'Margin missing' : money(row.forecastGrossProfit)}</p></div>
    </div>
    <p className="text-xs text-muted-foreground">Total contract {money(row.contractValue)} · total recorded costs {money(row.actualCosts)}. Forecast: {row.forecastBasis}{row.margin !== null && row.forecastBasis !== 'Closed project: contract less final costs' ? ` (${row.margin}%)` : ''}.</p>
    <details className="text-xs"><summary className="cursor-pointer text-primary">Monthly calculation</summary>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Month</th><th className="p-2">Allocation</th><th className="p-2">Reported GP</th><th className="p-2">Forecast GP</th></tr></thead><tbody>{row.months.map(month => <tr key={month.period} className="border-t border-border"><td className="p-2">{month.period}</td><td className="p-2">{month.percentage}%{!month.reportedPercentage ? ' (future)' : ''}</td><td className="p-2">{money(month.grossProfit)}</td><td className="p-2">{month.forecastMissing ? 'Margin missing' : money(month.forecastGrossProfit)}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}