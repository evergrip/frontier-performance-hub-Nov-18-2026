import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const headers = ['Lead ID', 'Lead', 'Source', 'Client Company', 'Client Contact', 'Client Email', 'Client Phone', 'Client Address', 'Disqualified Date', 'Disqualification Reason', 'Lead Notes'];
const csvRow = (cells) => cells.map(value => {
  const text = String(value ?? '');
  const safe = /^[\s\uFEFF]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}).join(',');

async function downloadDisqualifiedLeads() {
  const rows = [csvRow(headers)];
  let cursor;
  do {
    const page = await base44.entities.Lead.filter({ status: 'disqualified' }, { sort: '-created_date', limit: 100, cursor });
    const ids = [...new Set(page.items.map(lead => lead.client_id).filter(Boolean))];
    const clients = ids.length ? (await base44.entities.Client.filter({ id: { $in: ids } }, { limit: ids.length })).items : [];
    const byId = new Map(clients.map(client => [client.id, client]));
    for (const lead of page.items) {
      const client = byId.get(lead.client_id);
      const date = (lead.status_history || []).findLast(entry => entry.status === 'disqualified')?.entered_date;
      rows.push(csvRow([lead.id, lead.title, lead.source, client?.company_name, client?.contact_name, client?.email, client?.phone, client?.address, date, lead.disqualification_reason, lead.notes]));
    }
    if (page.has_more && (!page.next_cursor || page.next_cursor === cursor)) throw new Error('Incomplete lead export');
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  if (rows.length === 1) return 0;
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `disqualified-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length - 1;
}

export default function DisqualifiedLeadExport() {
  const exportCsv = useMutation({ mutationFn: downloadDisqualifiedLeads });
  return <div className="flex flex-col items-start sm:items-end">
    <Button type="button" variant="outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()} title="Download all disqualified leads, regardless of search">
      <Download aria-hidden="true" />{exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
    </Button>
    {exportCsv.isError && <span role="alert" className="mt-1 text-xs text-destructive">Export failed. Please try again.</span>}
    {exportCsv.isSuccess && exportCsv.data === 0 && <span role="status" className="mt-1 text-xs">No disqualified leads to export.</span>}
  </div>;
}