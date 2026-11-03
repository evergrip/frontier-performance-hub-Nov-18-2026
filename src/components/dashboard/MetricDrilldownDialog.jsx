import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import DataInspector from '../common/DataInspector';
import { calculateProjectFinancials } from '@/lib/projectFinancials';
import PeriodMetricConfig from '@/components/dashboard/PeriodMetricConfig';

export default function MetricDrilldownDialog({ 
  open, 
  onOpenChange, 
  metricKey, 
  sales, 
  projects, 
  leads, 
  clients,
  dateRange,
  monthlyTotals,
  getSaleEffectiveDate,
  getProjectEffectiveDate
}) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorEntity, setInspectorEntity] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = async () => {
      try { const u = await base44.auth.me(); setIsAdmin(u?.role === 'admin'); } catch {}
    };
    check();
  }, []);

  const openInspector = (entityType, entityData) => {
    if (!isAdmin) return;
    const related = [];
    if (entityType === 'Project' && entityData.sale_id) {
      const sale = sales.find(s => s.id === entityData.sale_id);
      related.push({ label: 'Linked Sale', data: sale });
      if (sale?.client_id) related.push({ label: 'Client', data: clients.find(c => c.id === sale.client_id) });
    }
    if (entityType === 'Sale') {
      if (entityData.client_id) related.push({ label: 'Client', data: clients.find(c => c.id === entityData.client_id) });
      if (entityData.lead_id) related.push({ label: 'Lead', data: leads.find(l => l.id === entityData.lead_id) });
    }
    if (entityType === 'Lead' && entityData.client_id) {
      related.push({ label: 'Client', data: clients.find(c => c.id === entityData.client_id) });
    }
    setInspectorEntity({ type: entityType, id: entityData.id, data: entityData, related });
    setInspectorOpen(true);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.company_name || client?.contact_name || 'Unknown';
  };

  const config = useMemo(() => {
    if (['constructionRevenue', 'totalRevenue', 'grossProfit', 'margins'].includes(metricKey)) return PeriodMetricConfig({ metricKey, projects, sales, dateRange, monthlyTotals, getSaleEffectiveDate, getClientName });
    switch (metricKey) {
      case 'preconRevenue': {
        const closedPrecon = sales
          .filter(s => s.sale_type === 'preconstruction' && s.status === 'closed_won')
          .filter(s => {
            if (!dateRange.start || !dateRange.end) return true;
            const d = getSaleEffectiveDate(s);
            return d >= dateRange.start && d <= dateRange.end;
          })
          .sort((a, b) => new Date(b.close_date || b.created_date) - new Date(a.close_date || a.created_date));

        const monthlyData = dateRange.start && dateRange.end ? eachMonthOfInterval({ start: dateRange.start, end: dateRange.end }).map(month => {
          const mStart = startOfMonth(month);
          const mEnd = endOfMonth(month);
          const monthRevenue = closedPrecon
            .filter(s => { const d = getSaleEffectiveDate(s); return d >= mStart && d <= mEnd; })
            .reduce((sum, s) => sum + (s.contract_value || 0), 0);
          return { month: format(month, 'MMM yy'), revenue: monthRevenue / 1000 };
        }) : [];

        return {
          title: 'Pre-Construction Revenue Breakdown',
          formula: 'Sum of contract_value for all preconstruction sales with status "closed_won" whose phase_history start date falls within the selected date range.',
          items: closedPrecon,
          columns: ['Sale', 'Client', 'Contract Value', 'Close Date'],
          renderRow: (s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.title}</TableCell>
              <TableCell>{getClientName(s.client_id)}</TableCell>
              <TableCell className="font-semibold">${((s.contract_value || 0) / 1000).toFixed(0)}K</TableCell>
              <TableCell>{s.close_date ? format(new Date(s.close_date), 'MMM d, yyyy') : '-'}</TableCell>
            </TableRow>
          ),
          total: closedPrecon.reduce((s, sale) => s + (sale.contract_value || 0), 0),
          monthlyData,
          chartLabel: 'Revenue ($K)'
        };
      }

      case 'activeProjects': {
        const active = projects.filter(p => !['closed'].includes(p.status) && !['held', 'sold'].includes(p.inventory_status));
        return {
          title: 'Active Projects',
          formula: 'Count of all projects where status is NOT "closed". Not date-range filtered — shows current active state.',
          items: active,
          columns: ['Project', 'Client', 'Status', 'Contract Value', 'Start Date'],
          renderRow: (p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.title}</TableCell>
              <TableCell>{getClientName(p.client_id)}</TableCell>
              <TableCell><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{(p.status || '').replace(/_/g, ' ')}</span></TableCell>
              <TableCell>${((p.contract_value || 0) / 1000).toFixed(0)}K</TableCell>
              <TableCell>{p.start_date ? format(new Date(p.start_date), 'MMM d, yyyy') : '-'}</TableCell>
            </TableRow>
          ),
          total: active.reduce((s, p) => s + (p.contract_value || 0), 0)
        };
      }

      case 'activeSales': {
        const active = sales.filter(s => ['feasibility', 'design_material_selections', 'engineering_permits', 'pending_construction_sale'].includes(s.status));
        return {
          title: 'Active Pre-Construction Sales',
          formula: 'Count of sales in statuses: feasibility, design_material_selections, engineering_permits, or pending_construction_sale. Not date-range filtered.',
          items: active,
          columns: ['Sale', 'Client', 'Status', 'Contract Value', 'Est. Construction'],
          renderRow: (s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.title}</TableCell>
              <TableCell>{getClientName(s.client_id)}</TableCell>
              <TableCell><span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{(s.status || '').replace(/_/g, ' ')}</span></TableCell>
              <TableCell>${((s.contract_value || 0) / 1000).toFixed(0)}K</TableCell>
              <TableCell>${((s.estimated_construction_budget || 0) / 1000).toFixed(0)}K</TableCell>
            </TableRow>
          ),
          total: active.reduce((s, sale) => s + (sale.contract_value || 0), 0)
        };
      }

      case 'activeLeads': {
        const active = leads.filter(l => !['converted', 'disqualified'].includes(l.status));
        return {
          title: 'Active Leads',
          formula: 'Count of leads where status is NOT "converted" or "disqualified". Not date-range filtered.',
          items: active,
          columns: ['Lead', 'Client', 'Status', 'Source', 'Est. Precon Value'],
          renderRow: (l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.title}</TableCell>
              <TableCell>{getClientName(l.client_id)}</TableCell>
              <TableCell><span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">{(l.status || '').replace(/_/g, ' ')}</span></TableCell>
              <TableCell className="capitalize">{(l.source || '').replace(/_/g, ' ')}</TableCell>
              <TableCell>${((l.estimated_precon_value || 0) / 1000).toFixed(0)}K</TableCell>
            </TableRow>
          ),
          total: null
        };
      }

      case 'conversionRate': {
        const filteredL = leads.filter(l => {
          if (!dateRange.start || !dateRange.end) return true;
          return new Date(l.created_date) >= dateRange.start && new Date(l.created_date) <= dateRange.end;
        });
        const resolved = filteredL.filter(l => ['converted', 'disqualified'].includes(l.status));
        const converted = resolved.filter(l => l.status === 'converted').length;
        return {
          title: 'Lead Conversion Details',
          formula: `Converted leads / (Converted + Disqualified leads) in date range. ${converted} converted / ${resolved.length} resolved = ${resolved.length > 0 ? ((converted/resolved.length)*100).toFixed(1) : 0}%`,
          items: resolved,
          columns: ['Lead', 'Client', 'Status', 'Source', 'Created'],
          renderRow: (l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.title}</TableCell>
              <TableCell>{getClientName(l.client_id)}</TableCell>
              <TableCell>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${l.status === 'converted' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {l.status === 'converted' ? 'Converted' : 'Disqualified'}
                </span>
              </TableCell>
              <TableCell className="capitalize">{(l.source || '').replace(/_/g, ' ')}</TableCell>
              <TableCell>{format(new Date(l.created_date), 'MMM d, yyyy')}</TableCell>
            </TableRow>
          ),
          total: null
        };
      }

      case 'winRate': {
        const filteredL = leads.filter(l => {
          if (!dateRange.start || !dateRange.end) return true;
          return new Date(l.created_date) >= dateRange.start && new Date(l.created_date) <= dateRange.end;
        });
        const proposals = filteredL.filter(l => (l.status_history || []).some(h => h.status === 'preconstruction_proposal'));
        const won = proposals.filter(l => l.status === 'converted').length;
        return {
          title: 'Win Rate Details (After Proposal)',
          formula: `Leads that reached "preconstruction_proposal" stage and then converted / total that reached proposal. ${won} won / ${proposals.length} proposals = ${proposals.length > 0 ? ((won/proposals.length)*100).toFixed(1) : 0}%`,
          items: proposals,
          columns: ['Lead', 'Client', 'Status', 'Source', 'Created'],
          renderRow: (l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.title}</TableCell>
              <TableCell>{getClientName(l.client_id)}</TableCell>
              <TableCell>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${l.status === 'converted' ? 'bg-emerald-100 text-emerald-700' : l.status === 'disqualified' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {l.status === 'converted' ? 'Won' : l.status === 'disqualified' ? 'Lost' : 'Active'}
                </span>
              </TableCell>
              <TableCell className="capitalize">{(l.source || '').replace(/_/g, ' ')}</TableCell>
              <TableCell>{format(new Date(l.created_date), 'MMM d, yyyy')}</TableCell>
            </TableRow>
          ),
          total: null
        };
      }

      case 'avgProjectSize': {
        const closedCon = projects.filter(p => p.project_type === 'construction' && p.status === 'closed')
          .filter(p => { if (!dateRange.start || !dateRange.end) return true; const d = getProjectEffectiveDate(p); return d >= dateRange.start && d <= dateRange.end; })
          .sort((a, b) => (b.contract_value || 0) - (a.contract_value || 0));
        const totalVal = closedCon.reduce((s, p) => s + (p.contract_value || 0), 0);
        const avg = closedCon.length > 0 ? totalVal / closedCon.length : 0;
        return {
          title: 'Average Project Size',
          formula: `Sum of contract_value / count of closed construction projects in date range. $${(totalVal/1000).toFixed(0)}K / ${closedCon.length} projects = $${(avg/1000).toFixed(0)}K avg`,
          items: closedCon,
          columns: ['Project', 'Client', 'Contract Value', 'Margin %', 'Closed Date'],
          renderRow: (p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.title}</TableCell>
              <TableCell>{getClientName(p.client_id)}</TableCell>
              <TableCell className="font-semibold">${((p.contract_value || 0) / 1000).toFixed(0)}K</TableCell>
              <TableCell>{(p.actual_margin || 0).toFixed(1)}%</TableCell>
              <TableCell>{p.actual_completion_date ? format(new Date(p.actual_completion_date), 'MMM d, yyyy') : '-'}</TableCell>
            </TableRow>
          ),
          total: totalVal
        };
      }

      default:
        return null;
    }
  }, [metricKey, sales, projects, leads, clients, dateRange, monthlyTotals]);

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>

        {/* Formula / Calculation Explanation */}
        {config.formula && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">How this is calculated</p>
            <p className="text-xs text-slate-700 leading-relaxed">{config.formula}</p>
          </div>
        )}

        {config.total !== null && config.total !== undefined && (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border border-amber-200 mb-2">
            <p className="text-sm text-slate-600">Total</p>
            <p className="text-3xl font-bold text-slate-900">${(config.total / 1000).toFixed(0)}K</p>
            <p className="text-xs text-slate-500">{config.items.length} items</p>
            {config._closedTotal != null && (
              <div className="flex gap-4 mt-2 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Closed: ${(config._closedTotal / 1000).toFixed(0)}K ({config._closedCount} projects)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Active recognized: ${(config._activeTotal / 1000).toFixed(0)}K ({config._activeCount} projects)
                </span>
              </div>
            )}
          </div>
        )}

        {config.monthlyData?.length > 0 && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <p className="text-sm font-medium text-slate-600 mb-3">Monthly Breakdown</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={config.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `$${value.toFixed(0)}K`} />
                  {config.stackedChart ? (
                    <>
                      <Bar dataKey="precon" stackId="a" fill="#3B82F6" name="Pre-Con ($K)" />
                      <Bar dataKey="construction" stackId="a" fill="#10B981" name="Construction ($K)" />
                    </>
                  ) : (
                    <Bar dataKey="revenue" fill="#F59E0B" name={config.chartLabel} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {config.items.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            {isAdmin && <p className="text-[10px] text-blue-400 px-3 pt-2">Admin: Click any row to inspect source data</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map(col => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.items.map(item => {
                  const entityType = item.project_type ? 'Project' : item.sale_type ? 'Sale' : item.lead_score !== undefined ? 'Lead' : item._type === 'precon' ? 'Sale' : item._type === 'construction' ? 'Project' : 'Project';
                  return (
                    <tr
                      key={item.id}
                      className={isAdmin ? 'cursor-pointer hover:bg-blue-50' : ''}
                      onClick={() => openInspector(entityType, item)}
                    >
                      {React.Children.map(config.renderRow(item).props.children, child => child)}
                    </tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-slate-400 py-8">No data for selected period</p>
        )}

        {/* Data Inspector */}
        {inspectorEntity && (
          <DataInspector
            open={inspectorOpen}
            onOpenChange={setInspectorOpen}
            entityType={inspectorEntity.type}
            entityId={inspectorEntity.id}
            entityData={inspectorEntity.data}
            relatedData={inspectorEntity.related}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}