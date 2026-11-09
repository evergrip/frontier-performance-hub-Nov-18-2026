import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function PlanningLeadInterest({ lead }) {
  const queryClient = useQueryClient();
  const interest = lead.planning_followup_interest || 'unreviewed';
  const save = useMutation({
    mutationFn: value => base44.entities.Lead.update(lead.id, { planning_followup_interest: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planningApplicationLeads'] }),
  });
  return <div className="space-y-2 min-w-56">
    <p className="text-xs text-muted-foreground" aria-live="polite">{save.isPending ? 'Saving...' : interest === 'interested' ? 'Interested: follow up' : interest === 'not_interested' ? 'Not interested: no follow-up' : 'Not reviewed'}</p>
    <div className="flex gap-2">
      <Button size="sm" variant={interest === 'interested' ? 'default' : 'outline'} aria-pressed={interest === 'interested'} disabled={save.isPending} onClick={() => save.mutate('interested')}>Interested</Button>
      <Button size="sm" variant={interest === 'not_interested' ? 'secondary' : 'outline'} aria-pressed={interest === 'not_interested'} disabled={save.isPending} onClick={() => save.mutate('not_interested')}>Not interested</Button>
    </div>
    {save.isError && <p role="alert" className="text-xs text-destructive">Unable to save your choice. Please try again.</p>}
  </div>;
}