import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { resolveGpJob, syncGpTiming } from '../../shared/gpAllocationJob.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { saleId, constructionBudget, finalPreconValue } = await req.json();
    if (!saleId || !Number.isFinite(Number(constructionBudget)) || Number(constructionBudget) <= 0) throw new Error('Enter a positive construction contract value.');
    const precon = await base44.entities.Sale.get(saleId);
    const finalValue = finalPreconValue == null ? precon?.contract_value : Number(finalPreconValue);
    if (!Number.isFinite(Number(finalValue)) || Number(finalValue) < 0) throw new Error('Enter a valid final pre-con value.');
    if (!precon || precon.sale_type !== 'preconstruction' || !['pending_construction_sale', 'closed_won'].includes(precon.status)) throw new Error('This pre-con job is not ready for construction.');
    const candidates = await base44.entities.Sale.filter({ linked_precon_sale_id: saleId, sale_type: 'construction' }, { sort: 'created_date', limit: 2 });
    if (candidates.items.length > 1) throw new Error('Multiple construction sales already exist; resolve this job’s links before converting.');
    let constructionSale = candidates.items[0];
    if (!constructionSale) constructionSale = (await base44.entities.Sale.upsert([{ title: `${precon.title} - Construction`, client_id: precon.client_id, lead_id: precon.lead_id, sale_type: 'construction', contract_value: Number(constructionBudget), linked_precon_sale_id: precon.id, assigned_to: precon.assigned_to, sale_contributors: precon.sale_contributors || [], estimated_margin: precon.estimated_margin, status: 'closed_won' }], { key: ['linked_precon_sale_id', 'sale_type'] })).records[0];
    const projectPage = await base44.entities.Project.filter({ sale_id: constructionSale.id, project_type: 'construction' }, { limit: 2 });
    if (projectPage.items.length > 1) throw new Error('Multiple construction projects already exist for this job; review the links.');
    let project = projectPage.items[0];
    if (!project) project = (await base44.entities.Project.upsert([{ title: precon.title, client_id: precon.client_id, sale_id: constructionSale.id, project_type: 'construction', status: 'awaiting_to_be_scheduled', contract_value: constructionSale.contract_value, monthly_revenue_allocations: precon.monthly_revenue_allocations || [], monthly_sub_allocations: precon.monthly_sub_allocations || [], include_in_forecast: precon.include_in_forecast !== false, forecast_build_type: precon.forecast_build_type || 'in_house', status_history: [...(precon.phase_history || []).map(entry => ({ ...entry, source: entry.source || 'sale' })), { status: 'awaiting_to_be_scheduled', entered_date: new Date().toISOString(), source: 'project' }] }], { key: ['sale_id', 'project_type'] })).records[0];
    await base44.entities.Sale.update(constructionSale.id, { converted_to_project_id: project.id });
    const job = await resolveGpJob(base44, { projectId: project.id });
    if (job.existing) { const forecast = await base44.entities.GrossProfitForecast.update(job.existing.id, { job_key: job.key, project_id: project.id }); await syncGpTiming(base44, job, forecast); }
    const phase_history = precon.status === 'closed_won' ? precon.phase_history || [] : [...(precon.phase_history || []), { status: 'closed_won', entered_date: new Date().toISOString(), source: 'sale' }];
    await base44.entities.Sale.update(precon.id, { status: 'closed_won', contract_value: Number(finalValue), phase_history, converted_to_project_id: project.id });
    // Attach the delivery estimate without changing any sale or project forecast fields.
    try {
      const estimates = base44.asServiceRole.entities.DeliveryEstimate;
      const { items } = await estimates.filter({ sale_id: { $in: [precon.id, constructionSale.id] } }, { limit: 10 });
      const estimate = items.find(item => item.sale_id === precon.id) || items[0];
      if (estimate && estimate.project_id !== project.id) await estimates.update(estimate.id, { project_id: project.id });
    } catch (error) {
      // The module can still follow the existing Sale/Project relationship if this write fails.
      console.error('Delivery estimate project link', project.id, error.message);
    }
    // The conversion is committed. A downstream commission error is not a failed conversion.
    let commissionWarning;
    const commissionRequests = [
      ...(finalPreconValue != null ? [{ sale_id: precon.id, sale_type: 'preconstruction', final_amount: finalValue, is_update: true }] : []),
      { sale_id: constructionSale.id, sale_type: 'construction' }
    ];
    for (const payload of commissionRequests) {
      try {
        const result = await base44.functions.invoke('processCommission', payload);
        if (result.data?.error) throw new Error(result.data.error);
      } catch (error) {
        console.error('Commission processing after successful conversion', payload.sale_id, error.message);
        commissionWarning = 'Conversion saved successfully, but commission processing needs admin review. Do not convert again.';
      }
    }
    return Response.json({ constructionSale, project, commission_warning: commissionWarning });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}