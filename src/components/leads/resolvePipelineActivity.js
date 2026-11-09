import { base44 } from '@/api/base44Client';

export default async function resolvePipelineActivity({ lead, sale, project }) {
  if (lead) return lead;
  const currentSale = sale || (project?.sale_id ? await base44.entities.Sale.get(project.sale_id) : null);
  const precon = currentSale?.linked_precon_sale_id ? await base44.entities.Sale.get(currentSale.linked_precon_sale_id) : currentSale;
  let leadId = precon?.lead_id || currentSale?.lead_id;
  if (!leadId && precon) {
    const page = await base44.entities.Lead.filter({ converted_to_sale_id: precon.id }, { limit: 2 });
    if (page.items.length > 1) throw new Error('Multiple originating leads found. Please check this record’s links.');
    leadId = page.items[0]?.id;
  }
  const origin = leadId ? await base44.entities.Lead.get(leadId) : null;
  const existingNotes = [
    origin?.notes && `Lead notes\n${origin.notes}`,
    precon?.notes && `Preconstruction notes\n${precon.notes}`,
    currentSale && currentSale.id !== precon?.id && currentSale.notes && `Construction sale notes\n${currentSale.notes}`,
    project?.notes && `Project notes\n${project.notes}`,
  ].filter(Boolean).join('\n\n');
  return {
    id: origin?.id || (precon ? `sale:${precon.id}` : `project:${project.id}`),
    title: project?.title || sale?.title,
    assigned_to: currentSale?.assigned_to || origin?.assigned_to,
    notes: existingNotes,
  };
}