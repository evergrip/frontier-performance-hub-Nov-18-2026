// Staff-based build capacity vs forecast backlog, by month of the fiscal year.
// Config lives in CompanySettings.capacity_model (all optional; defaults below).
import { allocationPercentage } from '@/components/utils/projectPeriod';
import { parseLocalDate } from '@/components/utils/fiscalYear';
import { scheduleShare } from '@/lib/pipelineForecast';

export const CAPACITY_DEFAULTS = {
  pm_count: null,                 // null = auto: distinct PMs on active construction projects
  pm_monthly_value: 250000,       // $ of construction work one PM can run per month
  pm_max_concurrent_jobs: 5,      // jobs one PM can run at once
  crew_count: null,               // null = auto: users in the Construction department who aren't PMs
  crew_hours_per_day: 8,
  revenue_per_crew_hour: 175,     // $ of in-house work produced per field-crew hour
  super_count: 0,                 // 0 = supers not modelled
  jobs_per_super: 3,
  subtrade_monthly_value: null,   // $ of subcontracted work subtrades can absorb per month; null = not modelled
  mixed_in_house_share: 0.5,      // share of "mixed" build-type work done by our crew
};

export const capacityConfig = (settings) => {
  const raw = settings?.capacity_model || {};
  const out = { ...CAPACITY_DEFAULTS };
  for (const k of Object.keys(CAPACITY_DEFAULTS)) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '' && Number.isFinite(Number(raw[k]))) out[k] = Number(raw[k]);
  }
  return out;
};

const monthsOf = (range) => {
  const out = [];
  for (let d = new Date(range.start.getFullYear(), range.start.getMonth(), 1); d <= range.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    out.push({ start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999) });
  }
  return out;
};

const inDept = (u, dept) => u?.department === dept || (u?.departments || []).includes(dept);

function workdays(month, holidayKeys) {
  let n = 0;
  for (let d = new Date(month.start); d <= month.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const dow = d.getDay();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dow !== 0 && dow !== 6 && !holidayKeys.has(key)) n++;
  }
  return n;
}

// Hours lost for one employee in a month from EmployeeUnavailability (weekdays only; hours_available counts as partial).
function unavailableHours(records, employeeId, month, hoursPerDay, holidayKeys) {
  let lost = 0;
  for (const r of records.filter((x) => x.employee_id === employeeId)) {
    const s = parseLocalDate(r.start_date), e = parseLocalDate(r.end_date || r.start_date);
    if (!s || !e) continue;
    for (let d = new Date(Math.max(s, month.start)); d <= e && d <= month.end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (d.getDay() === 0 || d.getDay() === 6 || holidayKeys.has(key)) continue;
      lost += Math.max(0, hoursPerDay - (Number(r.hours_available) || 0));
    }
  }
  return lost;
}

/**
 * forecast: result of buildPipelineForecast for the FY. users: listUsersBasic users.
 * Returns { config, staff, months[] } where each month has demand, capacity per role, utilization and the constraint.
 */
export function buildStaffCapacity({ forecast, range, settings, users = [], projects = [], subtrades = [], unavailability = [], holidays = [] }) {
  const cfg = capacityConfig(settings);
  const activePMs = new Set(projects.filter((p) => p.project_type === 'construction' && p.status !== 'closed' && p.project_manager_id).map((p) => p.project_manager_id));
  const pmCount = cfg.pm_count ?? activePMs.size;
  const crew = users.filter((u) => inDept(u, 'Construction') && !activePMs.has(u.id));
  const crewCount = cfg.crew_count ?? crew.length;
  const holidayKeys = new Set(holidays.map((h) => String(h.date || '').slice(0, 10)).filter(Boolean));
  const mixedIn = Math.min(Math.max(cfg.mixed_in_house_share, 0), 1);

  const rows = [
    ...forecast.activeProjects.map((r) => ({ rec: r.project, weight: 1, value: r.value, build: r.buildType, start: parseLocalDate(r.project.start_date), hasAlloc: (r.project.monthly_revenue_allocations || []).length > 0 })),
    ...forecast.signedNoProject.map((r) => ({ rec: r.sale, weight: 1, value: r.value, build: r.buildType, start: parseLocalDate(r.sale.close_date) })),
    ...forecast.precon.map((r) => ({ rec: r.sale, weight: r.probability, value: r.value, build: r.buildType, start: parseLocalDate(r.sale.target_precon_completion_date || r.sale.close_date) })),
  ];

  const months = monthsOf(range).map((m) => {
    let inHouse = 0, sub = 0, jobs = 0;
    for (const r of rows) {
      const share = r.hasAlloc ? allocationPercentage(r.rec, m) / 100 : scheduleShare(r.rec, m, { startDate: r.start, months: forecast.durationMonths }).inRange;
      if (!share) continue;
      const v = r.value * r.weight * share;
      const inShare = r.build === 'subcontractor' ? 0 : r.build === 'in_house' ? 1 : mixedIn;
      inHouse += v * inShare; sub += v * (1 - inShare); jobs += r.weight;
    }
    const total = inHouse + sub;
    const days = workdays(m, holidayKeys);
    const crewIds = cfg.crew_count == null ? crew.map((u) => u.id) : [];
    const lost = crewIds.reduce((s, id) => s + unavailableHours(unavailability, id, m, cfg.crew_hours_per_day, holidayKeys), 0);
    const crewHours = Math.max(0, crewCount * days * cfg.crew_hours_per_day - lost);
    const roles = [
      { role: 'Project managers ($)', demand: total, capacity: pmCount * cfg.pm_monthly_value },
      { role: 'Project managers (jobs)', demand: jobs, capacity: pmCount * cfg.pm_max_concurrent_jobs, unit: 'jobs' },
      { role: 'Field crew (hours)', demand: inHouse / cfg.revenue_per_crew_hour, capacity: crewHours, unit: 'hours' },
      ...(cfg.super_count > 0 ? [{ role: 'Supers (jobs)', demand: jobs, capacity: cfg.super_count * cfg.jobs_per_super, unit: 'jobs' }] : []),
      ...(cfg.subtrade_monthly_value != null ? [{ role: 'Subtrades ($)', demand: sub, capacity: cfg.subtrade_monthly_value }] : []),
    ].map((r) => ({ ...r, utilization: r.capacity > 0 ? r.demand / r.capacity : (r.demand > 0 ? Infinity : 0) }));
    const constraint = roles.reduce((a, b) => (b.utilization > a.utilization ? b : a), roles[0]);
    // $ of work deliverable this month: limited by PM $ capacity and by crew hours (in-house) + subtrades (sub work).
    const subCap = cfg.subtrade_monthly_value != null ? cfg.subtrade_monthly_value : sub;
    const dollarCap = Math.min(pmCount * cfg.pm_monthly_value, crewHours * cfg.revenue_per_crew_hour + subCap);
    return { month: m.start, inHouse, sub, total, jobs, workdays: days, crewHours, roles, constraint, dollarCapacity: dollarCap, over: constraint.utilization > 1 };
  });

  return {
    config: cfg,
    staff: { pmCount, pmAuto: cfg.pm_count == null, crewCount, crewAuto: cfg.crew_count == null, subtradeCount: subtrades.length, superCount: cfg.super_count },
    months,
  };
}
