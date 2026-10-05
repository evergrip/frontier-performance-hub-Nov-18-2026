import { allocationDate } from '@/components/utils/projectPeriod';

export default function allocationSlots(existing, fiscalYear, startMonth = 10) {
  const normalized = (existing || []).map(a => {
    const date = allocationDate(a);
    return date ? { ...a, year: date.getFullYear(), month: date.getMonth() + 1 } : { ...a };
  });
  const years = new Set([fiscalYear]);
  normalized.forEach(a => { if (allocationDate(a)) years.add(a.month >= startMonth ? a.year : a.year - 1); });
  const slots = [];
  [...years].sort((a, b) => a - b).forEach(year => {
    for (let i = 0; i < 12; i++) {
      const date = new Date(year, startMonth - 1 + i, 1);
      slots.push({ year: date.getFullYear(), month: date.getMonth() + 1, percentage: 0 });
    }
  });
  normalized.forEach(a => {
    const slot = allocationDate(a) && slots.find(s => s.year === a.year && s.month === a.month);
    if (slot) slot.percentage += Number(a.percentage) || 0;
    else slots.push(a);
  });
  return slots;
}