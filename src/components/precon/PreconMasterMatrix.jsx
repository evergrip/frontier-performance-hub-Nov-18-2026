function StageReference({ stage, roles, downstream }) {
  return <details className="border-t border-border py-3">
    <summary className="cursor-pointer font-medium">{stage.id}. {stage.name}{stage.gate && <span className="ml-2 text-xs font-semibold text-primary">Critical gate</span>}</summary>
    <div className="mt-3 space-y-2 pl-4 text-sm">
      <p>{stage.purpose}</p>
      <p><strong>Participants:</strong> {stage.participants}</p>
      <p><strong>Proposed owner:</strong> {roles[stage.owner]}</p>
      <div><strong>Required evidence:</strong><ul className="list-disc pl-5">{stage.evidence.map(item => <li key={item}>{item}</li>)}</ul></div>
      <p><strong>Source gate:</strong> {stage.authority}</p>
      <p><strong>Proposed approvers:</strong> {stage.reviewers.map(role => roles[role]).join(', ')}{stage.id === 32 && '; Management also signs any proposed applicability exception'}</p>
      <p><strong>Intended system behavior:</strong> {stage.automation}</p>
      <p><strong>Automatic action in draft:</strong> {downstream.length ? `Recheck and release eligible stages ${downstream.join(', ')} after verification.` : 'Recalculate final construction readiness after verification.'}</p>
      {!!stage.forms.length && <div><strong>Source library references (originals not supplied):</strong><ul className="list-disc pl-5">{stage.forms.map(form => <li key={form}>{form}</li>)}</ul></div>}
    </div>
  </details>;
}

export default function PreconMasterMatrix({ template }) {
  const { stages, roles, sections, decisions } = template;
  return <div className="space-y-4">
    <details className="border border-border bg-card p-4" open><summary className="cursor-pointer font-semibold">Unresolved management decisions</summary><dl className="mt-3 space-y-3 text-sm">{decisions.map(([name, body]) => <div key={name}><dt className="font-semibold">{name}</dt><dd>{body}</dd></div>)}</dl></details>
    <details className="border border-border bg-card p-4"><summary className="cursor-pointer font-semibold">Proposed dependency and parallel-work diagram</summary>
      <p className="my-3 text-sm">Each row reads from prerequisites to the stage they unlock. Branches with the same prerequisite can run in parallel; multiple prerequisites must all clear. For example, 6 and 7 can run together after 5, and both are needed for 8.</p>
      <ol className="grid gap-2 sm:grid-cols-2">{stages.map(s => <li key={s.id} className="border-l-2 border-primary bg-background p-2 text-sm"><span className="font-mono font-semibold">{s.deps.join(' + ') || 'Start'} → {s.id}</span> · {s.name}</li>)}</ol>
    </details>
    <details className="border border-border bg-card p-4"><summary className="cursor-pointer font-semibold">Critical approval authority matrix · 13 gates</summary>
      <div className="mt-3 space-y-3 text-sm">{stages.filter(s => s.gate).map(s => <div className="border-t pt-2" key={s.id}><strong>{s.id}. {s.gate}</strong> · {s.reviewers.map(role => roles[role]).join(' + ')}<p>{s.authority}. Record the version, attributable decision reference and outcome. {s.evidence.join('; ')}.</p></div>)}</div>
    </details>
    <details className="border border-border bg-card p-4"><summary className="cursor-pointer font-semibold">Stage-by-stage task, evidence and automation matrix · 34 stages</summary>
      {sections.map((section, index) => <section className="mt-5" key={section}><h3 className="mb-2 font-heading font-semibold">{section}</h3>{stages.filter(s => s.section === index).map(s => <StageReference key={s.id} stage={s} roles={roles} downstream={stages.filter(next => next.deps.includes(s.id)).map(next => next.id)} />)}</section>)}
    </details>
  </div>;
}