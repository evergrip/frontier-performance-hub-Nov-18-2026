import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock, Building2, Wrench, Layers, Pencil } from 'lucide-react';
import { getFiscalYearLabel } from '../utils/fiscalYear';
import ForecastProjectListDialog from './ForecastProjectListDialog';

export default function BuildCapacityForecast({ capacityForecast, staffCapacity, currentFiscalGoal, fiscalYear, fiscalYearStartMonth, settings, projects, preconSales, clients, sales }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState('projects');
  if (!capacityForecast) return null;

  const {
    activeInHouse = 0, activeSub = 0, activeMixed = 0,
    preconInHouse = 0, preconSub = 0, preconMixed = 0,
    excludedProjectsCount = 0, excludedSalesCount = 0,
    bookedBacklog = 0,
    preconConversionRate = 0.5, convertedToConstruction = 0, totalClosedPrecon = 0,
    inHouseLoad = 0,
  } = capacityForecast;
  const convRatePct = (preconConversionRate * 100).toFixed(0);
  

  const totalInHouse = activeInHouse + preconInHouse;
  const totalSub = activeSub + preconSub;
  const totalMixed = activeMixed + preconMixed;
  const totalExcluded = excludedProjectsCount + excludedSalesCount;

  const openDialog = (tab) => {
    setDialogTab(tab);
    setDialogOpen(true);
  };

  const ClickableCard = ({ children, className, onClick, title }) => (
    <div
      className={`p-4 rounded-lg cursor-pointer hover:shadow-md transition-all group relative ${className}`}
      onClick={onClick}
      title={title || 'Click to edit'}
    >
      <Pencil className="w-3 h-3 absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </div>
  );

  return (
    <>
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Build Capacity Forecast
        </CardTitle>
        <CardDescription>
          {capacityForecast.capacitySource === 'staff'
            ? <>Capacity from staff complement ({staffCapacity.staff.pmCount} PMs, {staffCapacity.staff.crewCount} field crew) · {getFiscalYearLabel(fiscalYear, fiscalYearStartMonth)}</>
            : <>Based on {getFiscalYearLabel(fiscalYear, fiscalYearStartMonth)} {capacityForecast.capacitySource === 'manual' ? 'manual capacity schedule' : `revenue target of $${((currentFiscalGoal?.revenue_target || 0) / 1000000).toFixed(1)}M`}</>}
          {capacityForecast.usingGrowthForecast && settings.next_year_revenue_target && (
            <> · Next year: ${(settings.next_year_revenue_target / 1000000).toFixed(1)}M</>
          )}
          {totalExcluded > 0 && (
            <span className="ml-2 text-amber-600">· {totalExcluded} excluded from forecast</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Monthly Capacity — click to edit */}
          <ClickableCard className="bg-white border border-blue-200" onClick={() => openDialog('capacity')} title="Click to edit capacity">
            <p className="text-xs text-slate-600 mb-1">In-House Monthly Capacity</p>
            <p className="text-2xl font-bold text-blue-700">
              ${(capacityForecast.monthlyCapacity / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {capacityForecast.capacitySource === 'staff' ? 'From staff (avg. remaining FY months)' : capacityForecast.hasManualCapacity ? 'Manual override' : 'From annual target'}
              {capacityForecast.usingGrowthForecast && (
                <> · Next: ${(capacityForecast.nextYearMonthlyCapacity / 1000).toFixed(0)}K</>
              )}
            </p>
            <p className="text-[10px] text-blue-600 mt-1">Sub work excluded from capacity</p>
          </ClickableCard>
          
          {/* Active Projects — click to see project list */}
          <ClickableCard className="bg-white border border-amber-200" onClick={() => openDialog('projects')} title="Click to view & edit projects">
            <p className="text-xs text-slate-600 mb-1">Booked Work (Active Projects)</p>
            <p className="text-2xl font-bold text-amber-700">
              ${(capacityForecast.activeProjectsValue / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-slate-500 mt-1">Contracted — remaining to complete</p>
            {(activeInHouse > 0 || activeSub > 0) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activeInHouse > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🏠 ${(activeInHouse / 1000).toFixed(0)}K in-house</span>}
                {activeSub > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">🔧 ${(activeSub / 1000).toFixed(0)}K sub</span>}
                {activeMixed > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">⚙️ ${(activeMixed / 1000).toFixed(0)}K mixed</span>}
              </div>
            )}
          </ClickableCard>
          
          {/* Precon Pipeline — click to see precon list */}
          <ClickableCard className="bg-white border border-emerald-200" onClick={() => openDialog('projects')} title="Click to view & edit pipeline">
            <p className="text-xs text-slate-600 mb-1">Potential Work (Precon Pipeline)</p>
            <p className="text-2xl font-bold text-emerald-700">
              ${(capacityForecast.preconPipelineValue / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Stage-weighted{capacityForecast.conversionHasHistory
                ? <> · {convRatePct}% company conversion ({convertedToConstruction}/{totalClosedPrecon}, trailing 24 mo)</>
                : <span className="text-amber-500"> (default stage probabilities — need 5+ decided precon in 24 mo)</span>
              }
            </p>
            {capacityForecast.preconPipelineValueRaw && capacityForecast.preconPipelineValueRaw !== capacityForecast.preconPipelineValue && (
              <p className="text-[10px] text-slate-400 mt-0.5">Raw pipeline: ${(capacityForecast.preconPipelineValueRaw / 1000).toFixed(0)}K before weighting · This FY: ${((capacityForecast.thisFY?.total || 0) / 1000).toFixed(0)}K · Beyond FY: ${((capacityForecast.beyondFY?.total || 0) / 1000).toFixed(0)}K</p>
            )}
            {(preconInHouse > 0 || preconSub > 0) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {preconInHouse > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🏠 ${(preconInHouse / 1000).toFixed(0)}K in-house</span>}
                {preconSub > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">🔧 ${(preconSub / 1000).toFixed(0)}K sub</span>}
                {preconMixed > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">⚙️ ${(preconMixed / 1000).toFixed(0)}K mixed</span>}
              </div>
            )}
          </ClickableCard>
          
          {/* Wait Time — clear breakdown */}
          <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg border-2 border-slate-300">
            <p className="text-xs text-slate-600 mb-1 font-semibold">New Client Wait Time (In-House)</p>
            <div className="space-y-2">
              <div>
                <p className="text-2xl font-bold text-slate-900">{bookedBacklog.toFixed(1)} <span className="text-sm font-medium text-slate-500">mo</span></p>
                <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide">Booked Only</p>
                <p className="text-[10px] text-slate-500">Contracted in-house work</p>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <p className="text-lg font-bold text-slate-600">{capacityForecast.monthsOfBacklog.toFixed(1)} <span className="text-xs font-medium text-slate-400">mo</span></p>
                <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide">+ Stage-weighted pipeline</p>
                <p className="text-[10px] text-slate-500">In-house load only · subs excluded</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Total Pipeline:</strong> ${(capacityForecast.totalPipeline / 1000).toFixed(0)}K
            <span className="mx-2">•</span>
            <strong>In-House Load:</strong> ${(inHouseLoad / 1000).toFixed(0)}K
            <span className="mx-2">•</span>
            Conversion: <strong>{capacityForecast.conversionHasHistory ? `${convRatePct}%` : 'stage defaults'}</strong>{capacityForecast.conversionHasHistory ? ` (${convertedToConstruction}/${totalClosedPrecon})` : ''}
          </p>
          <p className="text-sm text-blue-900 mt-1">
            Booked in-house: <strong>{Math.ceil(bookedBacklog)} months</strong>
            <span className="mx-2">•</span>
            Full in-house: <strong>{Math.ceil(capacityForecast.monthsOfBacklog)} months</strong>
          </p>
          {(totalInHouse > 0 || totalSub > 0 || totalMixed > 0) && (
            <div className="flex flex-wrap gap-3 mt-2 text-xs">
              {totalInHouse > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                  <Building2 className="w-3 h-3" /> In-House: ${(totalInHouse / 1000).toFixed(0)}K
                </span>
              )}
              {totalSub > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-100 text-orange-800 font-medium">
                  <Wrench className="w-3 h-3" /> Subcontractor: ${(totalSub / 1000).toFixed(0)}K
                </span>
              )}
              {totalMixed > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-100 text-purple-800 font-medium">
                  <Layers className="w-3 h-3" /> Mixed: ${(totalMixed / 1000).toFixed(0)}K
                </span>
              )}
            </div>
          )}
        </div>
        {staffCapacity && <StaffCapacityTable staffCapacity={staffCapacity} />}
      </CardContent>
    </Card>
    <ForecastProjectListDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      defaultTab={dialogTab}
      projects={projects}
      preconSales={preconSales}
      clients={clients}
      sales={sales}
      settings={settings}
    />
    </>
  );
}

const k = (v) => `$${Math.round((v || 0) / 1000).toLocaleString()}K`;
const pct = (u) => (Number.isFinite(u) ? `${Math.round(u * 100)}%` : '∞');

// Capacity vs forecast backlog by month for the fiscal year, with the constraining role.
function StaffCapacityTable({ staffCapacity }) {
  const { staff, config, months } = staffCapacity;
  const overMonths = months.filter((m) => m.over).length;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-800">Staff capacity vs forecast backlog, by month</p>
        <p className="text-xs text-slate-500">
          PMs: {staff.pmCount}{staff.pmAuto ? ' (auto)' : ''} · Field crew: {staff.crewCount}{staff.crewAuto ? ' (auto)' : ''} · Supers: {staff.superCount || 'not modelled'} · Subtrades on file: {staff.subtradeCount}{config.subtrade_monthly_value == null ? ' (capacity not modelled)' : ''}
        </p>
      </div>
      {staff.pmCount === 0 && staff.crewCount === 0 && (
        <p className="text-xs text-amber-600 mb-2">No PMs or field crew found. Set headcounts under Company Settings → Build capacity model.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-1.5 text-left">Month</th>
              <th className="px-2 py-1.5 text-right">Backlog (weighted)</th>
              <th className="px-2 py-1.5 text-right">In-house / Sub</th>
              <th className="px-2 py-1.5 text-right">Jobs</th>
              <th className="px-2 py-1.5 text-right">Capacity ($)</th>
              <th className="px-2 py-1.5 text-right">Crew hrs need / avail</th>
              <th className="px-2 py-1.5 text-left">Constraint</th>
              <th className="px-2 py-1.5 text-right">Load</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const crew = m.roles.find((r) => r.role.startsWith('Field crew'));
              const u = m.constraint?.utilization || 0;
              return (
                <tr key={m.month.toISOString()} className={m.over ? 'bg-red-50' : u > 0.85 ? 'bg-amber-50' : ''}>
                  <td className="px-2 py-1.5">{m.month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{k(m.total)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-500">{k(m.inHouse)} / {k(m.sub)}</td>
                  <td className="px-2 py-1.5 text-right">{m.jobs.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-right">{k(m.dollarCapacity)}</td>
                  <td className="px-2 py-1.5 text-right">{Math.round(crew?.demand || 0)} / {Math.round(crew?.capacity || 0)}</td>
                  <td className="px-2 py-1.5">{m.total > 0 ? m.constraint?.role : '—'}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${m.over ? 'text-red-600' : u > 0.85 ? 'text-amber-600' : 'text-emerald-600'}`}>{m.total > 0 ? pct(u) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        {overMonths > 0 ? `${overMonths} month(s) over capacity. ` : ''}Backlog = active jobs (allocations) + signed sales + stage-weighted precon. Assumptions: PM ${Math.round(config.pm_monthly_value / 1000)}K/month and {config.pm_max_concurrent_jobs} jobs; ${config.revenue_per_crew_hour} of in-house work per crew hour; {config.crew_hours_per_day} h/day less holidays and unavailability.
      </p>
    </div>
  );
}
