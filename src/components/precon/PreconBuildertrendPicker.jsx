import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const fieldClass = 'block w-full rounded-md border border-input bg-background p-2 text-sm';

export default function PreconBuildertrendPicker({ userId, save, invoke }) {
  const [saleId, setSaleId] = useState('');
  const [jobId, setJobId] = useState('');
  const sales = useInfiniteQuery({
    queryKey: ['precon-buildertrend-sales', userId], initialPageParam: null, retry: false,
    queryFn: ({ pageParam }) => base44.entities.Sale.filter({ sale_type: 'preconstruction' }, { sort: 'title', limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (page) => page.has_more ? page.next_cursor : undefined,
  });
  const jobs = useInfiniteQuery({
    queryKey: ['precon-buildertrend-jobs', userId], initialPageParam: null, retry: false,
    queryFn: ({ pageParam }) => invoke({ action: 'jobs', cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor || undefined,
  });
  const saleItems = sales.data?.pages.flatMap(page => page.items) || [];
  const jobItems = jobs.data?.pages.flatMap(page => page.items) || [];
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (saleId && jobId && !save.isPending) save.mutate({ saleId, jobId }); }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><label className="block text-sm font-medium" htmlFor="bt-pilot-sale">Hub pre-con sale</label>
        <select id="bt-pilot-sale" className={fieldClass} required value={saleId} disabled={!saleItems.length || save.isPending} onChange={e => setSaleId(e.target.value)}>
          <option value="">{sales.isPending ? 'Loading sales…' : saleItems.length ? 'Select a sale' : 'No sales available'}</option>
          {saleItems.map(sale => <option key={sale.id} value={sale.id}>{sale.title}{sale.close_date ? ` · ${sale.close_date}` : ''} · {sale.id.slice(-6)}</option>)}
        </select>
        {sales.isError && <p role="alert" className="text-sm text-destructive">Could not load pre-con sales.</p>}
        {sales.isError && !sales.data ? <Button type="button" size="sm" variant="outline" onClick={() => sales.refetch()}>Retry sales</Button> : sales.hasNextPage && <Button type="button" size="sm" variant="outline" disabled={sales.isFetchingNextPage || save.isPending} onClick={() => sales.fetchNextPage()}>{sales.isFetchingNextPage ? 'Loading…' : 'Load more sales'}</Button>}
      </div>
      <div className="space-y-2"><label className="block text-sm font-medium" htmlFor="bt-pilot-job">Existing Buildertrend job</label>
        <select id="bt-pilot-job" className={fieldClass} required value={jobId} disabled={!jobItems.length || save.isPending} onChange={e => setJobId(e.target.value)}>
          <option value="">{jobs.isPending ? 'Loading jobs…' : jobItems.length ? 'Select a job' : 'No jobs available'}</option>
          {jobItems.map(job => <option key={job.id} value={job.id}>{[job.name, job.status, job.jobType, job.id.slice(-6)].filter(Boolean).join(' · ')}</option>)}
        </select>
        {jobs.isError && <p role="alert" className="text-sm text-destructive">{jobs.error.message}</p>}
        {jobs.isError && !jobs.data ? <Button type="button" size="sm" variant="outline" onClick={() => jobs.refetch()}>Retry jobs</Button> : jobs.hasNextPage && <Button type="button" size="sm" variant="outline" disabled={jobs.isFetchingNextPage || save.isPending} onClick={() => jobs.fetchNextPage()}>{jobs.isFetchingNextPage ? 'Loading…' : 'Load more jobs'}</Button>}
      </div>
    </div>
    {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
    <Button type="submit" disabled={!saleId || !jobId || save.isPending}>{save.isPending ? 'Linking…' : 'Confirm job link'}</Button>
  </form>;
}