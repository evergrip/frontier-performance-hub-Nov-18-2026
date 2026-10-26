import React, { useState } from 'react';
import OmittedRevenueProjectsDialog from '@/components/dashboard/OmittedRevenueProjectsDialog';

const money = value => `$${Math.round(value).toLocaleString()}`;

export default function AnnualRevenueRequirement({ forecast, target, fiscalYear }) {
  const [omittedOpen, setOmittedOpen] = useState(false);
  if (!forecast) return null;
  const available = Number.isFinite(forecast.requiredRevenue) && forecast.requiredRevenue > 0;
  return <section className="rounded-md border border-border bg-background p-4 space-y-2" aria-label="Annual Forecasted Revenue to Reach Gross Profit Goals">
    <h3 className="text-sm font-medium text-muted-foreground">Annual Forecasted Revenue to Reach Gross Profit Goals</h3>
    <p className="text-xl font-semibold text-foreground">{available ? money(forecast.requiredRevenue) : 'Not available'}</p>
    <p className="text-xs text-muted-foreground">{available
      ? `${money(target)} GP goal ÷ ${(forecast.weightedMargin * 100).toFixed(2)}% contract-value-weighted margin · ${forecast.projectCount} construction project(s).`
      : !(target > 0) ? 'Set a positive Gross Profit goal for this fiscal year.' : 'Add included construction projects with positive contract values, positive margin estimates, and allocations in this fiscal year.'}</p>
    <p className="text-xs text-muted-foreground">Open construction projects allocated to this fiscal year only; excludes pre-construction and closed jobs. Uses project margin, or the linked sale’s estimated margin when no project margin is set. Each project is weighted by its full contract value.</p>
    {forecast.skippedCount > 0 && <button type="button" className="text-left text-xs text-destructive underline underline-offset-2" onClick={() => setOmittedOpen(true)}>{forecast.skippedCount} construction project(s) omitted for missing, zero, or invalid contract values or margins. View and edit projects.</button>}
    {omittedOpen && <OmittedRevenueProjectsDialog fiscalYear={fiscalYear} onClose={() => setOmittedOpen(false)} />}
  </section>;
}