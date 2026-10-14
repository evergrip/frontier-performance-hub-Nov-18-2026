// Shared FY pipeline forecast used by the Dashboard Annual Profit Forecast and Build Capacity Forecast.
import { allocationDate, allocationPercentage } from '@/components/utils/projectPeriod';
import { parseLocalDate } from '@/components/utils/fiscalYear';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const hasValue = (v) => v !== null && v !== undefined && v !== '';

export const OPEN_PRECON_STAGES = ['feasibility', 'design_material_selections', 'engineering_permits', 'pending_construction_sale'];

// Default win probability per open precon stage (chance the job becomes a construction contract).
export const DEFAULT_STAGE_PROBABILITIES = {
  feasibility: 0.25,
  design_material_selections: 0.45,
  engineering_permits: 0.65,
  pending_construction_sale: 0.8,
};
// How far along each stage is (0 = just started precon, 1 = signed). Used to blend the
// company-wide historical conversion rate into the per-stage probability.
const STAGE_PROGRESS = { feasibility: 0, design_material_selections: 0.3, engineering_permits: 0.6, pending_construction_sale: 0.8 };

export const CONVERSION_WINDOW_MONTHS = 24;
export const MIN_DECIDED_FOR_HISTORY = 5;
export const DEFAULT_CONSTRUCTION_MONTHS = 6;

const preconDecisionDate = (sale) => {
  const entry = [...(sale.phase_history || [])].reverse().find((h) => h.status === sale.status);
  return parseLocalDate(entry?.entered_date || sale.close_date || sale.updated_date || sale.created_date);
};

// Company-wide precon -> construction conversion over a trailing window (always pass ALL sales, not user-scoped).
export function trailingConversionRate(allSales, now = new Date(), windowMonths = CONVERSION_WINDOW_MONTHS) {
  const since = new Date(now.getFullYear(), now.getMonth() - windowMonths, now.getDate());
  const constructionByPrecon = new Set(allSales.filter((s) => s.sale_type === 'construction' && s.linked_precon_sale_id).map((s) => s.linked_precon_sale_id));
  const decided = allSales.filter((s) => s.sale_type === 'preconstruction' && ['closed_won', 'closed_lost'].includes(s.status)).filter((s) => {
    const d = preconDecisionDate(s);
    return d && d >= since && d <= now;
  });
  const converted = decided.filter((s) => s.status === 'closed_won' && (constructionByPrecon.has(s.id) || s.converted_to_project_id)).length;
  const hasHistory = decided.length >= MIN_DECIDED_FOR_HISTORY;
  return { rate: hasHistory ? converted / decided.length : null, converted, decided: decided.length, hasHistory, windowMonths };
}

// Probability per stage. Priority: CompanySettings.pipeline_stage_probabilities (percent 0-100) > blended history > defaults.
export function stageProbabilities(settings = {}, conversion) {
  const custom = settings?.pipeline_stage_probabilities || {};
  return Object.fromEntries(OPEN_PRECON_STAGES.map((stage) => {
    if (hasValue(custom[stage]) && Number.isFinite(Number(custom[stage]))) return [stage, Math.min(Math.max(Number(custom[stage]) / 100, 0), 1)];
    if (conversion?.hasHistory) {
      const base = conversion.rate;
      return [stage, Math.min(Math.max(base + (1 - base) * STAGE_PROGRESS[stage], 0), 1)];
    }
    return [stage, DEFAULT_STAGE_PROBABILITIES[stage]];
  }));
}

const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

// Share (0-1) of a job that falls in [range.start, range.end] and after it, by month.
// Uses the record's monthly_revenue_allocations when present and valid; otherwise spreads evenly over
// `months` starting at `startDate` (and never before the current month for not-yet-started work).
export function scheduleShare(record, range, { startDate, months = DEFAULT_CONSTRUCTION_MONTHS, now = new Date(), futureOnly = true } = {}) {
  const allocations = record.monthly_revenue_allocations || [];
  if (allocations.length) {
    const inRange = allocationPercentage(record, range) / 100;
    const total = allocations.reduce((s, a) => s + num(a.percentage), 0) / 100;
    if (inRange > 0 || total > 0) {
      const after = allocations.reduce((s, a) => { const d = allocationDate(a); return d && range?.end && d > range.end ? s + num(a.percentage) : s; }, 0) / 100;
      return { inRange, after, assumed: false };
    }
  }
  let start = monthStart(startDate || addMonths(now, 1));
  if (futureOnly && start < monthStart(now)) start = monthStart(now);
  const n = Math.max(1, Math.round(months));
  let inRange = 0, after = 0;
  for (let i = 0; i < n; i++) {
    const m = addMonths(start, i);
    if (range?.end && m > range.end) after += 1 / n;
    else if (!range?.start || m >= monthStart(range.start)) inRange += 1 / n;
  }
  return { inRange, after, assumed: true };
}

const marginFor = (project, sale) => {
  if (hasValue(project?.actual_margin)) return num(project.actual_margin);
  return num(sale?.estimated_margin);
};

/**
 * One forecast for the selected FY range.
 * projects/sales: records in scope (may be user-scoped). allSales: every sale (for company-wide conversion).
 */
export function buildPipelineForecast({ projects = [], sales = [], allSales = sales, range, settings = {}, now = new Date() }) {
  const durationMonths = num(settings?.default_construction_duration_months) || DEFAULT_CONSTRUCTION_MONTHS;
  const conversion = trailingConversionRate(allSales, now);
  const probabilities = stageProbabilities(settings, conversion);
  const salesById = Object.fromEntries(allSales.map((s) => [s.id, s]));
  const projectSaleIds = new Set(projects.map((p) => p.sale_id).filter(Boolean));
  const allProjectSaleIds = new Set([...projectSaleIds]);

  // Active construction projects: remaining work (future months, incl. current) in this FY vs beyond.
  const activeProjects = projects
    .filter((p) => p.project_type === 'construction' && p.status !== 'closed' && p.include_in_forecast !== false)
    .map((project) => {
      const value = num(project.contract_value);
      const sale = salesById[project.sale_id];
      const margin = marginFor(project, sale);
      const allocs = project.monthly_revenue_allocations || [];
      const pastPct = allocs.length ? allocationPercentage(project, null, true, now) / 100 : 0;
      const fyFuturePct = allocs.length ? Math.max(0, (allocationPercentage(project, range) - allocationPercentage(project, range, true, now)) / 100) : 0;
      const remainingPct = allocs.length ? Math.max(0, 1 - pastPct) : 1;
      let fyPct = fyFuturePct, beyondPct = Math.max(0, remainingPct - fyFuturePct);
      if (!allocs.length) {
        const share = scheduleShare(project, range, { startDate: parseLocalDate(project.start_date), months: durationMonths, now });
        fyPct = share.inRange; beyondPct = share.after;
      }
      return { project, sale, value, margin, buildType: project.forecast_build_type || 'in_house', fyValue: value * fyPct, beyondValue: value * beyondPct, remainingValue: value * remainingPct, fyGP: value * fyPct * margin / 100, assumedSchedule: !allocs.length };
    });

  // Signed construction sales (closed_won) that have no project yet.
  const signedNoProject = sales
    .filter((s) => s.sale_type === 'construction' && s.status === 'closed_won' && !s.converted_to_project_id && !allProjectSaleIds.has(s.id) && s.include_in_forecast !== false)
    .map((sale) => {
      const value = num(sale.contract_value) || num(sale.estimated_construction_budget);
      const margin = num(sale.estimated_margin);
      const share = scheduleShare(sale, range, { startDate: parseLocalDate(sale.target_construction_start_date || sale.close_date), months: durationMonths, now });
      return { sale, value, margin, probability: 1, buildType: sale.forecast_build_type || 'in_house', fyValue: value * share.inRange, beyondValue: value * share.after, fyGP: value * share.inRange * margin / 100, assumedSchedule: share.assumed };
    });

  // Open precon sales, stage-weighted. Skip ones already covered by a construction sale or project.
  const coveredPrecon = new Set(allSales.filter((s) => s.sale_type === 'construction' && s.linked_precon_sale_id).map((s) => s.linked_precon_sale_id));
  const precon = sales
    .filter((s) => s.sale_type === 'preconstruction' && OPEN_PRECON_STAGES.includes(s.status) && s.include_in_forecast !== false && !coveredPrecon.has(s.id) && !s.converted_to_project_id)
    .map((sale) => {
      const value = num(sale.estimated_construction_budget);
      const margin = num(sale.estimated_margin);
      const probability = probabilities[sale.status] ?? 0;
      const share = scheduleShare(sale, range, { startDate: parseLocalDate(sale.target_precon_completion_date || sale.close_date), months: durationMonths, now });
      const weighted = value * probability;
      return { sale, value, margin, probability, weighted, buildType: sale.forecast_build_type || 'in_house', fyValue: weighted * share.inRange, beyondValue: weighted * share.after, fyGP: weighted * share.inRange * margin / 100, assumedSchedule: share.assumed };
    });

  const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
  return {
    conversion, probabilities, durationMonths,
    activeProjects, signedNoProject, precon,
    excludedProjectsCount: projects.filter((p) => p.project_type === 'construction' && p.status !== 'closed' && p.include_in_forecast === false).length,
    excludedSalesCount: sales.filter((s) => s.sale_type === 'preconstruction' && OPEN_PRECON_STAGES.includes(s.status) && s.include_in_forecast === false).length,
    totals: {
      activeFY: sum(activeProjects, 'fyValue'), activeBeyond: sum(activeProjects, 'beyondValue'), activeRemaining: sum(activeProjects, 'remainingValue'), activeFYGP: sum(activeProjects, 'fyGP'),
      signedFY: sum(signedNoProject, 'fyValue'), signedBeyond: sum(signedNoProject, 'beyondValue'), signedFYGP: sum(signedNoProject, 'fyGP'),
      preconRaw: sum(precon, 'value'), preconWeighted: sum(precon, 'weighted'), preconFY: sum(precon, 'fyValue'), preconBeyond: sum(precon, 'beyondValue'), preconFYGP: sum(precon, 'fyGP'),
    },
  };
}

export { marginFor };
