import React, { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';

export default function MyFollowupTasks({ user }) {
  const cache = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['myFollowupTasks', user.id], initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities.LeadFollowupTask.filter({ assigned_to: user.id, status: 'open' }, { sort: 'due_date', limit: 25, cursor: pageParam }),
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
  });
  useEffect(() => base44.entities.LeadFollowupTask.subscribe(() => {
    cache.invalidateQueries({ queryKey: ['myFollowupTasks', user.id] });
  }), [cache, user.id]);
  const complete = useMutation({
    mutationFn: task => base44.entities.LeadFollowupTask.update(task.id, { status: 'completed', completed_at: new Date().toISOString() }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['myFollowupTasks'] });
      cache.invalidateQueries({ queryKey: ['leadTasks'] });
    },
  });
  const today = format(new Date(), 'yyyy-MM-dd');
  return <section className="rounded-lg border bg-card p-5 space-y-3">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList className="h-5 w-5" />My Follow-up Tasks</h2>
    <p className="text-sm text-muted-foreground">Open tasks assigned to me, earliest due first. Not affected by dashboard date filters.</p>
    {query.isLoading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
    {query.isError && <div role="alert" className="text-sm text-destructive">Unable to load tasks. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button></div>}
    {query.data?.pages[0]?.items.length === 0 && <p className="text-sm text-muted-foreground">No open follow-up tasks assigned to me.</p>}
    {query.data?.pages.flatMap(page => page.items).map(task => <div key={task.id} className="flex items-start gap-3 rounded-md border p-3">
      <input type="checkbox" className="mt-1" checked={false} aria-label={`Complete ${task.title}`} disabled={complete.isPending} onChange={() => complete.mutate(task)} />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium break-words">{task.title}</p>
        <p className="text-xs text-muted-foreground">Due {task.due_date}</p>
        {task.due_date < today && <p className="text-xs text-destructive">Overdue</p>}
        {task.due_date === today && <p className="text-xs font-medium">Due today</p>}
      </div>
    </div>)}
    {complete.isError && <p role="alert" className="text-sm text-destructive">Unable to complete task. Please try again.</p>}
    {query.hasNextPage && <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading...' : 'Load more tasks'}</Button>}
  </section>;
}