import test from 'node:test';
import assert from 'node:assert/strict';
import { closeoutTotals, closeoutCostVariance } from '../projects/closeoutFinancials.js';
const standard = () => ({ project: { contract_value: 100000 }, totalRevenue: 100000, totalGP: 25000, baselineCosts: 75000, rows: [{ period: '2026-10', revenue: 40000, gp: 10000 }, { period: '2026-11', revenue: 60000, gp: 15000 }] });
test('saved allocations approve without reentering costs or margin', () => {
  assert.deepEqual(closeoutTotals(standard()), { revenue: 100000, gp: 25000, costs: 75000, margin: 25, ready: true, error: '' });
  assert.equal(closeoutCostVariance(standard()), 0);
});
test('changing final GP updates costs and margin consistently', () => {
  const state = standard(); state.totalGP = 20000; state.rows[1].gp = 10000;
  const totals = closeoutTotals(state);
  assert.equal(totals.ready, true); assert.equal(totals.costs, 80000); assert.equal(totals.margin, 20);
  assert.ok(Math.abs(closeoutCostVariance(state) - 6.6666666667) < 0.0001);
});
test('partial allocations cannot be finalized', () => {
  const state = standard(); state.rows.pop(); assert.equal(closeoutTotals(state).ready, false);
});
test('balanced final results override the expected contract revenue', () => {
  const state = standard(); state.totalRevenue = 90000; state.rows[1].revenue = 50000;
  const totals = closeoutTotals(state);
  assert.equal(totals.ready, true); assert.equal(totals.revenue, 90000); assert.equal(totals.costs, 65000);
});
test('final revenue may exceed the original contract when all dollars are allocated', () => {
  const state = standard(); state.totalRevenue = 110000; state.rows[1].revenue = 70000;
  assert.equal(closeoutTotals(state).ready, true);
});
test('independent monthly costs and realized GP are preserved without double deduction', () => {
  const state = { project: { recognition_mode: 'monthly_actual', contract_value: 100000 }, baselineCosts: 70000, rows: [{ period: '2026-10', costs: 70000, revenue: 0, gp: 0 }, { period: '2026-11', costs: 0, revenue: 100000, gp: 25000 }] };
  const totals = closeoutTotals(state); assert.equal(totals.ready, true); assert.equal(totals.costs, 70000); assert.equal(totals.gp, 25000); assert.equal(totals.margin, 25);
});
test('missing data, duplicate months and blank amounts block approval', () => {
  assert.equal(closeoutTotals(null).ready, false);
  const state = standard(); state.rows[1].period = '2026-10'; assert.equal(closeoutTotals(state).ready, false);
  state.rows[1].period = '2026-11'; state.rows[1].gp = ''; assert.equal(closeoutTotals(state).ready, false);
});