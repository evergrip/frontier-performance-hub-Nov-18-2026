import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare } from 'lucide-react';
import LeadNoteHistory from '@/components/leads/LeadNoteHistory';
import LeadTaskForm from '@/components/leads/LeadTaskForm';
import LeadTaskList from '@/components/leads/LeadTaskList';
import resolvePipelineActivity from '@/components/leads/resolvePipelineActivity';

export default function LeadActivityButton({ lead: originalLead, sale, project, users = [] }) {
  const [open, setOpen] = useState(false);
  const context = useQuery({ queryKey: ['pipelineActivity', originalLead?.id, sale?.id, project?.id], queryFn: () => resolvePipelineActivity({ lead: originalLead, sale, project }), enabled: open });
  const lead = context.data;
  const { data: user, isLoading, isError } = useQuery({ queryKey: ['leadActivityUser'], queryFn: () => base44.auth.me(), enabled: open, staleTime: 300000 });
  return <div onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onSubmit={event => event.stopPropagation()}>
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}><MessageSquare className="h-4 w-4" />Notes & Follow-ups</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Notes & Follow-ups</DialogTitle></DialogHeader>
        <p className="text-sm font-medium break-words">{originalLead?.title || sale?.title || project?.title}</p>
        {(isLoading || context.isLoading) && <p className="text-sm text-muted-foreground">Loading history...</p>}
        {(isError || context.isError) && <p role="alert" className="text-sm text-destructive">Unable to load the connected history. Please check the originating lead and sale links or try again.</p>}
        {user && lead && !context.isError && <Tabs defaultValue="notes">
          <TabsList className="w-full"><TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger><TabsTrigger value="tasks" className="flex-1">Follow-up Tasks</TabsTrigger></TabsList>
          <TabsContent value="notes"><LeadNoteHistory key={lead.id} lead={lead} user={user} /></TabsContent>
          <TabsContent value="tasks" className="space-y-4"><LeadTaskForm key={lead.id} lead={lead} user={user} users={users} /><LeadTaskList lead={lead} user={user} /></TabsContent>
        </Tabs>}
      </DialogContent>
    </Dialog>
  </div>;
}