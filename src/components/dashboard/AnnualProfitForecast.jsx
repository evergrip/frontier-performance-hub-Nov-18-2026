import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFiscalYearLabel } from '@/components/utils/fiscalYear';

const money = (value) => `$${Math.round(value).toLocaleString()}`;

export default function AnnualProfitForecast({ forecast, target, fiscalYear, fiscalYearStartMonth = 10 }) {
  const gap = forecast.projectedGP - (target || 0);
  const status = gap >= 0 ? 'On track to exceed' : 'At risk of missing';
  const progress = target > 0 ? Math.max(0, Math.min(forecast.projectedGP / target * 100, 100)) : 0;
  return <Card className={`border-2 ${gap >= 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
    <CardHeader><CardTitle className="flex items-center gap-2"><Target className="w-5 h-5" />Annual Profit Forecast · {getFiscalYearLabel(fiscalYear, fiscalYearStartMonth)}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-600">Projected gross profit</p><p className="text-3xl font-bold text-slate-900">{money(forecast.projectedGP)} {target > 0 && <span className="text-base font-medium text-slate-500">of {money(target)}</span>}</p></div><div className={`flex items-center gap-2 font-semibold ${gap >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{gap >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}{target > 0 ? `${status}: ${money(Math.abs(gap))}` : <Link to="/CompanySettings" className="text-primary underline">Set this fiscal year’s GP target</Link>}</div></div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${gap >= 0 ? 'bg-emerald-600' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} /></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4"><div className="rounded-lg bg-white p-3 border border-slate-200"><p className="text-xs text-slate-500">Realized GP</p><p className="font-bold text-slate-900">{money(forecast.realizedGP)}</p><p className="text-xs text-slate-500">Recognized to date this fiscal year</p></div><div className="rounded-lg bg-white p-3 border border-slate-200"><p className="text-xs text-slate-500">In-progress GP</p><p className="font-bold text-slate-900">{money(forecast.inProgressGP)}</p><p className="text-xs text-slate-500">{forecast.activeCount} active jobs · remaining FY months at estimated margin</p></div><div className="rounded-lg bg-white p-3 border border-slate-200"><p className="text-xs text-slate-500">Signed, no project yet</p><p className="font-bold text-slate-900">{money(forecast.signedGP || 0)}</p><p className="text-xs text-slate-500">{forecast.signedCount || 0} closed-won construction sales</p></div><div className="rounded-lg bg-white p-3 border border-slate-200"><p className="text-xs text-slate-500">Pipeline GP (stage-weighted)</p><p className="font-bold text-slate-900">{money(forecast.pipelineGP)}</p><p className="text-xs text-slate-500">{forecast.pipelineCount} pre-con jobs · {forecast.conversion?.hasHistory ? `${Math.round(forecast.conversionRate * 100)}% conversion (${forecast.conversion.converted}/${forecast.conversion.decided}, last ${forecast.conversion.windowMonths} mo)` : 'default stage probabilities'}</p></div></div>
      {forecast.assumedScheduleCount > 0 && <p className="text-xs text-slate-500">{forecast.assumedScheduleCount} job(s) have no monthly allocations; their value is spread evenly from the target date.</p>}
    </CardContent>
  </Card>;
}