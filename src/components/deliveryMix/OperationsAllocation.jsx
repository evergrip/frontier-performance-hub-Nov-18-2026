import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cad, suggestMix } from '@/lib/deliveryMix';
import JobPicker from '@/components/deliveryMix/JobPicker';
import ScopeAllocation from '@/components/deliveryMix/ScopeAllocation';
import ScopeEditor from '@/components/deliveryMix/ScopeEditor';
import MixDialog from '@/components/deliveryMix/MixDialog';
import MixTable from '@/components/deliveryMix/MixTable';

export default function OperationsAllocation({ jobs, job, onSelect, scopes, capacity, canOperate, save, refresh }) {
  const [scopeMode, setScopeMode] = useState('job');
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const lookup = new Map(capacity.map(row => [row.month, row]));
  const calculate = (all, months) => suggestMix(all.filter(s => (scopeMode === 'all' || s.job.id === job?.id) && s.inhouse_feasible && s.inhouse_hours > 0 && s.fullAdded > 0), all, months);
  const apply = async () => {
    const fresh = await refresh();
    const next = calculate(fresh.scopes, fresh.capacity);
    const signature = rows => JSON.stringify(rows.map(({ scope, share }) => [scope.id, scope.updated_date, share]));
    if (signature(preview) !== signature(next)) throw new Error('Inputs changed after preview. Cancel and suggest again.');
    return save({ action:'applyShares', data:{ rows:next.map(({ scope, share }) => ({ id:scope.id, version:scope.updated_date, share })) } });
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><JobPicker jobs={jobs} selected={job} onSelect={onSelect} />{canOperate && <div className="flex items-center gap-2">
      <Select value={scopeMode} onValueChange={setScopeMode}><SelectTrigger aria-label="Suggestion scope" className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="job">This job</SelectItem><SelectItem value="all">All jobs</SelectItem></SelectContent></Select>
      <Button disabled={scopeMode === 'job' && !job} onClick={() => setPreview(calculate(scopes, capacity))}>Suggest</Button>
    </div>}</div>
    <p className="text-sm text-muted-foreground">Remaining hours are company-wide. The first number excludes the scope’s own saved hours; the second includes the share shown.</p>
    {!job?.scopes.length && <p className="rounded-md border p-4 text-sm text-muted-foreground">{job ? job.estimate ? 'Add scopes on Job Estimate first.' : 'This job is not yet estimated.' : 'Select a signed or in-construction job to allocate its scopes.'}</p>}
    {job?.scopes.map(scope => <ScopeAllocation key={`${scope.id}/${scope.updated_date}`} scope={scope} jobId={job.id} capacity={lookup} canOperate={canOperate} onEdit={() => setEditing(scope)} save={save} />)}
    {editing && <ScopeEditor mode="ops" job={job} scope={editing} save={save} onClose={() => setEditing(null)} />}
    {preview?.length > 0 && <MixDialog title="Suggested allocations" description="Whole scopes are ranked by added GP per hour. Other allocations are kept in place." submit="Apply" onSave={apply} onClose={() => setPreview(null)} wide>
      <MixTable headers={['Job','Scope','GP / hr','Current → suggested','Decision']} rows={preview.map(({ scope, share, reason }) => ({ id:scope.id,cells:[scope.job.title,scope.scope_name,cad(scope.ratePerHour),`${scope.inhouse_share || 0}% → ${share}%`,reason] }))} />
    </MixDialog>}
    {preview?.length === 0 && <p role="status" className="text-sm text-muted-foreground">No feasible scopes with positive added GP to suggest.</p>}
  </div>;
}