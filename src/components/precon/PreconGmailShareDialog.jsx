import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { gmailError, shareRequest } from '@/components/precon/preconGmailApi';
import PreconGmailMessage from '@/components/precon/PreconGmailMessage';

const toggle = (values,id) => values.includes(id) ? values.filter(v=>v!==id) : [...values,id];
export default function PreconGmailShareDialog({userId,message,onClose,onShared}) {
  const [projectId,setProject] = useState(''), [attachmentIds,setAttachments] = useState([]), [recipientIds,setRecipients] = useState([]);
  const [confirmed,setConfirmed] = useState(false), [pending,setPending] = useState(false), [error,setError] = useState('');
  const lock = useRef(false);
  const projects = useQuery({queryKey:['gmail-share-dialog-projects',userId],queryFn:()=>shareRequest('projects'),retry:false,gcTime:0});
  const team = useQuery({queryKey:['gmail-share-team',userId,projectId],queryFn:()=>shareRequest('team',{projectId}),enabled:!!projectId,retry:false,gcTime:0});
  const attachments = message.attachments.filter(a=>attachmentIds.includes(a.id));
  async function submit(e) {
    e.preventDefault();
    if (lock.current || !projectId || !recipientIds.length || !confirmed) return;
    lock.current = true;setPending(true);setError('');
    try { await shareRequest('share',{projectId,messageId:message.id,attachmentIds,recipientIds,confirmed});onShared(); }
    catch(e) {setError(gmailError(e,'Could not share the selected message.'));}
    finally {lock.current=false;setPending(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open && !pending)onClose();}}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>Share with Project</DialogTitle><DialogDescription>Only the message shown below will be copied. Other messages and future replies stay private.</DialogDescription></DialogHeader>
    <PreconGmailMessage message={{...message,attachments}} />
    <form onSubmit={submit} className="space-y-4 text-sm">
      <fieldset disabled={pending} className="space-y-3">
        <label className="block">Project<select required value={projectId} className="mt-1 block w-full rounded border bg-background p-2" onChange={e=>{setProject(e.target.value);setRecipients([]);setConfirmed(false);}}><option value="">Choose a project</option>{projects.data?.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        {projects.isPending ? <p>Loading projects…</p> : projects.isError ? <p role="alert">{gmailError(projects.error,'Could not load projects.')} <Button type="button" size="sm" variant="outline" onClick={()=>projects.refetch()}>Retry</Button></p> : !projects.data.projects.length && <p>No eligible projects. Ask an admin to add you to a pilot project team.</p>}
        {projectId && <fieldset><legend className="font-semibold">Recipients on this project</legend>{team.isPending ? <p>Loading team…</p> : team.isError ? <p role="alert">{gmailError(team.error,'Could not load the project team.')} <Button type="button" size="sm" variant="outline" onClick={()=>team.refetch()}>Retry</Button></p> : !team.data.members.length ? <p>No other people are enrolled on this project.</p> : team.data.members.map(m=><label className="block py-1" key={m.id}><input type="checkbox" checked={recipientIds.includes(m.id)} onChange={()=>{setRecipients(toggle(recipientIds,m.id));setConfirmed(false);}} /> {m.name}</label>)}</fieldset>}
        <fieldset><legend className="font-semibold">Attachments to include (optional)</legend>{message.attachments.length ? message.attachments.map(a=><label className="block break-words py-1" key={a.id}><input type="checkbox" checked={attachmentIds.includes(a.id)} onChange={()=>{setAttachments(toggle(attachmentIds,a.id));setConfirmed(false);}} /> {a.name}</label>) : <p>No attachments on this message.</p>}<p>{attachments.length ? `${attachments.length} selected · up to 4 MB total` : 'No attachments will be shared.'}</p></fieldset>
        <label className="block border-t pt-3"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /> I confirm this message, the selected attachments and the recipients above.</label>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button disabled={pending || !projectId || !recipientIds.length || !confirmed || team.isError}>{pending ? 'Sharing…' : 'Confirm share'}</Button>
    </form>
  </DialogContent></Dialog>;
}