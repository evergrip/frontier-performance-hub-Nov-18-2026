import React, { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import QuarterProfitContribution from '@/components/dashboard/QuarterProfitContribution';
import QuarterProfitFinancialEditor from '@/components/dashboard/QuarterProfitFinancialEditor';
import ProjectAllocationDialog from '@/components/projects/ProjectAllocationDialog';
import WeeklyGpContribution from '@/components/dashboard/WeeklyGpContribution';
import WeeklyGpForecastDialog from '@/components/sales/WeeklyGpForecastDialog';

const money = value => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
export default function QuarterProfitBreakdown({ fiscalYear, quarter, userId, onClose }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['quarterProfitBreakdown', fiscalYear, quarter.quarter, userId], initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const response = await base44.functions.invoke('getFiscalProfitProgress', { fiscalYear, quarter: quarter.quarter, detailCursor: pageParam });
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    }, getNextPageParam: last => last.details.next_cursor ?? undefined,
  });
  const projectQuery = useQuery({ queryKey: ['quarterProfitProject', editing?.id], queryFn: () => base44.entities.Project.get(editing.id), enabled: !!editing && editing.mode !== 'weekly' });
  const refresh = () => { ['projects', 'fiscalProfitProgress', 'quarterProfitBreakdown', 'quarterProfitProject', 'edit-logs', 'gpForecastTable', 'weeklyGpForecast'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] })); };
  const summary = data?.pages[0]?.quarters.find(item => item.quarter === quarter.quarter) || quarter;
  return <>
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Q{quarter.quarter} FY {fiscalYear} · Gross Profit breakdown</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{quarter.start}–{quarter.end} · Reported GP {money(summary.grossProfit)} · Full-quarter forecast {money(summary.forecastGrossProfit)}</p>
      <p className="text-xs text-muted-foreground">Reported GP uses contract value less recorded costs, allocated through the current Toronto month. The forecast covers the entire quarter using margins for active projects and final costs for closed projects. Saved pre-construction weekly GP forecasts are included until the job is lost or finalized without construction, then carried into construction without double-counting.</p>
      {summary.forecastMissingMargins > 0 && <p className="text-sm text-destructive">Forecast incomplete: {summary.forecastMissingMargins} project(s) need a forecast margin.</p>}
      {isPending ? <p role="status">Loading contributions…</p> : error ? <p role="alert" className="text-destructive">{error.message} <Button variant="outline" onClick={() => refetch()}>Retry</Button></p> : <>
        <p className="text-xs text-muted-foreground">{data.pages[0].details.total} contributing job entries. All project contributions sum to the reported quarter total; future allocations contribute only to forecast GP.</p>
        <div className="space-y-3">{data.pages.flatMap(page => page.details.items).map(row => row.kind === 'weekly_forecast' ? <WeeklyGpContribution key={row.id} row={row} onEdit={(id, mode) => setEditing({ id, mode })} /> : <QuarterProfitContribution key={row.id} row={row} onEdit={(id, mode) => setEditing({ id, mode })} />)}</div>
        {!data.pages[0].details.total && <p className="text-sm text-muted-foreground">No valid project allocations contribute to this quarter.</p>}
        {hasNextPage && <Button variant="outline" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>{isFetchingNextPage ? 'Loading…' : 'Load more projects'}</Button>}
      </>}
      {editing && editing.mode !== 'weekly' && projectQuery.isPending && <p role="status">Loading project for editing…</p>}
      {editing && editing.mode !== 'weekly' && projectQuery.error && <p role="alert" className="text-destructive">Unable to open project. <Button variant="outline" onClick={() => projectQuery.refetch()}>Retry</Button></p>}
    </DialogContent></Dialog>
    {editing?.mode === 'weekly' && <WeeklyGpForecastDialog key={editing.id} forecastId={editing.id} onClose={() => setEditing(null)} onSaved={refresh} />}
    {editing && editing.mode !== 'weekly' && projectQuery.data && (editing.mode === 'financials' ? <QuarterProfitFinancialEditor key={editing.id} project={projectQuery.data} onClose={() => setEditing(null)} onSaved={refresh} /> : editing.mode === 'gp' ? <WeeklyGpForecastDialog key={editing.id} projectId={editing.id} onClose={() => setEditing(null)} onSaved={refresh} /> : <ProjectAllocationDialog open project={projectQuery.data} companySettings={{ fiscal_year_start_month: 10 }} onOpenChange={open => { if (!open) setEditing(null); }} onSaved={refresh} />)}
  </>;
}