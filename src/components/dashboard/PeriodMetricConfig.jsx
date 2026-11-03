import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { projectPeriodFinancials } from '@/components/utils/projectPeriod';
import ProjectProfitActions from '@/components/projects/ProjectProfitActions';

export default function PeriodMetricConfig({ metricKey, projects, sales, dateRange, monthlyTotals = {}, getSaleEffectiveDate, getClientName }) {
  const financial = projects.filter(p => p.project_type === 'construction').map(p => ({ ...p, _period: projectPeriodFinancials(p, dateRange, false, 10, monthlyTotals[p.id]) })).filter(p => p._period.percentage > 0 || metricKey === 'grossProfit');
  const precon = metricKey === 'totalRevenue' ? sales.filter(s => s.sale_type === 'preconstruction' && s.status === 'closed_won' && (!dateRange.start || getSaleEffectiveDate(s) >= dateRange.start) && (!dateRange.end || getSaleEffectiveDate(s) <= dateRange.end)).map(s => ({ ...s, _period: { revenue: Number(s.contract_value) || 0, costs: 0, grossProfit: 0, grossMargin: 0 } })) : [];
  const items = [...financial, ...precon];
  const revenue = financial.reduce((s, p) => s + p._period.revenue, 0), profit = financial.reduce((s, p) => s + p._period.grossProfit, 0);
  const title = { constructionRevenue: 'Construction Revenue Breakdown', totalRevenue: 'Total Revenue Breakdown', grossProfit: 'Gross Profit by Project', margins: 'Gross Margin by Project' }[metricKey];
  return {
    title,
    formula: `Independent cost and realized-GP entries use their recorded months, including the current month, without deducting costs twice. Unsold FBG inventory has costs but no GP. Other projects use monthly contract shares in the selected period, regardless of project start year. Active work is recognized only through completed months; future allocations remain forecast. Closed projects with schedules are never counted again at full contract value. Active jobs with saved monthly dollar allocations use the GP and revenue entered for those months, not the project's margin field. Other jobs use recorded margin, otherwise revenue less recorded costs. Weighted construction margin: ${revenue ? (profit / revenue * 100).toFixed(1) : '0.0'}%.`,
    items,
    columns: ['Project / Sale', 'Client', 'Status', 'Period Revenue', 'Costs incurred', 'Period GP', 'Margin', 'Allocations'],
    total: metricKey === 'margins' ? null : metricKey === 'grossProfit' ? profit : items.reduce((s, p) => s + p._period.revenue, 0),
    renderRow: p => <TableRow key={p.id}>
      <TableCell className="font-medium">{p.title}</TableCell><TableCell>{getClientName(p.client_id)}</TableCell>
      <TableCell>{p.inventory_status === 'held' ? 'FBG inventory · unsold' : p.inventory_status === 'sold' ? 'FBG inventory · sold' : (p.status || '').replace(/_/g, ' ')}</TableCell>
      <TableCell>${Math.round(p._period.revenue).toLocaleString()}</TableCell>
      <TableCell>${Math.round(p._period.costs).toLocaleString()}</TableCell>
      <TableCell>{p.sale_type ? '—' : `$${Math.round(p._period.grossProfit).toLocaleString()}`}</TableCell>
      <TableCell>{p.sale_type ? '—' : `${p._period.grossMargin.toFixed(1)}%`}</TableCell>
      <TableCell>{!p.sale_type && <ProjectProfitActions project={p} />}</TableCell>
    </TableRow>
  };
}