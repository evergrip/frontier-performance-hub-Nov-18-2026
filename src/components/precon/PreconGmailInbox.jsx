import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PreconGmailMessage, { gmailDate } from '@/components/precon/PreconGmailMessage';
import PreconGmailShareDialog from '@/components/precon/PreconGmailShareDialog';
import PreconGmailProjectHistory from '@/components/precon/PreconGmailProjectHistory';
import usePreconGmailInbox from '@/components/precon/usePreconGmailInbox';

export default function PreconGmailInbox({userId}) {
  const inbox = usePreconGmailInbox();
  const submitted = inbox.page?.query || '';
  const [query,setQuery] = useState(''), [share,setShare] = useState(null), [revision,setRevision] = useState(0);
  const [notice,setNotice] = useState('');
  return <section className="space-y-4 border bg-card p-4 sm:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">Phase 2 · Read-only pilot</p><h2 className="font-heading text-xl font-bold">Private Gmail inbox</h2><p className="text-sm">Only you can read your connected mailbox. Nothing is shared unless you confirm it.</p></header>
    {inbox.auth === null ? <p role="status">Checking sign-in…</p> : !inbox.auth ? <Button onClick={()=>base44.auth.redirectToLogin()}>Sign in to connect Gmail</Button> : <>
      {inbox.pending && <p className="text-sm" role="status">Loading Gmail…</p>}
      {inbox.error && <p className="text-sm text-destructive" role="alert">{inbox.error}</p>}
      {!inbox.page ? <div className="flex flex-wrap gap-2">
        {inbox.canConnect && <Button disabled={inbox.pending} onClick={inbox.connect}>Connect My Gmail</Button>}
        {!inbox.pending && <Button variant="outline" onClick={()=>inbox.load()}>Check connection</Button>}
      </div> : <>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();inbox.load(query.trim());}}>
          <label className="min-w-48 flex-1 text-sm">Search my Gmail<Input value={query} onChange={e=>setQuery(e.target.value)} maxLength={500} placeholder="e.g. from:client@example.com" /></label>
          <Button disabled={inbox.pending}>Search</Button><Button type="button" variant="outline" disabled={inbox.pending} onClick={()=>{setQuery('');inbox.load();}}>Latest inbox</Button><Button type="button" variant="outline" disabled={inbox.pending} onClick={inbox.disconnect}>Disconnect Gmail</Button>
        </form>
        <h3 className="text-sm font-semibold">{submitted ? `Results for ${submitted}` : 'Latest inbox emails'}</h3>
        {inbox.page.messages.length ? <ul className="divide-y border">{inbox.page.messages.map((m,index)=><li key={`${m.id}-${index}`}><button className="block w-full break-words p-3 text-left text-sm hover:bg-primary/10" disabled={inbox.pending} onClick={()=>inbox.open(m.threadId)}><strong>{m.subject}</strong><span className="mt-1 block text-muted-foreground">{m.from} · {gmailDate(m.date)}</span></button></li>)}</ul> : <p className="text-sm">No matching emails.</p>}
        {submitted && inbox.page.nextCursor && <Button variant="outline" disabled={inbox.pending} onClick={()=>inbox.load(submitted,inbox.page.nextCursor)}>More results</Button>}
      </>}
      {notice && <p role="status" className="text-sm font-medium">{notice}</p>}
      <PreconGmailProjectHistory userId={userId} revision={revision} />
    </>}
    {inbox.thread && !share && <Dialog open onOpenChange={v=>{if(!v)inbox.closeThread();}}><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Gmail conversation</DialogTitle><DialogDescription>Private to your connected Gmail account.</DialogDescription></DialogHeader>{inbox.thread.messages.map(m=><PreconGmailMessage key={m.id} message={m}><Button size="sm" onClick={()=>{setNotice('');setShare(m);}}>Share with Project</Button></PreconGmailMessage>)}</DialogContent></Dialog>}
    {share && <PreconGmailShareDialog userId={userId} message={share} onClose={()=>setShare(null)} onShared={()=>{setShare(null);inbox.closeThread();setRevision(n=>n+1);setNotice('The selected email was shared with the confirmed project recipients.');}} />}
  </section>;
}