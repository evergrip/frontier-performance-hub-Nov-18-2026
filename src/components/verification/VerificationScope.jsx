import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
const scopes = {
  Clients: 'Contact identity and linked client integrity.',
  Leads: 'Qualification range, conversion destination, reciprocal links and transition timestamps.',
  'Pre-Construction': 'Origin and handoff links, contract inputs, contributors, payment documents and forecast allocations.',
  Projects: 'Sale/client/type coherence, contract discrepancies, final margin, schedules, fiscal periods and sub/work splits.',
  Dashboard: 'Current October-start fiscal targets and shared construction financial inputs.',
  Reports: 'Fiscal settings, target assumptions and the same allocation/GP inputs used by the dashboard.',
  Commissions: 'Earned = banked + available + paid; ledger totals, split conservation, tier configuration and manual verification.',
  Surveys: 'Question/section/logic dependencies, weights, submitted counts and saved/recomputed scoring evidence.'
};
export default function VerificationScope() {
  return <Card><CardContent className="p-5 space-y-4"><details><summary className="cursor-pointer font-semibold">Check coverage and confirmed fixes</summary><div className="grid md:grid-cols-2 gap-4 pt-4">{Object.entries(scopes).map(([area,text]) => <div key={area}><h3 className="text-sm font-semibold">{area}</h3><p className="text-xs text-muted-foreground">{text}</p></div>)}</div><div className="border-t mt-4 pt-4 text-sm space-y-2"><p className="font-semibold">Corrections applied to future calculations</p><ul className="list-disc pl-5 text-muted-foreground space-y-1"><li>Closed-project GP uses actual costs rather than an outdated forecast margin.</li><li>Zero-percent banked splits remain zero; unrelated or inactive commission rules are not selected.</li><li>Phase releases use the incremental amount needed to reach cumulative availability, not a repeated full release.</li><li>Bank rebuild calculations deduct funds already paid; existing balances are not rebuilt by this audit.</li><li>Survey scoring respects zero weights, deduplicates checkbox answers, and excludes hidden follow-ups.</li></ul></div></details>
    <p className="text-xs text-muted-foreground">These are deterministic checks of saved evidence, not a certification of every workflow. A live scan is not a transactional snapshot. Historical policies, survey revisions, concurrent retries, and browser interactions may need additional review. “No findings” means no issue was detected by these rules, not that every amount is proven correct.</p>
  </CardContent></Card>;
}