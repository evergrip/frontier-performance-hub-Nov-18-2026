import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const toggle = (all, id) => all.includes(id) ? all.filter(x => x !== id) : [...all,id];
export default function PreconShareEmailForm({ state, message, onClose, send, pending, error }) {
  const [projectId, setProject] = useState('');
  const [mode, setMode] = useState('message');
  const [ids, setIds] = useState([message.id]);
  const [audience, setAudience] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [note, setNote] = useState('');
  const thread = state.inbox.filter(m => m.thread === message.thread);
  const project = state.projects.find(p => p.id === projectId);
  const selected = thread.filter(m => ids.includes(m.id));
  function submit(e) {
    e.preventDefault();
    send({action:'share',messageId:message.id,messageIds:ids,mode,projectId,audience,attachmentKeys:attachments,note}).then(ok => { if (ok) onClose(); });
  }
  return <Dialog open onOpenChange={v => { if (!v && !pending) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Share with Project</DialogTitle><DialogDescription>{message.subject} · Only the selected content is copied. Future replies stay private.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4 text-sm">
      <label className="block">Frontier project<select required className="mt-1 block w-full rounded border bg-background p-2" value={projectId} onChange={e => {setProject(e.target.value); setAudience([]);}}><option value="">Choose a project</option>{state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="block">Share<select className="mt-1 block w-full rounded border bg-background p-2" value={mode} onChange={e => {setMode(e.target.value); setIds([message.id]); setAttachments([]);}}><option value="message">This message only</option><option value="conversation">Selected messages in this conversation</option></select></label>
      {mode === 'conversation' && <fieldset><legend className="font-semibold">Messages to include</legend>{thread.map(m => <label className="block py-1" key={m.id}><input type="checkbox" checked={ids.includes(m.id)} disabled={m.id === message.id} onChange={() => {setIds(toggle(ids,m.id));setAttachments(attachments.filter(a => !a.startsWith(`${m.id}:`)));}} /> {m.subject} · {m.date.slice(0,10)}</label>)}</fieldset>}
      {project && <fieldset><legend className="font-semibold">Team members who will get access</legend>{project.team.filter(id => id !== state.actor).map(id => <label className="block py-1" key={id}><input type="checkbox" checked={audience.includes(id)} onChange={() => setAudience(toggle(audience,id))} /> {state.people[id]}</label>)}</fieldset>}
      <fieldset><legend className="font-semibold">Attachments to include</legend>{selected.flatMap(m => m.attachments).length ? selected.flatMap(m => m.attachments.map(a => { const key = `${m.id}:${a.id}`; return <label className="block py-1" key={key}><input type="checkbox" checked={attachments.includes(key)} onChange={() => setAttachments(toggle(attachments,key))} /> {a.name} · {m.subject}</label>; })) : <p>No attachments on the selected messages.</p>}</fieldset>
      <label className="block">Optional note<textarea className="mt-1 block w-full rounded border bg-background p-2" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button disabled={pending || !audience.length}>Confirm share</Button>
    </form>
  </DialogContent></Dialog>;
}