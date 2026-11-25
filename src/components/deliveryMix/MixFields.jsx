import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function MixFields({ fields, values, setValues }) {
  return fields.map(([key, label, type = 'text', options = {}]) => <Label key={key} className="block space-y-2">
    <span>{label}</span>
    {type === 'textarea' ? <Textarea value={values[key] ?? ''} onChange={e => setValues({ ...values, [key]: e.target.value })} {...options} /> :
      <Input type={type} value={values[key] ?? ''} onChange={e => setValues({ ...values, [key]: e.target.value })} {...options} />}
  </Label>);
}