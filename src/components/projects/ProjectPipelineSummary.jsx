import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
const money = value => `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
export default function ProjectPipelineSummary({ user, assignedUserId }) {
  const query = useQuery({ queryKey: ['projects', 'pipelineSummary', user?.id, assignedUserId], enabled: !!user, queryFn: async () => {
    const response = await base44.functions.invoke('jobGpForecast', { action: 'pipelineSummary', assignedUserId });
    if (response.data.error) throw new Error(response.data.error);
    return response.data;
  } });
  const data = query.data;
  const monthLabel = data && new Date(`${data.currentPeriod}-15T12:00:00Z`).toLocaleDateString('en-CA', { timeZone: 'America/Halifax', month: 'long', year: 'numeric' });
  const cards = [
    { label: 'Active Projects', value: data?.activeCount },
    { label: 'In Production Value · This Month', value: data && money(data.currentMonthRevenue ?? 0), note: monthLabel && `Allocated to ${monthLabel}` },
    { label: 'In Production GP · This Month', value: data && money(data.currentMonthGrossProfit ?? 0), note: monthLabel && `Allocated to ${monthLabel}` },
    { label: 'Remaining Pipeline Value', value: data && money(data.revenue), note: 'Unallocated + months after the current month' },
    { label: 'Remaining Projected Gross Profit', value: data && money(data.grossProfit), note: 'Unallocated + months after the current month' },
    { label: data ? `Closed Projects · FY ${data.fiscalYear}` : 'Closed Projects · Current FY', value: data?.closedCount, note: data && `Oct ${data.fiscalYear}–Sep ${data.fiscalYear + 1}` }
  ];
  return <div className="space-y-2">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{cards.map(card => <Card key={card.label}><CardContent className="p-4"><div className="text-2xl font-bold text-foreground" aria-busy={query.isFetching}>{query.isPending ? '…' : query.error ? '—' : card.value}</div><div className="text-sm text-foreground">{card.label}</div>{card.note && <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>}</CardContent></Card>)}</div>
    {query.error && <p role="alert" className="text-sm text-destructive">Unable to load project totals: {query.error.response?.data?.error || query.error.message}</p>}
  </div>;
}