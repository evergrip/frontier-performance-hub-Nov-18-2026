import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import SourceRecord from '@/components/verification/SourceRecord';
export default function ReviewFindingDialog({ finding, onClose }) {
  const client = useQueryClient(), [status,setStatus] = useState(finding.review_status || 'manual_review'), [notes,setNotes] = useState(finding.review_notes || '');
  const save = useMutation({ mutationFn: async () => {
    const res = await base44.functions.invoke('runCoreVerification', { action: 'review', finding_id: finding.id, review_status: status, review_notes: notes });
    if (res.data.error) throw new Error(res.data.error);
    return res.data;
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['verification'] }); onClose(); } });
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{finding.record_title}: manual review</DialogTitle></DialogHeader>
    <p className="text-sm">{finding.summary}</p><div className="border rounded-md p-3 text-sm space-y-1"><p><strong>Rule:</strong> {finding.rule}</p><p><strong>Expected:</strong> {finding.expected}</p><p><strong>Observed:</strong> {finding.observed}</p><p><strong>Affects:</strong> {(finding.affected_areas || [finding.area]).join(', ')}</p><p><strong>Last detected:</strong> {new Date(finding.last_seen_at).toLocaleString()}</p></div>
    <details className="text-sm"><summary className="cursor-pointer font-semibold">Evidence used by the check</summary><pre className="text-xs whitespace-pre-wrap break-all max-h-52 overflow-auto mt-2">{JSON.stringify(finding.evidence || {}, null, 2)}</pre></details>
    <SourceRecord finding={finding} />
    <label className="text-sm font-semibold">Manual decision<select className="block border border-input bg-background rounded-md p-2 w-full mt-1 font-normal" value={status} onChange={e => setStatus(e.target.value)}><option value="manual_review">Flag for manual review</option><option value="investigate">Needs further investigation</option><option value="resolved">Human marked resolved</option></select></label>
    <label className="text-sm font-semibold">Review notes<Textarea className="mt-1 font-normal" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Explain the evidence checked and any manual decision." /></label>
    <p className="text-xs text-muted-foreground">Saving updates this finding only, not the underlying business record. A resolved finding can remain detected until its rule passes on a later scan.</p>
    {save.error && <p role="alert" className="text-sm text-destructive">{save.error.response?.data?.error || save.error.message}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending || status === 'resolved' && !notes.trim()}>{save.isPending ? 'Saving…' : 'Save manual review'}</Button></div>
  </DialogContent></Dialog>;
}