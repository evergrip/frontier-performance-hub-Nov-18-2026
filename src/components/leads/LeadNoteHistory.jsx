import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function LeadNoteHistory({ lead, user }) {
  const [body, setBody] = useState('');
  const cache = useQueryClient();
  const key = ['leadNotes', lead.id];
  const query = useInfiniteQuery({
    queryKey: key, initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities.LeadNote.filter({ lead_id: lead.id }, { sort: '-created_date', limit: 25, cursor: pageParam }),
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
  });
  const save = useMutation({
    mutationFn: () => base44.entities.LeadNote.create({ lead_id: lead.id, body: body.trim(), author_name: user.full_name || 'Team member' }),
    onSuccess: () => { setBody(''); cache.invalidateQueries({ queryKey: key }); },
  });
  return <section className="space-y-3">
    <h3 className="font-semibold">Conversation notes</h3>
    <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (body.trim() && !save.isPending) save.mutate(); }}>
      <Textarea aria-label="New conversation note" placeholder="Add an update about this lead..." value={body} onChange={event => setBody(event.target.value)} disabled={save.isPending} maxLength={10000} required />
      <Button type="submit" size="sm" disabled={!user || !body.trim() || save.isPending}>{save.isPending ? 'Adding...' : 'Add Note'}</Button>
      {save.isError && <p role="alert" className="text-sm text-destructive">Unable to save note. Please try again.</p>}
    </form>
    {query.isLoading && <p className="text-sm text-muted-foreground">Loading notes...</p>}
    {query.isError && <p role="alert" className="text-sm text-destructive">Unable to load notes.</p>}
    {query.data?.pages.flatMap(page => page.items).map(note => <article key={note.id} className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground"><span className="font-semibold">{note.author_name}</span><time dateTime={note.created_date}>{new Date(note.created_date).toLocaleString()}</time></div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{note.body}</p>
    </article>)}
    {query.data?.pages[0]?.items.length === 0 && <p className="text-sm text-muted-foreground">No conversation notes yet.</p>}
    {query.hasNextPage && <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading...' : 'Load older notes'}</Button>}
    {lead.notes && <div className="border-t pt-3"><p className="text-xs font-semibold text-muted-foreground">Existing notes</p><p className="whitespace-pre-wrap break-words text-sm">{lead.notes}</p></div>}
  </section>;
}