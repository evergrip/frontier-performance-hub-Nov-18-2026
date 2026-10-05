import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getFiscalYearLabel } from '@/components/utils/fiscalYear';
import { allocationDate } from '@/components/utils/projectPeriod';
import SubAllocationDialog from './SubAllocationDialog';
import InvalidAllocationRows from '@/components/projects/InvalidAllocationRows';

export default function ProjectAllocationDialog({ open, onOpenChange, project, companySettings }) {
  const queryClient = useQueryClient();
  const fiscalStartMonth = companySettings?.fiscal_year_start_month || 10;

  const [selectedFiscalYear, setSelectedFiscalYear] = useState(null);
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);
  const [subDialogOpen, setSubDialogOpen] = useState(false);

  useEffect(() => {
    if (!project || !open) return;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentFiscalYear = currentMonth >= fiscalStartMonth ? currentYear : currentYear - 1;
    setSelectedFiscalYear(currentFiscalYear);

    const buildFYSlots = (fy) => {
      const slots = [];
      for (let i = 0; i < 12; i++) {
        const month = ((fiscalStartMonth - 1 + i) % 12) + 1;
        const yr = month >= fiscalStartMonth ? fy : fy + 1;
        slots.push({ year: yr, month, percentage: 0 });
      }
      return slots;
    };

    const existingAllocs = (project.monthly_revenue_allocations || []).map(a => {
      const date = allocationDate(a);
      return date ? { ...a, year: date.getFullYear(), month: date.getMonth() + 1 } : a;
    });

    if (existingAllocs.length > 0) {
      const fySet = new Set();
      existingAllocs.forEach(a => {
        if (!allocationDate(a)) return;
        const afy = a.month >= fiscalStartMonth ? a.year : a.year - 1;
        fySet.add(afy);
      });
      fySet.add(currentFiscalYear);

      let allSlots = [];
      fySet.forEach(fy => {
        const slots = buildFYSlots(fy);
        slots.forEach(slot => {
          if (!allSlots.find(s => s.year === slot.year && s.month === slot.month)) {
            allSlots.push(slot);
          }
        });
      });

      existingAllocs.forEach(a => {
        const slot = allSlots.find(s => s.year === a.year && s.month === a.month);
        if (slot) slot.percentage += Number(a.percentage) || 0;
        else allSlots.push(a);
      });

      setMonthlyAllocations(allSlots);
    } else {
      setMonthlyAllocations(buildFYSlots(currentFiscalYear));
    }
  }, [project, open, fiscalStartMonth]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (monthlyAllocations.some(a => !allocationDate(a) || Number(a.percentage) < 0 || Number(a.percentage) > 100) || totalPct > 100.1) throw new Error('Use valid months and percentages; allocations across all years cannot exceed 100%.');
      const cleanAllocations = monthlyAllocations
        .filter(a => a.year && a.month && parseFloat(a.percentage) > 0)
        .map(a => ({ year: Number(a.year), month: Number(a.month), period: `${a.year}-${String(a.month).padStart(2, '0')}`, percentage: Number(a.percentage) }));
      return base44.entities.Project.update(project.id, { monthly_revenue_allocations: cleanAllocations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      toast.success('Revenue allocations saved');
    }
  });

  if (!project) return null;

  const contractValue = project.contract_value || 0;
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
          <DialogTitle>Revenue Schedule — Construction Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-900">{project.title}</p>
            {contractValue > 0 && (
              <p className="text-xs text-slate-600 mt-1">
                Contract Value: <span className="font-semibold">${contractValue.toLocaleString()}</span>
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
            Total (all years): <span className={`font-semibold ${totalPct >= 99.9 ? 'text-emerald-600' : totalPct > 0 ? 'text-amber-600' : ''}`}>{totalPct.toFixed(1)}%</span>
          </div>

          <InvalidAllocationRows allocations={monthlyAllocations} onChange={setMonthlyAllocations} />
          {saveMutation.error && <p className="text-sm text-destructive">{saveMutation.error.message}</p>}
          <p className="text-xs text-muted-foreground">Percentages are shares of the entire contract across all years, not a fresh 100% each year.</p>
          <div className="flex gap-2 justify-between pt-2">
            <Button variant="outline" size="sm" className="text-xs text-orange-700 border-orange-300 hover:bg-orange-50" onClick={() => setSubDialogOpen(true)}>
              Sub/In-House Split
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Save Allocations
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      <SubAllocationDialog
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
        entity={project}
        entityType="project"
        companySettings={companySettings}
      />
    </Dialog>
  );
}