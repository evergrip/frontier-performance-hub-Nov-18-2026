import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cadCents, costFields, pct, preciseHours } from '@/lib/deliveryMix';
import { costLabels } from '@/components/deliveryMix/estimateSheetValues';

export default function EstimateSheetRow({ row, priced, labourRate, fixedPrice, index, trades, onChange, onRemove, canSchedule, focus }) {
  const [details, setDetails] = useState(false);
  const label = name => `${name}, scope ${index + 1}`;
  const field = (key, name, attrs = {}) => <Input aria-label={label(name)} value={row[key] ?? ''} onChange={e => onChange({ [key]: e.target.value })} {...attrs} />;
  const amount = { type: 'number', min: 0, step: '0.01', placeholder: '0', className: 'tabular-nums' };
  const share = Number(row.inhouse_share || 0);
  const impact = !Number(row.inhouse_hours) ? (share > 0 ? 'Fill or enter hours to price' : 'Set mix to plan crew hours') : !row.inhouse_feasible ? 'Select a mix to plan in-house' : Math.abs(priced.fullAdded) < 1e-8 ? 'No margin change: costs match' : `${cadCents(Math.abs(priced.fullAdded))} ${priced.fullAdded > 0 ? 'more' : 'less'} GP at 100%`;
  const hasTrade = trades.some(trade => trade.id === row.subtrade_id);
  return <>
    <tr className="border-b align-top">
      <td className="p-2">{field('scope_name', 'Scope name', { placeholder: 'e.g. Framing', maxLength: 200, autoFocus: focus })}</td>
      <td className="p-2"><select aria-label={label('Subtrade')} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={row.subtrade_id || (row.manualVendor || row.sub_name ? 'manual' : '')} onChange={e => onChange({ subtrade_id: ['manual', ''].includes(e.target.value) ? '' : e.target.value, sub_name: e.target.value === 'manual' ? row.sub_name || '' : '', manualVendor: e.target.value === 'manual' })}>
        <option value="">Select subtrade</option><option value="manual">Enter name…</option>
        {row.subtrade_id && !hasTrade && <option value={row.subtrade_id}>Unavailable subtrade</option>}
        {trades.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>{!row.subtrade_id && (row.manualVendor || row.sub_name) && <div className="mt-1">{field('sub_name', 'Subcontractor name', { placeholder: 'Enter name', maxLength: 200 })}</div>}</td>
      <td className="space-y-2 p-2">{field('sub_quote', 'Sub quote', amount)}
        <label className="flex items-start gap-1.5 text-xs"><input type="checkbox" className="mt-0.5 accent-primary" checked={!!row.sub_supplies_materials} onChange={e => onChange({ sub_supplies_materials: e.target.checked })} />Sub supplies materials</label>
        <label className="block space-y-1 text-xs text-muted-foreground"><span>{row.sub_supplies_materials ? 'Frontier replacement cost' : 'Frontier material cost'}</span>{field('materials_by_frontier', 'Frontier material cost for full scope', { ...amount, required: !!row.sub_supplies_materials && share > 0 })}</label>
        {!row.sub_supplies_materials && <label className="block space-y-1 text-xs text-muted-foreground"><span>Material markup %</span>{field('frontier_material_markup_pct', 'Frontier material markup percentage', { ...amount, placeholder: 'Standard if blank' })}{fixedPrice && <span className="block">Saved, but only applied when there’s no price override.</span>}</label>}
      </td>
      <td className="p-2">{field('inhouse_hours', 'Full in-house hours', { ...amount, onChange: e => onChange({ inhouse_hours: e.target.value, inhouse_feasible: share > 0 || Number(e.target.value) > 0 }) })}{Number(row.inhouse_hours) > 0 && <p className="mt-1 text-xs text-muted-foreground"><span className="block">× {cadCents(labourRate)}/hr</span><span className="block">{cadCents(Number(row.inhouse_hours) * labourRate + priced.inhouseNonLabour)} in-house{priced.inhouseNonLabour > 0 ? ' incl. materials/extras' : ''}</span></p>}</td>
      <td className="p-2"><div className="flex h-9 items-center gap-2"><input type="range" min="0" max="100" step="1" aria-label={label('In-house percentage')} value={share} onChange={e => onChange({ inhouse_share: Number(e.target.value), ...(Number(e.target.value) > 0 ? { inhouse_feasible: true } : {}) })} className="min-w-0 flex-1 accent-primary disabled:opacity-40" /><span className="w-10 text-right text-xs tabular-nums">{share}%</span></div><p className="text-xs text-muted-foreground">{impact}{priced.hours > 0 && <span className="block">{preciseHours(priced.hours)} at this mix</span>}</p></td>
      <td className="p-2 pt-3 text-right text-xs tabular-nums"><div className="break-words font-semibold">{cadCents(priced.finalCost)}</div><div className="mt-1 break-words text-muted-foreground">{cadCents(priced.gp)} GP · {pct(priced.sell ? priced.gp / priced.sell * 100 : null, 2)}</div></td>
      <td className="whitespace-nowrap p-2"><Button type="button" variant="ghost" size="sm" className="px-1.5" aria-expanded={details} onClick={() => setDetails(!details)}>{details ? 'Less' : 'Details'}</Button>{!row.id && <Button type="button" variant="ghost" size="sm" className="px-1.5" aria-label={label('Remove draft row')} onClick={onRemove}>×</Button>}</td>
    </tr>
    {details && <tr className="border-b bg-muted/30"><td colSpan={7} className="p-3"><div className="grid grid-cols-4 gap-3">
      {[['cost_code', 'Cost code', { maxLength: 100 }], ...costFields.slice(2).map((key, i) => [key, costLabels[i + 2], amount]), ['inhouse_extra_materials', 'In-house extras (excluding material cost above)', amount], ...(canSchedule ? [['scheduled_start_month', 'Crew start', { type: 'month' }], ['duration_months', 'Months', { type: 'number', min: 1, max: 120, step: 1, required: true }]] : [])].map(([key, name, attrs]) => <label key={key} className="space-y-1 text-xs">{name}{field(key, name, attrs)}</label>)}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!row.inhouse_feasible} onChange={e => onChange({ inhouse_feasible: e.target.checked, ...(!e.target.checked ? { inhouse_share: 0 } : {}) })} />In-house feasible</label>
    </div></td></tr>}
  </>;
}