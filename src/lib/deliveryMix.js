import { deliveryMonths, getCrewCapacityByMonth } from '@/lib/deliveryMixCapacity';

export const mixDefaults = { labour_rate: 50, baseline_gm: 25, benchmark_gm: 45, hst_rate: 13, forecast_months: 18, crew_staff_ids: [] };
export const costFields = ['sub_quote', 'materials_by_frontier', 'selections', 'equipment', 'other'];
export const committed = job => ['Signed', 'In construction'].includes(job.bucket);
const formatCad = digits => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: digits, minimumFractionDigits: digits });
const wholeCad = formatCad(0), exactCad = formatCad(2);
export const cad = n => n == null ? '—' : wholeCad.format(n);
export const cadCents = n => n == null ? '—' : exactCad.format(n);
export const pct = (n, digits = 1) => n == null ? '—' : `${n.toFixed(digits)}%`;
export const hrs = n => n == null ? '—' : `${new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 }).format(n)} h`;
export const preciseHours = n => `${new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(n)} h`;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const subCost = s => costFields.reduce((total, key) => total + (key === 'materials_by_frontier' && s.sub_supplies_materials ? 0 : (s[key] || 0)), 0);
const tiers = [[45,'Maximum in-house'],[40,'Predominantly in-house'],[35,'Balanced hybrid'],[30,'Predominantly subbed'],[25,'Fully subbed']];

export function priceJob(job, scopes, settings) {
  const estimate = job.estimate;
  const cost = scopes.reduce((total, s) => total + subCost(s), 0);
  const marginFactor = 1 - settings.baseline_gm / 100;
  const automaticPrices = scopes.map(scope => {
    const material = !scope.sub_supplies_materials && scope.frontier_material_markup_pct != null ? (scope.materials_by_frontier || 0) : 0;
    return (subCost(scope) - material) / marginFactor + material * (1 + (scope.frontier_material_markup_pct ?? 0) / 100);
  });
  const hasOverride = estimate?.override_contract_price > 0;
  const price = hasOverride ? estimate.override_contract_price : automaticPrices.reduce((total, sell) => total + sell, 0);
  const rate = estimate?.labour_rate_override ?? settings.labour_rate;
  const priced = scopes.map((scope, index) => {
    const baseCost = subCost(scope), sell = hasOverride ? (cost ? price * baseCost / cost : 0) : automaticPrices[index];
    const inHours = scope.inhouse_hours || 0, requested = scope.inhouse_share || 0;
    const invalid = requested > 0 && (!scope.inhouse_feasible || !inHours);
    const share = invalid ? 0 : requested / 100;
    const replacementMaterials = scope.sub_supplies_materials ? (scope.materials_by_frontier || 0) : 0;
    const inhouseNonLabour = replacementMaterials + (scope.inhouse_extra_materials || 0);
    const fullAdded = (scope.sub_quote || 0) - inHours * rate - inhouseNonLabour;
    const baseline = sell - baseCost, added = fullAdded * share, hours = inHours * share;
    const months = deliveryMonths(scope.scheduled_start_month, scope.duration_months || 1);
    return { ...scope, job, baseCost, sell, baseline, inhouseNonLabour, fullAdded, fullInhouseCost: baseCost - fullAdded, added, hours, finalCost: baseCost - added, gp: baseline + added, ratePerHour: inHours ? fullAdded / inHours : null, share, invalid, months };
  });
  const baseline = sum(priced, 'baseline'), added = sum(priced, 'added'), hours = sum(priced, 'hours'), gp = baseline + added;
  const gm = price ? gp / price * 100 : null;
  return { ...job, price, withHst: price * (1 + settings.hst_rate / 100), scopes: priced, baselineCogs: cost, cogs: sum(priced, 'finalCost'), baseline, baselineGM: price ? baseline / price * 100 : null, added, hours, gp, gm, perHour: hours ? added / hours : null, tier: gm == null ? '—' : tiers.find(([threshold]) => gm + 1e-8 >= threshold)?.[1] || 'Below target' };
}

export function scheduleScopes(scopes) {
  return scopes.flatMap(scope => scope.months.map(month => Object.fromEntries([['month', month], ...['sell','hours','baseline','added','gp'].map(key => [key, scope[key] / scope.months.length])])));
}

export function monthForecast(months, crewData, scopes) {
  const scheduled = scheduleScopes(scopes);
  const rows = getCrewCapacityByMonth(months, { ...crewData, scheduled });
  const lookup = new Map(rows.map(row => [row.month, Object.assign(row, { sell: 0, baseline: 0, added: 0, gp: 0 })]));
  for (const slice of scheduled) {
    const row = lookup.get(slice.month);
    if (row) for (const key of ['sell','baseline','added','gp']) row[key] += slice[key];
  }
  return rows;
}

export function suggestMix(candidates, allScopes, capacity) {
  const sorted = [...candidates].sort((a, b) => (b.ratePerHour ?? -Infinity) - (a.ratePerHour ?? -Infinity) || a.id.localeCompare(b.id));
  const ids = new Set(sorted.map(s => s.id));
  const spare = new Map(capacity.map(row => [row.month, row.capacity]));
  for (const part of scheduleScopes(allScopes.filter(s => !ids.has(s.id)))) if (spare.has(part.month)) spare.set(part.month, spare.get(part.month) - part.hours);
  return sorted.map(scope => {
    const perMonth = scope.inhouse_hours / scope.months.length;
    const fits = scope.months.length && scope.months.every(month => spare.has(month) && spare.get(month) + 1e-8 >= perMonth);
    if (fits) scope.months.forEach(month => spare.set(month, spare.get(month) - perMonth));
    return { scope, share: fits ? 100 : 0, reason: fits ? 'Self-perform' : 'Sub (no capacity)' };
  });
}