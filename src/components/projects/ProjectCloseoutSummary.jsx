import React from 'react';
export default function ProjectCloseoutSummary({ project, form, threshold = 3 }) {
  const costs = Number(form.actual_costs), contract = Number(project.contract_value || 0);
  const variance = contract ? Math.abs((costs - contract) / contract * 100) : 0;
  const money = value => `$${(value / 1000).toFixed(0)}k`;
  return <div className="p-3 bg-accent border border-border rounded-lg">
    <h4 className="text-xs font-semibold mb-2">Final Project Summary</h4>
    <dl className="text-xs space-y-1">
      <div className="flex justify-between"><dt>Original Contract Value:</dt><dd className="font-semibold">{money(contract)}</dd></div>
      <div className="flex justify-between"><dt>Actual Project Costs:</dt><dd className="font-semibold">{money(costs)}</dd></div>
      <div className="flex justify-between"><dt>Contract Revenue:</dt><dd className="font-semibold">{money(contract)}</dd></div>
      <div className="flex justify-between border-t border-border pt-1 font-bold"><dt>Gross Profit:</dt><dd>{money(contract - costs)}</dd></div>
      <div className="flex justify-between font-bold"><dt>Margin:</dt><dd>{Number(form.actual_margin).toFixed(2)}%</dd></div>
      {variance > threshold && <div className="flex justify-between text-destructive border-t border-border pt-1 font-bold"><dt>Variance:</dt><dd>{variance.toFixed(2)}% (exceeds {threshold}%)</dd></div>}
    </dl>
  </div>;
}