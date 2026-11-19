import test from 'node:test';
import assert from 'node:assert/strict';
import { initialWorkflow,pilotTemplate } from './preconOperationalPolicy.ts';
import { workflowView } from './preconOperationalEngine.ts';
import { appendWorkflowEvent,attachWorkflow } from './preconOperationalStore.ts';
import { orderedSteps } from './preconRehearsalGraph.ts';

const at = '2026-11-19T14:30:00Z';
function fixture(path='detailed') {
  const template = pilotTemplate(path);
  const assignments = Object.fromEntries(template.stageRoles.map(r=>[r,`test-${r}`]));
  const state = initialWorkflow(template,assignments,5,'admin',at);
  const get = id=>workflowView(state,at).tasks.find(s=>s.id===id);
  const act = (stage,action,role,extra={})=>{
    const result = workflowView(state,at,{stage,action,...extra},{id:assignments[role] ?? role, role:role==='management' ? 'admin' : 'user'});
    state.events.push(result.event); return result;
  };
  const draft = (id,suffix='r1')=>get(id).evidence.map((_,i)=>`controlled-${id}-${i}-${suffix}`);
  const approve = id=>{ const t=get(id); for(const role of t.reviewers) act(id,'approve',role,{note:'Verified controlled evidence',reference:`decision-${id}-${role}`}); };
  const submit = (id,evidence=draft(id),note='Controlled evidence')=>act(id,'submit',get(id).owner,{evidence,note});
  const finish = id=>{
    const t=get(id); act(id,'start',t.owner);
    if(id===33) act(id,'permitSubmitted',t.owner,{reference:draft(id)[0],note:'Municipal review pending',followup:'2026-11-20'});
    submit(id); approve(id);
  };
  return {template,state,get,act,draft,submit,approve,finish};
}
for(const path of ['detailed','early']) test(`all 34 stages and 13 gates under the ${path} controlled sequence`,()=>{
  const f=fixture(path), order=orderedSteps(f.template.stages);
  assert.equal(order.length,34);
  assert.equal(order.filter(t=>t.gate).length,13);
  assert.ok(order.findIndex(t=>t.id===33) < order.findIndex(t=>t.id===34));
  for(const t of order) {
    if(t.id!==11) f.finish(t.id);
    else {
      f.act(11,'start',t.owner); f.submit(11);
      f.act(11,'reject',t.reviewers[0],{note:'Correct dimension'});
      assert.equal(f.get(12).status,'Locked');
      assert.throws(()=>f.submit(11),/revision needs changed evidence/i);
      f.submit(11,f.draft(11,'r2'),'Corrected drawing revision'); f.approve(11);
      assert.equal(f.get(11).revisions.length,2);
    }
    if(t.id===5) {assert.equal(f.get(6).status,'Ready');assert.equal(f.get(7).status,'Ready');assert.equal(f.get(8).status,'Locked');}
  }
  assert.ok(workflowView(f.state,at).completed);
  f.submit(11,f.draft(11,'r3'),'Updated issued drawing');
  assert.equal(f.get(34).status,'Locked');
  assert.equal(f.get(34).revisions.length,1);
  assert.deepEqual(f.get(34).approvals,{});
});

test('blocks skipping, missing evidence, self-approval, incomplete sign-off and unauthorized decisions',()=>{
 const f=fixture();
 const t=f.get(1);
 assert.throws(()=>f.act(2,'start','sales'),{status:409});
 f.act(1,'start',t.owner);
 assert.throws(()=>f.submit(1,[]),/every required item/);
 f.submit(1);
 assert.throws(()=>f.act(1,'approve',t.owner,{note:'Self approval'}),{status:403});
 assert.throws(()=>f.act(1,'approve','outsider',{note:'Unauthorized'}),{status:403});
 assert.throws(()=>f.act(1,'approve','client',{note:'No reference'}),/attributable/);
 f.act(1,'approve','client',{note:'Client signed',reference:'signed-1'});
 assert.equal(f.get(2).status,'Locked');
 f.act(1,'approve','admin',{note:'Retainer verified'});
 assert.equal(f.get(2).status,'Ready');
 assert.throws(()=>initialWorkflow(f.template,{...f.state.assignments,admin:f.state.assignments.sales},5,'admin',at),/different account/);
});

test('external waits preserve follow-ups and No-Go blocks design until audited reconsideration and fresh review',()=>{
 const f=fixture(); [1,2,3,4,5,7].forEach(f.finish);
 f.act(6,'start','coordinator');
 f.act(6,'hold','coordinator',{party:'Engineer',note:'Awaiting site report',followup:'2026-11-20'});
 assert.equal(f.get(6).wait.followup,'2026-11-20');
 f.act(6,'resume','coordinator'); f.submit(6);
 f.act(6,'noGo','vpPrecon',{note:'Missing engineering approval'});
 assert.equal(f.get(6).status,'No-Go'); assert.equal(f.get(8).status,'Locked');
 assert.throws(()=>f.submit(6,f.draft(6,'r2')),{status:409});
 assert.throws(()=>f.act(6,'reconsider','vpPrecon',{note:'Reopen'}),{status:403});
 f.act(6,'reconsider','management',{note:'Management accepted new investigation'});
 f.submit(6,f.draft(6,'r2'),'New engineering confirmation'); f.approve(6);
 assert.equal(f.get(8).status,'Ready');
});

test('conditional storage permits one canonical activation and rejects a stale journal append',async()=>{
 const {state}=fixture(); let linked, serial=0; const rows=new Map();
 const runs={create:async data=>{const r={...data,id:`r${++serial}`};rows.set(r.id,r);return r;},delete:async id=>rows.delete(id),updateMany:async (filter,op)=>{
   const current=rows.get(filter.id); if(current?.revision!==filter.revision)return {updated:0};
   rows.set(filter.id,{...current,...op.$set});return {updated:1};
 }};
 const entities={PreconWorkflowRun:runs,Sale:{updateMany:async (filter,op)=>{
   assert.equal(filter.id,'controlled-sale'); if(linked)return {updated:0}; linked=op.$set.precon_workflow_run_id;return {updated:1};
 }}};
 const results=await Promise.allSettled([1,2].map(()=>attachWorkflow(entities,{id:'controlled-sale'},state)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(rows.size,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const run=rows.get(linked), event=workflowView(state,at,{stage:1,action:'start'},{id:state.assignments.sales}).event;
 await appendWorkflowEvent(runs,run,event);
 await assert.rejects(appendWorkflowEvent(runs,run,event),{status:409});
 assert.equal(rows.get(linked).state.events.length,1);
});