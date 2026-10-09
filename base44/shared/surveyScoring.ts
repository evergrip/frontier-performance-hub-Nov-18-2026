export function evaluateVisibility(question, responses) {
  return (question.logic_rules || []).every(rule => {
    const a = responses[rule.condition_question_id], v = rule.value;
    const answered = a !== undefined && a !== null && a !== '' && (!Array.isArray(a) || a.length > 0);
    const contains = Array.isArray(a) ? a.includes(v) : String(a ?? '').includes(v);
    const checks = { equals: String(a) === String(v), not_equals: String(a) !== String(v), contains, not_contains: !contains, greater_than: Number(a) > Number(v), less_than: Number(a) < Number(v), is_answered: answered, is_not_answered: !answered };
    const met = checks[rule.operator] ?? true;
    return rule.logic_type === 'show' ? met : !met;
  });
}
export function scoreQuestion(q, answer) {
  let questionScore = 0, questionMax = 0;
  const scores = q.option_scores || {}, values = Object.values(scores).map(Number).filter(Number.isFinite);
  const scored = values.length > 0;
  if (['scale', 'radio', 'dropdown'].includes(q.type) && scored) {
    questionMax = Math.max(...values);
    questionScore = answer == null ? 0 : Number(scores[String(answer)]) || 0;
  } else if (q.type === 'checkbox' && scored) {
    questionMax = values.reduce((s, v) => s + Math.max(0, v), 0);
    questionScore = Array.isArray(answer) ? [...new Set(answer)].reduce((s, a) => s + (Number(scores[a]) || 0), 0) : 0;
  } else if (['rating', 'scale', 'number'].includes(q.type)) {
    questionMax = Number(q.type === 'scale' ? q.max_value ?? 10 : q.points ?? (q.type === 'rating' ? 5 : 0));
    questionScore = Math.min(Number(answer) || 0, questionMax);
  }
  return { questionScore, questionMax };
}
export function calculateScores(survey, responses) {
  let totalScore = 0, maxPossibleScore = 0;
  const categoryScores = Object.fromEntries((survey.headings || []).map(h => [h.id, { title: h.title, score: 0, max: 0, pct: 0 }]));
  const base = {};
  for (const q of survey.questions || []) {
    if (q.is_followup || !evaluateVisibility(q, responses)) continue;
    const scored = scoreQuestion(q, responses[q.id]);
    base[q.category_id] = (base[q.category_id] || 0) + scored.questionScore * (q.weight ?? 1);
  }
  for (const q of survey.questions || []) {
    if (!evaluateVisibility(q, responses)) continue;
    if (q.is_followup && !(survey.section_followup_rules || []).some(r => (r.followup_question_ids || []).includes(q.id) && (base[r.heading_id] || 0) >= r.threshold_score)) continue;
    const { questionScore, questionMax } = scoreQuestion(q, responses[q.id]), weight = q.weight ?? 1;
    totalScore += questionScore * weight; maxPossibleScore += questionMax * weight;
    if (categoryScores[q.category_id]) { categoryScores[q.category_id].score += questionScore * weight; categoryScores[q.category_id].max += questionMax * weight; }
  }
  for (const c of Object.values(categoryScores)) c.pct = c.max > 0 ? Math.round(c.score / c.max * 100) : 0;
  return { totalScore, maxPossibleScore, scorePercentage: maxPossibleScore > 0 ? Math.round(totalScore / maxPossibleScore * 100) : 0, categoryScores };
}