import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function LeadEmailComposer({ recipient, onSend, onCancel }) {
  const id = useId();
  const sending = useRef(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    if (sending.current || !recipient || !subject.trim() || !message.trim()) return;
    sending.current = true;
    setPending(true);
    setError('');
    try {
      await onSend({ subject: subject.trim(), message });
    } catch (err) {
      setError(err.message || 'Gmail could not confirm that the email was sent.');
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  if (!recipient) return <p className="text-sm text-muted-foreground">Add an email address to the lead’s client record before sending.</p>;

  return <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
    <div className="space-y-1"><Label htmlFor={`${id}-to`}>To</Label><Input id={`${id}-to`} value={recipient} readOnly /></div>
    <div className="space-y-1"><Label htmlFor={`${id}-subject`}>Subject</Label><Input id={`${id}-subject`} value={subject} onChange={event => setSubject(event.target.value)} required maxLength={200} disabled={pending} /></div>
    <div className="space-y-1"><Label htmlFor={`${id}-message`}>Message</Label><Textarea id={`${id}-message`} value={message} onChange={event => setMessage(event.target.value)} rows={8} required maxLength={20000} disabled={pending} /></div>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
      <Button type="submit" disabled={pending || !subject.trim() || !message.trim()}>{pending ? 'Sending…' : 'Send email'}</Button>
    </div>
  </form>;
}