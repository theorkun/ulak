const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createChat}=require('../server.cjs');
test('ULAK managed directorate rooms, authentication and 200 live connections',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ulak-test-')),dbPath=path.join(dir,'test.db');let app=createChat({dbPath,setupToken:'test-token'}),base;
  async function listen(){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}await listen();
  t.after(async()=>{await app.close();assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('ulak-test-'));fs.rmSync(dir,{recursive:true,force:true});});
  function client(){const c={cookie:'',csrf:'',id:0};c.call=async(route,data,method,extra={})=>{const response=await fetch(base+route,{method:method||(data?'POST':'GET'),headers:{Origin:base,Cookie:c.cookie,...(data||method?{'Content-Type':'application/json','X-CSRF-Token':c.csrf}:{}),...extra},body:data?JSON.stringify(data):undefined});if(response.headers.get('set-cookie'))c.cookie=response.headers.get('set-cookie').split(';')[0];const result=await response.json();if(result.csrf)c.csrf=result.csrf;if(result.user)c.id=result.user.id;return{status:response.status,data:result};};return c;}
  const admin=client(),alice=client(),bob=client(),eve=client(),visitor=client();const password='Test-Password-2026!';let general,it,hr,deptIt,deptHr,firstMessage;
  await t.test('setup creates general and own directorate; regular login requires password',async()=>{
    assert.equal((await visitor.call('/api/status')).data.setupRequired,true);assert.equal((await visitor.call('/api/conversations')).status,401);
    assert.equal((await visitor.call('/api/setup',{token:'bad'})).status,403);
    assert.equal((await admin.call('/api/setup',{token:'test-token',name:'Test Admin',username:'admin',password,department:'Bilgi İşlem Müdürlüğü'})).status,201);
    assert.equal((await visitor.call('/api/setup',{})).status,409);
    const rooms=(await admin.call('/api/conversations')).data.conversations;assert.equal(rooms.length,2);general=rooms.find(r=>r.scope==='general').id;it=rooms.find(r=>r.scope==='department').id;deptIt=rooms.find(r=>r.scope==='department').departmentId;
    assert.ok(rooms.every(r=>r.kind==='group'));assert.notEqual(app.db.prepare('SELECT password FROM users WHERE id=?').get(admin.id).password,password);
    assert.equal((await visitor.call('/api/login',{username:'admin',password:'wrong'})).status,401);
    assert.equal((await visitor.call('/api/status')).data.previewPassword,undefined);
  });
  await t.test('administrators manage directorates and assign staff',async()=>{
    const dept=(await admin.call('/api/admin/departments',{name:'İnsan Kaynakları Müdürlüğü'})).data.department;deptHr=dept.id;
    assert.equal((await admin.call('/api/admin/departments',{name:'insan kaynakları müdürlüğü'})).data.department.id,deptHr);
    for(const[username,c,departmentId]of[['alice',alice,deptIt],['bob',bob,deptIt],['eve',eve,deptHr]]){
      const result=await admin.call('/api/admin/users',{username,name:'Test '+username,departmentId});assert.equal(result.status,201);const temp=result.data.temporaryPassword;
      assert.equal((await c.call('/api/login',{username,password:temp})).data.user.mustChangePassword,true);assert.equal((await c.call('/api/conversations')).status,428);
      assert.equal((await c.call('/api/password',{currentPassword:temp,password})).status,200);
    }
    hr=(await eve.call('/api/conversations')).data.conversations.find(r=>r.scope==='department').id;
    assert.equal((await alice.call('/api/admin/departments')).status,403);assert.equal((await alice.call('/api/admin/users',{})).status,403);
    assert.equal((await admin.call('/api/admin/users',{username:'bad-dept',name:'Bad Department',departmentId:99999})).status,400);
  });
  await t.test('direct and arbitrary groups are denied for every role',async()=>{
    for(const c of[admin,alice])for(const kind of['direct','group'])assert.equal((await c.call('/api/conversations',{kind,members:[bob.id],title:'Forbidden'})).status,403);
    const legacy=Number(app.db.prepare("INSERT INTO conversations(kind,title,creator_id,direct_key) VALUES('direct','',?,'legacy-direct')").run(alice.id).lastInsertRowid);
    for(const id of[alice.id,bob.id])app.db.prepare('INSERT INTO members(conversation_id,user_id) VALUES(?,?)').run(legacy,id);
    app.db.prepare('INSERT INTO messages(conversation_id,sender_id,body,client_id) VALUES(?,?,?,?)').run(legacy,alice.id,'archived-secret','legacy-message');
    assert.equal((await alice.call(`/api/conversations/${legacy}/messages`)).status,404);
    assert.equal((await alice.call('/api/search?q=archived-secret')).data.messages.length,0);
    assert.equal((await alice.call('/api/conversations')).data.conversations.length,2);
  });
  await t.test('personnel see own directorate and General only, including administrators',async()=>{
    assert.equal((await eve.call(`/api/conversations/${it}/messages`)).status,404);assert.equal((await admin.call(`/api/conversations/${hr}/messages`)).status,404);
    assert.equal((await eve.call(`/api/conversations/${it}/messages`,{body:'Intrusion',clientId:crypto.randomUUID()})).status,404);
    assert.equal((await eve.call(`/api/conversations/${it}/read`,{lastId:0})).status,404);
    assert.equal((await eve.call(`/api/conversations/${general}/messages`)).status,200);
  });
  await t.test('posts are idempotent; unread, search and replies respect room boundaries',async()=>{
    const input={body:'GÖRÜŞME müdürlük içi <img src=x>',clientId:crypto.randomUUID()};const sent=await alice.call(`/api/conversations/${it}/messages`,input);assert.equal(sent.status,201);firstMessage=sent.data.id;
    assert.equal((await alice.call(`/api/conversations/${it}/messages`,input)).data.id,firstMessage);
    assert.equal((await bob.call('/api/conversations')).data.conversations.find(r=>r.id===it).unread,1);
    assert.equal((await bob.call('/api/search?q=gorusme')).data.messages.length,1);assert.equal((await eve.call('/api/search?q=gorusme')).data.messages.length,0);
    assert.equal((await bob.call(`/api/conversations/${it}/read`,{lastId:firstMessage})).status,200);assert.equal((await bob.call('/api/conversations')).data.conversations.find(r=>r.id===it).unread,0);
    assert.equal((await bob.call(`/api/conversations/${it}/messages`,{body:'Yanıt',clientId:crypto.randomUUID(),replyTo:firstMessage})).status,201);
    assert.equal((await bob.call(`/api/conversations/${general}/messages`,{body:'Cross-room',clientId:crypto.randomUUID(),replyTo:firstMessage})).status,400);
    assert.equal((await bob.call(`/api/messages/${firstMessage}`,{body:'Other edit'},'PATCH')).status,404);
    assert.equal((await alice.call(`/api/messages/${firstMessage}`,{body:'Görüşme güncellendi.'},'PATCH')).status,200);
    assert.equal((await alice.call(`/api/messages/${firstMessage}`,null,'DELETE')).status,200);
    const rows=(await bob.call(`/api/conversations/${it}/messages`)).data.messages;assert.equal(rows[0].body,'');assert.equal(rows[1].reply.body,'Silinen mesaj');
  });
  await t.test('changing a directorate revokes old room, search and posting immediately',async()=>{
    await bob.call(`/api/conversations/${it}/messages`,{body:'old-department-secret',clientId:crypto.randomUUID()});
    assert.equal((await admin.call('/api/admin/users/'+alice.id,{departmentId:deptHr},'PATCH')).status,200);
    const rooms=(await alice.call('/api/conversations')).data.conversations;assert.ok(rooms.some(r=>r.id===hr));assert.ok(!rooms.some(r=>r.id===it));
    assert.equal((await alice.call(`/api/conversations/${it}/messages`)).status,404);assert.equal((await alice.call('/api/search?q=old-department-secret')).data.messages.length,0);
    assert.equal((await alice.call(`/api/conversations/${it}/messages`,{body:'no',clientId:crypto.randomUUID()})).status,404);
    await admin.call('/api/admin/users/'+alice.id,{departmentId:deptIt},'PATCH');
  });
  await t.test('CSRF, origin and host validation remain enforced',async()=>{
    assert.equal((await alice.call(`/api/conversations/${it}/messages`,{body:'x',clientId:crypto.randomUUID()},'POST',{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await alice.call(`/api/conversations/${it}/messages`,{body:'x',clientId:crypto.randomUUID()},'POST',{Origin:'http://evil.invalid'})).status,403);
    const status=await new Promise((resolve,reject)=>require('node:http').get(base+'/api/status',{headers:{Host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));assert.equal(status,403);
  });
  async function stream(c){const controller=new AbortController();const response=await fetch(base+'/api/events',{headers:{Cookie:c.cookie},signal:controller.signal});assert.equal(response.status,200);return{controller,reader:response.body.getReader()};}
  async function until(s,predicate){let timer;try{return await Promise.race([(async()=>{let value='';while(true){const r=await s.reader.read();if(r.done)throw Error('Stream ended');value+=new TextDecoder().decode(r.value);if(predicate(value))return value;}})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SSE timeout')),10000);})]);}finally{clearTimeout(timer);}}
  await t.test('events for a different directorate are not delivered',async()=>{
    const s=await stream(eve);try{await until(s,v=>v.includes('connected'));await bob.call(`/api/conversations/${it}/messages`,{body:'private-event',clientId:crypto.randomUUID()});await bob.call(`/api/conversations/${general}/messages`,{body:'general-marker',clientId:crypto.randomUUID()});const value=await until(s,v=>v.includes(`"conversationId":${general}`));assert.equal(new RegExp(`"conversationId":${it}(?=[,}])`).test(value),false);}finally{s.controller.abort();}
  });
  await t.test('200 live connections receive General Area updates',async()=>{
    const stored=app.db.prepare('SELECT password FROM users WHERE id=?').get(admin.id).password,clients=[];app.db.exec('BEGIN');
    try{for(let i=0;i<200;i++){const id=Number(app.db.prepare("INSERT INTO users(username,name,password,role,department,department_id) VALUES(?,?,?,'member',?,?)").run('load-'+i,'Load '+i,stored,'Bilgi İşlem Müdürlüğü',deptIt).lastInsertRowid);for(const room of[general,it])app.db.prepare('INSERT INTO members(conversation_id,user_id) VALUES(?,?)').run(room,id);const token=crypto.randomBytes(32).toString('hex');app.db.prepare('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),id,'load',Date.now()+60000);clients.push({cookie:'kn_session='+token});}app.db.exec('COMMIT');}catch(e){app.db.exec('ROLLBACK');throw e;}
    const streams=await Promise.all(clients.map(stream));try{await Promise.all(streams.map(s=>until(s,v=>v.includes('connected'))));assert.equal((await admin.call(`/api/conversations/${general}/messages`,{body:'Load marker',clientId:crypto.randomUUID()})).status,201);await Promise.all(streams.map(s=>until(s,v=>v.includes(`"kind":"message","conversationId":${general}`))));}finally{streams.forEach(s=>s.controller.abort());}
  });
  await t.test('history paging, account reset and disabled-account protection',async()=>{
    for(let i=0;i<60;i++)app.db.prepare('INSERT INTO messages(conversation_id,sender_id,body,client_id) VALUES(?,?,?,?)').run(it,bob.id,'history '+i,crypto.randomUUID());
    const rows=(await bob.call(`/api/conversations/${it}/messages`)).data;assert.equal(rows.messages.length,50);assert.equal(rows.hasMore,true);assert.equal((await eve.call(`/api/conversations/${it}/messages?before=${rows.messages[0].id}`)).status,404);
    assert.equal((await admin.call('/api/admin/users/'+eve.id,{active:false},'PATCH')).status,200);assert.equal((await eve.call('/api/me')).status,401);
    const reset=await admin.call(`/api/admin/users/${alice.id}/reset`,{});assert.equal(reset.status,200);assert.equal((await alice.call('/api/me')).status,401);
    app.db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(bob.id);assert.equal((await bob.call('/api/me')).status,401);
  });
  await t.test('restart preserves posts and archived data without reopening direct chat',async()=>{
    const total=app.db.prepare('SELECT count(*) n FROM messages').get().n;await app.close();app=createChat({dbPath});await listen();
    assert.equal((await visitor.call('/api/status')).data.setupRequired,false);await bob.call('/api/login',{username:'bob',password});assert.equal((await bob.call('/api/conversations')).data.conversations.length,2);assert.equal(app.db.prepare('SELECT count(*) n FROM messages').get().n,total);
    assert.equal((await bob.call('/api/search?q=archived-secret')).data.messages.length,0);assert.equal((await fetch(base+'/data/kurumnet.db')).status,404);
  });
});
