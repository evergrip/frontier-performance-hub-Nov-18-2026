import { costFields } from '@/lib/deliveryMix';

export const costLabels = ['Sub quote', 'Frontier materials', 'Selections', 'Equipment', 'Other'];
export const newScopeRow = () => ({ rowKey: crypto.randomUUID(), scope_name: '', duration_months: 1 });
export const asMoney = value => value === '' || value == null ? null : Number(value);

export function scopeCosts(row) {
  return {
    scope_name: (row.scope_name || '').trim(), cost_code: row.cost_code || '',
    subtrade_id: row.subtrade_id || '', sub_name: row.subtrade_id ? '' : row.sub_name || '',
    ...Object.fromEntries(costFields.map(key => [key, Number(row[key] || 0)])),
  };
}

export function scopeOperations(row) {
  return {
    inhouse_feasible: !!row.inhouse_feasible,
    inhouse_hours: Number(row.inhouse_hours || 0), inhouse_extra_materials: Number(row.inhouse_extra_materials || 0),
    inhouse_share: Number(row.inhouse_share || 0), scheduled_start_month: row.scheduled_start_month || '',
    duration_months: Number(row.duration_months ?? 1),
  };
}

export function changedScopeRows(rows, original, saveMix) {
  return rows.flatMap(row => {
    const before = original.get(row.id) || {};
    const costs = scopeCosts(row);
    const operations = scopeOperations(row);
    const costsChanged = JSON.stringify(costs) !== JSON.stringify(scopeCosts(before));
    const opsChanged = saveMix && JSON.stringify(operations) !== JSON.stringify(scopeOperations(before));
    if (!costsChanged && !opsChanged) return [];
    return [{ id: row.id, ...costs, ...(opsChanged ? { operations } : {}) }];
  });
}