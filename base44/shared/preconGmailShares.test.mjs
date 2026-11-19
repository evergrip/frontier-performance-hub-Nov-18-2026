import test from 'node:test';
import assert from 'node:assert/strict';
import { readGmailShare, saveGmailShare } from './preconGmailShares.ts';

const member = allowed => ({filter:async ({user_id})=>({items:allowed.includes(user_id)?[{user_id}]:[]})});
test('leaving the project blocks history, message and attachment before file access',async()=>{
  const db={PreconGmailProjectMember:member(['original-sender'])};
  for (const action of ['history','open','download']) await assert.rejects(readGmailShare({},db,{id:'removed'},{action,projectId:'job1',shareId:'share1',attachmentId:'1'}),{status:404});
});
test('current non-selected team members, including an admin, cannot open or download',async()=>{
  const db={PreconGmailProjectMember:member(['admin']),PreconGmailProjectShare:{filter:async()=>({items:[{actor_id:'sender',recipient_ids:['selected']}]})}};
  for (const action of ['open','download']) await assert.rejects(readGmailShare({},db,{id:'admin',role:'admin'},{action,projectId:'job1',shareId:'share1',attachmentId:'1'}),{status:404});
});
test('a share to an unassigned project fails before Gmail, database writes or storage',async()=>{
  await assert.rejects(saveGmailShare({}, {PreconGmailProjectMember:member([])}, {id:'sender'}, {projectId:'other',messageId:'m1',recipientIds:['selected'],attachmentIds:[],confirmed:true}),{status:404});
});
test('the server requires explicit confirmation and rejects a recipient outside the team',async()=>{
  const db={PreconGmailProjectMember:member(['sender']),User:{filter:async()=>[]}};
  const input={projectId:'job1',messageId:'m1',recipientIds:['other'],attachmentIds:[]};
  await assert.rejects(saveGmailShare({},db,{id:'sender'},input),{status:400});
  await assert.rejects(saveGmailShare({},db,{id:'sender'},{...input,confirmed:true}),{status:409});
});