import React from 'react';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';

const money = value => `$${Math.round(Number(value) || 0).toLocaleString()}`;

export default function GrossProfitTargetProgress({ actual = 0, target, note }) {
  const goal = Number(target) || 0;
  const profit = Number(actual) || 0;
  const attainment = goal > 0 ? profit / goal * 100 : 0;
  const gap = Math.max(0, goal - profit);
  return <div className="space-y-2">
    <p className="font-semibold text-foreground">Company Gross Profit Target</p>
    {goal > 0 ? <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-2xl font-bold text-foreground">{money(profit)} <span className="text-sm font-normal text-muted-foreground">of {money(goal)}</span></p>
        <p className="text-sm font-medium text-foreground">{attainment.toFixed(1)}% achieved</p>
      </div>
      <Progress value={Math.max(0, Math.min(attainment, 100))} className="h-3" />
      <p className="text-sm text-muted-foreground">{gap > 0 ? `${money(gap)} Gross Profit remaining to target` : `Target achieved · ${money(profit - goal)} above target`}</p>
    </> : <>
      <p className="text-sm text-muted-foreground">No Gross Profit target is set for this fiscal year. Existing revenue targets have not been converted.</p>
      <Link to="/CompanySettings" className="text-sm text-primary underline">Set the company Gross Profit target</Link>
    </>}
    {note && <p className="text-xs text-muted-foreground">{note}</p>}
  </div>;
}