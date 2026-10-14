import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFiscalYearLabel } from '@/components/utils/fiscalYear';
import GrossProfitTargetProgress from '@/components/common/GrossProfitTargetProgress';
import QuarterProfitProgress from '@/components/dashboard/QuarterProfitProgress';

const money = value => `$${Math.round(value).toLocaleString()}`;

export default function FiscalProfitProgress({ fiscalYear, userId, projectsUpdatedAt, goalsUpdatedAt }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['fiscalProfitProgress', fiscalYear, userId, projectsUpdatedAt, goalsUpdatedAt],
    queryFn: async () => {
      const response = await base44.functions.invoke('getFiscalProfitProgress', { fiscalYear });
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    enabled: !!userId,
    staleTime: 60000,
    refetchInterval: 60000,
  });
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Gross Profit Progress · {getFiscalYearLabel(fiscalYear, 10)}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {isPending ? <p role="status" className="text-sm text-muted-foreground">Loading fiscal-year and quarterly Gross Profit…</p> : error ? <p role="alert" className="text-sm text-destructive">Unable to load Gross Profit progress. <button type="button" className="underline" onClick={() => refetch()}>Retry</button></p> : <>
        <GrossProfitTargetProgress actual={data.annual.grossProfit} target={data.target} />
        <p className="text-sm text-muted-foreground">Allocated revenue {money(data.annual.revenue)} − allocated recorded costs {money(data.annual.costs)} = Gross Profit. As of {data.asOf} (Toronto).</p>
        {data.scope === 'own' && <p className="text-xs text-muted-foreground">Your assigned/contributed projects only, compared with the company target, matching your dashboard access.</p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{data.quarters.map(quarter => <QuarterProfitProgress key={quarter.quarter} quarter={quarter} />)}</div>
        <p className="text-xs text-muted-foreground">Quarterly targets are 25% of the annual target. Construction projects only. Recorded project costs use the same monthly allocation percentages as revenue; there is no separate monthly cost schedule. Includes the current month’s full allocation, not day-prorated; future months are excluded. This is allocated recorded-cost GP, not the estimated-margin Annual Profit Forecast.</p>
        {(data.excludedProjects > 0 || data.incompleteProjects > 0) && <p role="status" className="text-xs text-destructive">{data.excludedProjects} project(s) excluded for missing/invalid allocations or financial values; {data.incompleteProjects} project(s) have incomplete allocations. Closed single-year projects without allocations use their completion month. Missing allocations on cross-year projects are never assigned to a single year.</p>}
      </>}
    </CardContent>
  </Card>;
}