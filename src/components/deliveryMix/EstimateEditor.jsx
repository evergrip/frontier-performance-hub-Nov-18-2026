import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cadCents, committed, pct, preciseHours, priceJob } from '@/lib/deliveryMix';
import { estimateTargetHours, TARGET_MARGIN } from '@/components/deliveryMix/estimateTargetHours';
import MixDialog from '@/components/deliveryMix/MixDialog';
import MixFields from '@/components/deliveryMix/MixFields';
import EstimateSheetRow from '@/components/deliveryMix/EstimateSheetRow';
import { asMoney, changedScopeRows, newScopeRow, scopeCosts, scopeOperations } from '@/components/deliveryMix/estimateSheetValues';

const basicFields = [['start_month','Start month','month',{required:true}], ['job_number','Job number','text',{maxLength:100}]];
const options = [['override_contract_price','Price override (CAD)','number',{min:0,step:'0.01'}], ['labour_rate_override','Labour rate override (CAD/hr)','number',{min:0,step:'0.01'}], ['notes','Estimate notes','textarea',{maxLength:3000}]];
const headers = ['Scope', 'Subtrade', 'Sub quote', 'In-house hrs', 'In-house mix', 'Est. COGS / GP', ''];
const currentMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone:'America/Toronto', year:'numeric', month:'2-digit' }).format(new Date());

export default function EstimateEditor({ job, settings, subtrades, canOperate, add, focus, save, onClose }) {
  const [values, setValues] = useState(() => ({ start_month: job.allocations[0]?.period || currentMonth(), ...job.estimate }));
  const [original] = useState(() => new Map(job.scopes.map(row => [row.id, row])));
  const [rows, setRows] = useState(() => [...original.values(), ...(!original.size || add ? [newScopeRow()] : [])]);
  const [focusRow, setFocusRow] = useState(focus || (add || !job.scopes.length ? rows.at(-1)?.rowKey : null));
  const canSchedule = canOperate && committed(job);
  const estimate = { start_month: values.start_month, job_number: values.job_number || '', notes: values.notes || '', override_contract_price: asMoney(values.override_contract_price), labour_rate_override: asMoney(values.labour_rate_override) };
  const preview = priceJob({ ...job, estimate }, rows.map(row => ({ ...scopeCosts(row), ...scopeOperations(row) })), settings);
  const labourRate = estimate.labour_rate_override ?? settings.labour_rate;
  const target = estimateTargetHours(preview, labourRate);
  const fillHours = () => setRows(current => current.map((row, index) => target.hours.has(index) ? { ...row, inhouse_hours: target.hours.get(index) } : row));
  const saveSheet = () => {
    if (canSchedule && rows.some(row => row.inhouse_share > 0 && !(Number(row.inhouse_hours) > 0) && (row.inhouse_share !== original.get(row.id)?.inhouse_share || Number(row.inhouse_hours || 0) !== Number(original.get(row.id)?.inhouse_hours || 0)))) throw new Error('Enter hours for each in-house scope, use Fill hours, or set its mix back to 0%.');
    const edits = changedScopeRows(rows, original, canSchedule);
    if (edits.some(row => !row.scope_name)) throw new Error('Give each filled row a scope name before saving.');
    return save({ action: 'estimate', jobId: job.id, data: { ...estimate, rows: edits } });
  };
  return <MixDialog sheet title={job.estimate ? 'Edit estimate' : 'Create estimate'} description={job.title} submit="Save estimate" onClose={onClose} onSave={saveSheet}>
    <div className="grid grid-cols-2 gap-3 sm:max-w-sm"><MixFields fields={basicFields} values={values} setValues={setValues} /></div>
    <details><summary className="w-fit cursor-pointer text-sm text-muted-foreground">Price, labour rate &amp; notes</summary><div className="mt-2 grid gap-3 sm:grid-cols-3"><MixFields fields={options} values={values} setValues={setValues} /></div></details>
    <p className="text-xs text-muted-foreground">Each slider replaces part of that row’s sub quote with in-house labour and extras. The customer price stays fixed; margin only moves if costs differ. {canSchedule ? 'Set a crew start in Details to include the hours in capacity.' : 'In-house inputs are a preview only and won’t be saved.'}</p>
    <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={!target.hours} onClick={fillHours}>Fill hours for {TARGET_MARGIN}% margin</Button><p className="text-xs text-muted-foreground" aria-live="polite">{target.reason || `Budget: ${preciseHours(target.crewHours)} of crew time at this mix. Replaces hours only on selected scopes, split by sub quote. Not a duration estimate.`}</p></div>
    <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[780px] table-fixed text-sm" aria-label="Estimate spreadsheet">
      <colgroup><col className="w-[19%]" /><col className="w-[17%]" /><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[17%]" /><col className="w-[14%]" /><col className="w-[10%]" /></colgroup>
      <thead className="bg-muted text-left text-xs"><tr>{headers.map((header, index) => <th scope="col" key={header} className={`p-2 ${index === 5 ? 'text-right' : ''}`}>{header || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => { const key = row.id || row.rowKey; return <EstimateSheetRow key={key} row={row} priced={preview.scopes[index]} labourRate={labourRate} index={index} trades={subtrades} canSchedule={canSchedule} focus={key === focusRow} onChange={patch => setRows(current => current.map(item => (item.id || item.rowKey) === key ? {...item,...patch} : item))} onRemove={() => setRows(current => current.filter(item => item.rowKey !== key))} />; })}</tbody>
    </table></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" onClick={() => { const row = newScopeRow(); setRows(current => [...current, row]); setFocusRow(row.rowKey); }}>+ Add row</Button><div className="flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums"><span>Price <strong>{cadCents(preview.price)}</strong></span><span>Est. COGS <strong>{cadCents(preview.cogs)}</strong></span><span>Gross profit <strong>{cadCents(preview.gp)}</strong></span><span>Gross margin <strong>{pct(preview.gm, 3)}</strong></span></div></div>
  </MixDialog>;
}