import React from 'react';
import { Button } from '@/components/ui/button';
const money = value => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
export default function GpForecastAllocationRows({ row, months, onEdit }) {
  return <>
    <tr className="border-t border-border">
      <td rowSpan={2} className="p-2 min-w-48 align-top"><Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left" onClick={() => onEdit(row)}>{row.title}</Button></td>
      <td rowSpan={2} className="p-2 whitespace-nowrap align-top">{row.phase || 'Construction'}</td>
      <th scope="row" className="p-2 whitespace-nowrap font-medium">GP</th>
      {months.map(month => <td className="p-2 whitespace-nowrap" key={month.period}>{money(row.forecastMonths[month.period])}</td>)}
      <td className="p-2 font-semibold whitespace-nowrap">{money(row.forecastGrossProfit)}</td>
    </tr>
    <tr className="text-muted-foreground">
      <th scope="row" className="p-2 whitespace-nowrap font-medium">Revenue</th>
      {months.map(month => <td className="p-2 whitespace-nowrap" key={month.period}>{money(row.revenueMonths?.[month.period])}</td>)}
      <td className="p-2 font-semibold whitespace-nowrap">{money(row.allocatedRevenue)}</td>
    </tr>
  </>;
}