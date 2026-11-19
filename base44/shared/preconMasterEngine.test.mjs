import test from 'node:test';
import assert from 'node:assert/strict';
import { masterRun } from './preconMasterEngine.ts';
const date = '2026-11-19T10:00:00Z';
function rehearsal(path = 'detailed') {
  let run = masterRun(path, [], null, date);
  const act = command => { run = masterRun(path, run.history, command, date); };
  const submit = (id, version = 1) => { const t = run.tasks[id]; act({ id, actor:t.owner, action:'submit', exceptions:id === 32 ? [1] : [], note:'Example change impact', evidence:t.evidence.map((_, i) => id === 33 && !i ? 'Example permit application' : `Example ${id}.${i} v${version}`) }); };
  function finish(id, decision = 'approve') {
    const {owner} = run.tasks[id];
    act({id,actor:owner,action:'start'});
    if (id === 33) {
      assert.throws(() => submit(id), /Record the permit submission first/);
      act({id,actor:owner,action:'permitSubmitted',note:'Example permit application'});
      assert.equal(run.tasks[34].status, 'Locked');
    }
    submit(id);
    for (const actor of run.tasks[id].reviewersForVersion) act({id,actor,action:decision,note:'Example decision'});
  }
  return {act, submit, finish, get run(){return run;}};
}
for (const path of ['detailed','early']) test(`34 stages and 13 gates clear on ${path} permit path`, () => {
  const s = rehearsal(path), order = [];
  while (order.length < 34) {
    const task = Object.values(s.run.tasks).find(t => t.status === 'Ready');
    assert.ok(task);
    s.finish(task.id); order.push(task.id);
  }
  assert.equal(s.run.gatesVerified, 13);
  assert.equal(s.run.readiness, true);
  assert.ok(order.indexOf(30) < order.indexOf(28));
  assert.ok(order.indexOf(33) < order.indexOf(34));
  assert.equal(order.indexOf(33) < order.indexOf(27), path === 'early');
});
test('locked work, missing evidence, self-approval and repeated decisions are rejected', () => {
  const s = rehearsal();
  assert.throws(() => s.act({id:2,actor:'sales',action:'start'}), /prerequisites/);
  s.act({id:1,actor:'sales',action:'start'});
  assert.throws(() => s.act({id:1,actor:'sales',action:'submit',evidence:['Agreement']}), /Every deliverable/);
  s.submit(1);
  const approve = actor => s.act({id:1,actor,action:'approve',note:'Example decision'});
  assert.throws(() => approve('sales'), /independent/);
  approve('client');
  assert.equal(s.run.tasks[2].status, 'Locked');
  assert.throws(() => approve('client'), /independent/);
  approve('admin');
  assert.equal(s.run.tasks[2].status, 'Ready');
});
test('No-Go blocks design; new evidence invalidates current and downstream approvals', () => {
  const s = rehearsal();
  for (const id of [1,2,3,4,5,7]) s.finish(id);
  s.finish(6,'noGo');
  assert.equal(s.run.tasks[8].status,'Locked');
  s.submit(6,2);
  s.act({id:6,actor:'vpPrecon',action:'approve',note:'Rechecked risk'});
  s.finish(8);
  s.submit(6,3);
  assert.deepEqual(s.run.tasks[6].approvals,{});
  assert.deepEqual(s.run.tasks[8].approvals,{});
  assert.equal(s.run.tasks[8].status,'Locked');
  assert.equal(s.run.tasks[6].revisions.length,3);
});