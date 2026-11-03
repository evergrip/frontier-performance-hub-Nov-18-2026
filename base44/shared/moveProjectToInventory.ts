export async function moveProjectToInventory(base44, user, input) {
  if (typeof input.projectId !== 'string' || !input.projectId) return Response.json({ error: 'Select an active project.' }, { status: 400 });
  const project = await base44.entities.Project.get(input.projectId).catch(e => e.status === 404 ? null : Promise.reject(e));
  if (!project) return Response.json({ error: 'Project not found.' }, { status: 404 });
  if (project.project_type !== 'construction' || project.status === 'closed' || ['held', 'sold'].includes(project.inventory_status)) return Response.json({ error: 'Only active construction projects outside inventory can be moved.' }, { status: 400 });
  const history = project.recognition_mode === 'monthly_actual' ? project.monthly_actual_allocations || [] : [];
  const costs = history.length ? history.reduce((sum, row) => sum + Number(row.costs || 0), 0) : Number(project.actual_costs || 0);
  if (!Number.isFinite(costs) || costs < 0 || history.some(row => !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) || !Number.isFinite(Number(row.costs)) || Number(row.costs) < 0)) return Response.json({ error: 'Correct the recorded project costs before moving to inventory.' }, { status: 400 });
  if (input.preview === true) return Response.json({ title: project.title, costs, hasMonthlyCosts: history.length > 0, updatedDate: project.updated_date });
  if (input.convertAllHistory !== true) return Response.json({ error: 'Confirm conversion of all financial history.' }, { status: 400 });
  if (input.updatedDate !== project.updated_date) return Response.json({ error: 'This project changed. Close and reopen the move confirmation.' }, { status: 409 });
  if (!history.length && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.costPeriod || '')) return Response.json({ error: 'Choose a month for the existing recorded costs.' }, { status: 400 });
  const rows = (history.length ? history : [{ period: input.costPeriod, costs }]).map(row => ({ period: row.period, costs: Number(row.costs || 0), revenue: 0, gp: 0 }));
  const note = `Moved to FBG Inventory on ${new Date().toISOString()} by ${user.full_name || user.id}. All project revenue and GP history converted to unsold inventory; recorded costs retained.`;
  const saved = await base44.entities.Project.update(project.id, {
    inventory_status: 'held', recognition_mode: 'monthly_actual', monthly_actual_allocations: rows,
    actual_costs: costs, actual_margin: 0, include_in_forecast: false,
    recognition_revision: Number(project.recognition_revision || 0) + 1,
    notes: [project.notes, note].filter(Boolean).join('\n\n')
  });
  return Response.json({ project: saved });
}