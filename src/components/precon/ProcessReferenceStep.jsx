import { ExternalLink } from 'lucide-react';

export default function ProcessReferenceStep({ step }) {
  const inputs = step.inputs || [];
  const outputs = step.outputs || [];
  const prerequisites = step.prerequisites || [];
  return (
    <article className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <div className="flex gap-4"><span className="font-heading text-sm font-bold text-primary shrink-0">{step.step_id || '—'}</span><div className="min-w-0 flex-1">
        <h3 className="font-heading font-semibold text-foreground">{step.step_description || 'Untitled step'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Responsible: {(step.responsible_roles || []).join(', ') || 'Not specified'}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <div><span className="font-semibold">Inputs: </span>{inputs.join(', ') || 'Not specified'}</div>
          <div><span className="font-semibold">Outputs: </span>{outputs.map(output => output.name).filter(Boolean).join(', ') || 'Not specified'}</div>
          <div><span className="font-semibold">Prerequisites: </span>{prerequisites.join(', ') || 'Not documented'}</div>
          <div><span className="font-semibold">Notes: </span>{step.notes || 'None documented'}</div>
        </div>
        {(step.resources || []).length > 0 && <div className="mt-3 flex flex-wrap gap-3">{step.resources.map((resource, index) => resource.url?.startsWith('https://') ? <a key={index} href={resource.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline inline-flex items-center gap-1">{resource.name || 'Resource'} <ExternalLink className="w-3 h-3" /></a> : <span key={index} className="text-sm">{resource.name}</span>)}</div>}
      </div></div>
    </article>
  );
}