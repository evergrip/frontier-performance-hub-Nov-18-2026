import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function DisqualifyUncontactedLeadDialog({ lead, user, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      const current = await base44.entities.Lead.get(lead.id);
      if (current.status !== 'imported') throw new Error('This lead has already moved out of Uncontacted Leads.');
      if (user.role !== 'admin' && current.assigned_to !== user.id) throw new Error('This lead is no longer assigned to you.');
      const history = current.status_history?.length ? current.status_history : [{ status: 'imported', entered_date: current.created_date }];
      return base44.entities.Lead.update(current.id, {
        status: 'disqualified', disqualification_reason: reason.trim(),
        status_history: [...history, { status: 'disqualified', entered_date: new Date().toISOString(), source: 'lead' }],
      });
    },
    onSuccess: () => { onSuccess(); onClose(); toast.success('Lead disqualified'); },
  });
  return <Dialog open={!!lead} onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>Disqualify Lead</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (reason.trim() && !mutation.isPending) mutation.mutate(); }}>
        <p className="text-sm font-medium text-foreground">{lead?.title}</p>
        <div className="space-y-2">
          <Label htmlFor="uncontacted-dq-reason">Reason for Disqualification *</Label>
          <Textarea id="uncontacted-dq-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g., Out of scope, Budget too low, Outside our service area..." rows={4} required disabled={mutation.isPending} />
        </div>
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message || 'Unable to disqualify lead. Please try again.'}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={!reason.trim() || mutation.isPending}>{mutation.isPending ? 'Disqualifying...' : 'Disqualify Lead'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}