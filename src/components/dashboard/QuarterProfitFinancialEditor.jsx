import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeChanges, logEdit } from '@/components/common/editLogUtils';

export default function QuarterProfitFinancialEditor({ project, onClose, onSaved }) {
  const [form, setForm] = useState({ contract_value: project.contract_value ?? '', actual_costs: project.actual_costs ?? '', actual_margin: project.actual_margin ?? '' });
  const mutation = useMutation({
    mutationFn: async () => {
      const values = { contract_value: Number(form.contract_value), actual_costs: Number(form.actual_costs), actual_margin: form.actual_margin === '' ? null : Number(form.actual_margin) };
      await base44.entities.Project.update(project.id, values);
      await logEdit({ entityType: 'project', entityId: project.id, entityTitle: project.title, changes: computeChanges(project, values, Object.keys(values)) });
    },
    onSuccess: () => { onSaved(); onClose(); },
  });
  const fields = [
    { key: 'contract_value', label: 'Total contract value ($)', required: true, min: 0 },
    { key: 'actual_costs', label: 'Total recorded costs ($)', required: true, min: 0 },
    { key: 'actual_margin', label: 'Project forecast margin (%)', max: 100 },
  ];
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Edit GP inputs · {project.title}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
        <p className="text-sm text-muted-foreground">These are whole-project amounts, not quarter-only amounts. Monthly allocations determine the quarter’s share.</p>
        {fields.map(field => <div key={field.key} className="space-y-1">
          <Label htmlFor={`profit-${field.key}`}>{field.label}</Label>
          <Input id={`profit-${field.key}`} type="number" step="any" min={field.min} max={field.max} required={field.required} disabled={mutation.isPending} value={form[field.key]} onChange={event => setForm(previous => ({ ...previous, [field.key]: event.target.value }))} />
        </div>)}
        <p className="text-xs text-muted-foreground">Active-project forecasts use this margin, or the linked sale’s estimated margin when blank. Closed projects use contract value less final costs; their margin input is ignored.</p>
        {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save changes'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}