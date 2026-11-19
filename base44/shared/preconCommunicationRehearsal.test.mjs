import test from 'node:test';
import assert from 'node:assert/strict';
import { communicationRehearsal } from './preconCommunicationRehearsal.ts';
function demo() {
  const now = '2026-11-19T10:00:00Z';
  let state = communicationRehearsal([], null, now);
  return (action, confirmed = false) => (state = communicationRehearsal(state.history, {action, confirmed}, now));
}
test('a matching thread creates one evidence recommendation, an uncertain thread needs confirmation', () => {
  const act = demo();
  let state = act('incoming');
  assert.equal(state.messages[0].project, state.project);
  assert.equal(state.task.status,'Ready');
  assert.match(state.attention, /independent Stage 23 reviewer/);
  state = act('incoming');
  assert.equal(state.documents.length, 1);
  assert.match(state.audit.at(-1).note, /Duplicate/);
  assert.equal(act('ambiguous').messages.at(-1).project, null);
  assert.throws(() => act('associate'), /Confirm/);
  assert.equal(act('associate', true).messages.at(-1).project, state.project);
});
test('confirmed send creates one wait, partial reply does not unblock work, revised evidence only clears independent gate after approval', () => {
  const act = demo();
  act('incoming');
  assert.throws(() => act('send'), /Confirm/);
  assert.equal(act('send',true).followUp.state,'Waiting');
  assert.throws(() => act('send',true), /duplicate/);
  assert.equal(act('partial').followUp.state,'Waiting');
  const revised = act('revised');
  assert.equal(revised.documents[0].current,false);
  assert.equal(revised.documents[1].current,true);
  assert.equal(revised.followUp.state,'Needs response validation');
  assert.equal(act('validate',true).task.downstream,'Locked');
  assert.throws(() => act('submit'), /Open a current document/);
  act('preview'); assert.equal(act('submit').task.status,'Review');
  assert.throws(() => act('approve'), /Accept/);
  act('review'); assert.equal(act('accept').task.downstream,'Locked');
  assert.equal(act('approve').task.downstream,'Ready');
});
test('revised evidence triggers revalidation of earlier approved work', () => {
  const act = demo();
  act('incoming'); act('send',true); act('preview'); act('submit'); act('review'); act('accept'); act('approve');
  assert.match(act('revised').attention,/recheck existing approvals/);
  act('preview');
  assert.equal(act('submit').task.downstream,'Locked');
});
test('permission loss, disconnected account and failed sync preserve received evidence', () => {
  const act = demo();
  act('disconnect'); assert.throws(() => act('incoming'), /Restore/);
  act('restore'); act('incoming'); act('permission');
  assert.throws(() => act('preview'), /restore access/);
  act('restore'); act('preview');
  assert.equal(act('syncFailure').documents.length,1);
  assert.throws(() => act('ambiguous'), /Restore/);
  act('restore'); assert.equal(act('submit').task.status,'Review');
});