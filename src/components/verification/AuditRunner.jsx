import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ShieldCheck } from 'lucide-react';
export default function AuditRunner() {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [progress, setProgress] = useState(null), [error, setError] = useState('');
  const latest = useQuery({ queryKey: ['verificationLatest'], queryFn: () => base44.entities.VerificationRun.filter({}, { sort: '-created_date', limit: 1 }) });
  const run = progress || latest.data?.items[0];
  const start = async () => {
    setBusy(true); setError('');
    try {
      let result = (await base44.functions.invoke('runCoreVerification', { action: 'start' })).data;
      if (result.error) throw new Error(result.error);
      setProgress(result.run);
      while (result.run.status === 'running') {
        const r = result.run;
        result = (await base44.functions.invoke('runCoreVerification', { action: 'step', run_id: r.id, expected_step: r.step, expected_cursor: r.cursor })).data;
        if (result.error) throw new Error(result.error);
        setProgress(result.run);
      }
      await client.invalidateQueries({ queryKey: ['verification'] });
      await client.invalidateQueries({ queryKey: ['verificationLatest'] });
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return <Card><CardContent className="p-5 space-y-3">
    <div className="flex flex-wrap justify-between items-center gap-4"><div><h2 className="font-heading font-semibold flex gap-2 items-center"><ShieldCheck className="w-5 h-5 text-primary" />Read-only business verification</h2><p className="text-sm text-muted-foreground mt-1">Checks save findings only. No financial records, links, answers, or allocations are corrected.</p></div>
      <Button onClick={start} disabled={busy || latest.isLoading}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? 'Checking records…' : run?.status === 'running' ? 'Resume verification' : 'Run verification'}</Button></div>
    {run && <div className="text-sm space-y-2"><p>{run.status === 'completed' ? 'Completed' : 'In progress'} · {run.checked || 0} records checked · {run.step || 0}/11 sources completed</p><div className="h-2 bg-secondary/10 rounded overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(run.step || 0) / 11 * 100}%` }} /></div><p className="text-xs text-muted-foreground">Started {new Date(run.started_at).toLocaleString()} · Rules {run.rule_version}</p><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{Object.entries(run.coverage || {}).map(([source,n]) => <span key={source}>{source}: {n}</span>)}</div></div>}
    {(error || latest.error) && <p role="alert" className="text-sm text-destructive">{error || latest.error.message}</p>}
  </CardContent></Card>;
}