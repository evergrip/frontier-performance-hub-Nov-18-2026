import React from 'react';
import { closeoutTotals } from '@/components/projects/closeoutFinancials';
const money = value => Number(value).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
export default function CloseoutFinancialTotals({ financials }) {
  const totals = closeoutTotals(financials);
  const standard = financials.project.recognition_mode !== 'monthly_actual';
  const allocated = field => Math.round(financials.rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0) * 100) / 100;
  const allocatedGP = allocated('gp'), allocatedRevenue = allocated('revenue');
  const missingGP = Math.round((totals.gp - allocatedGP) * 100) / 100;
  const missingRevenue = Math.round((totals.revenue - allocatedRevenue) * 100) / 100;
  const entries = [
    ['Final revenue', money(totals.revenue)],
    ...(standard ? [['Allocated revenue', money(allocatedRevenue)], [missingRevenue < 0 ? 'Overallocated revenue' : 'Missing revenue', money(Math.abs(missingRevenue)), missingRevenue !== 0]] : []),
    ['Final costs', money(totals.costs)],
    ['Final gross profit', money(totals.gp)],
    ...(standard ? [['Allocated GP', money(allocatedGP)], [missingGP < 0 ? 'Overallocated GP' : 'Missing GP', money(Math.abs(missingGP)), missingGP !== 0]] : []),
    ['Final gross margin', `${totals.margin.toFixed(2)}%`],
  ];
  return <div className="space-y-2">
    <div className="rounded-md border border-border bg-accent p-3"><h4 className="mb-2 text-sm font-semibold">Numbers to approve</h4><dl className="space-y-1 text-sm">{entries.map(([label, value, discrepancy]) => <div className={`flex justify-between gap-4 ${discrepancy ? 'font-semibold text-destructive' : ''}`} key={label}><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl></div>
    {totals.error && <p className="text-sm text-destructive" role="alert">{totals.error}</p>}
  </div>;
}