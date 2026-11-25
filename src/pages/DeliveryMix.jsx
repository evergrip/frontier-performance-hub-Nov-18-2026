import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PieChart } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasPageAccess, hasPermission } from '@/lib/permissions';
import { committed } from '@/lib/deliveryMix';
import { deliveryModel, deliveryRequest } from '@/lib/deliveryMixData';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JobEstimate from '@/components/deliveryMix/JobEstimate';
import OperationsAllocation from '@/components/deliveryMix/OperationsAllocation';
import CapacityForecast from '@/components/deliveryMix/CapacityForecast';
import Opportunities from '@/components/deliveryMix/Opportunities';
import CompanySummary from '@/components/deliveryMix/CompanySummary';

const tabs = [['estimate','Job Estimate'],['allocation','Operations Allocation'],['capacity','Capacity Forecast'],['opportunities','Opportunities'],['summary','Company Summary']];
export default function DeliveryMix() {
  const { user } = useAuth();
  const canView = hasPageAccess(user, 'DeliveryMix');
  const canEstimate = hasPermission(user, 'delivery_mix_estimate');
  const canOperate = hasPermission(user, 'delivery_mix_operations');
  const client = useQueryClient();
  const key = ['deliveryMix', user?.id];
  const query = useQuery({ queryKey:key, queryFn:() => deliveryRequest({ action:'load' }), enabled:canView, staleTime:30_000, retry:false });
  const model = useMemo(() => query.data && deliveryModel(query.data), [query.data]);
  const [selected, setSelected] = useState(null);
  const save = async payload => {
    const saved = await deliveryRequest(payload);
    await client.invalidateQueries({ queryKey:key });
    if (payload.action === 'estimate' && saved.id) setSelected(saved.id);
  };
  const refresh = async () => deliveryModel((await query.refetch({ throwOnError:true })).data);
  const job = model?.jobs.find(j => j.id === selected || (j.estimate && j.estimate.id === selected));
  const selectJob = id => setSelected(model.jobs.find(j => j.id === id)?.estimate?.id || id);
  return <div className="min-w-0 space-y-6">
    <header className="flex items-start gap-3"><PieChart className="mt-1 h-7 w-7 shrink-0 text-primary" aria-hidden /><div><h1 className="text-2xl font-bold md:text-3xl">Delivery Mix &amp; GP Forecast</h1><p className="mt-1 text-sm text-muted-foreground">Estimate job profitability and plan in-house crew capacity. CAD before HST unless noted.</p></div></header>
    {!canView ? <p role="alert">You do not have access to Delivery Mix.</p> : query.isPending ? <p role="status" className="text-muted-foreground">Loading delivery mix…</p> : query.isError ? <div className="space-y-2"><p role="alert" className="text-destructive">{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div> : <Tabs defaultValue="estimate" className="min-w-0">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">{tabs.map(([id,label]) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}</TabsList>
      <TabsContent value="estimate" className="mt-4"><JobEstimate key={job?.id || 'none'} jobs={model.jobs} job={job} onSelect={selectJob} canEstimate={canEstimate} canOperate={canOperate} capacity={model.capacity} subtrades={model.subtrades} save={save} /></TabsContent>
      <TabsContent value="allocation" className="mt-4"><OperationsAllocation jobs={model.jobs.filter(committed)} job={job && committed(job) ? job : null} onSelect={selectJob} scopes={model.scopes} capacity={model.capacity} canOperate={canOperate} save={save} refresh={refresh} /></TabsContent>
      <TabsContent value="capacity" className="mt-4"><CapacityForecast model={model} admin={user.role === 'admin'} canOperate={canOperate} save={save} /></TabsContent>
      <TabsContent value="opportunities" className="mt-4"><Opportunities scopes={model.scopes} /></TabsContent>
      <TabsContent value="summary" className="mt-4"><CompanySummary {...model} /></TabsContent>
    </Tabs>}
  </div>;
}