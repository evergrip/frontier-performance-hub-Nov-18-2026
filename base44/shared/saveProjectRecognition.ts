export async function saveProjectRecognition(base44, user, input) {
  const project = input.projectId ? await base44.entities.Project.get(input.projectId).catch(e => e.status === 404 ? null : Promise.reject(e)) : null;
  if (input.projectId && !project) return Response.json({ error: 'Project not found.' }, { status: 404 });
  if (!project && !String(input.title || '').trim()) return Response.json({ error: 'Enter an inventory project title.' }, { status: 400 });
  const states = ['none', 'held', 'sold'];
  if (!states.includes(input.inventoryStatus) || !project && input.inventoryStatus === 'none') return Response.json({ error: 'Select an inventory status.' }, { status: 400 });
  if (Number(input.revision || 0) !== Number(project?.recognition_revision || 0)) return Response.json({ error: 'This project changed. Reopen the editor before saving.' }, { status: 409 });
  const source = input.rows;
  if (!Array.isArray(source) || !source.length || source.length > 1200) return Response.json({ error: 'Enter at least one month.' }, { status: 400 });
  const rows = source.map(row => ({ period: row.period, costs: Number(row.costs), revenue: Number(row.revenue), gp: Number(row.gp) }));
  if (rows.some(row => !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) || ![row.costs, row.revenue, row.gp].every(Number.isFinite) || row.costs < 0 || row.revenue < 0) || new Set(rows.map(row => row.period)).size !== rows.length) return Response.json({ error: 'Use unique valid months and valid amounts; costs and revenue cannot be negative.' }, { status: 400 });
  if (input.inventoryStatus === 'held' && rows.some(row => row.gp !== 0 || row.revenue !== 0)) return Response.json({ error: 'Unsold inventory cannot recognize revenue or GP.' }, { status: 400 });
  const costs = rows.reduce((sum, row) => sum + row.costs, 0), gp = rows.reduce((sum, row) => sum + row.gp, 0), revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const patch = { actual_costs: Math.round(costs * 100) / 100, recognition_mode: 'monthly_actual', inventory_status: input.inventoryStatus, monthly_actual_allocations: rows.sort((a, b) => a.period.localeCompare(b.period)), recognition_revision: Number(project?.recognition_revision || 0) + 1 };
  if (input.inventoryStatus === 'sold') {
    const price = Number(input.salePrice), date = String(input.saleDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || !Number.isFinite(price) || price < 0 || Math.abs(revenue - price) > 0.01 || Math.abs(gp - (price - costs)) > 0.01 || rows.some(row => row.period < date.slice(0, 7) && (row.gp !== 0 || row.revenue !== 0))) return Response.json({ error: 'Reconcile revenue to sale price and GP to sale price less costs. Revenue and GP must occur in the sale month or later.' }, { status: 400 });
    Object.assign(patch, { inventory_sale_price: price, inventory_sale_date: date, contract_value: price, actual_costs: costs, actual_margin: price ? gp / price * 100 : 0 });
  }
  const saved = project ? await base44.entities.Project.update(project.id, patch) : await base44.entities.Project.create({ title: input.title.trim(), client_id: '', sale_id: '', project_type: 'construction', project_manager_id: user.id, status: 'awaiting_to_be_scheduled', contract_value: 0, actual_costs: costs, ...patch });
  return Response.json({ project: saved });
}