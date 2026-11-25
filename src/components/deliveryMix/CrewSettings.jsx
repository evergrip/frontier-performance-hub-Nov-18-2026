import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import MixDialog from '@/components/deliveryMix/MixDialog';
import MixFields from '@/components/deliveryMix/MixFields';

const fields = [['labour_rate','All-in labour cost (CAD/hour)','number',{min:0,step:'0.01',required:true}],['baseline_gm','Baseline GM (%)','number',{min:0,max:99.99,step:'0.01',required:true}],['benchmark_gm','Benchmark GM (%)','number',{min:0,max:100,step:'0.01',required:true}],['hst_rate','HST (%)','number',{min:0,max:100,step:'0.01',required:true}],['forecast_months','Forecast months','number',{min:12,max:60,step:1,required:true}]];

export default function CrewSettings({ staff, settings, save }) {
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('');
  const open = mode => { setDraft({ ...settings }); setQuery(''); setMode(mode); };
  const selected = draft?.crew_staff_ids ?? [];
  const visible = staff.filter(s => `${s.name} ${s.department || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="rounded-md border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Crew roster</h3><p className="text-sm text-muted-foreground">{settings.crew_staff_ids.length ? staff.filter(s => settings.crew_staff_ids.includes(s.id)).map(s => s.name).join(', ') : 'No crew selected. Capacity is zero until you add staff.'}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => open('roster')}>Edit crew roster</Button><Button variant="outline" onClick={() => open('settings')}>Delivery settings</Button></div>
    </div>
    {draft && <MixDialog title={mode === 'roster' ? 'Edit crew roster' : 'Delivery settings'} description={mode === 'roster' ? 'Only the selected staff are included in field crew capacity.' : 'The all-in labour rate already includes burden and benefits.'} onClose={() => setDraft(null)} onSave={() => save({ action:'settings', data:{ ...draft, ...Object.fromEntries(fields.map(([key]) => [key, Number(draft[key])])) } })}>
      {mode === 'settings' ? <MixFields fields={fields} values={draft} setValues={setDraft} /> : <>
        <Input aria-label="Search staff" placeholder="Search staff by name or department…" value={query} onChange={e => setQuery(e.target.value)} />
        <p className="text-sm text-muted-foreground">{selected.length} selected</p>
        <div className="max-h-72 space-y-2 overflow-y-auto">{!visible.length && <p className="text-sm text-muted-foreground">No matching staff.</p>}{visible.map(s => <label key={s.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><Checkbox checked={selected.includes(s.id)} onCheckedChange={checked => setDraft({ ...draft, crew_staff_ids:checked ? [...selected,s.id] : selected.filter(id => id !== s.id) })} />{s.name}{s.department ? ` · ${s.department}` : ''}{s.start_date || s.end_date ? ` · ${s.start_date || '—'} to ${s.end_date || '—'}` : ''}</label>)}</div>
      </>}
    </MixDialog>}
  </section>;
}