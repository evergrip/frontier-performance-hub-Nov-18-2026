import { base44 } from '@/api/base44Client';
import { getCurrentFiscalYear, getFiscalYearDates, parseLocalDate } from '@/components/utils/fiscalYear';
import { deliveryMonths } from '@/lib/deliveryMixCapacity';
import { committed, mixDefaults, monthForecast, priceJob } from '@/lib/deliveryMix';

export async function deliveryRequest(payload) {
  try {
    const { data } = await base44.functions.invoke('deliveryMix', payload);
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.data?.error || error.message);
  }
}

export function deliveryModel(data) {
  const settings = { ...mixDefaults, ...data.settings };
  const { fiscalStart, staff, holidays, availability } = data;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const part = key => parts.find(p => p.type === key).value;
  const year = getCurrentFiscalYear(fiscalStart, parseLocalDate(`${part('year')}-${part('month')}-${part('day')}`));
  const months = deliveryMonths(getFiscalYearDates(year, fiscalStart).startDate, settings.forecast_months);
  const byEstimate = new Map();
  for (const scope of data.scopes) {
    if (!byEstimate.has(scope.estimate_id)) byEstimate.set(scope.estimate_id, []);
    byEstimate.get(scope.estimate_id).push(scope);
  }
  const jobs = data.jobs.map(job => priceJob(job, byEstimate.get(job.estimate?.id) || [], settings));
  const scopes = jobs.filter(committed).flatMap(job => job.scopes);
  const crewData = { crew: staff.filter(s => settings.crew_staff_ids.includes(s.id)), availability, holidays };
  return { ...data, jobs, scopes, staff, settings, year, months, crewData, capacity:monthForecast(months, crewData, scopes) };
}