import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getFiscalYearLabel } from '@/components/utils/fiscalYear';
import SubAllocationDialog from './SubAllocationDialog';
import allocationSlots from '@/components/utils/allocationSlots';
import { allocationDate } from '@/components/utils/projectPeriod';
import InvalidAllocationRows from '@/components/projects/InvalidAllocationRows';

export default function PreconAllocationDialog({ open, onOpenChange, sale, companySettings }) {
  const queryClient = useQueryClient();
  const fiscalStartMonth = companySettings?.fiscal_year_start_month || 10;

  const [selectedFiscalYear, setSelectedFiscalYear] = useState(null);
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);
  const [subDialogOpen, setSubDialogOpen] = useState(false);

  useEffect(() => {
    if (!sale || !open) return;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentFiscalYear = currentMonth >= fiscalStartMonth ? currentYear : currentYear - 1;
    setSelectedFiscalYear(currentFiscalYear);

    setMonthlyAllocations(allocationSlots(sale.monthly_revenue_allocations, currentFiscalYear, fiscalStartMonth));
  }, [sale, open, fiscalStartMonth]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (monthlyAllocations.some(a => !allocationDate(a) || !Number.isFinite(Number(a.percentage)) || Number(a.percentage) < 0 || Number(a.percentage) > 100) || totalPct > 100.1) throw new Error('Use valid months and percentages; shares across all years cannot exceed 100%.');
      const cleanAllocations = monthlyAllocations
        .filter(a => a.year && a.month && parseFloat(a.percentage) > 0)
        .map(a => ({ year: Number(a.year), month: Number(a.month), period: `${a.year}-${String(a.month).padStart(2, '0')}`, percentage: Number(a.percentage) }));
      return base44.entities.Sale.update(sale.id, { monthly_revenue_allocations: cleanAllocations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      onOpenChange(false);
      toast.success('Forecast allocations saved');
    }
  });

  if (!sale) return null;

  const forecastValue = sale.estimated_construction_budget || 0;
  const totalPct = monthlyAllocations.reduce((sum, a) => sum + (parseFloat(a.percentage) || 0), 0);

  const handleFYChange = (value) => {
    const newFY = parseInt(value);
    setSelectedFiscalYear(newFY);
    const newMonths = [];
    for (let i = 0; i < 12; i++) {
      const month = ((fiscalStartMonth - 1 + i) % 12) + 1;
      const yr = month >= fiscalStartMonth ? newFY : newFY + 1;
      newMonths.push({ year: yr, month, percentage: 0 });
    }
    setMonthlyAllocations(prev => {
      const merged = [...prev];
      newMonths.forEach(nm => {
        if (!merged.find(a => a.year === nm.year && a.month === nm.month)) {
          merged.push(nm);
        }
      });
      return merged;
    });
  };

  const visibleAllocations = monthlyAllocations
    .filter(alloc => {
      if (fiscalStartMonth === 1) return alloc.year === selectedFiscalYear;
      return (alloc.month >= fiscalStartMonth && alloc.year === selectedFiscalYear) ||
                    (alloc.month < fiscalStartMonth && alloc.year === selectedFiscalYear + 1);
    })
    .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Forecast Schedule — Pre-Construction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-900">{sale.title}</p>
            <p className="text-xs text-amber-700 mt-1">
              This is a pre-construction job — not yet guaranteed. Allocations forecast when construction might happen.
            </p>
            {forecastValue > 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Est. Construction Value: <span className="font-semibold">${forecastValue.toLocaleString()}</span>
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs mb-1">Fiscal Year</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleFYChange((selectedFiscalYear - 1).toString())}>
                <span className="text-xs">◀</span>
              </Button>
              <span className="text-sm font-semibold text-center flex-1">{getFiscalYearLabel(selectedFiscalYear, fiscalStartMonth)}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleFYChange((selectedFiscalYear + 1).toString())}>
                <span className="text-xs">▶</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-3 bg-slate-50">
            {visibleAllocations.map((alloc) => {
              const monthName = new Date(alloc.year, alloc.month - 1).toLocaleString('default', { month: 'short' });
              return (
                <div key={`${alloc.year}-${alloc.month}`}>
                  <label className="text-xs text-slate-600">{monthName} {alloc.year}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={alloc.percentage}
                    onChange={(e) => setMonthlyAllocations(monthlyAllocations.map(a =>
                      a.month === alloc.month && a.year === alloc.year
                        ? { ...a, percentage: parseFloat(e.target.value) || 0 }
                        : a
                    ))}
                    className="w-full px-2 py-1 border rounded text-xs"
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>

          <div className="text-xs p-2 bg-blue-50 rounded">
            Total (all years): <span className="font-semibold">{totalPct.toFixed(1)}%</span>
          </div>

          <InvalidAllocationRows allocations={monthlyAllocations} onChange={setMonthlyAllocations} />
          {saveMutation.error && <p className="text-sm text-destructive">{saveMutation.error.message}</p>}
          <div className="flex gap-2 justify-between pt-2">
            <Button variant="outline" size="sm" className="text-xs text-orange-700 border-orange-300 hover:bg-orange-50" onClick={() => setSubDialogOpen(true)}>
              Sub/In-House Split
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
                Save Forecast
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      <SubAllocationDialog
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
        entity={sale}
        entityType="sale"
        companySettings={companySettings}
      />
    </Dialog>
  );
}