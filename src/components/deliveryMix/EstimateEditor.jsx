import { useState } from 'react';
import MixDialog from '@/components/deliveryMix/MixDialog';
import MixFields from '@/components/deliveryMix/MixFields';

const fields = [['job_number','Job number'],['start_month','Start month','month',{required:true}],['override_contract_price','Contract price override (CAD)','number',{min:0,step:'0.01'}],['labour_rate_override','All-in labour rate override (CAD/hour)','number',{min:0,step:'0.01'}],['notes','Notes','textarea',{maxLength:3000}]];

export default function EstimateEditor({ job, save, onClose }) {
  const [values, setValues] = useState({ job_number: '', start_month: '', notes: '', ...job.estimate });
  return <MixDialog title={job.estimate ? 'Edit estimate' : 'Create estimate'} description={job.title} onClose={onClose} onSave={() => save({ action: 'estimate', jobId: job.id, data: Object.fromEntries(fields.map(([key, , type]) => [key, type === 'number' ? (values[key] === '' || values[key] == null ? null : Number(values[key])) : values[key] || ''])) })}>
    <MixFields fields={fields} values={values} setValues={setValues} />
  </MixDialog>;
}