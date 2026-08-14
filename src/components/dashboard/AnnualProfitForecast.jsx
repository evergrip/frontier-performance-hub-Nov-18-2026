import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, TrendingDown, TrendingUp } from 'lucide-react';

const money = (value) => `$${Math.round(value).toLocaleString()}`;

export default function AnnualProfitForecast({ forecast, target, fiscalYear }) {
  if (!target) return <Card><CardContent className="py-8 text-center text-slate-500">Set a gross profit target in Company Settings to start the annual profit forecast.</CardContent></Card>;
  const gap = forecast.projectedGP - target;
  const status = gap >= 0 ? 'On track to exceed' : 'At risk of missing';
  const progress = Math.min((forecast.projectedGP / target) * 100, 100);
  return <Card className={`border-2 ${gap >= 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
    <CardHeader><CardTitle className="flex items-center gap-2"><Target className="w-5 h-5" />Annual Profit Forecast · FY {fiscalYear}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-600">Projected gross profit</p><p className="text-3xl font-bold text-slate-900">{money(forecast.projectedGP)} <span className="text-base font-medium text-slate-500">of {money(target)}</span></p></div><div className={`flex items-center gap-2 font-semibold ${gap >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{gap >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}{status}: {money(Math.abs(gap))}</div></div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${gap >= 0 ? 'bg-emerald-600' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} /></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-lg bg-white p-3 border border-slate-200"><p className="text-xs text-slate-500">Realized GP</p><p className="font-bold text-slate-900">{money(forecast.realizedGP)}</p><p className="text-xs text-slate-500">{forecast.closedCount} completed jobs</p></div><div className="rounded-lg bg-white p-3 border border-slate-200"><p className="text-xs text-slate-500">In-progress GP</p><p className="font-bold text-slate-900">{money(forecast.inProgressGP)}</p><p className="text-xs text-slate-500">{forecast.activeCount} active jobs</p></div><div className="rounded-lg bg-white p-3 border border-slate-200"><p className="text-xs text-slate-500">Pipeline GP</p><p className="font-bold text-slate-900">{money(forecast.pipelineGP)}</p><p className="text-xs text-slate-500">{forecast.pipelineCount} pre-con jobs · {(forecast.conversionRate * 100).toFixed(0)}% conversion</p></div></div>
    </CardContent>
  </Card>;
}