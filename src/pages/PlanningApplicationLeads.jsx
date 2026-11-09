import React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { hasPermission } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import PlanningLeadsTable from '@/components/leads/PlanningLeadsTable';

export default function PlanningApplicationLeads() {
  const account = useQuery({ queryKey: ['uncontactedLeadUser'], queryFn: () => base44.auth.me() });
  const allowed = hasPermission(account.data, 'pipeline_leads');
  const query = useInfiniteQuery({
    queryKey: ['planningApplicationLeads'], enabled: !!account.data && allowed, initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities.Lead.filter({ source: 'Planning application leads' }, { sort: '-created_date', limit: 50, cursor: pageParam }),
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
  });
  if (account.isLoading) return <p>Loading...</p>;
  if (account.isError) return <p role="alert" className="text-destructive">Unable to load your account.</p>;
  if (!allowed) return <p>You do not have permission to view leads.</p>;
  return <div className="max-w-7xl mx-auto space-y-6">
    <div><h1 className="text-3xl font-bold text-foreground">Frontier Planning Application Leads</h1><p className="mt-2 text-muted-foreground">Mark Interested for leads we want to follow up on, or Not interested to pass. These choices do not change the lead’s pipeline stage.</p></div>
    {query.isLoading && <p className="text-sm text-muted-foreground">Loading planning leads...</p>}
    {query.isError && <div role="alert"><p className="text-destructive">Unable to load planning leads.</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div>}
    {query.data?.pages.map((page, index) => <PlanningLeadsTable key={index} leads={page.items} />)}
    {query.data?.pages[0]?.items.length === 0 && <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">No planning application leads yet.</p>}
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading...' : 'Load more leads'}</Button>}
  </div>;
}