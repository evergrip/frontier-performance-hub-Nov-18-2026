import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PreconRehearsalBoard from './PreconRehearsalBoard';
import PreconRehearsalTask from './PreconRehearsalTask';
import PreconRehearsalGuide from './PreconRehearsalGuide';

export default function PreconRehearsal() {
  const [state, setState] = useState(null);
  const [selected, setSelected] = useState(null);
  const [actor, setActor] = useState('michael');
  const [type, setType] = useState('renovation');
  const change = useMutation({ mutationFn: async ({ history, command }) => (await base44.functions.invoke('preconRehearsal', { history, command })).data });
  const error = change.error?.response?.data?.error || change.error?.message;
  const busy = change.isPending;
  const actionLock = useRef(false);
  async function submit(command) {
    if (actionLock.current) return false;
    actionLock.current = true;
    try { setState(await change.mutateAsync({ history: state?.history || [], command })); return true; } catch { return false; }
    finally { actionLock.current = false; }
  }
  function open(id) { change.reset(); setSelected(id); }
  const task = state?.tasks[selected];
  return <section className="space-y-4 border border-border bg-background p-4 sm:p-6">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">Isolated rehearsal · Admin role-play</p><h2 className="mt-1 font-heading text-2xl font-bold">Harbourview Kitchen Renovation</h2><p className="mt-1 text-sm text-muted-foreground">Fictional project and training rules, not the Frontier manual. Nothing is saved to the hub; refreshing resets the rehearsal. Use sample evidence only.</p></header>
    <PreconRehearsalGuide />
    {!state?.instance ? <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); submit({ action: 'activate', actor: 'chris', type }); }}>
      <label className="text-sm">Project type<select className="mt-1 block rounded-md border border-input bg-background p-2" value={type} onChange={e => setType(e.target.value)}><option value="renovation">Renovation</option><option value="addition">Addition</option><option value="garage_conversion">Garage conversion</option><option value="custom_home">Custom home (condition check)</option></select></label>
      <Button disabled={busy}>{busy ? 'Activating…' : 'Activate test project'}</Button>
    </form> : <>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Rehearse as<select className="mt-1 block rounded-md border border-input bg-background p-2" value={actor} disabled={busy} onChange={e => { change.reset(); setActor(e.target.value); }}>{Object.entries(state.actors).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><Button variant="outline" disabled={busy} onClick={() => { setState(null); setSelected(null); setActor('michael'); change.reset(); }}>Reset rehearsal</Button></div>
      <p className="text-xs text-muted-foreground">Pinned to rehearsal template v{state.instance.version}. Start with Michael’s brief, save sample evidence, submit it, then switch to Sales for review.</p>
      <PreconRehearsalBoard state={state} onOpen={open} />
      <PreconRehearsalTask task={task} tasks={state.tasks} group={task && state.groups[task.group]} actor={actor} onClose={() => open(null)} submit={submit} busy={busy} error={error} />
    </>}
    {error && !task && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}