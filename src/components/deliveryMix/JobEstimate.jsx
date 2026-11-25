import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cad, pct, hrs, committed, scheduleScopes } from '@/lib/deliveryMix';
import JobMonthly from '@/components/deliveryMix/JobMonthly';
import JobPicker from '@/components/deliveryMix/JobPicker';
import MixTable from '@/components/deliveryMix/MixTable';
import MixMetrics from '@/components/deliveryMix/MixMetrics';
import MixDialog from '@/components/deliveryMix/MixDialog';
import EstimateEditor from '@/components/deliveryMix/EstimateEditor';
import ScopeEditor from '@/components/deliveryMix/ScopeEditor';

const buildLabel = value => ({ in_house: 'In-house', mixed: 'Mixed', subcontractor: 'Subcontractor' })[value] || 'Not set';
export default function JobEstimate({ jobs, job, onSelect, canEstimate, canOperate, capacity, subtrades, save }) {
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);
  const history = job?.bucket === 'Complete';
  const variance = job?.hubValue > 0 ? (job.price - job.hubValue) / job.hubValue * 100 : null;
  const existingMonths = new Set(job?.allocations.map(row => row.period));
  const over = capacity.filter(row => row.over && job?.scopes.some(s => s.hours > 0 && s.months.includes(row.month))).map(row => row.month);
  const nextBuildType = job?.scopes.some(s => s.share > 0) ? 'mixed' : 'subcontractor';
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><JobPicker jobs={jobs} selected={job} onSelect={onSelect} history />{job && !history && canEstimate && <Button onClick={() => setDialog({ type: 'estimate' })}>{job.estimate ? 'Edit estimate' : 'Create estimate'}</Button>}</div>
    {!job ? <p className="text-sm text-muted-foreground">Select a job to see or create its delivery estimate.</p> : <p className="text-sm text-muted-foreground">{job.client} · {history ? 'Read-only history' : job.bucket === 'Pipeline' ? 'Pipeline (not in capacity)' : job.bucket}{job.estimate && ` · Estimate starts ${job.estimate.start_month}${job.estimate.job_number ? ` · Job ${job.estimate.job_number}` : ''}`}</p>}
    {job && !job.estimate && <p className="rounded-md border p-4 text-sm text-muted-foreground">Not yet estimated. Hub value: {cad(job.hubValue)}.</p>}
    {job?.estimate && <>
      <MixMetrics items={[
        ['Contract price',cad(job.price),'Before HST'],['Price incl. HST',cad(job.withHst),'For information only'],['Hub value',cad(job.hubValue),variance == null ? 'No comparison value' : `${pct(variance)} variance${Math.abs(variance) > 2 ? ' · exceeds 2%' : ''}`,Math.abs(variance) > 2],['Baseline GP / GM',cad(job.baseline),pct(job.baselineGM)],['Current GP / GM',cad(job.gp),pct(job.gm)],['Added GP',cad(job.added)],['In-house hours',hrs(job.hours)],['Added GP / hr',cad(job.perHour)],['Memo tier',job.tier],['Months over capacity',committed(job) ? over.length : '—',over.join(', '),over.length > 0],
      ]} />
      {job.estimate.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{job.estimate.notes}</p>}
      <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">Scopes</h2>{!history && canEstimate && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialog({ type: 'apply' })} disabled={!job.scopes.length || job.gm == null}>Apply to job forecast</Button><Button onClick={() => setDialog({ type: 'cost' })}>Add scope</Button></div>}</div>
      {existingMonths.size > 0 && <p className="text-sm text-muted-foreground">Hub revenue schedule: {job.allocations.map(row => `${row.period} (${pct(row.percentage)})`).join(', ')}.</p>}
      <MixTable label="Estimate scopes" headers={['Scope / cost code','Sub baseline','Sell price','Baseline GP','Current GP / GM','Schedule','Actions']} rows={job.scopes.map(s => ({ id:s.id, cells:[<div>{s.scope_name} <small className="text-muted-foreground">{s.cost_code}</small>{s.invalid && <Badge variant="destructive" className="ml-2">Invalid share · treated as subbed</Badge>}{s.share > 0 && s.share < 1 && <p className="text-xs text-muted-foreground">partial self-perform (assumes linear split)</p>}</div>,cad(s.baseCost),cad(s.sell),cad(s.baseline),`${cad(s.gp)} / ${pct(s.sell ? s.gp/s.sell*100 : null)}`,<div>{s.months.join(', ') || 'Not scheduled'}{existingMonths.size > 0 && s.months.some(m => !existingMonths.has(m)) && <p className="text-xs text-destructive">Outside hub allocated months</p>}</div>,<div className="flex gap-1">{!history && canEstimate && <><Button size="sm" variant="outline" onClick={() => setDialog({ type:'cost', scope:s })}>Edit costs</Button><Button size="sm" variant="ghost" onClick={() => setDialog({ type:'delete', scope:s })}>Remove</Button></>}{!history && canOperate && <Button size="sm" variant="outline" onClick={() => setDialog({ type:'ops', scope:s })}>Edit schedule</Button>}</div>] }))} empty="No scopes on this estimate yet." />
      <JobMonthly slices={scheduleScopes(job.scopes)} window={capacity.map(row => row.month)} />
    </>}
    {dialog?.type === 'estimate' && <EstimateEditor job={job} save={save} onClose={close} />}
    {['cost','ops'].includes(dialog?.type) && <ScopeEditor job={job} scope={dialog.scope} mode={dialog.type} subtrades={subtrades} save={save} onClose={close} />}
    {dialog?.type === 'delete' && <MixDialog title="Remove scope?" description={dialog.scope.scope_name} submit="Remove scope" onClose={close} onSave={() => save({ action:'deleteScope', jobId:job.id, scopeId:dialog.scope.id })}><p className="text-sm">This removes the scope from the estimate and forecast.</p></MixDialog>}
    {dialog?.type === 'apply' && <MixDialog title="Apply to job forecast?" description="Only the values below will change. Price and monthly revenue allocations stay the same." submit="Apply to job forecast" onClose={close} onSave={() => save({ action:'applyForecast',jobId:job.id,data:{buildType:job.buildType ?? null,margin:job.type === 'Sale' ? job.margin ?? null : null,nextBuildType,nextMargin:job.gm} })}><p className="text-sm">Build type: <strong>{buildLabel(job.buildType)} → {buildLabel(nextBuildType)}</strong></p>{job.type === 'Sale' && <p className="text-sm">Estimated margin: <strong>{pct(job.margin)} → {pct(job.gm)}</strong></p>}</MixDialog>}
  </div>;
}