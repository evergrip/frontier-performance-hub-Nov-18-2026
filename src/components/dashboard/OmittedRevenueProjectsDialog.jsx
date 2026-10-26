import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import OmittedRevenueProjectEditor from '@/components/dashboard/OmittedRevenueProjectEditor';

export default function OmittedRevenueProjectsDialog({ fiscalYear, onClose }) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(null);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['fiscalProfitProgress', 'omitted', fiscalYear, cursor],
    queryFn: async () => {
      const response = await base44.functions.invoke('getFiscalProfitProgress', { fiscalYear, omittedCursor: cursor });
      if (response.data.error) throw new Error(response.data.error);
      return response.data.revenueRequirement.omittedProjects;
    },
  });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Omitted construction projects · FY {fiscalYear}</DialogTitle><DialogDescription>Select a project to review and complete its forecast inputs.</DialogDescription></DialogHeader>
      {selected ? <OmittedRevenueProjectEditor key={selected.id} project={selected} onBack={() => { setSelected(null); setCursor(0); }} /> : <div className="space-y-3">
        {isPending ? <p role="status" className="text-sm text-muted-foreground">Loading omitted projects…</p> : error ? <p role="alert" className="text-sm text-destructive">Unable to load projects. <button type="button" className="underline" onClick={() => refetch()}>Retry</button></p> : <>
          {!data.items.length && <p className="text-sm text-muted-foreground">No omitted projects on this page. Corrected projects are included in the forecast automatically.</p>}
          {data.items.map(project => <button key={project.id} type="button" className="w-full rounded-md border border-border bg-card p-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelected(project)}>
            <span className="block font-semibold">{project.title}</span><span className="block text-xs text-muted-foreground">{project.status.replaceAll('_', ' ')}</span>
            <span className="block text-xs text-destructive mt-1">{project.issues.join(' ')}</span>
          </button>)}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{data.total} omitted project(s)</span><div className="flex gap-2">{cursor > 0 && <Button variant="outline" size="sm" onClick={() => setCursor(Math.max(0, cursor - 50))}>Previous</Button>}{data.has_more && <Button variant="outline" size="sm" onClick={() => setCursor(data.next_cursor)}>Next</Button>}</div></div>
        </>}
      </div>}
    </DialogContent>
  </Dialog>;
}