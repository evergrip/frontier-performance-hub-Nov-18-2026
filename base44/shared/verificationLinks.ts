export async function references(entities, type, ids) {
  const distinct = [...new Set(ids.filter(Boolean))];
  if (!distinct.length) return new Map();
  if (type === 'User') return new Map((await entities.User.filter({ id: { $in: distinct } })).map(r => [r.id, r]));
  let cursor; const map = new Map();
  do {
    const page = await entities[type].filter({ id: { $in: distinct } }, { limit: 100, cursor });
    page.items.forEach(r => map.set(r.id, r)); cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return map;
}
export async function linkedReferences(entities, type, field, ids) {
  const distinct = [...new Set(ids.filter(Boolean))];
  if (!distinct.length) return [];
  let cursor; const rows = [];
  do { const page = await entities[type].filter({ [field]: { $in: distinct } }, { limit: 100, cursor }); rows.push(...page.items); cursor = page.has_more ? page.next_cursor : null; } while (cursor);
  return rows;
}
export function recorder(type, record, add, area, affected = [area]) {
  return (rule, summary, expected, observed, severity = 'medium', confidence = 'invariant', evidence = {}) => add({ fingerprint: `${type}:${record.id}:${rule}`, area, affected_areas: affected, entity_type: type, entity_id: record.id, record_title: record.title || record.contact_name || record.rule_name || record.full_name || `${type} ${record.id}`, rule, summary, expected: String(expected), observed: String(observed), severity, confidence, evidence });
}
export function historyCheck(record, field, statuses, emit) {
  const history = (record[field] || []).filter(h => statuses.includes(h.status));
  const latest = history.at(-1);
  if (latest && latest.status !== record.status) emit('history-status', 'Stored status disagrees with the latest applicable history entry.', record.status, latest.status, 'medium', 'investigate', { field, latest });
  if (history.some(h => !h.entered_date || !Number.isFinite(Date.parse(h.entered_date)))) emit('history-date', 'A transition has no usable timestamp.', 'Valid timestamp on each transition', 'Missing or invalid timestamp', 'medium', 'investigate');
}