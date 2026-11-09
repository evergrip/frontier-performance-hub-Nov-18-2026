import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LeadTaskForm from '@/components/leads/LeadTaskForm';
import LeadTaskList from '@/components/leads/LeadTaskList';
import LeadNoteHistory from '@/components/leads/LeadNoteHistory';

export default function FollowupTaskDialog({ selected, user, complete, onClose }) {
  const [mode, setMode] = useState(selected.mode || 'followup');
  const taskQuery = useQuery({ queryKey: ['followupTask', selected.task.id], queryFn: () => base44.entities.LeadFollowupTask.get(selected.task.id) });
  const leadQuery = useQuery({ queryKey: ['dashboardFollowupLead', selected.task.lead_id], queryFn: () => base44.entities.Lead.get(selected.task.lead_id), initialData: selected.lead });
  const people = useQuery({ queryKey: ['salespeople'], queryFn: async () => (await base44.functions.invoke('listSalespeople', {})).data?.salespeople || [] });
  const task = taskQuery.data || selected.task;
  const lead = leadQuery.data;
  const canChange = user.role === 'admin' || task.created_by_id === user.id || task.assigned_to === user.id;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{task.title}</DialogTitle></DialogHeader>
    {(taskQuery.isLoading || leadQuery.isLoading) && <p className="text-sm text-muted-foreground">Loading follow-up...</p>}
    {(taskQuery.isError || leadQuery.isError) && <p role="alert" className="text-sm text-destructive">Unable to load follow-up details.</p>}
    <div className="space-y-2"><h3 className="font-semibold">{lead?.title || 'Lead unavailable'}</h3><p className="text-sm text-muted-foreground">{task.assignee_name} · Due {task.due_date} · {task.status === 'completed' ? 'Completed' : 'Open'}</p>
      {task.status !== 'completed' && <Button disabled={!canChange || complete.isPending} onClick={() => complete.mutate(task)}>{complete.isPending ? 'Completing...' : 'Mark complete'}</Button>}
      {complete.isError && <p role="alert" className="text-sm text-destructive">Unable to complete task. Please try again.</p>}
    </div>
    {lead && <>
      <div className="flex flex-wrap gap-2"><Button variant={mode === 'followup' ? 'default' : 'outline'} onClick={() => setMode('followup')}>Create follow-up</Button><Button variant={mode === 'subtask' ? 'default' : 'outline'} onClick={() => setMode('subtask')}>Add subtask</Button></div>
      {people.isError && <p role="alert" className="text-sm text-destructive">Unable to load other assignees.</p>}
      <LeadTaskForm key={mode} lead={{ ...lead, assigned_to: task.assigned_to }} user={user} users={people.data || []} parentTask={mode === 'subtask' ? task : undefined} previousTask={mode === 'followup' ? task : undefined} />
      <section className="space-y-2 border-t pt-4"><h3 className="font-semibold">Subtasks</h3><LeadTaskList lead={lead} user={user} parentTaskId={task.id} /></section>
      <section className="space-y-2 border-t pt-4"><h3 className="font-semibold">Lead notes</h3><LeadNoteHistory lead={lead} user={user} /></section>
    </>}
  </DialogContent></Dialog>;
}