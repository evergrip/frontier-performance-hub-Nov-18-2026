import { references, recorder } from './verificationLinks.ts';
import { number, near } from './verificationMath.ts';
export async function checkCommissions(entities, type, rows, add) {
  const [users, sales] = await Promise.all([references(entities, 'User', rows.map(r => r.user_id)), references(entities, 'Sale', rows.map(r => r.sale_id))]);
  let ledger = [], payouts = [];
  if (type === 'CommissionBank' && rows.length) {
    const ids = rows.map(r => r.user_id).filter(Boolean);
    const result = await entities.CommissionTransaction.aggregate({ query: { user_id: { $in: ids }, transaction_type: { $ne: 'phase_commission' } }, groupBy: 'user_id', sum: 'amount' });
    const paid = await entities.CommissionPayout.aggregate({ query: { user_id: { $in: ids }, status: 'paid' }, groupBy: 'user_id', sum: 'amount' });
    if (result.truncated || paid.truncated) throw new Error('Commission aggregation is truncated; review cannot safely finish.');
    ledger = result.rows; payouts = paid.rows;
  }
  let duplicates = [];
  if (type === 'CommissionTransaction' && rows.some(r => r.sale_id)) {
    const result = await entities.CommissionTransaction.aggregate({ query: { sale_id: { $in: rows.map(r => r.sale_id).filter(Boolean) }, transaction_type: 'sale_commission' }, groupBy: ['sale_id','user_id'], having: { count: { $gt: 1 } } });
    if (result.truncated) throw new Error('Duplicate commission results are truncated.');
    duplicates = result.rows;
  }
  for (const r of rows) {
    const emit = recorder(type, r, add, 'Commissions');
    if (type === 'CommissionRule') {
      for (const field of ['precon_phase_availability','construction_phase_availability']) {
        const phases = r[field] || [];
        if (phases.some(p => !near(number(p.available_percentage) + number(p.banked_percentage), 100, 0.1) || number(p.available_percentage) < 0 || number(p.available_percentage) > 100 || number(p.banked_percentage) < 0 || number(p.banked_percentage) > 100)) emit(`split-${field}`, 'Phase available and banked percentages do not form a valid 100% split.', 'Each phase split totals 100%', JSON.stringify(phases), 'high');
        if (new Set(phases.map(p => p.phase)).size !== phases.length) emit(`phase-duplicates-${field}`, 'Repeated phase definitions make payout rules ambiguous.', 'One definition per phase', 'Duplicate phase', 'high');
      }
      const tiers = [...(r.tiers || [])].sort((a,b) => number(a.min_volume) - number(b.min_volume));
      if (!tiers.length || tiers.some((t,i) => !Number.isFinite(Number(t.commission_rate)) || number(t.commission_rate) < 0 || number(t.commission_rate) > 100 || number(t.min_volume) < 0 || t.max_volume != null && number(t.max_volume) <= number(t.min_volume) || i > 0 && (tiers[i-1].max_volume == null || !near(t.min_volume, tiers[i-1].max_volume)))) emit('commission-tiers', 'Commission tier coverage is empty, invalid, overlapping, or has gaps.', 'Ordered contiguous tiers with valid rates', JSON.stringify(tiers), 'high', 'investigate');
      continue;
    }
    if (!users.has(r.user_id)) emit('commission-user', 'Commission record refers to a missing user.', 'Existing user', r.user_id || 'Missing user_id', 'high');
    if (type === 'CommissionBank') {
      const accounted = number(r.current_bank_balance) + number(r.available_balance) + number(r.total_paid_out);
      if (!near(r.total_earned, accounted)) emit('bank-conservation', 'Commission bank does not conserve earned funds.', `${number(r.total_earned).toFixed(2)} earned`, `${accounted.toFixed(2)} banked + available + paid`, 'high', 'invariant', { total_earned: r.total_earned, current_bank_balance: r.current_bank_balance, available_balance: r.available_balance, total_paid_out: r.total_paid_out });
      const earned = ledger.find(l => l.user_id === r.user_id)?.sum_amount || 0, paid = payouts.find(l => l.user_id === r.user_id)?.sum_amount || 0;
      if (!near(earned, r.total_earned)) emit('earned-ledger', 'Bank earnings differ from the saved non-phase transaction ledger.', earned, r.total_earned, 'high', 'investigate');
      if (!near(paid, r.total_paid_out)) emit('payout-ledger', 'Bank paid total differs from saved paid payout records; legacy history may be incomplete.', paid, r.total_paid_out, 'high', 'investigate');
      if (!users.get(r.user_id)?.commission_start_date) emit('anniversary-date', 'Anniversary-based sales tiers cannot be independently verified without a start date.', 'Commission start date', 'Missing', 'medium', 'investigate');
      if (number(r.current_bank_balance) < -0.02 || number(r.available_balance) < -0.02) emit('negative-bank', 'Bank contains negative balances; inspect releases and corrections.', 'Review negative balances', `${r.current_bank_balance} banked; ${r.available_balance} available`, 'high', 'investigate');
      continue;
    }
    if (r.sale_id && !sales.has(r.sale_id)) emit('commission-sale', 'Commission refers to a missing sale.', 'Existing Sale', r.sale_id, 'high');
    if (r.transaction_type === 'sale_commission') {
      const allocated = number(r.banked_amount) + number(r.immediate_payout_amount);
      if (r.banked_amount != null && !near(allocated, r.amount)) emit('transaction-conservation', 'Initial commission split does not equal its earned amount.', r.amount, allocated, 'high', 'invariant', { amount: r.amount, banked_amount: r.banked_amount, immediate_payout_amount: r.immediate_payout_amount });
      if (duplicates.some(d => d.sale_id === r.sale_id && d.user_id === r.user_id)) emit('duplicate-sale-commission', 'More than one initial commission exists for the same sale and user.', 'One initial earning entry, adjustments separately recorded', 'Multiple initial transactions', 'high', 'investigate');
      if (!r.verified) emit('unverified-commission', 'Commission has not completed existing manual admin verification.', 'Admin verification before relying on this amount', 'Unverified', 'medium', 'investigate');
    }
    if (r.transaction_type === 'phase_commission' && !near(r.amount, 0)) emit('phase-new-earnings', 'Phase releases should transfer funds rather than create new earnings.', 0, r.amount, 'high');
  }
}