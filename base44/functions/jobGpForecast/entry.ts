import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { scheduleInfo, weeklyRows } from '../../shared/weeklyGpForecast.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { action = 'load', saleId, forecastId, probableStartDate, offset = 0 } = await req.json();
    if (!['load', 'save'].includes(action) || !Number.isInteger(offset) || offset < 0 || (!saleId && !forecastId)) return Response.json({ error: 'Invalid request' }, { status: 400 });
    const existing = forecastId ? await base44.entities.GrossProfitForecast.get(forecastId) : (await base44.entities.GrossProfitForecast.filter({ precon_sale_id: saleId }, { limit: 1 })).items[0];
    const sale = await base44.entities.Sale.get(existing?.precon_sale_id || saleId);
    if (!sale || sale.sale_type !== 'preconstruction') return Response.json({ error: 'Pre-construction sale not found' }, { status: 404 });
    const start = probableStartDate || existing?.probable_start_date || '';
    const goalYear = start ? Number(start.slice(0, 4)) - (Number(start.slice(5, 7)) < 10 ? 1 : 0) : Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric' }).format(new Date())) - (Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', month: 'numeric' }).format(new Date())) < 10 ? 1 : 0);
    const goal = (await base44.entities.FiscalGoal.filter({ fiscal_year: goalYear }, { limit: 1, fields: ['gross_profit_target'] })).items[0];
    const annualTarget = Number(goal?.gross_profit_target) || 0;
    const estimatedGP = existing?.project_id ? existing.total_gp : Number(sale.estimated_construction_budget || 0) * Number(sale.estimated_margin || 0) / 100;
    let forecast = existing;
    if (action === 'save') {
      if (!existing?.project_id && !['feasibility', 'design_material_selections', 'engineering_permits', 'pending_construction_sale'].includes(sale.status)) return Response.json({ error: 'Only open pre-construction jobs can be forecast.' }, { status: 400 });
      const values = { precon_sale_id: sale.id, title: sale.title, probable_start_date: start, total_gp: estimatedGP, annual_gp_goal: annualTarget, goal_fiscal_year: goalYear, weekly_gp: annualTarget / 52 };
      scheduleInfo(start, values.total_gp, values.weekly_gp);
      if (values.total_gp <= 0) throw new Error('Set a positive construction budget and estimated margin before forecasting.');
      forecast = existing ? await base44.entities.GrossProfitForecast.update(existing.id, values) : await base44.entities.GrossProfitForecast.create(values);
    }
    const preview = start && annualTarget > 0 && estimatedGP >= 0 ? { probable_start_date: start, total_gp: estimatedGP, weekly_gp: annualTarget / 52 } : null;
    const info = preview ? scheduleInfo(start, preview.total_gp, preview.weekly_gp) : null;
    return Response.json({ forecast, title: sale.title, estimatedGP, annualTarget, goalYear, weeklyGP: annualTarget / 52, weeks: info?.weeks || 0, endDate: info?.endDate, rows: preview ? weeklyRows(preview, null, null, offset) : [], hasMore: info ? offset + 50 < info.weeks : false });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}