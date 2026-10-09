import React, { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import FindingFilters from '@/components/verification/FindingFilters';
import FindingsTable from '@/components/verification/FindingsTable';
import ReviewFindingDialog from '@/components/verification/ReviewFindingDialog';
export default function FindingWorkspace() {
  const [filters,setFilters] = useState({ search: '', area: 'all', detection: 'active', status: 'all' }), [selected,setSelected] = useState(null);
  const query = {};
  if (filters.area !== 'all') query.affected_areas = filters.area;
  if (filters.detection !== 'all') query.detected = filters.detection === 'active';
  if (filters.status !== 'all') query.review_status = filters.status;
  if (filters.search.trim()) {
    const pattern = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = ['record_title','summary','rule'].map(field => ({ [field]: { $regex: pattern, $options: 'i' } }));
  }
  const results = useInfiniteQuery({ queryKey: ['verification','findings',query], initialPageParam: undefined, queryFn: ({pageParam}) => base44.entities.VerificationFinding.filter(query, { sort: '-last_seen_at', limit: 50, cursor: pageParam }), getNextPageParam: page => page.has_more ? page.next_cursor : undefined });
  const totals = useQuery({ queryKey: ['verification','totals',query], queryFn: () => base44.entities.VerificationFinding.aggregate({ query, groupBy: 'severity' }) });
  const count = totals.data?.rows.reduce((s,r) => s + r.count, 0) || 0;
  return <section className="space-y-4"><div className="flex justify-between flex-wrap gap-3 items-end"><h2 className="font-heading text-xl font-semibold">Findings and manual review</h2><p className="text-sm text-muted-foreground">{totals.isLoading ? 'Counting…' : `${count} matching findings`}</p></div>
    <div className="flex gap-3 flex-wrap">{(totals.data?.rows || []).map(r => <span key={r.severity} className="border rounded-md px-3 py-2 text-sm"><strong>{r.count}</strong> {r.severity} priority</span>)}</div>
    <FindingFilters value={filters} onChange={setFilters} />
    {(results.error || totals.error) && <p role="alert" className="text-sm text-destructive">{results.error?.message || totals.error?.message}</p>}
    {results.isLoading ? <p className="py-10 text-center text-muted-foreground">Loading findings…</p> : <FindingsTable rows={results.data?.pages.flatMap(p => p.items) || []} onOpen={setSelected} />}
    {results.hasNextPage && <Button variant="outline" onClick={() => results.fetchNextPage()} disabled={results.isFetchingNextPage}>{results.isFetchingNextPage ? 'Loading…' : 'Load more findings'}</Button>}
    {selected && <ReviewFindingDialog key={selected.id} finding={selected} onClose={() => setSelected(null)} />}
  </section>;
}