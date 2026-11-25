import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFiscalYearDates, getFiscalYearLabel } from '@/components/utils/fiscalYear';
import { deliveryMonths } from '@/lib/deliveryMixCapacity';
import { cad, pct, scheduleScopes } from '@/lib/deliveryMix';
import MixMetrics from '@/components/deliveryMix/MixMetrics';

export default function CompanySummary({ scopes, months, goals, settings, year, fiscalStart }) {
  const [selected, setSelected] = useState(year);
  const years = [...new Set([year, year + 1, ...goals.map(g => g.fiscal_year)])].filter(Number.isFinite).sort((a,b) => b-a);
  const window = new Set(months);
  const fy = new Set(deliveryMonths(getFiscalYearDates(selected, fiscalStart).startDate, 12));
  const scheduled = scheduleScopes(scopes);
  const totals = { baseline:0, added:0, gp:0, sell:0 };
  let gpOut = 0;
  for (const scope of scopes) {
    const missing = scope.months.filter(m => !window.has(m)).length;
    gpOut += scope.months.length ? scope.gp * missing / scope.months.length : scope.gp;
  }
  for (const row of scheduled) if (fy.has(row.month)) for (const key of Object.keys(totals)) totals[key] += row[key];
  const goal = goals.find(g => g.fiscal_year === selected);
  const required = goal?.revenue_target > 0 && goal.gross_profit_target != null ? goal.gross_profit_target / goal.revenue_target * 100 : null;
  const targetGap = goal?.gross_profit_target != null ? goal.gross_profit_target - totals.gp : null;
  const benchmarkGap = totals.sell * settings.benchmark_gm / 100 - totals.gp;
  const gapLabel = value => value == null ? 'No fiscal goal set' : value < 0 ? 'Ahead of target' : value > 0 ? 'Still needed' : 'On target';
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Company summary · Estimate-based</h2><p className="text-sm text-muted-foreground">Signed and in-construction scopes only. Actual GP stays on the Dashboard.</p></div>
      <Select value={String(selected)} onValueChange={value => setSelected(Number(value))}><SelectTrigger aria-label="Fiscal year" className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent>{years.map(fy => <SelectItem key={fy} value={String(fy)}>{getFiscalYearLabel(fy, fiscalStart, true)}</SelectItem>)}</SelectContent></Select>
    </div>
    <MixMetrics items={[
      ['Forecast FY GP',cad(totals.gp),`Goal: ${cad(goal?.gross_profit_target)}`],['Baseline GP',cad(totals.baseline)],['Added GP',cad(totals.added)],['Scheduled FY revenue',cad(totals.sell),`Goal: ${cad(goal?.revenue_target)}`],['Blended GM',pct(totals.sell ? totals.gp / totals.sell * 100 : null),`Required: ${pct(required)}`],['GP gap to target',cad(targetGap),gapLabel(targetGap)],['GP gap to benchmark',totals.sell ? cad(benchmarkGap) : '—',`${pct(settings.benchmark_gm)} of scheduled FY revenue${totals.sell ? ` · ${gapLabel(benchmarkGap)}` : ''}`],['GP not scheduled in window',cad(gpOut),`${months[0]} to ${months.at(-1)} · expected $0`,Math.abs(gpOut) > 0.005],
    ]} />
  </div>;
}