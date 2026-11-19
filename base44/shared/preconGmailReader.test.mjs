import test from 'node:test';
import assert from 'node:assert/strict';
import { currentMailbox, gmailPage, gmailThread } from './preconGmailReader.ts';
import { authorizeGmailPilot, isShareViewer } from './preconGmailAccess.ts';

const email = id => ({id,threadId:'t1',internalDate:'5000',payload:{mimeType:'multipart/mixed',headers:[{name:'Subject',value:'Quotation'}],parts:[{mimeType:'text/plain',body:{data:'RnVsbCBtZXNzYWdl'}},{partId:'2',filename:'drawing.pdf',mimeType:'application/pdf',body:{attachmentId:'attachment'}}]}});
test('inbox loads ten and sends private search to Gmail',async()=>{
  const api = async (path,params)=>{ if (path !== 'messages') return email(path.split('/')[1]);
    assert.equal(params.maxResults,'10'); assert.equal(params.q,'from:client'); assert.equal(params.labelIds,undefined);
    return {messages:[{id:'m1'}],nextPageToken:'next'};
  };
  assert.deepEqual((await gmailPage(api,{query:'from:client'})).messages.map(m=>m.subject),['Quotation']);
});
test('mixed search results preserve the recipient and identify sent messages by Gmail label',async()=>{
  const api = async path => {
    if (path === 'messages') return {messages:[{id:'sent'},{id:'received'}]};
    const id = path.split('/')[1], sent = id === 'sent', raw = email(id);
    raw.payload.headers.push({name:'From',value:sent ? 'me@example.com' : 'client@example.com'}, {name:'To',value:sent ? 'client@example.com' : 'me@example.com'});
    return {...raw, labelIds:[sent ? 'SENT' : 'INBOX']};
  };
  const {messages} = await gmailPage(api,{query:'Quotation'});
  assert.deepEqual(messages.map(({isSent,from,to}) => isSent ? to : from), ['client@example.com','client@example.com']);
  assert.deepEqual(messages.map(({isSent}) => isSent), [true,false]);
});
test('thread reads full bodies and never downloads named attachments while opening',async()=>{
  const api=async(path,params)=>{assert.equal(path,'threads/t1');assert.equal(params.format,'full');return {messages:[email('m1'),email('m2')]};};
  const result=await gmailThread(api,'t1');
  assert.equal(result.messages.length,2);assert.equal(result.messages[1].body[0].text,'Full message');assert.equal(result.messages[1].attachments[0].name,'drawing.pdf');
});
test('caller connection is the only token used; other account ID and path traversal rejected',async()=>{
  const base44={asServiceRole:{connectors:{getCurrentAppUserConnection:async()=>({accessToken:'current-user-only'})}}};
  const api=await currentMailbox(base44,async (url,opts)=>{
    assert.equal(opts.method,undefined);assert.equal(opts.headers.Authorization,'Bearer current-user-only');
    assert.equal(url.pathname,'/gmail/v1/users/me/threads/other-users-thread');return new Response(null,{status:404});
  });
  await assert.rejects(gmailThread(api,'other-users-thread'),{status:404});
  await assert.rejects(gmailThread(api,'../../users/other'),{status:400});
});
test('non-enrolled users cannot access pilot; share access never grants admin override',async()=>{
  const base44={auth:{me:async()=>({id:'u',role:'user',permissions:['pipeline_precon']})},asServiceRole:{entities:{PreconGmailProjectMember:{filter:async()=>({items:[]})}}}};
  await assert.rejects(authorizeGmailPilot(base44),{status:403});
  for(const id of ['sender','chosen']) assert.equal(isShareViewer(id,{actor_id:'sender',recipient_ids:['chosen']}),true);
  assert.equal(isShareViewer('admin',{actor_id:'sender',recipient_ids:['chosen']}),false);
});