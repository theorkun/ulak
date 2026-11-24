const {test}=require('node:test'),assert=require('node:assert/strict');
const {createChat}=require('../server.cjs');
async function fixture(t,enabled=true,deliveryOverride){
  const sent=[],app=createChat({dbPath:':memory:',setupToken:'recovery-test-setup',recoveryChannels:enabled?['email','sms']:[],recoveryDelivery:deliveryOverride|| (async message=>sent.push(message))});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
  const call=async(route,data,auth)=>{const response=await fetch(base+route,{method:data?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{})},body:data?JSON.stringify(data):undefined});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const setup=await call('/api/setup',{token:'recovery-test-setup',name:'Test Admin',username:'test.admin',department:'Yönetim',password:'Original-password!'}),auth={cookie:setup.cookie,csrf:setup.data.csrf};
  app.db.prepare('UPDATE users SET email=?,phone=? WHERE id=1').run('person@example.invalid','+905320000000');
  const request=channel=>call('/api/recovery/request',{username:'test.admin',channel});
  const delivery=async()=>{for(let i=0;i<30&&!sent.length;i++)await new Promise(r=>setTimeout(r,5));assert.ok(sent.length);return sent.at(-1);};
  return{app,call,request,delivery,sent,auth,base};
}
test('email recovery is single-use, hashes codes, hides contact data and revokes existing sessions',async t=>{
  const f=await fixture(t);const reply=await f.request('email');assert.equal(reply.status,200);assert.match(reply.data.requestId,/^[a-f0-9]{48}$/);assert.equal('code' in reply.data,false);
  const message=await f.delivery();assert.equal(message.channel,'email');assert.equal(message.to,'person@example.invalid');
  const stored=f.app.db.prepare('SELECT * FROM password_recovery').get();assert.notEqual(stored.code_hash,message.code);assert.equal(stored.expires>Date.now(),true);
  const input={requestId:reply.data.requestId,code:message.code,password:'Replacement-password!'};
  assert.equal((await f.call('/api/recovery/confirm',input)).status,200);
  assert.equal((await f.call('/api/me',null,f.auth)).status,401);
  assert.equal((await f.call('/api/recovery/confirm',input)).status,400);
  assert.equal((await f.call('/api/login',{username:'test.admin',password:'Replacement-password!'})).status,200);
  assert.equal((await f.call('/api/login',{username:'test.admin',password:'Original-password!'})).status,401);
});
test('SMS uses stored destination; unknown account gets the same neutral response; codes expire and lock',async t=>{
  const f=await fixture(t),unknown=await f.call('/api/recovery/request',{username:'unknown.person',channel:'sms'}),reply=await f.request('sms');
  assert.equal(unknown.status,reply.status);assert.equal(unknown.data.message,reply.data.message);
  const message=await f.delivery();assert.equal(message.to,'+905320000000');assert.equal(message.channel,'sms');assert.equal(f.sent.length,1);
  const wrong=message.code==='000000'?'111111':'000000';
  for(let i=0;i<5;i++)assert.equal((await f.call('/api/recovery/confirm',{requestId:reply.data.requestId,code:wrong,password:'Replacement-password!'})).status,400);
  assert.equal((await f.call('/api/recovery/confirm',{requestId:reply.data.requestId,code:message.code,password:'Replacement-password!'})).status,400);
  const second=await f.request('sms');await new Promise(r=>setTimeout(r,10));
  f.app.db.prepare('UPDATE password_recovery SET expires=0').run();
  assert.equal((await f.call('/api/recovery/confirm',{requestId:second.data.requestId,code:f.sent.at(-1).code,password:'Replacement-password!'})).status,400);
});
test('changing contact information invalidates pending recovery; personal contacts stay admin-only',async t=>{
  const f=await fixture(t),reply=await f.request('email'),message=await f.delivery();
  const response=await fetch(f.base+'/api/admin/users/1',{method:'PATCH',headers:{Origin:f.base,'Content-Type':'application/json',Cookie:f.auth.cookie,'X-CSRF-Token':f.auth.csrf},body:JSON.stringify({email:'updated@example.invalid',phone:'0532 123 45 67'})});assert.equal(response.status,200);
  assert.equal((await f.call('/api/recovery/confirm',{requestId:reply.data.requestId,code:message.code,password:'Replacement-password!'})).status,400);
  const admin=await f.call('/api/admin/users',null,f.auth);assert.equal(admin.data.users[0].phone,'+905321234567');assert.equal(admin.data.users[0].email,'updated@example.invalid');
  const rooms=await f.call('/api/conversations',null,f.auth);assert.equal(JSON.stringify(rooms.data).includes('updated@example.invalid'),false);
  assert.equal('email' in (await f.call('/api/me',null,f.auth)).data.user,false);
  assert.equal((await f.call('/api/recovery/request',{username:'another.person',channel:'sms',phone:'+905329999999'})).status,200);
  assert.equal(f.sent.length,1);
});
test('unconfigured channels do not claim delivery, reject cross-origin requests and limit guessing',async t=>{
  const f=await fixture(t,false);assert.equal((await f.request('email')).status,503);assert.equal(f.sent.length,0);
  const status=await f.call('/api/status');assert.deepEqual(status.data.recoveryChannels,{email:false,sms:false});
  const bad=await fetch(f.base+'/api/recovery/request',{method:'POST',headers:{Origin:'https://other.invalid','Content-Type':'application/json'},body:JSON.stringify({username:'test.admin',channel:'email'})});assert.equal(bad.status,403);
  for(let i=0;i<5;i++)await f.request('email');assert.equal((await f.request('email')).status,429);
});
test('provider failure invalidates the code and records no code, destination or provider secret',async t=>{
  const f=await fixture(t,true,async()=>{throw Error('private provider detail');});
  assert.equal((await f.request('email')).status,200);
  for(let i=0;i<30&&!f.app.db.prepare("SELECT id FROM audit WHERE action='recovery_delivery_failed'").get();i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(f.app.db.prepare('SELECT count(*) n FROM password_recovery').get().n,0);
  const entry=f.app.db.prepare("SELECT * FROM audit WHERE action='recovery_delivery_failed'").get();assert.ok(entry);
  assert.equal(JSON.stringify(entry).includes('person@example.invalid'),false);assert.equal(JSON.stringify(entry).includes('private provider detail'),false);
});
