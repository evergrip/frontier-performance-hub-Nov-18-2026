import React from 'react';
import { Progress } from '@/components/ui/progress';

const money = value => `$${Math.round(value).toLocaleString()}`;
const monthLabel = period => new Date(`${period}-01T12:00:00`).toLocaleDateString('en-CA', { month: 'short' });

export default function QuarterProfitProgress({ quarter, onOpen }) {
  const percent = quarter.target > 0 ? quarter.grossProfit / quarter.target * 100 : 0;
  return <div className={`space-y-3 rounded-md border p-4 ${quarter.isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
    <div className="flex flex-wrap items-center justify-between gap-1">
      <h3 className="font-semibold text-foreground">Q{quarter.quarter} · {monthLabel(quarter.start)}–{monthLabel(quarter.end)}</h3>
      <span className="text-xs text-muted-foreground">{quarter.isCurrent ? 'Current quarter' : quarter.upcoming ? 'Upcoming' : 'Completed quarter'}</span>
    </div>
    <button type="button" onClick={onOpen} className="text-left text-xl font-bold text-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm" aria-label={`View and edit Q${quarter.quarter} Gross Profit contributions`}>{money(quarter.grossProfit)}</button>
    <p className="text-xs text-primary">Click GP to view and edit contributions</p>
    <p className="text-xs text-muted-foreground">Allocated revenue {money(quarter.revenue)} − costs {money(quarter.costs)}</p>
    <div className="space-y-1 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">Full-quarter forecast GP · construction + pre-con</p>
      <p className="text-lg font-semibold text-foreground">{money(quarter.forecastGrossProfit)}</p>
      <p className={`text-xs font-medium ${quarter.forecastMissingMargins > 0 || (quarter.target > 0 && quarter.forecastGrossProfit < quarter.target) ? 'text-destructive' : 'text-muted-foreground'}`}>{quarter.forecastMissingMargins > 0 ? `Forecast incomplete: ${quarter.forecastMissingMargins} missing margin(s)` : quarter.target > 0 ? quarter.forecastGrossProfit >= quarter.target ? `On track · ${money(quarter.forecastGrossProfit - quarter.target)} above target` : `Off track · ${money(quarter.target - quarter.forecastGrossProfit)} short of target` : 'Set annual GP target to assess tracking'}</p>
    </div>
    {quarter.target > 0 ? <>
      <Progress value={Math.max(0, Math.min(percent, 100))} aria-label={`Q${quarter.quarter} Gross Profit attainment`} />
      <p className="text-sm text-muted-foreground">{percent.toFixed(1)}% of {money(quarter.target)}</p>
      <p className="text-xs text-muted-foreground">{quarter.grossProfit < quarter.target ? `${money(quarter.target - quarter.grossProfit)} remaining` : `${money(quarter.grossProfit - quarter.target)} above target`}</p>
    </> : <p className="text-sm text-muted-foreground">Annual GP target not set</p>}
  </div>;
}