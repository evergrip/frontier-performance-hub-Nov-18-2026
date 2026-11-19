import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PreconCommunicationInbox from '@/components/precon/PreconCommunicationInbox';
import PreconCommunicationDocuments from '@/components/precon/PreconCommunicationDocuments';
import PreconCommunicationFollowup from '@/components/precon/PreconCommunicationFollowup';

export default function PreconCommunicationRehearsal() {
  const [run, setRun] = useState(null);
  const lock = useRef(false);
  const {mutateAsync, isPending, error, reset} = useMutation({mutationFn: async payload => (await base44.functions.invoke('preconMasterDraft', payload)).data});
  async function act(action, confirmed) {
    if (lock.current) return;
    lock.current = true;
    try { setRun(await mutateAsync({mode:'communication', history:run?.history || [], ...(action ? {command:{action, confirmed}} : {})})); }
    catch { /* Displayed inline below. */ }
    finally { lock.current = false; }
  }
  return <section className="space-y-4 border border-border bg-card p-4 sm:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">Phase 2 · Development only</p><h2 className="font-heading text-xl font-bold">Google Workspace communication rehearsal</h2><p className="mt-1 text-sm">Walk through a fictional engineering thread, document revisions, independent review and follow-up. No Google account, external message or live project is used; this is not a connector test.</p></header>
    {run ? <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{run.project}</h3><Button size="sm" variant="outline" disabled={isPending} onClick={() => { reset(); setRun(null); }}>End rehearsal</Button></div>
      <p className="border-l-2 border-primary pl-3 text-sm" role="status"><strong>Michael’s queue:</strong> {run.attention || 'No new communication actions.'}</p>
      <PreconCommunicationInbox run={run} act={act} pending={isPending} />
      <PreconCommunicationDocuments run={run} act={act} pending={isPending} />
      <PreconCommunicationFollowup run={run} act={act} pending={isPending} />
      <details className="border-t pt-3 text-sm"><summary className="cursor-pointer font-semibold">Simulate provider failures</summary><div className="mt-2 flex flex-wrap gap-2">{[['permission','Deny Drive access'],['disconnect','Disconnect account'],['syncFailure','Fail synchronization']].map(([key,label]) => <Button key={key} size="sm" variant="outline" disabled={isPending} onClick={() => act(key)}>{label}</Button>)}</div></details>
      {run.failure && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{run.failure}</p><Button size="sm" variant="outline" disabled={isPending} onClick={() => act('restore')}>Restore simulated access</Button></div>}
      <details className="text-sm"><summary className="cursor-pointer font-semibold">Session history</summary><ul>{run.audit.map((a,i) => <li key={i}>{a.at} · {a.note}</li>)}</ul></details>
    </> : <Button disabled={isPending} onClick={() => act()}>{isPending ? 'Starting…' : 'Start communication rehearsal'}</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error.response?.data?.error || error.message}</p>}
  </section>;
}