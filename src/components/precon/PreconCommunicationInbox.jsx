import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PreconCommunicationInbox({ run, act, pending }) {
  const [query, setQuery] = useState('');
  const [thread, setThread] = useState('');
  const includes = m => `${m.subject} ${m.from} ${m.text} ${m.project || ''}`.toLowerCase().includes(query.trim().toLowerCase());
  const threads = [...new Map(run.messages.filter(includes).map(m => [m.thread, m])).values()];
  const active = thread || run.messages.find(m => m.id === run.selected)?.thread;
  return <section className="space-y-3">
    <h4 className="font-semibold">Project inbox · fictional Gmail</h4>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => { setThread(''); act('incoming'); }}>{run.messages.some(m => m.id === 'example-msg-01') ? 'Replay same notification' : 'Receive engineer email'}</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => { setThread(''); act('ambiguous'); }}>Receive ambiguous email</Button>
    </div>
    <label className="block text-sm">Search email<Input value={query} onChange={e => setQuery(e.target.value)} /></label>
    {threads.length ? <ul>{threads.map(m => <li key={m.thread}><button className="w-full border-b py-2 text-left text-sm underline" onClick={() => setThread(m.thread)}>{m.subject}</button></li>)}</ul> : <p className="text-sm">No matching conversations.</p>}
    {threads.some(m => m.thread === active) && <div className="space-y-2 border-l-2 border-primary pl-3 text-sm" aria-label="Selected conversation">{run.messages.filter(m => m.thread === active).map(m => <article className="space-y-1 border-b pb-2" key={m.id}><strong>{m.subject}</strong><p>{m.from} · {m.category}</p><p>{m.text}</p><p className="break-all text-xs">{m.thread} / {m.id}</p>{m.file && <p>Attachment: Structural drawings v{m.file}.pdf</p>}{m.project ? <p>Linked to {m.project}</p> : <Button size="sm" disabled={pending} onClick={() => act('associate', true)}>Confirm match: {run.project}</Button>}</article>)}</div>}
  </section>;
}