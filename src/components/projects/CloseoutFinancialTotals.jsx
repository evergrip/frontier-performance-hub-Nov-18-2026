import React from 'react';
import { closeoutTotals } from '@/components/projects/closeoutFinancials';
const money = value => Number(value).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
export default function CloseoutFinancialTotals({ financials }) {
  const totals = closeoutTotals(financials);
  return <div className="space-y-2">
    <div className="rounded-md border border-border bg-accent p-3"><h4 className="mb-2 text-sm font-semibold">Numbers to approve</h4><dl className="space-y-1 text-sm">{[['Final revenue', money(totals.revenue)], ['Final costs', money(totals.costs)], ['Final gross profit', money(totals.gp)], ['Final gross margin', `${totals.margin.toFixed(2)}%`]].map(([label, value]) => <div className="flex justify-between gap-4" key={label}><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl></div>
    {totals.error && <p className="text-sm text-destructive" role="alert">{totals.error}</p>}
  </div>;
}