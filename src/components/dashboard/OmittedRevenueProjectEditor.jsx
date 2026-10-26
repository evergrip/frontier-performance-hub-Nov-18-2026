import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeChanges, logEdit } from '@/components/common/editLogUtils';

export default function OmittedRevenueProjectEditor({ project, onBack }) {
  const queryClient = useQueryClient();
  const [contract, setContract] = useState(project.contract_value ?? '');
  const [margin, setMargin] = useState(project.effective_margin ?? '');
  const mutation = useMutation({
    mutationFn: async () => {
      const values = { contract_value: Number(contract), actual_margin: Number(margin) };
      if (contract === '' || margin === '' || !Number.isFinite(values.contract_value) || values.contract_value <= 0 || !Number.isFinite(values.actual_margin) || values.actual_margin <= 0 || values.actual_margin > 100) throw new Error('Enter a positive contract value and a margin greater than zero and at most 100%.');
      await base44.entities.Project.update(project.id, values);
      await logEdit({ entityType: 'project', entityId: project.id, entityTitle: project.title, changes: computeChanges(project, values, Object.keys(values)) });
    },
    onSuccess: async () => {
      await Promise.all(['projects', 'fiscalProfitProgress', 'edit-logs'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      onBack();
    },
  });
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
    <div><h3 className="font-semibold">{project.title}</h3><p className="text-xs text-muted-foreground">Construction · {project.status.replaceAll('_', ' ')}</p></div>
    <ul className="list-disc pl-5 text-sm text-destructive">{project.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    <div className="space-y-1"><Label htmlFor="omitted-contract">Total contract value ($)</Label><Input id="omitted-contract" type="number" step="any" min="0.01" required disabled={mutation.isPending} value={contract} onChange={event => setContract(event.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="omitted-margin">Project forecast margin (%)</Label><Input id="omitted-margin" type="number" step="any" min="0.000001" max="100" required disabled={mutation.isPending} value={margin} onChange={event => setMargin(event.target.value)} /></div>
    <p className="text-xs text-muted-foreground">Whole-project inputs. Saving sets the project margin used by the forecast; it does not change recorded costs or the linked sale. The annual forecast recalculates automatically.</p>
    {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onBack}>Back to projects</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save changes'}</Button></div>
  </form>;
}