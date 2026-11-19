import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { inboxRequest, gmailError, gmailStatus } from '@/components/precon/preconGmailApi';

export default function PreconGmailComposer({ request, onClose, onSent, onReconnect }) {
  const seed = useQuery({queryKey:['precon-gmail-draft',request.key],queryFn:()=>inboxRequest('prepare',request),retry:false,gcTime:0});
  const [edits,setEdits] = useState({}), [review,setReview] = useState(false), [pending,setPending] = useState(false), [failure,setFailure] = useState(null);
  const [reconnecting,setReconnecting] = useState(false), [connectionError,setConnectionError] = useState('');
  const sending = useRef(false);
  const draft = {...seed.data,...edits};
  function reconnect() {
    setConnectionError(''); setReconnecting(true);
    onReconnect(async()=>{setFailure(null);await seed.refetch();setReconnecting(false);},message=>{setConnectionError(message);setReconnecting(false);});
  }
  const error = failure || seed.error;
  const title = {compose:'Compose email',reply:'Reply',replyAll:'Reply all',forward:'Forward email'}[request.mode];
  const update = key => e => setEdits({...edits,[key]:e.target.value});
  async function send() {
    if (!review || sending.current) return;
    sending.current = true; setPending(true); setFailure(null);
    try { onSent(await inboxRequest('send',{mode:request.mode,messageId:request.messageId,...draft,confirmed:true})); }
    catch (e) { setFailure(e); setReview(false); }
    finally { sending.current = false; setPending(false); }
  }
  return <Dialog open onOpenChange={value=>{if(!value && !sending.current) onClose();}}>
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{review ? 'Confirm Gmail send' : title}</DialogTitle><DialogDescription>{review ? 'Review exactly what will be sent to these recipients.' : 'Nothing is sent until you confirm.'}</DialogDescription></DialogHeader>
      {(seed.isFetching || reconnecting) && <p role="status">{reconnecting ? 'Complete consent with your work Gmail account in the Google window.' : 'Checking your Gmail permissions…'}</p>}
      {connectionError && <p role="alert" className="text-sm text-destructive">{connectionError}</p>}
      {error && <div className="space-y-2 text-sm"><p role="alert" className="text-destructive">{gmailError(error,seed.error ? 'Could not check Gmail access for Compose. Try again.' : 'Gmail did not confirm the send. Check Sent mail before retrying.')}</p>{gmailStatus(error) === 412 ? <Button type="button" variant="outline" disabled={reconnecting} onClick={reconnect}>Reconnect Gmail</Button> : seed.error && <Button type="button" variant="outline" disabled={seed.isFetching} onClick={()=>seed.refetch()}>Retry permission check</Button>}</div>}
      {seed.data && !seed.error && (review ? <div className="space-y-3 break-words text-sm">
        <p><strong>From:</strong> {draft.from}</p><p><strong>To:</strong> {draft.to}</p>{draft.cc && <p><strong>Cc:</strong> {draft.cc}</p>}
        <p><strong>Subject:</strong> {draft.subject || '(No subject)'}</p><div className="max-h-64 overflow-auto whitespace-pre-wrap border bg-background p-3">{draft.body}</div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending} onClick={()=>setReview(false)}>Back to editing</Button><Button type="button" disabled={pending} onClick={send}>{pending ? 'Sending…' : 'Confirm and send'}</Button></div>
      </div> : <form className="space-y-3 text-sm" onSubmit={e=>{e.preventDefault();setFailure(null);setReview(true);}}>
        <p><strong>From:</strong> {draft.from}</p>
        <label className="block">To<Input required value={draft.to} onChange={update('to')} maxLength={3000} placeholder="Email addresses separated by commas" /></label>
        <label className="block">Cc<Input value={draft.cc} onChange={update('cc')} maxLength={3000} /></label>
        <label className="block">Subject<Input readOnly={['reply','replyAll'].includes(request.mode)} value={draft.subject} onChange={update('subject')} maxLength={1000} /></label>
        <label className="block">Message<Textarea required value={draft.body} onChange={update('body')} maxLength={50000} rows={8} /></label>
        {request.mode === 'forward' && <p>Only the message text is forwarded. Attachments are not included.</p>}
        <Button type="submit" disabled={reconnecting || gmailStatus(failure) === 412 || !draft.to.trim() || !draft.body.trim()}>Review before sending</Button>
      </form>)}
    </DialogContent>
  </Dialog>;
}