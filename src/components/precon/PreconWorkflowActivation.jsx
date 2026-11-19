import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PreconWorkflowActivation({project,roles,users,busy,onActivate}) {
  return <form className="space-y-3 border p-4" onSubmit={e=>{
    e.preventDefault(); const fields = new FormData(e.currentTarget);
    onActivate({action:'activate',saleId:project.id,path:fields.get('path'), days:Number(fields.get('days')), assignments:Object.fromEntries(Object.keys(roles).map(key=>[key,fields.get(key)])),confirm:fields.get('confirm')==='on'});
  }}>
    <h3 className="font-semibold">Activate {project.title}</h3>
    <p className="text-sm">Assign test accounts to the workflow roles. Client and municipality roles are internal staff recording external decisions, not external accounts. All 34 stages are required in this controlled template.</p>
    <label className="block text-sm">Permit sequence for this test<select name="path" required className="block w-full rounded border bg-background p-2"><option value="">Select a sequence</option><option value="detailed">Detailed manual: issuance after agreement</option><option value="early">High-level map: issuance before estimating</option></select></label>
    <label className="block text-sm">Test target: days from task readiness<Input name="days" type="number" min="1" max="60" required /></label>
    <div className="grid gap-2 sm:grid-cols-2">{Object.entries(roles).map(([key,label])=><label key={key} className="text-sm">{label}<select name={key} required className="block w-full rounded border bg-background p-2"><option value="">Select a test account</option>{users.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></label>)}</div>
    <label className="block text-sm"><input type="checkbox" name="confirm" required /> This is a controlled test Sale, not a live project.</label>
    <Button disabled={busy}>{busy ? 'Activating…' : 'Activate controlled workflow'}</Button>
  </form>;
}