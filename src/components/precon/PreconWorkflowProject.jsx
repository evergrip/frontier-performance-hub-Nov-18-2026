import { useState } from 'react';
import { Button } from '@/components/ui/button';

const working = ['Ready','In progress','Revision required'];
export default function PreconWorkflowProject({project,onOpen}) {
  const [showAll,setShowAll] = useState(false);
  const {tasks,today,userId,names} = project;
  const open = tasks.filter(t=>!['Locked','Approved'].includes(t.status));
  const acts = t => (t.ownerId===userId && working.includes(t.status)) || t.reviewersAssigned.some(r=>r.userId===userId && t.pendingReviewers.includes(r.role));
  const risk = t => ['Blocked','No-Go'].includes(t.status) || (t.due && t.due < today) || (t.wait?.followup <= today);
  const next = [...open].sort((a,b)=>Number(acts(b))-Number(acts(a)) || Number(!!risk(b))-Number(!!risk(a)) || (a.wait?.followup || a.due || '').localeCompare(b.wait?.followup || b.due || '') || a.id-b.id);
  const blockers = open.filter(risk).length;
  const decisions = open.filter(t=>t.status==='Review' || t.status==='No-Go').length;
  const gateCount = tasks.filter(t=>t.gate && t.status==='Approved').length;
  return <section className="space-y-2 border p-4">
    <h3 className="font-heading font-semibold">{project.title}</h3>
    <p className="text-sm">{project.completed ? 'Handoff approved' : `${next.filter(acts).length} need your action · ${decisions} outstanding decisions · ${blockers} at risk`} · {gateCount}/13 gates approved</p>
    <p className="text-xs text-muted-foreground">{project.version} · Activated {project.activatedAt.slice(0,10)} by {names[project.activatedBy] || project.activatedBy}</p>
    <ul className="divide-y">{(showAll ? tasks : next).map(t=><li key={t.id}><button type="button" onClick={()=>onOpen(project.id,t.id)} className="w-full space-y-1 break-words py-2 text-left text-sm hover:underline">
      <strong>{t.id}. {t.name}</strong> · {t.status}{acts(t) && ' · Your action'}{risk(t) && ' · At risk'}
      <span className="block">{t.status==='Review' ? `Review: ${t.reviewersAssigned.filter(r=>t.pendingReviewers.includes(r.role)).map(r=>names[r.userId] || r.userId).join(', ')}` : `Owner: ${names[t.ownerId] || t.ownerId}`}{t.due && ` · Due ${t.due}`}{t.wait && ` · ${t.wait.party}: ${t.wait.note} · follow up ${t.wait.followup}`}{!t.wait && t.issue && ` · ${t.issue}`}{!!t.unmet.length && ` · Blocked by Stage ${t.unmet.join(', ')}`}</span>
    </button></li>)}</ul>
    <Button variant="outline" size="sm" onClick={()=>setShowAll(v=>!v)}>{showAll ? 'Show open work' : 'Show all 34 stages'}</Button>
  </section>;
}