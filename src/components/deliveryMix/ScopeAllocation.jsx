import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cad, hrs } from '@/lib/deliveryMix';

export default function ScopeAllocation({ scope, jobId, capacity, canOperate, onEdit, save }) {
  const [draft, setDraft] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const saved = scope.inhouse_share || 0, share = draft ?? saved;
  const valid = scope.inhouse_feasible && scope.inhouse_hours > 0;
  const effective = valid ? share / 100 : 0;
  const hours = (scope.inhouse_hours || 0) * effective;
  const months = scope.months.map(month => {
    const row = capacity.get(month);
    const before = row == null ? null : row.remaining + scope.hours / scope.months.length;
    return { month, before, after: before == null ? null : before - hours / scope.months.length };
  });
  const confirm = async () => {
    setPending(true); setError('');
    try { await save({ action:'scopeOps', jobId, scopeId:scope.id, data:{ inhouse_share:share } }); setDraft(null); }
    catch (e) { setError(e.message); }
    finally { setPending(false); }
  };
  return <Card><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center gap-2 text-base">{scope.scope_name}{share > 0 && !valid && <Badge variant="destructive">Invalid share · treated as subbed</Badge>}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm">{cad(scope.fullAdded * effective)} added GP · {hrs(hours)} used · {cad(scope.ratePerHour)} added GP/hr</p>
      <div className="flex flex-wrap items-center gap-3"><Slider aria-label={`${scope.scope_name} in-house share`} className="w-full max-w-sm" value={[share]} min={0} max={100} step={1} disabled={!canOperate || pending} onValueChange={([next]) => setDraft(next)} /><span className="text-sm font-semibold">{share}% in-house</span>
        {canOperate && draft != null && draft !== saved && <><Button size="sm" disabled={pending} onClick={confirm}>{pending ? 'Saving…' : 'Save share'}</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => setDraft(null)}>Cancel</Button></>}
        {canOperate && <Button size="sm" variant="outline" disabled={pending} onClick={onEdit}>Edit operations inputs</Button>}
      </div>
      {effective > 0 && effective < 1 && <p className="text-xs text-muted-foreground">partial self-perform (assumes linear split)</p>}
      {!months.length && <p className="text-xs text-muted-foreground">Not scheduled.</p>}
      <div className="flex flex-wrap gap-2">{months.map(({ month, before, after }) => <Badge key={month} variant={after != null && after < -1e-8 ? 'destructive' : 'outline'}>{month}: {before == null ? 'Outside window' : `${hrs(before)} before → ${hrs(after)} after${after < -1e-8 ? ' · Over capacity' : ''}`}</Badge>)}</div>
      {scope.decision_notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{scope.decision_notes}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}