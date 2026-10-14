import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getFiscalYearLabel } from '@/components/utils/fiscalYear';
import { toast } from 'sonner';

export default function NextYearProfitTarget({ fiscalYear, fiscalStartMonth, fiscalGoals }) {
  const queryClient = useQueryClient();
  const goal = fiscalGoals.find(g => Number(g.fiscal_year) === Number(fiscalYear));
  const [target, setTarget] = useState('');
  useEffect(() => { setTarget(goal?.gross_profit_target ?? ''); }, [goal?.gross_profit_target, fiscalYear]);
  const save = useMutation({
    mutationFn: async () => {
      const data = { gross_profit_target: Number(target) };
      return goal ? base44.entities.FiscalGoal.update(goal.id, data) : base44.entities.FiscalGoal.create({ ...data, fiscal_year: Number(fiscalYear) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscalGoals'] });
      toast.success('Next fiscal year Gross Profit target saved');
    },
  });
  const valid = target !== '' && Number.isFinite(Number(target)) && Number(target) >= 0;
  return <div className="space-y-2 rounded-md border border-border p-4">
    <Label htmlFor="next-year-gp-target">Next Year Company Gross Profit Target</Label>
    <p className="text-xs text-muted-foreground">{getFiscalYearLabel(fiscalYear, fiscalStartMonth)}. Uses the same annual Gross Profit target as the dashboard and reports, not the revenue planning amount.</p>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input id="next-year-gp-target" type="number" min="0" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="Enter Gross Profit target" />
      <Button type="button" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save GP Target'}</Button>
    </div>
    {!goal?.gross_profit_target && <p className="text-xs text-muted-foreground">No Gross Profit target set. Historical revenue targets remain separate.</p>}
    {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
  </div>;
}