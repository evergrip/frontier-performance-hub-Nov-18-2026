import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { examples } from './PreconRehearsalFixture';

const labels = { start: 'Start work', resume: 'Resume work', evidence: 'Save evidence revision', submit: 'Submit for review', complete: 'Mark complete', approve: 'Approve submitted version', reject: 'Request revisions', exception: 'Authorize Not Applicable', waitClient: 'Wait on client', waitConsultant: 'Wait on consultant', block: 'Mark blocked' };
const needsNote = ['reject', 'exception', 'waitClient', 'waitConsultant', 'block'];

export default function PreconRehearsalActions({ task, actor, submit, busy, error }) {
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState('');
  const [resolution, setResolution] = useState('');
  const actions = task.actions[actor] || [];
  const action = actions.includes(selected) ? selected : actions[0] || '';
  const field = action === 'reject' ? 'Revision instructions' : action === 'exception' ? 'Exception reason' : 'What is preventing progress?';
  return <form className="space-y-3 border-t border-border pt-4" onSubmit={async e => {
    e.preventDefault();
    if (await submit({ action, id: task.id, actor, ...(needsNote.includes(action) ? { reason: note } : {}), ...(action === 'evidence' ? { evidence } : {}), ...(action === 'block' ? { resolution } : {}) })) { setSelected(''); setNote(''); setEvidence(''); setResolution(''); }
  }}>
    <h4 className="font-semibold">Next action</h4>
    {!action ? <p className="text-sm text-muted-foreground">No action for this role in the current state.</p> : <>
      <label className="block text-sm">Action <select className="mt-1 block rounded-md border border-input bg-background p-2" value={action} onChange={e => setSelected(e.target.value)}>{actions.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      {action === 'evidence' && <label className="block text-sm">Synthetic evidence <Textarea className="mt-1" required maxLength={3000} value={evidence} onChange={e => setEvidence(e.target.value)} /><Button type="button" variant="link" className="px-0" onClick={() => setEvidence(examples[task.id])}>Insert sample evidence</Button></label>}
      {needsNote.includes(action) && <label className="block text-sm">{field}<Textarea className="mt-1" required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>}
      {action === 'block' && <label className="block text-sm">Recommended resolution<Textarea className="mt-1" required maxLength={1000} value={resolution} onChange={e => setResolution(e.target.value)} /></label>}
      <Button type="submit" disabled={busy}>{busy ? 'Applying…' : labels[action]}</Button>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}