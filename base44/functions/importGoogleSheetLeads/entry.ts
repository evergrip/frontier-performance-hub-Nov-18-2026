import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { spreadsheetId, cutoff, readSheetRows, prepareRows, readMatches, phoneKey, emailKey } from '../../shared/sheetLeadImport.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const payload = await req.json().catch(() => ({}));
    const dryRun = payload.dry_run !== false;
    const entities = base44.asServiceRole.entities;
    const { eligible, stats } = prepareRows(await readSheetRows(base44));
    const existingIds = new Set();
    for (let i = 0; i < eligible.length; i += 100) {
      const matches = await readMatches(entities.Lead, { external_lead_id: { $in: eligible.slice(i, i + 100).map(r => r.id) } });
      matches.forEach(r => existingIds.add(r.external_lead_id));
    }
    const pending = eligible.filter(r => !existingIds.has(r.id));
    const batch = pending.slice(0, 100);
    const summary = { cutoff, dry_run: dryRun, eligible: eligible.length, already_imported: eligible.length - pending.length, pending: pending.length, deferred: Math.max(0, pending.length - batch.length), skipped: stats, imported: 0, clients_created: 0 };
    if (!batch.length || dryRun) return Response.json(summary);
    const clauses = batch.flatMap(r => {
      const queries = [];
      if (r.email) queries.push({ email: { $in: [r.email, r.row['Email Address']] } });
      const digits = phoneKey(r.phone);
      if (digits) queries.push({ phone: { $regex: `^\\D*(?:1\\D*)?${digits.split('').join('\\D*')}\\D*$` } });
      if (!r.email && !digits) queries.push({ contact_name: r.contactName });
      return queries;
    });
    const clients = await readMatches(entities.Client, { $or: clauses });
    const byEmail = new Map(), byPhone = new Map(), byName = new Map();
    const indexClient = c => {
      if (c.email) byEmail.set(emailKey(c.email), c.id);
      if (phoneKey(c.phone)) byPhone.set(phoneKey(c.phone), c.id);
      if (!c.email && !phoneKey(c.phone)) byName.set(c.contact_name, c.id);
    };
    clients.forEach(indexClient);
    const findClient = r => (r.email && byEmail.get(r.email)) || (phoneKey(r.phone) && byPhone.get(phoneKey(r.phone))) || (!r.email && !phoneKey(r.phone) && byName.get(r.contactName));
    // Create only new clients; never edit any existing client or lead.
    const newClients = new Map();
    for (const r of batch) {
      if (!findClient(r) && !newClients.has(r.key)) newClients.set(r.key, { contact_name: r.contactName, ...(r.email ? { email: r.email } : {}), ...(r.phone ? { phone: r.phone } : {}), status: 'active' });
    }
    if (newClients.size) {
      const created = await entities.Client.bulkCreate([...newClients.values()]);
      created.forEach(indexClient);
      summary.clients_created = created.length;
    }
    const importedAt = new Date().toISOString();
    const leads = batch.map(r => {
      const clientId = findClient(r);
      if (!clientId) throw new Error('Unable to resolve a client for an import row.');
      return { client_id: clientId, title: `${r.contactName} - ${r.row.Source || 'Imported lead'}`, source: r.row.Source || 'Google Sheets', status: 'imported', lead_score: 50,
        status_history: [{ status: 'imported', entered_date: importedAt }], notes: `Original lead date: ${r.date}\nLead ID: ${r.id}\n\n${r.notes}`,
        external_lead_id: r.id, import_spreadsheet_id: spreadsheetId, source_lead_date: r.date, imported_at: importedAt };
    });
    const createdLeads = await entities.Lead.bulkCreate(leads);
    summary.imported = createdLeads.length;
    return Response.json(summary);
  } catch (error) {
    console.error('Google Sheet lead import failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}