import { references, recorder } from './verificationLinks.ts';
import { calculateScores } from './surveyScoring.ts';
import { number, near } from './verificationMath.ts';
export async function checkSurveys(entities, type, rows, add) {
  const surveys = type === 'SurveyResponse' ? await references(entities, 'Survey', rows.map(r => r.survey_id)) : new Map();
  const totals = type === 'Survey' && rows.length ? await entities.SurveyResponse.aggregate({ query: { survey_id: { $in: rows.map(r => r.id) }, status: 'submitted' }, groupBy: 'survey_id' }) : { rows: [] };
  if (totals.truncated) throw new Error('Survey response counts are truncated.');
  for (const r of rows) {
    const emit = recorder(type, r, add, 'Surveys');
    if (type === 'Survey') {
      const questions = r.questions || [], ids = new Set(questions.map(q => q.id)), headings = new Set((r.headings || []).map(h => h.id));
      if (ids.size !== questions.length || questions.some(q => !q.id)) emit('question-ids', 'Survey question identifiers are blank or duplicated.', 'Unique nonblank identifiers', 'Invalid question identifiers', 'high');
      if (questions.some(q => q.category_id && !headings.has(q.category_id))) emit('question-heading', 'Question points to a missing survey section.', 'Existing heading', 'Unmatched heading');
      if (questions.some(q => q.weight != null && (!Number.isFinite(Number(q.weight)) || number(q.weight) < 0))) emit('question-weights', 'Survey has invalid or negative weights.', 'Finite nonnegative weights; zero excludes scoring', 'Invalid weights', 'high');
      if (questions.some(q => (q.logic_rules || []).some(l => !ids.has(l.condition_question_id)))) emit('logic-question', 'Conditional logic points to a missing question.', 'Existing controlling question', 'Unmatched logic dependency', 'high');
      if ((r.section_followup_rules || []).some(f => !headings.has(f.heading_id) || (f.followup_question_ids || []).some(id => !ids.has(id)))) emit('followup-links', 'Follow-up rule has an invalid section or question reference.', 'Valid follow-up dependencies', 'Missing dependency', 'high');
      const actual = totals.rows.find(t => t.survey_id === r.id)?.count || 0;
      if (!near(actual, r.total_responses ?? 0, 0)) emit('response-counter', 'Stored response count differs from submitted response records.', actual, r.total_responses ?? 0, 'medium', 'investigate');
      continue;
    }
    const survey = surveys.get(r.survey_id);
    if (!survey) { emit('response-survey', 'Response refers to a missing survey.', 'Existing Survey', r.survey_id, 'high'); continue; }
    if (r.status !== 'submitted' && !r.is_complete) continue;
    const pct = number(r.max_possible_score) > 0 ? Math.round(number(r.total_score) / number(r.max_possible_score) * 100) : 0;
    if (!near(pct, r.score_percentage, 0)) emit('response-percentage', 'Saved percentage disagrees with its saved numerator and denominator.', `${pct}%`, `${r.score_percentage}%`, 'high', 'invariant', { total_score: r.total_score, max_possible_score: r.max_possible_score });
    const expected = calculateScores(survey, r.responses || {});
    if (!near(expected.totalScore, r.total_score) || !near(expected.maxPossibleScore, r.max_possible_score)) emit('response-rescore', 'Score differs from the current survey definition; historical edits may explain it.', `${expected.totalScore}/${expected.maxPossibleScore}`, `${r.total_score}/${r.max_possible_score}`, 'medium', 'investigate', { submitted_at: r.submitted_at, survey_updated_at: survey.updated_date, note: 'No immutable survey revision is stored; this is a review item, not proof that a historical score is wrong.' });
    if (r.status === 'submitted' && !r.is_complete) emit('response-completion', 'Submitted status and completion flag disagree.', 'Submitted response marked complete', 'is_complete is false', 'medium', 'investigate');
  }
}