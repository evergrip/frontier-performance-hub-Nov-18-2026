import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PreconSharedEmailHistory({ state, send, pending }) {
  const [projectId, setProject] = useState(state.projects[0]?.id || '');
  const shares = state.shares.filter(s => s.projectId === projectId);
  return <section className="space-y-3 border-t pt-4 text-sm">
    <h3 className="font-semibold">Project communications</h3>
    {state.projects.length ? <label className="block">Project<select className="mt-1 block max-w-full rounded border bg-background p-2" value={projectId} onChange={e => {setProject(e.target.value); if (state.attachment) send();}}>{state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : <p>This person is not an authorized member of any sample project.</p>}
    {!shares.length && <p>No messages have been shared with you for this project.</p>}
    {shares.map(s => <article key={s.id} className="space-y-2 border p-3">
      <p><strong>Shared by {state.people[s.owner]}</strong> · {s.sharedAt}</p>
      {s.note && <p className="break-words whitespace-pre-wrap">Note: {s.note}</p>}
      {s.messages.map(m => <details className="border-t pt-2" key={m.id}><summary className="cursor-pointer font-medium">{m.subject}</summary><div className="space-y-1 pt-2"><p>From: {m.from}</p><p>To: {m.to.join(', ')}</p>{m.cc.length > 0 && <p>Cc: {m.cc.join(', ')}</p>}<p>Original date: {m.date}</p><p>Message {m.id} · conversation {m.thread}</p><p className="whitespace-pre-wrap break-words">{m.body}</p>{m.attachments.length ? m.attachments.map(a => <Button variant="outline" size="sm" key={a.id} disabled={pending} onClick={() => send({action:'attachment',shareId:s.id,messageId:m.id,attachmentId:a.id})}>{a.name}</Button>) : <p>No attachments shared.</p>}</div></details>)}
      <p className="border-l-2 border-primary pl-2">Suggestion: {s.suggestion}</p>
      {s.owner === state.actor && <details><summary className="cursor-pointer font-medium">Manage access and view audit</summary><p className="pt-2">Revoking access removes future access in the Hub; it does not delete the retained project copy or undo previous disclosures.</p><ul>{s.access.map(id => <li className="mt-2 flex flex-wrap items-center justify-between gap-2" key={id}>{state.people[id]} <Button variant="outline" size="sm" disabled={pending} onClick={() => send({action:'revoke',shareId:s.id,recipient:id})}>Revoke {state.people[id]}</Button></li>)}</ul>{!s.access.length && <p>No active recipients.</p>}<ul className="mt-2 space-y-1">{s.audit.map((e,i) => <li key={i}>{e.at} · {state.people[e.by]} {e.action} · {state.projects.find(p => p.id === e.projectId)?.name} · {e.recipients.map(id => state.people[id]).join(', ')}</li>)}</ul></details>}
    </article>)}
    {state.attachment && <div className="border bg-background p-3" role="status"><strong>{state.attachment.name}</strong><p className="whitespace-pre-wrap break-words">{state.attachment.text}</p><Button size="sm" variant="outline" disabled={pending} onClick={() => send()}>Close attachment</Button></div>}
  </section>;
}