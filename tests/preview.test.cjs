const {test}=require('node:test'),assert=require('node:assert/strict');
const {startPreview}=require('../preview.cjs');
test('preview requires real demo password login and restricts users to two rooms',async t=>{
  const preview=await startPreview({port:0,quiet:true});t.after(()=>preview.close());assert.equal(preview.server.address().address,'127.0.0.1');const base=`http://127.0.0.1:${preview.server.address().port}`;
  const status=await(await fetch(base+'/api/status')).json();assert.equal(status.preview,true);assert.equal(status.setupRequired,false);assert.equal(status.previewAccounts.length,8);
  assert.equal((await fetch(base+'/api/me')).status,401);
  async function login(username,password){const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username,password})});return{status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],data:await r.json()};}
  assert.equal((await login('demo.insan','bad')).status,401);const user=await login('demo.insan','UlakDemo2026!');assert.equal(user.status,200);
  const rooms=await(await fetch(base+'/api/conversations',{headers:{Cookie:user.cookie}})).json();assert.equal(rooms.conversations.length,2);assert.ok(rooms.conversations.some(r=>r.title==='Genel Alan'));assert.ok(rooms.conversations.some(r=>r.title==='İnsan Kaynakları Müdürlüğü'));
  const it=preview.app.db.prepare("SELECT id FROM conversations WHERE scope='department' AND title='Bilgi İşlem Müdürlüğü'").get().id;assert.equal((await fetch(base+`/api/conversations/${it}/messages`,{headers:{Cookie:user.cookie}})).status,404);
});
