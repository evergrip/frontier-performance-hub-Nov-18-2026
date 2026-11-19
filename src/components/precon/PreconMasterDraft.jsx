import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PreconMasterMatrix from './PreconMasterMatrix';
import PreconMasterRun from './PreconMasterRun';

const request = async payload => (await base44.functions.invoke('preconMasterDraft', payload)).data;
export default function PreconMasterDraft() {
  const [path, setPath] = useState('detailed');
  const [run, setRun] = useState(null);
  const lock = useRef(false);
  const ref = useQuery({ queryKey: ['precon-master-draft', path], queryFn: () => request({mode:'reference', path}) });
  const command = useMutation({ mutationFn: request });
  async function send(action) {
    if (lock.current) return;
    lock.current = true;
    try { setRun(await command.mutateAsync({mode:'simulate', path, history: run?.history || [], command: action})); } catch { /* Shown below or in stage form. */ }
    finally { lock.current = false; }
  }
  const error = command.error?.response?.data?.error || command.error?.message;
  return <section className="space-y-4 border border-border bg-background p-4 sm:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">Draft for management validation</p><h2 className="mt-1 font-heading text-2xl font-bold">Frontier Pre-Construction Master Workflow v1.0 (Draft)</h2><p className="mt-1 text-sm text-muted-foreground">Source: {ref.data?.source || 'April 2026 process manual transcription'}. Role assignments, timing and dependencies are proposals, not approvals.</p></header>
    <label className="block text-sm">Permit sequencing to review<select className="mt-1 block max-w-full rounded border bg-background p-2" value={path} disabled={!!run || command.isPending} onChange={e => { command.reset(); setPath(e.target.value); }}><option value="detailed">34-stage matrix: permit after agreement</option><option value="early">22-step map: permit before estimating</option></select></label>
    {ref.isPending ? <p className="text-sm">Loading the draft…</p> : ref.isError ? <p role="alert" className="text-sm text-destructive">The draft could not be loaded. <button type="button" onClick={() => ref.refetch()} className="underline">Retry</button></p> : <>
      <PreconMasterMatrix template={ref.data} />
      <div className="space-y-4 border border-border bg-card p-4">
        <h3 className="font-heading font-semibold">Run the draft on a fictional project</h3>
        <p className="text-sm">Start as Sales at Stage 1. Use made-up evidence references and switch roles to record independent decisions. The server checks stage dependencies, evidence completeness and version matching, then automatically releases eligible tasks. Five-day stage targets and two-day follow-ups are rehearsal defaults only.</p>
        <p className="text-xs text-muted-foreground">This rehearsal does not verify real files, contact anyone, spend funds, or connect to a live Sale. The audit is viewable during the rehearsal and cleared on refresh. Live activation and permanent audit storage are not enabled.</p>
        {!run ? <><Button disabled={command.isPending} onClick={() => send()}>{command.isPending ? 'Starting…' : 'Start draft rehearsal'}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</> : <><Button variant="outline" disabled={command.isPending} onClick={() => { command.reset(); setRun(null); }}>End rehearsal</Button><PreconMasterRun run={run} template={ref.data} send={send} pending={command.isPending} error={error} resetError={command.reset} /></>}
      </div>
    </>}
  </section>;
}