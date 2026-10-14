import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { CAPACITY_DEFAULTS } from '@/lib/staffCapacity';

const FIELDS = [
  ['pm_count', 'Project managers (headcount)', 'Blank = auto (PMs on active construction projects)'],
  ['pm_monthly_value', '$ of construction one PM runs per month', ''],
  ['pm_max_concurrent_jobs', 'Max concurrent jobs per PM', ''],
  ['crew_count', 'Field crew / carpenters (headcount)', 'Blank = auto (Construction department users who are not PMs)'],
  ['crew_hours_per_day', 'Crew hours per workday', ''],
  ['revenue_per_crew_hour', '$ of in-house work per crew hour', 'Converts in-house backlog $ into crew hours needed'],
  ['super_count', 'Site supers (headcount)', '0 = not modelled'],
  ['jobs_per_super', 'Jobs per super', ''],
  ['subtrade_monthly_value', '$ of subcontracted work subtrades can absorb per month', 'Blank = not modelled'],
  ['mixed_in_house_share', 'Share of "mixed" jobs built in-house (0–1)', ''],
];

export default function CapacityModelSettings({ settings, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { setForm(settings?.capacity_model || {}); }, [settings]);
  const save = () => {
    const clean = {};
    for (const [key] of FIELDS) if (form[key] !== '' && form[key] !== undefined && form[key] !== null) clean[key] = Number(form[key]);
    onSave({ capacity_model: clean });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Build capacity model</CardTitle>
        <CardDescription>Staff-based capacity used by the Dashboard Build Capacity card. Leave a field blank to use the default shown.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIELDS.map(([key, label, help]) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input type="number" step="any" value={form[key] ?? ''} placeholder={CAPACITY_DEFAULTS[key] == null ? 'auto' : String(CAPACITY_DEFAULTS[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              {help && <p className="text-[11px] text-slate-500 mt-0.5">{help}</p>}
            </div>
          ))}
        </div>
        <Button onClick={save}>Save capacity model</Button>
      </CardContent>
    </Card>
  );
}
