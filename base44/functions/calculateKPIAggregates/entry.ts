import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
    }

    const results = { processed: 0, created: 0, updated: 0, finalized: 0, errors: [] };

    const settingsList = await base44.asServiceRole.entities.CompanySettings.list();
    // Feature flag: KPIs are off unless CompanySettings.kpis_enabled === true. No-op (nothing read or written).
    if (settingsList?.[0]?.kpis_enabled !== true) {
      return Response.json({ success: true, skipped: true, message: 'KPIs are disabled (CompanySettings.kpis_enabled is not true); nothing calculated.' });
    }
    const fiscalStartMonth = Number(settingsList?.[0]?.fiscal_year_start_month) || 10;
    const today = torontoToday();

    // Fetch all active calculated KPIs
    const kpis = await base44.asServiceRole.entities.KPI.filter({ is_active: true, type: "calculated" });

    for (const kpi of kpis) {
      try {
        const current = getReportingPeriod(kpi.reporting_period_type, today, fiscalStartMonth);
        await processKPI(base44, kpi, results, current);
        // First day of a new period: recompute the previous period once more so late activity is captured.
        if (today === current.start) {
          const previous = getReportingPeriod(kpi.reporting_period_type, addDays(current.start, -1), fiscalStartMonth);
          await processKPI(base44, kpi, results, previous);
          results.finalized++;
        }
        results.processed++;
      } catch (error) {
        results.errors.push({ kpi_id: kpi.id, kpi_name: kpi.name, error: error.message });
      }
    }

    return Response.json({ success: true, message: `Processed ${results.processed} KPIs`, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processKPI(base44, kpi, results, periodDates) {
  const { source_entity, metric_field, date_field, aggregation_method, filter_conditions, responsible_user_field, reporting_period_type, threshold_comparison, threshold_value, target_value } = kpi;

  if (!source_entity || !base44.asServiceRole.entities[source_entity]) {
    throw new Error(`Invalid source entity: ${source_entity}`);
  }

  // Build query filters
  const queryFilters = { ...(filter_conditions || {}) };
  
  // For date filtering, we fetch all records and filter in code since
  // complex date range queries may not be supported on all field types
  let sourceData;
  try {
    sourceData = await base44.asServiceRole.entities[source_entity].filter(queryFilters);
  } catch (e) {
    // If filter fails (e.g. unsupported operator), try listing all
    sourceData = await base44.asServiceRole.entities[source_entity].filter({});
    // Apply filter conditions manually
    if (filter_conditions && Object.keys(filter_conditions).length > 0) {
      sourceData = sourceData.filter(record => {
        return Object.entries(filter_conditions).every(([key, val]) => {
          if (typeof val === 'object' && val !== null) return true; // Skip complex filters
          return record[key] === val;
        });
      });
    }
  }

  // Apply date range filter in code for reliability
  if (date_field) {
    sourceData = sourceData.filter(record => {
      const key = torontoDateKey(record[date_field]);
      return !!key && key >= periodDates.start && key <= periodDates.end;
    });
  }

  // Group by responsible user
  const userGroups = {};
  for (const record of sourceData) {
    const userId = record[responsible_user_field];
    if (!userId) continue;
    if (!userGroups[userId]) userGroups[userId] = [];
    userGroups[userId].push(record);
  }

  // Also handle assigned users who may have zero records
  if (kpi.assigned_user_ids && kpi.assigned_user_ids.length > 0) {
    for (const uid of kpi.assigned_user_ids) {
      if (!userGroups[uid]) userGroups[uid] = [];
    }
  }

  // Calculate KPI for each user
  for (const [userId, records] of Object.entries(userGroups)) {
    const actualValue = calculateAggregation(records, metric_field, aggregation_method);
    
    // Get user-specific target if exists
    let targetValueAtEntry = target_value;
    try {
      const targets = await base44.asServiceRole.entities.KPITarget.filter({
        kpi_id: kpi.id,
        user_id: userId,
      });
      const matchingTarget = targets.find(t => {
        const tStart = periodKey(t.reporting_period_start_date);
        const tEnd = periodKey(t.reporting_period_end_date);
        return tStart && tEnd && tStart <= periodDates.end && tEnd >= periodDates.start;
      });
      if (matchingTarget) targetValueAtEntry = matchingTarget.target_value;
    } catch (e) {
      // Use default target
    }
    
    const isFlagged = checkThreshold(actualValue, threshold_value, threshold_comparison);
    
    // Upsert entry
    const existingEntries = await base44.asServiceRole.entities.KPIEntry.filter({
      kpi_id: kpi.id,
      user_id: userId,
    });
    
    // Match on the calendar date of the period (works for old UTC-midnight values and new Toronto-offset values).
    const existing = existingEntries.find(e => periodKey(e.reporting_period_start_date) === periodDates.start && periodKey(e.reporting_period_end_date) === periodDates.end);

    const entryData = {
      kpi_id: kpi.id,
      user_id: userId,
      reporting_period_start_date: `${periodDates.start}T00:00:00${torontoOffset(periodDates.start)}`,
      reporting_period_end_date: `${periodDates.end}T23:59:59${torontoOffset(periodDates.end)}`,
      actual_value: actualValue,
      target_value_at_entry: targetValueAtEntry,
      is_flagged: isFlagged,
      source_data_ids: records.map(r => r.id),
      manual_entry: false
    };

    if (existing) {
      await base44.asServiceRole.entities.KPIEntry.update(existing.id, {
        ...entryData,
        explanation_provided: existing.explanation_provided
      });
      results.updated++;
    } else {
      await base44.asServiceRole.entities.KPIEntry.create(entryData);
      results.created++;
    }
  }
}

// ---- Dates: all periods are civil dates (YYYY-MM-DD) in America/Toronto, fiscal year from CompanySettings ----
const TZ = 'America/Toronto';
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const parts = (key) => key.split('-').map(Number);

function torontoDateKey(value) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str; // plain date already
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
// Stored period boundaries: the calendar date is the first 10 chars (old values were UTC midnight of that date).
const periodKey = (value) => (value ? String(value).slice(0, 10) : null);
const torontoToday = () => torontoDateKey(new Date());
function addDays(key, n) { const [y, m, d] = parts(key); return ymd(y, m, d + n); }
function torontoOffset(key) {
  const [y, m, d] = parts(key);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT-5';
  const mm = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  return mm ? `${mm[1]}${pad(mm[2])}:${mm[3] || '00'}` : '-05:00';
}

// Returns { start, end } as 'YYYY-MM-DD' (inclusive) for the period containing `dateKey`.
function getReportingPeriod(periodType, dateKey, fiscalStartMonth = 10) {
  const [y, m, d] = parts(dateKey);
  switch (periodType) {
    case 'daily':
      return { start: dateKey, end: dateKey };
    case 'weekly': { // Sunday – Saturday
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const start = ymd(y, m, d - dow);
      return { start, end: addDays(start, 6) };
    }
    case 'quarterly': { // fiscal quarters (Q1 = first 3 months of the fiscal year)
      const offset = (m - fiscalStartMonth + 12) % 12;
      const qStartMonth = m - (offset % 3);
      return { start: ymd(y, qStartMonth, 1), end: ymd(y, qStartMonth + 3, 0) };
    }
    case 'yearly': { // fiscal year
      const fyStartYear = m >= fiscalStartMonth ? y : y - 1;
      return { start: ymd(fyStartYear, fiscalStartMonth, 1), end: ymd(fyStartYear + 1, fiscalStartMonth, 0) };
    }
    case 'monthly':
    default:
      return { start: ymd(y, m, 1), end: ymd(y, m + 1, 0) };
  }
}

function calculateAggregation(records, metricField, method) {
  if (method === 'count') return records.length;
  
  const values = records
    .map(r => typeof r[metricField] === 'number' ? r[metricField] : parseFloat(r[metricField]))
    .filter(v => !isNaN(v));

  if (values.length === 0) return 0;

  switch (method) {
    case 'sum': return values.reduce((s, v) => s + v, 0);
    case 'average': return values.reduce((s, v) => s + v, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return 0;
  }
}

function checkThreshold(actualValue, thresholdValue, comparison) {
  if (thresholdValue == null || !comparison) return false;
  switch (comparison) {
    case 'less_than': return actualValue < thresholdValue;
    case 'greater_than': return actualValue > thresholdValue;
    case 'equal_to': return actualValue === thresholdValue;
    case 'not_equal_to': return actualValue !== thresholdValue;
    default: return false;
  }
}