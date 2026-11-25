import { parseLocalDate } from '@/components/utils/fiscalYear';

export const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export function deliveryMonths(start, count) {
  const date = typeof start === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(start) ? parseLocalDate(start) : start instanceof Date ? start : null;
  return date ? Array.from({ length: count }, (_, i) => monthKey(new Date(date.getFullYear(), date.getMonth() + i, 1))) : [];
}
export function defaultCrewHours(staff, month, holidays) {
  if ((staff.start_date && staff.start_date.slice(0, 7) > month) || (staff.end_date && staff.end_date.slice(0, 7) < month)) return null;
  const date = parseLocalDate(month);
  let weekdays = 0;
  for (let day = 1; day <= new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); day++) {
    const current = new Date(date.getFullYear(), date.getMonth(), day);
    if (current.getDay() % 6 && !holidays.has(`${month}-${String(day).padStart(2, '0')}`)) weekdays++;
  }
  return weekdays * (staff.hours_per_week || 0) / 5;
}
export function getCrewCapacityByMonth(months, { crew, availability, holidays, scheduled = [] }) {
  const days = new Set(holidays.map(h => h.date));
  const overrides = new Map(availability.map(row => [`${row.staff_detail_id}/${row.month}`, row]));
  const rows = months.map(month => {
    let available = 0, reserved = 0;
    for (const person of crew) {
      const standard = defaultCrewHours(person, month, days);
      if (standard === null) continue;
      const override = overrides.get(`${person.id}/${month}`);
      available += override?.available_hours ?? standard;
      reserved += override?.reserved_hours ?? 0;
    }
    return { month, available, reserved, capacity: available - reserved, allocated: 0, remaining: 0, over: false };
  });
  const byMonth = new Map(rows.map(row => [row.month, row]));
  for (const { month, hours } of scheduled) if (byMonth.has(month)) byMonth.get(month).allocated += hours;
  for (const row of rows) {
    row.remaining = row.capacity - row.allocated;
    row.over = row.remaining < -1e-8;
  }
  return rows;
}