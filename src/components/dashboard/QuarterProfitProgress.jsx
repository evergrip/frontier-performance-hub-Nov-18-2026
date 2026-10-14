import React from 'react';
import { Progress } from '@/components/ui/progress';

const money = value => `$${Math.round(value).toLocaleString()}`;
const monthLabel = period => new Date(`${period}-01T12:00:00`).toLocaleDateString('en-CA', { month: 'short' });

export default function QuarterProfitProgress({ quarter }) {
  const percent = quarter.target > 0 ? quarter.grossProfit / quarter.target * 100 : 0;
  return <div className={`space-y-3 rounded-md border p-4 ${quarter.isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
    <div className="flex flex-wrap items-center justify-between gap-1">
      <h3 className="font-semibold text-foreground">Q{quarter.quarter} · {monthLabel(quarter.start)}–{monthLabel(quarter.end)}</h3>
      <span className="text-xs text-muted-foreground">{quarter.isCurrent ? 'Current quarter' : quarter.upcoming ? 'Upcoming' : 'Completed quarter'}</span>
    </div>
    <p className="text-xl font-bold text-foreground">{money(quarter.grossProfit)}</p>
    <p className="text-xs text-muted-foreground">Allocated revenue {money(quarter.revenue)} − costs {money(quarter.costs)}</p>
    {quarter.target > 0 ? <>
      <Progress value={Math.max(0, Math.min(percent, 100))} aria-label={`Q${quarter.quarter} Gross Profit attainment`} />
      <p className="text-sm text-muted-foreground">{percent.toFixed(1)}% of {money(quarter.target)}</p>
      <p className="text-xs text-muted-foreground">{quarter.grossProfit < quarter.target ? `${money(quarter.target - quarter.grossProfit)} remaining` : `${money(quarter.grossProfit - quarter.target)} above target`}</p>
    </> : <p className="text-sm text-muted-foreground">Annual GP target not set</p>}
  </div>;
}