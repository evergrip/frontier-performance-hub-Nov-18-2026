import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PreconShareEmailForm from '@/components/precon/PreconShareEmailForm';
import PreconSharedEmailHistory from '@/components/precon/PreconSharedEmailHistory';

export default function PreconEmailSharingPreview() {
  const [state, setState] = useState(null);
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function send(command, actor = state?.actor || 'michael') {
    if (lock.current) return false;
    lock.current = true;
    setError(''); setPending(true);
    try {
      const response = await base44.functions.invoke('preconMasterDraft', {mode:'emailSharingPreview', actor, history:state?.history || [], command});
      setState(response.data);
      return true;
    } catch (e) {
      setError(e.response?.data?.error || 'The fictional sharing preview could not be updated.'); return false;
    } finally { setPending(false); lock.current = false; }
  }
  return <section className="space-y-4 border bg-card p-4 sm:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">Phase 2 · Fictional mailboxes only</p><h2 className="font-heading text-xl font-bold">Private Gmail and project sharing</h2><p className="mt-1 text-sm">Rehearse selective sharing as sample users. No Google accounts are connected, no real project records are touched, and this session clears on refresh.</p></header>
    {!state ? <Button disabled={pending} onClick={() => send()}>{pending ? 'Opening…' : 'Open sharing preview'}</Button> : <>
      <div className="flex flex-wrap items-end gap-2"><label className="block text-sm">Simulate as<select disabled={pending} className="mt-1 block max-w-full rounded border bg-background p-2" value={state.actor} onChange={e => send(undefined,e.target.value)}>{Object.entries(state.people).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label><Button variant="outline" disabled={pending} onClick={() => {setState(null);setMessage(null);setError('');}}>End preview</Button></div>
      <section className="space-y-2 text-sm"><h3 className="font-semibold">Private inbox · {state.people[state.actor]}</h3>
        {['michael','karen'].includes(state.actor) && <Button variant="outline" size="sm" disabled={pending} onClick={() => send({action:state.connected ? 'disconnect' : 'connect'})}>{state.connected ? 'Disconnect fictional Gmail' : 'Connect fictional Gmail'}</Button>}
        {state.laterReplyAvailable && <Button variant="outline" size="sm" className="ml-2" disabled={pending} onClick={() => send({action:'laterReply'})}>Receive a later reply</Button>}
        {!state.connected ? <p>No fictional mailbox connected.</p> : !state.inbox.length ? <p>No messages.</p> : state.inbox.map(m => <details key={m.id} className="border p-3"><summary className="cursor-pointer font-medium">{m.subject}</summary><p className="mt-2">From: {m.from} · {m.date}</p><p className="my-2 break-words whitespace-pre-wrap">{m.body}</p><Button size="sm" disabled={pending} onClick={() => {setError('');setMessage(m);}}>Share with Project</Button></details>)}
      </section>
      <PreconSharedEmailHistory key={state.actor} state={state} send={send} pending={pending} />
      {message && <PreconShareEmailForm message={message} state={state} onClose={() => {setMessage(null);setError('');}} send={send} pending={pending} error={error} />}
    </>}
    {error && !message && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}