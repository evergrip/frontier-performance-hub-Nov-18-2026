import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function JobPicker({ jobs, selected, onSelect, history = false }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const matches = jobs.filter(job => `${job.title} ${job.client}`.toLowerCase().includes(term.trim().toLowerCase()));
  const groups = history ? [['Signed & in construction', matches.filter(j => ['Signed','In construction'].includes(j.bucket))], ['Pipeline (not in capacity)', matches.filter(j => j.bucket === 'Pipeline')], ['Complete · history only', matches.filter(j => j.bucket === 'Complete')]] : [['Signed & in construction', matches]];
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
    <Button variant="outline" className="h-auto min-h-9 max-w-full justify-start whitespace-normal text-left" aria-label="Select job">{selected ? `${selected.title} · ${selected.bucket}` : 'Select a job'}</Button>
  </PopoverTrigger><PopoverContent align="start" className="w-[min(90vw,29rem)] space-y-2 p-2">
    <Input autoFocus aria-label="Search by title or client" placeholder="Search by title or client…" value={term} onChange={e => setTerm(e.target.value)} />
    <div className="max-h-80 space-y-2 overflow-y-auto">{!matches.length && <p className="p-2 text-sm text-muted-foreground">No matching jobs.</p>}{groups.filter(([, list]) => list.length).map(([label, list]) => <section key={label}>
      <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground">{label}</h3>
      {list.map(job => <Button key={job.id} variant={job.id === selected?.id ? 'secondary' : 'ghost'} className="h-auto w-full justify-between gap-2 whitespace-normal px-2 py-2 text-left" onClick={() => { onSelect(job.id); setOpen(false); setTerm(''); }}><span>{job.title}<small className="block text-muted-foreground">{job.client}</small></span><Badge variant="outline" className="shrink-0">{job.bucket}</Badge></Button>)}
    </section>)}</div>
  </PopoverContent></Popover>;
}