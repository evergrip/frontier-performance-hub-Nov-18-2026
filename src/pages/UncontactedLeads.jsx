import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { hasPermission } from '@/lib/permissions';
import { toast } from 'sonner';
import EditLeadDialog from '@/components/leads/EditLeadDialog';
import UncontactedLeadColumn from '@/components/leads/UncontactedLeadColumn';
import DisqualifyUncontactedLeadDialog from '@/components/leads/DisqualifyUncontactedLeadDialog';
import { Link } from 'react-router-dom';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Button } from '@/components/ui/button';

function sourceLabel(source) {
  const value = (source || '').trim();
  if (!value) return 'No Source';
  if (/\bphone\b/i.test(value)) return 'Phone Leads';
  if (/\bweb(?:site)?\b/i.test(value)) return 'Website Leads';
  return value.replace(/_/g, ' ');
}

export default function UncontactedLeads() {
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState(null);
  const [open, setOpen] = useState(false);
  const [disqualifyLead, setDisqualifyLead] = useState(null);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const { data: user, isLoading: loadingUser } = useQuery({ queryKey: ['uncontactedLeadUser'], queryFn: () => base44.auth.me() });
  const allowed = hasPermission(user, 'pipeline_leads');
  const scope = { status: 'imported', source: { $ne: 'Planning application leads' } };
  const { data: totals, isLoading, isError } = useQuery({
    queryKey: ['uncontactedSources', scope], enabled: !!user && allowed,
    queryFn: () => base44.entities.Lead.aggregate({ query: scope, groupBy: 'source' }),
  });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), enabled: allowed });
  const { data: users = [] } = useQuery({ queryKey: ['salespeople'], queryFn: async () => (await base44.functions.invoke('listSalespeople', {})).data?.salespeople || [], enabled: allowed });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['uncontactedSources'] }); queryClient.invalidateQueries({ queryKey: ['uncontactedLeads'] }); queryClient.invalidateQueries({ queryKey: ['leads'] }); };
  const move = useMutation({
    mutationFn: async lead => {
      const current = await base44.entities.Lead.get(lead.id);
      if (current.status !== 'imported') throw new Error('This lead has already moved out of Uncontacted Leads.');
      if (!allowed) throw new Error('You do not have permission to manage leads.');
      const history = current.status_history?.length ? current.status_history : [{ status: 'imported', entered_date: current.created_date }];
      return base44.entities.Lead.update(current.id, { status: 'new_project_lead', status_history: [...history, { status: 'new_project_lead', entered_date: new Date().toISOString(), source: 'lead' }] });
    },
    onSuccess: () => { refresh(); toast.success('Moved to Contacted Leads'); },
    onError: error => { refresh(); toast.error(error.message || 'Unable to move lead'); },
  });
  if (loadingUser) return <p>Loading leads...</p>;
  if (!allowed) return <p>You do not have permission to view leads.</p>;
  const groups = new Map();
  for (const row of totals?.rows || []) {
    const label = sourceLabel(row.source);
    const group = groups.get(label) || { label, sources: [], count: 0 };
    group.sources.push(row.source ?? null); group.count += row.count; groups.set(label, group);
  }
  const columns = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  return <div className="max-w-7xl mx-auto space-y-6">
    <div><h1 className="text-4xl font-bold text-foreground mb-2">Uncontacted Leads</h1><p className="text-lg text-muted-foreground">Review incoming leads by source and move them to the contacted pipeline when ready.</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" asChild><Link to="/PlanningApplicationLeads">Frontier Planning Application Leads</Link></Button><Button onClick={() => setAddLeadOpen(true)}>Add Lead</Button></div>
    <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} clients={clients} users={users} initialStatus="imported" />
    {isLoading && <p className="text-sm text-muted-foreground">Loading leads...</p>}
    {isError && <p className="text-sm text-destructive">Unable to load lead sources.</p>}
    {totals?.truncated && <p className="text-sm text-destructive">Some lead sources could not be displayed.</p>}
    {!isLoading && !isError && columns.length === 0 && <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">No uncontacted leads to show.</div>}
    {columns.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">{columns.map(group => <UncontactedLeadColumn key={group.label} group={group} scope={scope} clients={clients} users={users} onOpen={lead => { setSelectedLead(lead); setOpen(true); }} onContact={lead => move.mutate(lead)} onDisqualify={setDisqualifyLead} pending={move.isPending} />)}</div>}
    <EditLeadDialog open={open} onOpenChange={value => { setOpen(value); if (!value) refresh(); }} lead={selectedLead} clients={clients} users={users} onAdvance={lead => move.mutate(lead)} advanceLabel="Move to Contacted Leads" onDisqualify={setDisqualifyLead} />
    {disqualifyLead && <DisqualifyUncontactedLeadDialog key={disqualifyLead.id} lead={disqualifyLead} user={user} onClose={() => setDisqualifyLead(null)} onSuccess={refresh} />}
    <div className="text-center"><Link to="/DisqualifiedLeads" className="text-sm text-destructive underline underline-offset-4">View Disqualified Leads</Link></div>
  </div>;
}