import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../../../', import.meta.url);
const load = async path => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, root), 'utf8')).toString('base64')}`);
const math = await load('base44/shared/verificationMath.ts');
const scoring = await load('base44/shared/surveyScoring.ts');
const financials = await load('src/lib/projectFinancials.js');
const fiscal = await load('src/components/utils/fiscalYear.jsx');
let periodSource = await readFile(new URL('src/components/utils/projectPeriod.js', root), 'utf8');
const moduleURL = async path => `data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, root), 'utf8')).toString('base64')}`;
periodSource = periodSource.replace("@/lib/projectFinancials", await moduleURL('src/lib/projectFinancials.js')).replace("@/components/utils/fiscalYear", await moduleURL('src/components/utils/fiscalYear.jsx'));
const period = await import(`data:text/javascript;base64,${Buffer.from(periodSource).toString('base64')}`);
test('October fiscal start uses the starting calendar year', () => {
  assert.equal(fiscal.getCurrentFiscalYear(10, new Date(2026,8,30)), 2025);
  assert.equal(fiscal.getCurrentFiscalYear(10, new Date(2026,9,1)), 2026);
  assert.equal(fiscal.getCurrentFiscalYear(10, new Date(2027,0,1)), 2026);
});
test('closed project GP uses actual costs, not its stale forecast margin', () => {
  const p = { status: 'closed', contract_value: 1000, actual_costs: 700, actual_margin: 45, monthly_revenue_allocations: [{year:2026,month:9,percentage:40},{year:2026,month:10,percentage:60}] };
  const f = period.projectPeriodFinancials(p, { start: new Date(2026,9,1), end: new Date(2027,8,30) });
  assert.equal(f.revenue, 600); assert.equal(f.grossProfit, 180); assert.equal(f.costs, 420);
  assert.equal(financials.calculateProjectFinancials(p).grossProfit, 300);
});
test('cross-year allocations reconcile without charging the full contract twice', () => {
  const p = {status:'closed',contract_value:1000,actual_costs:700,monthly_revenue_allocations:[{period:'2026-09',percentage:40},{period:'2026-10',percentage:60}]};
  const first = period.projectPeriodFinancials(p,{start:new Date(2025,9,1),end:new Date(2026,8,30)});
  const second = period.projectPeriodFinancials(p,{start:new Date(2026,9,1),end:new Date(2027,8,30)});
  assert.equal(first.revenue + second.revenue,1000); assert.equal(first.grossProfit + second.grossProfit,300);
});
test('allocations reject over-allocation, duplicate months and conflicting period keys', () => {
  assert.ok(math.allocationIssues([{year:2026,month:10,percentage:101}]).length);
  assert.ok(math.allocationIssues([{year:2026,month:10,percentage:50},{period:'2026-10',percentage:50}]).length);
  assert.equal(math.periodOf({period:'2026-10',year:2027,month:10}),null);
  assert.deepEqual(math.allocationIssues([{period:'2026-09',percentage:40},{period:'2026-10',percentage:60}], 'percentage',true),[]);
});
test('cumulative phase release subtracts initial availability and earlier releases', () => {
  assert.equal(math.phaseRelease(1000,250,0,50),250);
  assert.equal(math.phaseRelease(1000,250,250,50),0);
  assert.equal(math.phaseRelease(1000,250,250,100),500);
  assert.equal(math.phaseRelease(1000,250,750,100),0);
});
test('bank rebuild deducts already paid funds exactly once', () => assert.equal(math.availableAfterPayouts(700,200),500));
test('wrong-type and inactive commission rules cannot silently apply', () => {
  assert.equal(math.selectCommissionRule([{sale_type:'preconstruction'}],'construction'),undefined);
  assert.equal(math.selectCommissionRule([{sale_type:'construction',is_active:false}],'construction'),undefined);
});
test('zero weight excludes a question from both score and maximum', () => {
  const s = scoring.calculateScores({questions:[{id:'a',type:'rating',points:5,weight:0}]},{a:5});
  assert.equal(s.totalScore,0); assert.equal(s.maxPossibleScore,0);
});
test('checkbox duplicates cannot multiply the score', () => assert.equal(scoring.scoreQuestion({type:'checkbox',option_scores:{a:3,b:2}},['a','a']).questionScore,3));
test('hidden follow-ups neither inflate the denominator nor score stale answers', () => {
  const survey = {headings:[{id:'h'}],questions:[{id:'a',type:'rating',points:5,category_id:'h'},{id:'b',type:'rating',points:5,is_followup:true,category_id:'h'}],section_followup_rules:[{heading_id:'h',threshold_score:4,followup_question_ids:['b']}]};
  const hidden = scoring.calculateScores(survey,{a:2,b:5}); assert.equal(hidden.totalScore,2); assert.equal(hidden.maxPossibleScore,5);
  const visible = scoring.calculateScores(survey,{a:4,b:3}); assert.equal(visible.totalScore,7); assert.equal(visible.maxPossibleScore,10);
});