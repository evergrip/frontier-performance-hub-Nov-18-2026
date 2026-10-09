import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

import { calculateScores } from '../../shared/surveyScoring.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { dry_run = false } = await req.json();
  // Fetch all surveys
  const surveys = await base44.asServiceRole.entities.Survey.filter({});
  const surveyMap = {};
  for (const s of surveys) surveyMap[s.id] = s;

  // Fetch all responses
  const allResponses = await base44.asServiceRole.entities.SurveyResponse.filter({});

  let updated = 0;
  let skipped = 0;
  const details = [];

  for (const resp of allResponses) {
    const survey = surveyMap[resp.survey_id];
    if (!survey) { skipped++; continue; }

    const { totalScore, maxPossibleScore, scorePercentage, categoryScores } = calculateScores(survey, resp.responses || {});

    const changed = resp.total_score !== totalScore || resp.max_possible_score !== maxPossibleScore || resp.score_percentage !== scorePercentage;

    if (changed) {
      if (!dry_run) await base44.asServiceRole.entities.SurveyResponse.update(resp.id, {
        total_score: totalScore,
        max_possible_score: maxPossibleScore,
        score_percentage: scorePercentage,
        category_scores: categoryScores,
      });
      details.push({
        response_id: resp.id,
        survey: survey.title,
        old: { score: resp.total_score, max: resp.max_possible_score, pct: resp.score_percentage },
        new: { score: totalScore, max: maxPossibleScore, pct: scorePercentage },
      });
      updated++;
    } else {
      skipped++;
    }
  }

  return Response.json({ dry_run, updated, skipped, total: allResponses.length, details });
}