import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MixDialog from '@/components/deliveryMix/MixDialog';
import MixFields from '@/components/deliveryMix/MixFields';
import { costFields } from '@/lib/deliveryMix';

const costLabels = ['Sub quote','Materials by Frontier','Selections','Equipment','Other'];
const numeric = { min: 0, step: '0.01' };
const estimateFields = [['scope_name','Scope name','text',{required:true,maxLength:200}],['cost_code','Cost code'],...costFields.map((key, i) => [key, costLabels[i], 'number', numeric])];
const opsFields = [['inhouse_hours','Full in-house hours','number',numeric],['inhouse_extra_materials','In-house extra materials (CAD)','number',numeric],['scheduled_start_month','Scheduled start month','month'],['duration_months','Duration (months)','number',{min:1,max:120,step:1,required:true}],['decision_notes','Decision notes','textarea',{maxLength:3000}]];

export default function ScopeEditor({ job, scope, mode, subtrades, save, onClose }) {
  const operation = mode === 'ops';
  const [values, setValues] = useState({ duration_months: 1, scheduled_start_month: operation ? job.estimate.start_month : '', ...scope });
  const fields = operation ? opsFields : [...estimateFields, ...(!values.subtrade_id ? [['sub_name','Subcontractor name']] : [])];
  const submit = () => {
    const data = Object.fromEntries(fields.map(([key, , type]) => [key, type === 'number' ? Number(values[key] || 0) : values[key] || '']));
    if (operation) data.inhouse_feasible = !!values.inhouse_feasible;
    else Object.assign(data, { subtrade_id: values.subtrade_id || '', sub_name: values.sub_name || '' });
    return save({ action: operation ? 'scopeOps' : 'scopeEstimate', jobId: job.id, scopeId: scope?.id, data });
  };
  return <MixDialog title={operation ? 'Edit operations inputs' : scope ? 'Edit scope costs' : 'Add scope'} description={scope?.scope_name || job.title} onClose={onClose} onSave={submit} wide>
    {operation ? <Label className="flex items-center gap-2"><Checkbox checked={!!values.inhouse_feasible} onCheckedChange={checked => setValues({ ...values, inhouse_feasible: checked === true })} /> In-house delivery is feasible</Label> : <div className="space-y-2">
      <Label htmlFor="delivery-subtrade">Subtrade</Label><Select value={values.subtrade_id || 'none'} onValueChange={id => setValues({ ...values, subtrade_id: id === 'none' ? '' : id })}><SelectTrigger id="delivery-subtrade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Manual entry / none</SelectItem>{subtrades.map(item => <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2"><MixFields fields={fields} values={values} setValues={setValues} /></div>
  </MixDialog>;
}