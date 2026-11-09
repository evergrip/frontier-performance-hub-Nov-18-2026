import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LeadTaskForm({ lead, user, users }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [assignee, setAssignee] = useState(lead.assigned_to || user.id);
  const cache = useQueryClient();
  const people = users.some(person => person.id === user.id) ? users : [...users, user];
  const save = useMutation({
    mutationFn: () => base44.entities.LeadFollowupTask.create({ lead_id: lead.id, title: title.trim(), due_date: date, assigned_to: assignee, assignee_name: people.find(person => person.id === assignee)?.full_name || 'Team member', status: 'open' }),
    onSuccess: () => { setTitle(''); setDate(''); cache.invalidateQueries({ queryKey: ['leadTasks', lead.id] }); },
  });
  return <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (title.trim() && date && assignee && !save.isPending) save.mutate(); }}>
    <Label htmlFor={`task-title-${lead.id}`}>Follow-up task</Label>
    <Input id={`task-title-${lead.id}`} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g., Call to discuss the proposal" maxLength={500} disabled={save.isPending} required />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor={`task-date-${lead.id}`}>Due date</Label><Input id={`task-date-${lead.id}`} type="date" value={date} onChange={event => setDate(event.target.value)} disabled={save.isPending} required /></div>
      <div className="space-y-1"><Label htmlFor={`task-owner-${lead.id}`}>Assignee</Label><select id={`task-owner-${lead.id}`} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={assignee} onChange={event => setAssignee(event.target.value)} disabled={save.isPending} required><option value="">Select salesperson</option>{people.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div>
    </div>
    <Button type="submit" size="sm" disabled={!title.trim() || !date || !assignee || save.isPending}>{save.isPending ? 'Adding...' : 'Add Task'}</Button>
    {save.isError && <p role="alert" className="text-sm text-destructive">Unable to save task. Please try again.</p>}
  </form>;
}