import { cad, pct, hrs } from '@/lib/deliveryMix';
import MixTable from '@/components/deliveryMix/MixTable';

export default function JobMonthly({ slices, window }) {
  const allowed = new Set(window);
  const totals = new Map();
  for (const s of slices) {
    if (!allowed.has(s.month)) continue;
    if (!totals.has(s.month)) totals.set(s.month, { sell:0, baseline:0, added:0, gp:0, hours:0 });
    const row = totals.get(s.month);
    for (const key of Object.keys(row)) row[key] += s[key];
  }
  return <section className="space-y-2"><h3 className="font-semibold">Monthly job GP &amp; GM</h3>
    <MixTable headers={['Month','Scheduled price','Baseline GP','Added GP','Final GP','Final GM','Crew hours']} rows={window.filter(month => totals.has(month)).map(month => { const row = totals.get(month); return {id:month,cells:[month,cad(row.sell),cad(row.baseline),cad(row.added),cad(row.gp),pct(row.sell ? row.gp / row.sell * 100 : null),hrs(row.hours)]}; })} empty="No scopes scheduled in the forecast window." />
  </section>;
}