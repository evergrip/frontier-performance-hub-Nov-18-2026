import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cad, hrs, pct, monthForecast } from '@/lib/deliveryMix';
import MixTable from '@/components/deliveryMix/MixTable';
import ForecastCharts from '@/components/deliveryMix/ForecastCharts';
import CrewGrid from '@/components/deliveryMix/CrewGrid';
import CrewSettings from '@/components/deliveryMix/CrewSettings';

const gm = row => row.sell ? row.gp / row.sell * 100 : null;
const statusBadge = over => over ? <Badge variant="destructive">Over capacity</Badge> : '—';
export default function CapacityForecast({ model, canOperate, admin, save }) {
  const [bucket, setBucket] = useState('all');
  const { jobs, scopes, capacity, months, crewData, staff, settings, year } = model;
  const filtered = bucket !== 'all';
  const gpRows = filtered ? monthForecast(months, crewData, scopes.filter(s => s.job.bucket === bucket)) : capacity;
  const rows = gpRows.map((row, i) => ({ ...row, shownAllocated:row.allocated, allocated:capacity[i].allocated, remaining:capacity[i].remaining, over:capacity[i].over }));
  const totals = Object.fromEntries(['capacity','allocated','shownAllocated','remaining','baseline','added','gp','sell'].map(key => [key, rows.slice(0, 12).reduce((sum, row) => sum + row[key], 0)]));
  const cells = row => [hrs(row.capacity), ...(filtered ? [hrs(row.shownAllocated)] : []), hrs(row.allocated), hrs(row.remaining), statusBadge(row.over), cad(row.baseline), cad(row.added), cad(row.gp), pct(gm(row))];
  const tableRows = rows.map(row => ({ id:row.month, className:row.over ? 'bg-destructive/10' : '', cells:[row.month, ...cells(row)] }));
  tableRows.splice(12, 0, { id:'subtotal', className:'bg-muted font-semibold', cells:[`FY ${year} subtotal`, ...cells({ ...totals, over:rows.slice(0, 12).some(row => row.over) })] });
  const unestimated = jobs.filter(j => ['Signed','In construction'].includes(j.bucket) && !j.estimate && (!filtered || j.bucket === bucket));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">{months[0]} to {months.at(-1)}</h2><p className="text-sm text-muted-foreground">Estimate-based GP. Remaining hours and over-capacity flags always include all committed jobs.</p></div>
      <Select value={bucket} onValueChange={setBucket}><SelectTrigger aria-label="Status bucket" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All committed jobs</SelectItem><SelectItem value="Signed">Signed</SelectItem><SelectItem value="In construction">In construction</SelectItem></SelectContent></Select>
    </div>
    <MixTable label="Monthly company capacity and gross profit" headers={['Month','Capacity', ...(filtered ? [`Allocated · ${bucket}`] : []),'Allocated · all jobs','Remaining · all jobs','Flag','Baseline GP','Added GP','Total GP','GM']} rows={tableRows} />
    <ForecastCharts rows={rows} boundary={months[12]} />
    <section className="space-y-2"><h3 className="font-semibold">Not yet estimated ({unestimated.length})</h3><p className="text-sm text-muted-foreground">These jobs contribute no hours or GP until estimated.</p><MixTable headers={['Job','Client','Status']} rows={unestimated.map(j => ({ id:j.id,cells:[j.title,j.client,j.bucket] }))} empty="All jobs in this view have delivery estimates." /></section>
    {admin && <CrewSettings staff={staff} settings={settings} save={save} />}
    <CrewGrid {...crewData} months={months} canOperate={canOperate} save={save} />
  </div>;
}