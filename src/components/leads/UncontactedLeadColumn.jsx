import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function UncontactedLeadColumn({ group, scope, clients, onOpen, onContact, pending }) {
  const query = { ...scope, $or: group.sources.map(source => source == null ? { source: { $exists: false } } : { source }) };
  if (group.sources.includes(null)) query.$or.push({ source: null }, { source: '' });
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['uncontactedLeads', group.label, group.sources, scope],
    queryFn: ({ pageParam }) => base44.entities.Lead.filter(query, { sort: '-created_date', limit: 50, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
  });
  const leads = data?.pages.flatMap(page => page.items) || [];
  return <section className="min-w-0 rounded-lg border bg-card p-3">
    <div className="mb-3 border-b pb-3"><h2 className="font-semibold text-foreground">{group.label}</h2><p className="text-xs text-muted-foreground">{group.count} {group.count === 1 ? 'lead' : 'leads'}</p></div>
    {isLoading && <p className="text-sm text-muted-foreground">Loading leads...</p>}
    {isError && <p className="text-sm text-destructive">Unable to load leads.</p>}
    <div className="space-y-2">{leads.map(lead => {
      const client = clients.find(item => item.id === lead.client_id);
      return <Card key={lead.id}><CardContent className="p-3 space-y-2">
        <button type="button" onClick={() => onOpen(lead)} className="w-full text-left"><span className="block text-sm font-medium text-foreground break-words">{lead.title}</span><span className="block text-xs text-muted-foreground">{client?.company_name || client?.contact_name || 'Client details'}</span><span className="block text-xs text-muted-foreground mt-1 break-words">{lead.source || 'No source'}</span></button>
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={pending} onClick={() => onContact(lead)}>Move to Contacted Leads</Button>
      </CardContent></Card>;
    })}</div>
    {hasNextPage && <Button variant="ghost" size="sm" className="mt-3 w-full" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>{isFetchingNextPage ? 'Loading...' : 'Load more'}</Button>}
  </section>;
}