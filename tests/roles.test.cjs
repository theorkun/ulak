const {test}=require('node:test'),assert=require('node:assert/strict');const {startPreview}=require('../preview.cjs');
test('Orkun is super admin; role changes invalidate sessions and ordinary admins cannot escalate',async t=>{
  const preview=await startPreview({port:0,quiet:true});t.after(()=>preview.close());const base='http://127.0.0.1:'+preview.server.address().port;
  function client(){const c={cookie:'',csrf:''};c.call=async(route,input,method)=>{const r=await fetch(base+route,{method:method||(input?'POST':'GET'),headers:{Origin:base,Cookie:c.cookie,'Content-Type':'application/json','X-CSRF-Token':c.csrf},body:input?JSON.stringify(input):undefined});if(r.headers.get('set-cookie'))c.cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(data.csrf)c.csrf=data.csrf;return{status:r.status,data};};return c;}
  const root=client(),staff=client();let login=await root.call('/api/login',{username:'orkun',password:'admin'});assert.equal(login.data.user.role,'super_admin');const rootId=login.data.user.id;
  login=await staff.call('/api/login',{username:'demo.insan',password:'UlakDemo2026!'});const staffId=login.data.user.id;
  assert.equal((await staff.call('/api/admin/users/'+staffId,{role:'super_admin'},'PATCH')).status,403);
  assert.equal((await root.call('/api/admin/users/'+rootId,{role:'member'},'PATCH')).status,400);
  assert.equal((await root.call('/api/admin/users/'+rootId,{active:false},'PATCH')).status,400);
  assert.equal((await root.call('/api/admin/users/'+staffId,{role:'admin'},'PATCH')).status,200);
  assert.equal((await staff.call('/api/me')).status,401);
  assert.equal((await staff.call('/api/login',{username:'demo.insan',password:'UlakDemo2026!'})).data.user.role,'admin');
  assert.equal((await staff.call('/api/admin/users/'+staffId,{role:'super_admin'},'PATCH')).status,403);
  assert.equal((await staff.call('/api/admin/users/'+rootId,{email:'wrong@example.invalid'},'PATCH')).status,403);
  assert.equal((await staff.call('/api/admin/users/'+rootId+'/reset',{})).status,403);
  const dept=(await root.call('/api/admin/departments')).data.departments[0].id;
  assert.equal((await staff.call('/api/admin/users',{username:'forbidden.admin',name:'Forbidden Admin',departmentId:dept,role:'super_admin'})).status,403);
  assert.equal((await root.call('/api/admin/users/'+staffId,{role:'super_admin'},'PATCH')).status,200);
  assert.equal((await staff.call('/api/login',{username:'demo.insan',password:'UlakDemo2026!'})).data.user.role,'super_admin');
  const rooms=(await root.call('/api/conversations')).data.conversations;assert.equal(rooms.length,2);
  const other=preview.app.db.prepare("SELECT id FROM conversations WHERE scope='department' AND title='İnsan Kaynakları ve Eğitim Müdürlüğü'").get();assert.equal((await root.call('/api/conversations/'+other.id+'/messages')).status,404);
});
