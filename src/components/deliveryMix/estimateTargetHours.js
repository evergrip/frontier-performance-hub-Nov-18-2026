export const TARGET_MARGIN = 45;

// Price is fixed. Remove the selected share of sub quotes, add its extras,
// and split the remaining labour budget by the quoted dollars being replaced.
export function estimateTargetHours({ price, baselineCogs, scopes }, rate) {
  const picked = scopes.map((scope, index) => ({
    index,
    share: scope.inhouse_feasible ? scope.inhouse_share / 100 : 0,
    quote: scope.sub_quote,
    extras: scope.inhouse_extra_materials,
  })).filter(scope => scope.share > 0);
  if (!(baselineCogs > 0)) return { reason: 'Enter the scope costs first.' };
  if (!(price > 0)) return { reason: 'Enter a valid contract price first.' };
  if (!picked.length) return { reason: 'Move the sliders for the scopes you plan to do in-house.' };
  if (!(rate > 0)) return { reason: 'Enter a labour rate above $0/hour.' };

  const savingsBeforeLabour = picked.reduce((sum, s) => sum + s.share * (s.quote - s.extras), 0);
  const budget = price * (100 - TARGET_MARGIN) / 100 - baselineCogs + savingsBeforeLabour;
  if (budget <= 1e-8) return { reason: 'This mix leaves no room for crew hours at 45% margin.' };
  const quoted = picked.reduce((sum, s) => sum + s.share * s.quote, 0);
  const weightOf = s => quoted > 0 ? s.quote : 1;
  const weight = picked.reduce((sum, s) => sum + s.share * weightOf(s), 0);
  const hours = new Map(picked.map(s => [s.index, Math.floor((budget / rate) * weightOf(s) / weight * 100) / 100]));
  if (picked.some(s => !(hours.get(s.index) > 0))) return { reason: 'At least one selected scope has no usable crew-hour budget; check its sub quote or adjust the mix.' };
  const crewHours = picked.reduce((sum, s) => sum + s.share * hours.get(s.index), 0);
  return { hours, crewHours };
}