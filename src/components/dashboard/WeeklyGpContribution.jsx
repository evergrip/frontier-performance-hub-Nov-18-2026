import React from 'react';
import { Button } from '@/components/ui/button';
const money = value => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function WeeklyGpContribution({ row, onEdit }) {
  return <div className="space-y-3 rounded-md border border-border bg-card p-4">
    <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{row.title}</h3><p className="text-xs text-muted-foreground">{row.phase} · shared GP dollar schedule</p></div><div className="flex flex-wrap gap-2">{row.projectId && <Button size="sm" variant="outline" onClick={() => onEdit(row.projectId, 'financials')}>Edit financials</Button>}<Button size="sm" variant="outline" onClick={() => onEdit(row.forecastId, 'weekly')}>Edit GP allocations</Button></div></div>
    <p className="text-sm font-semibold">Reported GP {money(row.grossProfit || 0)} · quarter forecast GP {money(row.forecastGrossProfit)}</p>
    <p className="text-xs text-muted-foreground">Probable start {row.probableStartDate} · {money(row.weeklyGP)} per week · total job GP {money(row.totalGP)}. Reported GP uses recorded costs; weekly dollars control timing.</p>
    <details className="text-xs"><summary className="cursor-pointer text-primary">Weekly allocations this quarter</summary><table className="mt-2 w-full text-left"><thead><tr><th className="p-2">Date</th><th className="p-2">GP</th><th className="p-2">Remaining</th></tr></thead><tbody>{row.weeks.map(week => <tr key={week.date} className="border-t border-border"><td className="p-2">{week.date}</td><td className="p-2">{money(week.amount)}</td><td className="p-2">{money(week.remaining)}</td></tr>)}</tbody></table></details>
  </div>;
}