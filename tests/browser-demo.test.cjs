const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function demo(){const context=vm.createContext({window:{ULAK_DEMO_DEPARTMENTS:require('../department-catalog.cjs').names},URL,crypto:require('node:crypto').webcrypto});vm.runInContext(fs.readFileSync(path.join(root,'demo/browser-demo.js'),'utf8'),context);return context.window.ULAK_DEMO.request;}
test('Pages demo enforces simulated login, room scope and message ownership without network access',async()=>{
  const request=demo();
  await assert.rejects(request('/api/conversations'),{status:401});
  await assert.rejects(request('/api/login',{username:'demo.insan',password:'wrong'}),{status:401});
  const me=await request('/api/login',{username:'demo.insan',password:'UlakDemo2026!'});
  assert.equal('password' in me.user,false);
  const {conversations}=await request('/api/conversations');assert.equal(conversations.length,2);
  const other=(await request('/api/directory')).departments.find(d=>!d.accessible);
  await assert.rejects(request(`/api/conversations/${other.id+1}/messages`),{status:403});
  await assert.rejects(request('/api/admin/users'),{status:403});
  await assert.rejects(request('/api/messages/3',{body:'Changed'},'PATCH'),{status:403});
  const {message}=await request('/api/conversations/1/messages',{body:'Example message',clientId:'test-send'});
  assert.equal(message.body,'Example message');
  const repeat=await request('/api/conversations/1/messages',{body:'Example message',clientId:'test-send'});assert.equal(repeat.message.id,message.id);
  await request('/api/messages/'+message.id,{body:'Edited'},'PATCH');
  assert.ok((await request('/api/search?q=Edited')).messages.some(m=>m.id===message.id));
  const otherTab=demo();await otherTab('/api/login',{username:'demo.insan',password:'UlakDemo2026!'});
  assert.equal((await otherTab('/api/search?q=Edited')).messages.length,0);
  await request('/api/messages/'+message.id,null,'DELETE');assert.equal((await request('/api/search?q=Edited')).messages.length,0);
});
test('Pages demo account creation, forced password change and reassignment stay in disposable memory',async()=>{
  const request=demo();await request('/api/login',{username:'demo.yonetici',password:'UlakDemo2026!'});
  const {department}=await request('/api/admin/departments',{name:'Example Directorate'});
  const created=await request('/api/admin/users',{name:'Example Person',username:'example.person',role:'member',departmentId:department.id});
  assert.equal('password' in created.user,false);
  await request('/api/logout',{});await request('/api/login',{username:'example.person',password:created.temporaryPassword});
  await assert.rejects(request('/api/conversations'),{status:428});
  await request('/api/password',{currentPassword:created.temporaryPassword,password:'Example-new-password!'});
  assert.ok((await request('/api/conversations')).conversations.some(r=>r.title==='Example Directorate'));
  await request('/api/logout',{});await request('/api/login',{username:'demo.yonetici',password:'UlakDemo2026!'});
  const dept=(await request('/api/directory')).departments[0];await request('/api/admin/users/'+created.user.id,{departmentId:dept.id},'PATCH');
  await request('/api/logout',{});await request('/api/login',{username:'example.person',password:'Example-new-password!'});
  assert.equal((await request('/api/conversations')).conversations[1].title,dept.name);
});
