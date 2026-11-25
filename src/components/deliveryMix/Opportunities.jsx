import { cad, hrs } from '@/lib/deliveryMix';
import MixTable from '@/components/deliveryMix/MixTable';

export default function Opportunities({ scopes }) {
  const ranked = scopes.filter(s => s.inhouse_feasible).sort((a, b) => (b.ratePerHour ?? -Infinity) - (a.ratePerHour ?? -Infinity) || a.scope_name.localeCompare(b.scope_name));
  return <div className="space-y-3"><h2 className="text-lg font-semibold">Self-perform opportunities</h2><p className="text-sm text-muted-foreground">Signed and in-construction jobs, ranked by added GP per crew hour at full self-perform.</p>
    <MixTable headers={['Job','Client','Scope','Months','Full crew hours','Full added GP','Added GP / hr','Current share']} rows={ranked.map(s => ({ id:s.id,cells:[s.job.title,s.job.client,s.scope_name,s.months.join(', ') || 'Not scheduled',hrs(s.inhouse_hours),cad(s.fullAdded),cad(s.ratePerHour),<span className={s.invalid ? 'text-destructive' : ''}>{s.inhouse_share || 0}%{s.invalid ? ' · treated as subbed' : ''}</span>] }))} empty="No feasible scopes on committed jobs yet." />
  </div>;
}