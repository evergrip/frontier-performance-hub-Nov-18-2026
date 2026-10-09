import { references, linkedReferences, recorder, historyCheck } from './verificationLinks.ts';
import { number, near, allocationIssues, periodOf } from './verificationMath.ts';

export async function checkPipeline(entities, type, rows, add) {
  const area = { Client: 'Clients', Lead: 'Leads', Sale: 'Pre-Construction', Project: 'Projects' }[type];
  const [clients, leads, sales, projects] = await Promise.all([
    references(entities, 'Client', rows.map(r => r.client_id)), references(entities, 'Lead', rows.map(r => r.lead_id)),
    references(entities, 'Sale', rows.flatMap(r => [r.sale_id, r.converted_to_sale_id, r.linked_precon_sale_id])), references(entities, 'Project', rows.map(r => r.converted_to_project_id))
  ]);
  const reverse = type === 'Sale' ? await linkedReferences(entities, 'Project', 'sale_id', rows.map(r => r.id)) : [];
  for (const r of rows) {
    const emit = recorder(type, r, add, area, type === 'Project' ? ['Projects', 'Dashboard', 'Reports'] : [area]);
    if (type === 'Client') {
      if (!r.contact_name?.trim()) emit('client-name', 'Client has no primary contact name.', 'Primary contact name', 'Blank name');
      if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) emit('client-email', 'Client email has an invalid format.', 'Usable email address', 'Invalid email format', 'low');
      continue;
    }
    const client = clients.get(r.client_id);
    if (!client) emit('client-link', 'Client link is missing or points to a missing record.', 'Existing linked Client', r.client_id || 'No client_id', 'high');
    if (type === 'Lead') {
      if (!Number.isFinite(Number(r.lead_score)) || number(r.lead_score) < 0 || number(r.lead_score) > 100) emit('lead-score', 'Qualification score falls outside its defined range.', '0–100', r.lead_score);
      if (r.status === 'converted') {
        const sale = sales.get(r.converted_to_sale_id);
        if (!sale) emit('conversion-sale', 'Converted lead has no verifiable destination sale.', 'Existing Sale', r.converted_to_sale_id || 'Missing destination', 'high', 'investigate');
        else if (sale.client_id !== r.client_id || sale.lead_id !== r.id) emit('conversion-reciprocal', 'Lead and destination sale links disagree.', `client ${r.client_id}; lead ${r.id}`, `client ${sale.client_id}; lead ${sale.lead_id}`, 'high');
      }
      historyCheck(r, 'status_history', ['new_project_lead','initial_video_consult','initial_inperson_consultation','preconstruction_proposal','followup','converted','disqualified'], emit);
      continue;
    }
    for (const field of ['contract_value', ...(type === 'Project' ? ['actual_costs'] : [])]) if (r[field] != null && (!Number.isFinite(Number(r[field])) || number(r[field]) < 0)) emit(`numeric-${field}`, 'Financial input is invalid or negative.', 'Finite, nonnegative amount', r[field], 'high');
    if (type === 'Sale') {
      const lead = leads.get(r.lead_id);
      if (r.lead_id && !lead) emit('lead-link', 'Sale refers to a missing lead.', 'Existing Lead', r.lead_id, 'high');
      if (lead && lead.client_id !== r.client_id) emit('lead-client', 'Sale and source lead have different clients.', lead.client_id, r.client_id, 'high');
      const precon = sales.get(r.linked_precon_sale_id);
      if (r.linked_precon_sale_id && (!precon || precon.sale_type !== 'preconstruction' || precon.client_id !== r.client_id)) emit('precon-link', 'Construction sale has an inconsistent pre-construction origin.', 'Same-client preconstruction Sale', r.linked_precon_sale_id, 'high');
      const project = projects.get(r.converted_to_project_id), children = reverse.filter(p => p.sale_id === r.id);
      if (r.converted_to_project_id && (!project || project.sale_id !== r.id || project.client_id !== r.client_id)) emit('project-link', 'Sale-to-project handoff is not reciprocal.', 'Same-client Project linked back to Sale', r.converted_to_project_id, 'high');
      if (children.length > 1) emit('multiple-projects', 'Multiple projects share this originating sale; check intended structure.', 'One project unless intentionally split', children.length, 'high', 'investigate', { project_ids: children.map(p => p.id) });
      if (r.sale_type === 'construction' && r.status === 'closed_won' && !children.length) emit('missing-project', 'Won construction sale has no linked project.', 'Construction project', 'No project found', 'high', 'investigate');
      const splits = r.sale_contributors || [];
      if (splits.length && (!near(splits.reduce((s, c) => s + number(c.commission_split), 0), 100, 0.1) || new Set(splits.map(c => c.user_id)).size !== splits.length || splits.some(c => !c.user_id || c.commission_split == null || number(c.commission_split) < 0 || number(c.commission_split) > 100))) emit('contributor-splits', 'Contributor splits are incomplete, duplicated, or do not total 100%.', 'Unique contributors totaling 100%', JSON.stringify(splits), 'high', 'investigate');
      for (const field of ['invoices','deposits']) {
        const list = r[field] || [], idField = field === 'invoices' ? 'invoice_number' : 'deposit_number';
        const ids = list.map(v => v[idField]).filter(Boolean);
        if (new Set(ids).size !== ids.length) emit(`duplicate-${field}`, 'Repeated document numbers could double-count a payment.', 'Unique document numbers', ids.join(', '), 'medium', 'investigate');
        if (list.some(v => !Number.isFinite(Number(v.amount)) || number(v.amount) < 0)) emit(`amount-${field}`, 'Payment document has an invalid amount.', 'Finite, nonnegative document amounts', 'Invalid amount', 'medium', 'investigate');
      }
      historyCheck(r, 'phase_history', ['feasibility','design_material_selections','engineering_permits','pending_construction_sale','closed_won','closed_lost'], emit);
    } else {
      const sale = sales.get(r.sale_id);
      if (!sale) emit('sale-link', 'Project has no verifiable originating sale.', 'Existing Sale', r.sale_id || 'Missing sale_id', 'high');
      else {
        if (sale.client_id !== r.client_id || sale.sale_type !== r.project_type) emit('sale-coherence', 'Project and originating sale disagree on client or type.', `${sale.client_id}; ${sale.sale_type}`, `${r.client_id}; ${r.project_type}`, 'high');
        if (!near(r.contract_value, sale.contract_value)) emit('contract-mismatch', 'Project and sale contract values differ; changes may require review.', sale.contract_value, r.contract_value, 'high', 'investigate', { sale_id: sale.id });
      }
      if (r.status === 'closed' && r.actual_costs == null) emit('final-costs', 'Closed project is missing final actual costs.', 'Finalized actual costs', 'Missing', 'high', 'investigate');
      if (r.status === 'closed' && r.actual_margin != null && number(r.contract_value) > 0) {
        const calculated = (number(r.contract_value) - number(r.actual_costs)) / number(r.contract_value) * 100;
        if (!near(calculated, r.actual_margin, 0.1)) emit('closed-margin', 'Recorded final margin disagrees with revenue minus actual costs.', `${calculated.toFixed(4)}%`, `${r.actual_margin}%`, 'high', 'investigate', { contract_value: r.contract_value, actual_costs: r.actual_costs, actual_margin: r.actual_margin });
      }
      if (r.start_date && r.actual_completion_date && r.actual_completion_date < r.start_date) emit('completion-date', 'Actual completion precedes the project start.', 'Completion on or after start', `${r.start_date} → ${r.actual_completion_date}`);
      if (['mobilization','active_construction'].includes(r.status) && !r.project_manager_id) emit('project-manager', 'Active project has no assigned project manager.', 'Assigned manager', 'Missing manager', 'medium', 'investigate');
      historyCheck(r, 'status_history', ['awaiting_to_be_scheduled','mobilization','active_construction','substantial_completion_closeout','closed'], emit);
    }
    const allocations = r.monthly_revenue_allocations || [];
    if (allocations.length) {
      const issues = allocationIssues(allocations, 'percentage', type === 'Project' && r.status === 'closed');
      if (issues.length) emit('revenue-allocations', 'Revenue allocation schedule violates its period or percentage rules.', 'Unique valid periods; total ≤100%, closed project 100%', issues.join('; '), 'high', 'invariant', { allocations });
      else if (type === 'Project' && !near(allocations.reduce((s, a) => s + number(a.percentage), 0), 100, 0.1)) emit('incomplete-schedule', 'Not all project revenue has been scheduled.', 'Review unallocated portion of contract', `${allocations.reduce((s, a) => s + number(a.percentage), 0).toFixed(2)}% scheduled`, 'medium', 'investigate');
    } else if (type === 'Project' && r.project_type === 'construction') emit('missing-schedule', 'No monthly allocations are available to verify fiscal attribution.', 'Year-aware revenue allocations for spanning projects', 'No allocations; date fallback applies only to eligible closed projects', 'high', 'investigate');
    for (const field of ['monthly_sub_allocations','monthly_work_allocations']) {
      const list = r[field] || [], issues = allocationIssues(list, field === 'monthly_sub_allocations' ? 'sub_percentage' : 'percentage');
      if (issues.length) emit(field, 'Allocation entries need review.', 'Unique valid periods and percentages', issues.join('; '), 'medium', 'invariant', { allocations: list });
      if (field === 'monthly_sub_allocations' && list.some(a => !allocations.some(b => periodOf(a) === periodOf(b)))) emit('sub-period-links', 'A subcontractor split has no matching revenue month.', 'Revenue month for every sub split', 'Unmatched monthly split', 'medium', 'investigate');
    }
  }
}