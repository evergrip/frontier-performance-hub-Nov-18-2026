import React from 'react';
import { Button } from '@/components/ui/button';
const money = value => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function WeeklyGpSchedule({ data, offset, onOffset }) {
  return <div className="space-y-3">
    <p className="text-sm">Estimated construction GP: <strong>{money(data.estimatedGP)}</strong></p>
    <p className="text-sm">FY {data.goalYear} annual GP goal {money(data.annualTarget)} ÷ 52 = <strong>{money(data.weeklyGP)} per week</strong></p>
    {data.annualTarget <= 0 && <p className="text-sm text-destructive">Set a positive annual GP goal for this start date’s fiscal year in Company Settings first.</p>}
    {data.weeks > 0 && <>
      <p className="text-xs text-muted-foreground">{data.weeks} weekly allocations, finishing {data.endDate}. First allocation is on the probable start date; each following allocation is seven days later. The last week uses only the remaining GP.</p>
      <div className="max-h-60 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Week date</th><th className="p-2">Forecast GP</th><th className="p-2">Remaining GP</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.date} className="border-t border-border"><td className="p-2">{row.date}</td><td className="p-2">{money(row.amount)}</td><td className="p-2">{money(row.remaining)}</td></tr>)}</tbody></table></div>
      <div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={!offset} onClick={() => onOffset(Math.max(0, offset - 50))}>Previous weeks</Button><Button type="button" size="sm" variant="outline" disabled={!data.hasMore} onClick={() => onOffset(offset + 50)}>Next weeks</Button></div>
    </>}
    <p className="text-xs text-muted-foreground">Saved forecasts retain this weekly rate across fiscal years and construction conversion. They are excluded when the job is lost or finalized without construction. These amounts affect forecast GP only, never reported GP.</p>
  </div>;
}