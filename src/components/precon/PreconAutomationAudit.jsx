export default function PreconAutomationAudit() {
  return <details className="border border-border bg-card p-5 text-sm">
    <summary className="cursor-pointer font-heading font-semibold">Legacy automation audit · 18 Nov 2026</summary>
    <dl className="mt-3 space-y-3">
      <div><dt className="font-semibold">Pre-Con Co-Pilot Daily Monitor</dt><dd>Inactive after consecutive failures. Its configured schedule is 10:00 UTC, despite the description saying 7:00 AM. Recent runs failed before the monitoring function ran. Alert generation, budget drift checks and affected records could not be verified.</dd></div>
      <div><dt className="font-semibold">PreCon Auto Handoff on Lead Conversion</dt><dd>Active. It triggers when a Lead update changes the linked Sale to a non-empty value, including a replacement link. Recent runs failed before the handoff function ran. Creation of the first five progress records and duplicate protection could not be verified.</dd></div>
      <div><dt className="font-semibold">PreCon Financial Sync to Lead</dt><dd>Inactive after migration activation failed; no runs were found. It refers to a progress record type and backend function not found in the inspected source. Which financial fields would be updated and how conflicts would be handled could not be verified.</dd></div>
    </dl>
    <p className="mt-3 text-muted-foreground">The rehearsal does not call or replace these automations. Enforcing readiness across the existing construction conversion paths requires a separate production approval and implementation.</p>
  </details>;
}