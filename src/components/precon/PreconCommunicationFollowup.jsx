import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PreconCommunicationFollowup({ run, act, pending }) {
  const [preview, setPreview] = useState(false);
  const f = run.followUp;
  const got = id => run.messages.some(m => m.id === id);
  return <section className="space-y-3 border-t pt-4 text-sm">
    <h4 className="font-semibold">Follow-ups</h4>
    {!f ? <>
      <Button size="sm" variant="outline" disabled={pending || !run.documents.length} onClick={() => setPreview(!preview)}>{preview ? 'Hide draft' : 'Prepare follow-up'}</Button>
      {preview && <div className="space-y-2 border p-3"><p><strong>To:</strong> {run.contact}</p><p>{run.draft}</p><Button size="sm" disabled={pending || !!run.failure} onClick={() => act('send', true)}>Confirm simulated send</Button><p>No message leaves the rehearsal.</p></div>}
    </> : <>
      <p><strong>{f.state}</strong> · {f.project}</p><p>Waiting on: {f.contact} · {f.request}</p><p>Sent {f.sent.slice(0,10)} · Expected {f.expected} · {f.blocks}</p>
      <p>A request is already recorded. No repeat reminder will be sent.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={pending || got('example-msg-03')} onClick={() => act('partial')}>Receive acknowledgment</Button><Button variant="outline" size="sm" disabled={pending || got('example-msg-04')} onClick={() => act('revised')}>Receive revised drawings</Button></div>
      {f.state === 'Needs response validation' && <Button size="sm" disabled={pending} onClick={() => act('validate', true)}>Confirm reply meets request</Button>}
    </>}
  </section>;
}