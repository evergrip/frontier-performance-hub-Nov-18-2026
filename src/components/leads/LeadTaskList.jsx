import React from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function LeadTaskList({ lead, user }) {
  const cache = useQueryClient();
  const key = ['leadTasks', lead.id];
  const query = useInfiniteQuery({
    queryKey: key, initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities.LeadFollowupTask.filter({ lead_id: lead.id }, { sort: 'due_date', limit: 25, cursor: pageParam }),
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
  });
  const change = useMutation({
    mutationFn: task => base44.entities.LeadFollowupTask.update(task.id, { status: task.status === 'completed' ? 'open' : 'completed', completed_at: task.status === 'completed' ? null : new Date().toISOString() }),
    onSuccess: () => { cache.invalidateQueries({ queryKey: key }); cache.invalidateQueries({ queryKey: ['myFollowupTasks'] }); },
  });
  const today = format(new Date(), 'yyyy-MM-dd');
  return <div className="space-y-2">
    {query.isLoading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
    {query.isError && <p role="alert" className="text-sm text-destructive">Unable to load tasks.</p>}
    {query.data?.pages[0]?.items.length === 0 && <p className="text-sm text-muted-foreground">No follow-up tasks yet.</p>}
    {query.data?.pages.flatMap(page => page.items).map(task => {
      const completed = task.status === 'completed';
      const canChange = user.role === 'admin' || task.created_by_id === user.id || task.assigned_to === user.id;
      return <div key={task.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
        <input type="checkbox" className="mt-1" checked={completed} aria-label={`${completed ? 'Reopen' : 'Complete'} ${task.title}`} disabled={!canChange || change.isPending} onChange={() => change.mutate(task)} />
        <div className="min-w-0 flex-1"><p className={completed ? 'text-sm line-through text-muted-foreground break-words' : 'text-sm font-medium break-words'}>{task.title}</p>
          <p className="text-xs text-muted-foreground">{task.assignee_name} · Due {task.due_date}</p>
          {!completed && task.due_date < today && <p className="text-xs text-destructive">Overdue</p>}
          {completed && <p className="text-xs text-muted-foreground">Completed{task.completed_at ? ` ${new Date(task.completed_at).toLocaleString()}` : ''}</p>}
        </div>
      </div>;
    })}
    {change.isError && <p role="alert" className="text-sm text-destructive">Unable to update task. Please try again.</p>}
    {query.hasNextPage && <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading...' : 'Load more tasks'}</Button>}
  </div>;
}