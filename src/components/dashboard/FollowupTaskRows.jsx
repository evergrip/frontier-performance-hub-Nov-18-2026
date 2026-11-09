import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function FollowupTaskRows({ tasks, today, complete, onOpen }) {
  const ids = [...new Set(tasks.map(task => task.lead_id))].sort();
  const leads = useQuery({
    queryKey: ['dashboardTaskLeads', ids], enabled: ids.length > 0,
    queryFn: () => base44.entities.Lead.filter({ id: { $in: ids } }, { limit: ids.length }),
  });
  const byId = new Map((leads.data?.items || []).map(lead => [lead.id, lead]));
  return <div className="space-y-3">
    {leads.isError && <p role="alert" className="text-sm text-destructive">Unable to load lead names. <Button size="sm" variant="outline" onClick={() => leads.refetch()}>Retry</Button></p>}
    {tasks.map(task => {
      const lead = byId.get(task.lead_id);
      return <div key={task.id} className="flex items-start gap-3 rounded-md border p-3">
        <input type="checkbox" className="mt-1" checked={false} aria-label={`Complete ${task.title}`} disabled={complete.isPending} onChange={() => complete.mutate(task)} />
        <div className="min-w-0 flex-1 space-y-1">
          <button type="button" className="block text-left text-sm font-semibold text-primary underline underline-offset-4 break-words" onClick={() => onOpen(task, lead)}>{lead?.title || (leads.isLoading ? 'Loading lead...' : 'Open follow-up')}</button>
          <button type="button" className="block text-left text-sm font-medium break-words hover:underline" onClick={() => onOpen(task, lead)}>{task.title}</button>
          <p className="text-xs text-muted-foreground">{task.parent_task_id ? 'Subtask · ' : ''}Due {task.due_date}</p>
          {task.due_date < today && <p className="text-xs text-destructive">Overdue</p>}
          {task.due_date === today && <p className="text-xs font-medium">Due today</p>}
          <div className="flex flex-wrap gap-2 pt-1"><Button size="sm" variant="outline" onClick={() => onOpen(task, lead, 'followup')}>Create follow-up</Button><Button size="sm" variant="outline" onClick={() => onOpen(task, lead, 'subtask')}>Add subtask</Button></div>
        </div>
      </div>;
    })}
  </div>;
}