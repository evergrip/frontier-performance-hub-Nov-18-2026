import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PreconBuildertrendPicker from '@/components/precon/PreconBuildertrendPicker';

export async function buildertrendPilot(payload) {
  try {
    return (await base44.functions.invoke('preconBuildertrendPilot', payload)).data;
  } catch (error) {
    const status = error.status ?? error.response?.status;
    throw Object.assign(new Error(error.response?.data?.error || 'The Buildertrend pilot is unavailable. Try again.'), { status });
  }
}

export default function PreconBuildertrendPilot({ userId }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const key = ['precon-buildertrend-pilot', userId];
  const pilot = useQuery({ queryKey: key, queryFn: () => buildertrendPilot({ action: 'status' }), retry: false });
  const save = useMutation({
    mutationFn: ({ saleId, jobId }) => buildertrendPilot({ action: 'link', saleId, jobId }),
    onSuccess: (result) => client.setQueryData(key, result),
    onError: (error) => { if (error.status === 409) client.invalidateQueries({ queryKey: key }); },
  });
  const link = pilot.data?.link;
  return <section className="space-y-3 border border-border bg-card p-5">
    <h2 className="font-heading text-lg font-semibold">Buildertrend job link pilot</h2>
    <p className="text-sm text-muted-foreground">Link one existing Buildertrend job to a Hub pre-con sale. Nothing is created or changed in Buildertrend, and automatic sync stays off.</p>
    {pilot.isPending ? <p role="status" className="text-sm">Checking pilot status…</p> : pilot.isError ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{pilot.error.message}</p><Button type="button" variant="outline" onClick={() => pilot.refetch()}>Retry</Button></div> : link ? (
      <div className="space-y-1 text-sm" role="status"><p><strong>Hub sale:</strong> {link.sale_title}</p><p><strong>Linked Buildertrend job:</strong> {link.job_name}</p><p className="break-all text-muted-foreground">Job ID: {link.job_id}</p></div>
    ) : open ? <PreconBuildertrendPicker userId={userId} save={save} invoke={buildertrendPilot} /> : <Button type="button" variant="outline" onClick={() => setOpen(true)}>Choose records to link</Button>}
  </section>;
}