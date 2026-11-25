import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { hrs } from '@/lib/deliveryMix';
import { defaultCrewHours } from '@/lib/deliveryMixCapacity';
import MixTable from '@/components/deliveryMix/MixTable';
import MixDialog from '@/components/deliveryMix/MixDialog';
import MixFields from '@/components/deliveryMix/MixFields';

const fields = [['available_hours','Available hours','number',{min:0,step:'0.01',required:true}],['reserved_hours','Reserved hours','number',{min:0,step:'0.01',required:true}],['notes','Notes','textarea',{maxLength:3000}]];

export default function CrewGrid({ months, crew, holidays, availability, canOperate, save }) {
  const [cell, setCell] = useState(null);
  const [draft, setDraft] = useState(null);
  const [reset, setReset] = useState(false);
  const days = new Set(holidays.map(h => h.date));
  const overrides = new Map(availability.map(a => [`${a.staff_detail_id}/${a.month}`, a]));
  return <section className="space-y-2"><h3 className="font-semibold">Crew availability</h3><p className="text-sm text-muted-foreground">Available / reserved hours. Defaults use weekdays less holidays. An asterisk marks an override.</p>
    <MixTable label="Crew availability by month" headers={['Crew member', ...months]} empty="No crew members on the roster." rows={crew.map(person => ({ id:person.id, cells:[person.name, ...months.map(month => {
      const standard = defaultCrewHours(person, month, days);
      if (standard == null) return '—';
      const override = overrides.get(`${person.id}/${month}`);
      const values = { available_hours:override?.available_hours ?? Number(standard.toFixed(2)), reserved_hours:override?.reserved_hours ?? 0, notes:override?.notes ?? '' };
      const label = `${hrs(values.available_hours)} / ${hrs(values.reserved_hours)}${override ? ' *' : ''}`;
      return canOperate ? <Button size="sm" variant="ghost" aria-label={`${person.name} ${month}: ${label}`} onClick={() => { setCell({ person, month, override }); setDraft(values); setReset(false); }}>{label}</Button> : <span title={values.notes}>{label}</span>;
    })] }))} />
    {cell && <MixDialog title={reset ? 'Restore default hours?' : 'Edit crew availability'} description={`${cell.person.name} · ${cell.month}`} submit={reset ? 'Restore default' : 'Save changes'} onClose={() => setCell(null)} onSave={() => save({ action:reset ? 'resetAvailability' : 'availability', data:{ ...draft, available_hours:Number(draft.available_hours), reserved_hours:Number(draft.reserved_hours), staff_detail_id:cell.person.id, month:cell.month } })}>
      {reset ? <p className="text-sm">The override, reserved hours and notes will be removed for this month.</p> : <><MixFields fields={fields} values={draft} setValues={setDraft} />{cell.override && <Button variant="outline" type="button" onClick={() => setReset(true)}>Restore default</Button>}</>}
    </MixDialog>}
  </section>;
}