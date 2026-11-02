export async function resolvePreconGpJob(base44, input, pointed) {
  const saleId = input.saleId || pointed?.precon_sale_id;
  if (!saleId || input.projectId) throw new Error('Select a pre-construction sale for pre-con allocations.');
  const precon = await base44.entities.Sale.get(saleId);
  if (precon.sale_type !== 'preconstruction') throw new Error('Select a pre-construction sale.');
  const key = `precon-services:${precon.id}`;
  const page = await base44.entities.GrossProfitForecast.filter({ job_key: key }, { sort: '-updated_date', limit: 1 });
  return { key, precon, project: null, sale: null, existing: page.items[0] || null, estimatedGP: 0, forecastScope: 'precon', title: precon.title };
}