import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PreconGmailMessage, { gmailDate } from '@/components/precon/PreconGmailMessage';
import { gmailError, shareRequest } from '@/components/precon/preconGmailApi';

export default function PreconGmailProjectHistory({userId,revision}) {
  const [projectId,setProject] = useState(''), [id,setId] = useState(''), [downloading,setDownloading] = useState(false), [error,setError] = useState('');
  const projects = useQuery({queryKey:['gmail-projects',userId],queryFn:()=>shareRequest('projects'),retry:false,gcTime:0});
  const history = useInfiniteQuery({queryKey:['gmail-project-history',userId,projectId,revision],queryFn:({pageParam})=>shareRequest('history',{projectId,cursor:pageParam}),initialPageParam:'',getNextPageParam:p=>p.nextCursor || undefined,enabled:!!projectId,retry:false,gcTime:0});
  const copy = useQuery({queryKey:['gmail-project-copy',userId,projectId,id],queryFn:()=>shareRequest('open',{projectId,shareId:id}),enabled:!!id,retry:false,gcTime:0});
  async function download(attachmentId) {
    setDownloading(true);setError('');
    try {
      const {attachment} = await shareRequest('download',{projectId,shareId:id,attachmentId});
      const bytes = Uint8Array.from(atob(attachment.data),c=>c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
      const link = document.createElement('a');link.href=url;link.download=attachment.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) {setError(gmailError(e,'Could not download this attachment.'));}
    finally {setDownloading(false);}
  }
  const entries = history.data?.pages.flatMap(p=>p.shares) || [];
  return <section className="space-y-2 border-t pt-4 text-sm">
    <h3 className="font-semibold">Shared project emails</h3>
    {projects.isPending ? <p>Loading projects…</p> : projects.isError ? <p role="alert">{gmailError(projects.error,'Could not load projects.')} <Button size="sm" variant="outline" onClick={()=>projects.refetch()}>Retry</Button></p> : !projects.data.projects.length ? <p>No pilot project teams assigned.</p> : <label className="block">Project<select className="mt-1 block max-w-full rounded border bg-background p-2" value={projectId} onChange={e=>{setId('');setProject(e.target.value);}}><option value="">Choose a project</option>{projects.data.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
    {projectId && (history.isPending ? <p>Loading shared emails…</p> : history.isError ? <p role="alert">{gmailError(history.error,'Could not load shared emails.')} <Button size="sm" variant="outline" onClick={()=>history.refetch()}>Retry</Button></p> : !entries.length ? <p>No emails shared with you for this project.</p> : <ul className="divide-y border">{entries.map(s=><li key={s.id}><button className="block w-full break-words p-3 text-left hover:bg-primary/10" onClick={()=>{setError('');setId(s.id);}}><strong>{s.subject}</strong><span className="block text-muted-foreground">Shared by {s.sharedBy} · {gmailDate(s.sharedAt)} · {s.attachmentNames.length} attachments</span></button></li>)}</ul>)}
    {projectId && history.hasNextPage && <Button variant="outline" size="sm" disabled={history.isFetching} onClick={()=>history.fetchNextPage()}>More shared emails</Button>}
    {id && <Dialog open onOpenChange={open=>{if(!open && !downloading)setId('');}}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Shared project email</DialogTitle><DialogDescription>This is the confirmed copy, not a link to anyone’s inbox.</DialogDescription></DialogHeader>
      {copy.isPending ? <p>Opening shared email…</p> : copy.isError ? <p role="alert">{gmailError(copy.error,'Could not open this shared email.')}</p> : <>
        <p className="text-sm">Shared by {copy.data.sharedBy} on {gmailDate(copy.data.sharedAt)} with {copy.data.recipients.map(m=>m.name).join(', ')}.</p>
        <PreconGmailMessage message={copy.data.message}>{copy.data.message.attachments.map(a=><Button variant="outline" size="sm" key={a.id} disabled={downloading} onClick={()=>download(a.id)}>Download {a.name}</Button>)}</PreconGmailMessage>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </>}
    </DialogContent></Dialog>}
  </section>;
}