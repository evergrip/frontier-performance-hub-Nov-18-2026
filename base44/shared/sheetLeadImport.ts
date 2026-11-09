export const spreadsheetId = '1yoSm9mji2lviLYy1jrb8Q4Qm5QOzaLwMj0QtVTZ7M2U';
export const cutoff = '2026-11-01';
export const phoneKey = (value) => String(value || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
export const emailKey = (value) => String(value || '').trim().toLowerCase();

export async function readSheetRows(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
  const headers = { Authorization: `Bearer ${accessToken}` };
  const root = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const meta = await fetch(`${root}?fields=sheets.properties`, { headers, signal: AbortSignal.timeout(15000) });
  if (!meta.ok) throw new Error(`Google Sheets access failed (${meta.status})`);
  const sheet = (await meta.json()).sheets.find(s => s.properties.sheetId === 106728111);
  if (!sheet) throw new Error('The selected source tab no longer exists.');
  const range = encodeURIComponent(`'${sheet.properties.title.replace(/'/g, "''")}'!A:N`);
  const response = await fetch(`${root}/values/${range}?valueRenderOption=FORMATTED_VALUE`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Reading sheet rows failed (${response.status})`);
  const [columns = [], ...rows] = (await response.json()).values || [];
  const required = ['Source', 'Date', 'First Name', 'Last Name', 'Email Address', 'Phone Number', 'Message', 'Additional Notes', 'Sales person', 'status', 'Comment', 'Date of comment', 'Hit count', 'Lead ID'];
  if (!required.every(c => columns.includes(c))) throw new Error('Source columns changed; import stopped without modifying records.');
  return rows.map(row => Object.fromEntries(columns.map((c, i) => [c, String(row[i] ?? '').trim()])));
}

export function prepareRows(rows) {
  const seen = new Set();
  const stats = { before_cutoff: 0, invalid_date: 0, missing_id: 0, repeated_id: 0 };
  const eligible = [];
  for (const row of rows) {
    const date = row.Date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) { stats.invalid_date++; continue; }
    if (date < cutoff) { stats.before_cutoff++; continue; }
    const id = row['Lead ID'];
    if (!id) { stats.missing_id++; continue; }
    if (seen.has(id)) { stats.repeated_id++; continue; }
    seen.add(id);
    const name = [row['First Name'], row['Last Name']].filter(Boolean).join(' ');
    const usableName = name && !/^(not listed|unknown|n\/a)$/i.test(name);
    const contactName = usableName ? name : `${row.Source || 'Imported'} lead ${id.slice(0, 8)}`;
    const rawEmail = row['Email Address'];
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? emailKey(rawEmail) : '';
    const phone = row['Phone Number'];
    const key = email ? `email:${email}` : phoneKey(phone) ? `phone:${phoneKey(phone)}` : `name:${contactName}`;
    const notes = columnsForNotes.map(c => row[c] ? `${c}: ${row[c]}` : '').filter(Boolean).join('\n\n');
    eligible.push({ row, id, date, contactName, email, phone, key, notes });
  }
  return { eligible, stats };
}
const columnsForNotes = ['Message', 'Additional Notes', 'Sales person', 'status', 'Comment', 'Date of comment', 'Hit count', 'Email Address'];

export async function readMatches(entity, query) {
  let cursor;
  const rows = [];
  do {
    const page = await entity.filter(query, { limit: 100, cursor });
    rows.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return rows;
}