import React, { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ProjectRecognitionDialog from '@/components/projects/ProjectRecognitionDialog';
const money = value => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
export default function FbgInventorySection({ user }) {
  const [status, setStatus] = useState('held'), [editing, setEditing] = useState(undefined);
  const saleIds = useQuery({ queryKey: ['inventorySaleIds', user?.id], enabled: !!user && user.role !== 'admin', queryFn: async () => {
    const ids = []; let cursor;
    do { const page = await base44.entities.Sale.filter({ assigned_to: user.id }, { limit: 100, fields: ['id'], cursor }); ids.push(...page.items.map(sale => sale.id)); cursor = page.has_more ? page.next_cursor : null; } while (cursor);
    return ids;
  } });
  const query = useInfiniteQuery({ queryKey: ['inventoryProjects', status, user?.id, saleIds.data], enabled: !!user && (user.role === 'admin' || saleIds.isSuccess),
    initialPageParam: undefined, queryFn: ({ pageParam }) => base44.entities.Project.filter({ inventory_status: status, ...(user.role !== 'admin' ? { $or: [{ project_manager_id: user.id }, { sale_id: { $in: saleIds.data } }] } : {}) }, { limit: 50, sort: '-updated_date', cursor: pageParam }), getNextPageParam: page => page.has_more ? page.next_cursor : undefined });
  return <section className="space-y-4 rounded-md border border-border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">FBG Inventory</h2><p className="text-sm text-muted-foreground">Costs stay in the months incurred. Unsold inventory carries no GP.</p></div><Button onClick={() => setEditing(null)}>New inventory project</Button></div>
    <p className="text-xs text-muted-foreground">Use “Move to FBG Inventory” on an active project card to convert its history and retain recorded costs.</p>
    <select aria-label="Inventory status filter" className="rounded-md border border-input bg-background p-2" value={status} onChange={e => setStatus(e.target.value)}><option value="held">Held inventory</option><option value="sold">Sold inventory</option></select>
    {saleIds.error ? <p role="alert" className="text-destructive">{saleIds.error.message}</p> : query.isPending ? <p role="status">Loading inventory…</p> : query.error ? <p role="alert" className="text-destructive">{query.error.message}</p> : <>
      {query.data.pages[0].items.length === 0 && <p className="text-muted-foreground">No {status} inventory projects.</p>}
      {query.data.pages.flatMap(page => page.items).map(project => <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3"><div><h3 className="font-medium">{project.title}</h3><p className="text-sm text-muted-foreground">Recorded costs {money((project.monthly_actual_allocations || []).reduce((sum, row) => sum + Number(row.costs || 0), 0))}{status === 'sold' ? ` · Sold ${project.inventory_sale_date} for ${money(project.inventory_sale_price)}` : ' · GP $0 until sold'}</p></div><Button variant="outline" onClick={() => setEditing(project)}>{status === 'held' ? 'Edit costs / record sale' : 'Edit sale & GP timing'}</Button></div>)}
      {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button>}
    </>}
    {editing !== undefined && <ProjectRecognitionDialog key={editing?.id || 'new'} project={editing} onClose={() => setEditing(undefined)} />}
  </section>;
}