import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { hasPermission } from '@/lib/permissions';
import ProcessReferenceStep from '@/components/precon/ProcessReferenceStep';
import PreconRehearsal from '@/components/precon/PreconRehearsal';
import PreconAutomationAudit from '@/components/precon/PreconAutomationAudit';
import PreconMasterDraft from '@/components/precon/PreconMasterDraft';
import PreconCommunicationRehearsal from '@/components/precon/PreconCommunicationRehearsal';
import PreconEmailSharingPreview from '@/components/precon/PreconEmailSharingPreview';
import PreconGmailInbox from '@/components/precon/PreconGmailInbox';

export default function PreconCommandCentre() {
  const { data: user, isLoading: userLoading } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const permitted = hasPermission(user, 'pipeline_precon');
  const { data: page, isLoading, isError } = useQuery({
    queryKey: ['precon-process-reference'], enabled: permitted,
    queryFn: () => base44.entities.ProcessMap.filter({ title: 'Pre-Con Process' }, { sort: '-updated_date', limit: 1 }),
  });
  if (userLoading) return <p className="text-sm text-muted-foreground">Loading Command Centre…</p>;
  if (!permitted) return <p className="text-sm text-muted-foreground">You do not have access to pre-construction.</p>;
  const map = page?.items?.[0];
  const count = (map?.sections || []).reduce((sum, section) => sum + (section.section_steps || []).length, 0);
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Stage 1</p><h1 className="mt-2 font-heading text-3xl font-bold">Pre-Con Command Centre</h1><p className="mt-2 max-w-3xl text-muted-foreground">Review the Pre-Construction process and access your connected Gmail inbox.{user.role === 'admin' && ' Rehearsal tools do not change existing projects.'}</p></header>
    <PreconGmailInbox key={user.id} userId={user.id} />
    {user?.role === 'admin' && <><PreconMasterDraft /><PreconEmailSharingPreview /><PreconCommunicationRehearsal /><PreconRehearsal /><PreconAutomationAudit /></>}
    <div className="border border-border bg-card p-5"><h2 className="font-heading font-semibold">Separate process reference</h2><p className="mt-2 text-sm text-muted-foreground">The map below is the existing hub reference, not the 34-stage master draft or the high-level 22-step source cited in the permit timing decision.</p></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Loading the process map…</p> : isError ? <p className="text-sm text-destructive">The process map could not be loaded.</p> : !map ? <p className="text-sm text-muted-foreground">The Pre-Con Process map is not available.</p> : <>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-heading text-xl font-semibold">{map.title}</h2><p className="mt-1 text-sm text-muted-foreground">{map.status} · Version {map.version || 'not specified'} · {count} documented steps</p></div><Link className="text-sm font-semibold text-primary underline" to={`/ProcessMapView?id=${encodeURIComponent(map.id)}`}>Open source process map</Link></div>
      {(map.sections || []).map((section, index) => <section key={index} className="border border-border bg-card p-5 sm:p-6"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Section {index + 1}</p><h2 className="mt-1 font-heading text-lg font-semibold">{section.section_title}</h2>{section.section_description && <p className="mt-1 text-sm text-muted-foreground">{section.section_description}</p>}</div>{(section.section_steps || []).map((step, stepIndex) => <ProcessReferenceStep key={`${step.step_id}-${stepIndex}`} step={step} />)}</section>)}
    </>}
  </div>;
}