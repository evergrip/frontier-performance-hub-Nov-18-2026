import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkPipeline } from '../../shared/verificationPipeline.ts';
import { checkCommissions } from '../../shared/verificationCommissions.ts';
import { checkSurveys } from '../../shared/verificationSurveys.ts';
import { checkReporting } from '../../shared/verificationReporting.ts';

const sources = ['Client','Lead','Sale','Project','CommissionTransaction','CommissionBank','CommissionRule','Survey','SurveyResponse','CompanySettings','FiscalGoal'];
const version = 'core-2026-10-09-v1';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const body = await req.json(), entities = base44.asServiceRole.entities;
    if (body.action === 'start') {
      const running = await entities.VerificationRun.filter({ status: 'running' }, { sort: '-created_date', limit: 1 });
      const run = running.items[0] || await entities.VerificationRun.create({ status: 'running', started_at: new Date().toISOString(), step: 0, cursor: '', checked: 0, coverage: {}, initiated_by: user.id, rule_version: version });
      return Response.json({ run, sources });
    }
    if (body.action === 'review') {
      if (!body.finding_id || !['manual_review','investigate','resolved'].includes(body.review_status)) return Response.json({ error: 'Invalid review request' }, { status: 400 });
      if (body.review_status === 'resolved' && !body.review_notes?.trim()) return Response.json({ error: 'Explain the manual resolution before marking resolved.' }, { status: 400 });
      await entities.VerificationFinding.get(body.finding_id);
      const finding = await entities.VerificationFinding.update(body.finding_id, { review_status: body.review_status, review_notes: String(body.review_notes || '').slice(0, 4000), reviewed_by: user.id, reviewed_at: new Date().toISOString() });
      return Response.json({ finding });
    }
    if (body.action !== 'step' || !body.run_id) return Response.json({ error: 'Choose start, step, or review.' }, { status: 400 });
    const run = await entities.VerificationRun.get(body.run_id);
    if (run.status === 'completed') return Response.json({ run, sources });
    if (body.expected_step !== run.step || String(body.expected_cursor || '') !== String(run.cursor || '')) return Response.json({ error: 'This run has advanced. Refresh and resume.' }, { status: 409 });
    const type = sources[run.step];
    if (!type) return Response.json({ error: 'Invalid audit position' }, { status: 400 });
    const page = await entities[type].filter({ created_date: { $lte: run.started_at } }, { sort: 'id', limit: 40, cursor: run.cursor || undefined });
    const findings = [], add = finding => findings.push({ ...finding, detected: true, last_run_id: run.id, last_seen_at: new Date().toISOString(), rule_version: version });
    if (run.step < 4) await checkPipeline(entities, type, page.items, add);
    else if (run.step < 7) await checkCommissions(entities, type, page.items, add);
    else if (run.step < 9) await checkSurveys(entities, type, page.items, add);
    else await checkReporting(entities, type, page.items, add);
    if (findings.length) await entities.VerificationFinding.upsert(findings, { key: 'fingerprint' });
    if (!page.has_more) {
      let cleared;
      do {
        cleared = await entities.VerificationFinding.updateMany({ entity_type: type, detected: true, last_seen_at: { $lt: run.started_at } }, { $set: { detected: false } });
      } while (cleared.has_more);
    }
    const step = page.has_more ? run.step : run.step + 1;
    const coverage = { ...(run.coverage || {}), [type]: (run.coverage?.[type] || 0) + page.items.length };
    const updated = await entities.VerificationRun.update(run.id, { step, cursor: page.has_more ? page.next_cursor : '', checked: (run.checked || 0) + page.items.length, coverage, status: step === sources.length ? 'completed' : 'running', ...(step === sources.length ? { completed_at: new Date().toISOString() } : {}) });
    return Response.json({ run: updated, sources, found_in_batch: findings.length });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}