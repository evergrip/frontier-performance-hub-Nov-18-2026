import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PlanningLeadInterest from '@/components/leads/PlanningLeadInterest';

export default function PlanningLeadsTable({ leads }) {
  const ids = [...new Set(leads.map(lead => lead.client_id).filter(Boolean))].sort();
  const clients = useQuery({
    queryKey: ['planningLeadClients', ids], enabled: ids.length > 0,
    queryFn: () => base44.entities.Client.filter({ id: { $in: ids } }, { limit: ids.length }),
  });
  const byId = new Map((clients.data?.items || []).map(client => [client.id, client]));
  return <div className="rounded-lg border bg-card overflow-x-auto">
    {clients.isError && <p role="alert" className="p-3 text-sm text-destructive">Unable to load contact details.</p>}
    <Table><TableHeader><TableRow>
      <TableHead>Planning lead</TableHead><TableHead>Contact</TableHead><TableHead>Postal address</TableHead><TableHead>Email / Phone</TableHead><TableHead>Follow-up interest</TableHead><TableHead>Pipeline stage</TableHead>
    </TableRow></TableHeader><TableBody>{leads.map(lead => {
      const client = byId.get(lead.client_id);
      return <TableRow key={lead.id}>
        <TableCell className="font-medium min-w-48">{lead.title}</TableCell>
        <TableCell>{client?.contact_name || (clients.isLoading ? 'Loading...' : 'Not recorded')}{client?.company_name && <p className="text-xs text-muted-foreground">{client.company_name}</p>}</TableCell>
        <TableCell className="min-w-40 whitespace-pre-line">{client?.address || 'Not recorded'}</TableCell>
        <TableCell><p>{client?.email || 'No email'}</p><p className="text-xs text-muted-foreground">{client?.phone || 'No phone'}</p></TableCell>
        <TableCell><PlanningLeadInterest lead={lead} /></TableCell>
        <TableCell>{lead.status?.replaceAll('_', ' ')}</TableCell>
      </TableRow>;
    })}</TableBody></Table>
  </div>;
}