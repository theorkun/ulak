const {test}=require('node:test'),assert=require('node:assert/strict');
const {startPreview}=require('../preview.cjs');
test('collaboration respects identity, room access and destructive message semantics',async t=>{
  const p=await startPreview({port:0,quiet:true});t.after(()=>p.close());const base='http://127.0.0.1:'+p.server.address().port,db=p.app.db;
  async function client(username,password){const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(r.status,200);const me=await r.json(),cookie=r.headers.get('set-cookie').split(';')[0];return{id:me.user.id,csrf:me.csrf,cookie,async call(route,input,method){const r=await fetch(base+route,{method:method||(input?'POST':'GET'),headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':me.csrf},body:input?JSON.stringify(input):undefined});return{status:r.status,data:await r.json()};},async download(route){return fetch(base+route,{headers:{Cookie:cookie}});}};}
  const admin=await client('orkun','admin'),staff=await client('demo.bilgi','UlakDemo2026!'),outsider=await client('demo.insan','UlakDemo2026!');
  const rooms=(await admin.call('/api/conversations')).data.conversations,general=rooms.find(r=>r.scope==='general').id,it=rooms.find(r=>r.scope==='department').id;
  const send=(c,room,extra={})=>c.call(`/api/conversations/${room}/messages`,{body:'Test duyuru dosyası',clientId:require('node:crypto').randomUUID(),...extra});
  const file={name:'gundem.pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nTest\n%%EOF').toString('base64')};
  await t.test('files require login and current room membership, reject disguised content',async()=>{
    const posted=await send(admin,it,{attachment:file});assert.equal(posted.status,201);const id=posted.data.id;
    assert.equal((await fetch(base+'/api/attachments/'+id)).status,401);
    assert.equal((await outsider.download('/api/attachments/'+id)).status,404);
    const download=await staff.download('/api/attachments/'+id);assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment;/);assert.equal(await download.text(),'%PDF-1.4\nTest\n%%EOF');
    assert.equal((await send(admin,it,{attachment:{name:'evil.svg',data:'data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64')}})).status,400);
    assert.equal((await send(admin,it,{attachment:{name:'fake.pdf',data:'data:application/pdf;base64,'+Buffer.from('<script>bad</script>').toString('base64')}})).status,400);
  });
  await t.test('profile photos are owned by the caller and do not expose private fields',async()=>{
    const png=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/saricam-belediyesi-logo.png'));
    const result=await staff.call('/api/profile/avatar',{name:'photo.png',data:'data:image/png;base64,'+png.toString('base64'),userId:admin.id});assert.equal(result.status,200);assert.match(result.data.user.avatarUrl,new RegExp('^/api/avatars/'+staff.id));assert.equal('avatar'in result.data.user,false);assert.equal('password'in result.data.user,false);
    assert.deepEqual(Buffer.from(await(await staff.download(result.data.user.avatarUrl)).arrayBuffer()),png);
    assert.equal((await fetch(base+result.data.user.avatarUrl)).status,401);
    assert.equal((await admin.call('/api/me')).data.user.avatarUrl,'');
    assert.ok((await admin.call(`/api/conversations/${it}/messages`)).data.messages.some(m=>m.sender.id===staff.id&&m.sender.avatarUrl));
    assert.equal((await staff.call('/api/profile/avatar',{name:'fake.png',data:'data:image/png;base64,SGVsbG8='})).status,400);
    assert.equal((await staff.call('/api/profile/avatar',null,'DELETE')).status,200);assert.equal((await staff.download(result.data.user.avatarUrl)).status,404);
  });
  let announcement;
  await t.test('only managers announce or pin; acknowledgement uses authenticated identity',async()=>{
    assert.equal((await send(staff,general,{announcement:true})).status,403);
    announcement=(await send(admin,general,{announcement:true})).data.id;
    assert.equal((await staff.call(`/api/messages/${announcement}/pin`,{pinned:true})).status,403);
    assert.equal((await admin.call(`/api/messages/${announcement}/pin`,{pinned:true})).status,200);
    assert.ok((await staff.call('/api/conversations')).data.conversations.find(r=>r.id===general).pins.some(m=>m.id===announcement));
    await staff.call(`/api/messages/${announcement}/acknowledge`,{userId:admin.id});await staff.call(`/api/messages/${announcement}/acknowledge`,{});
    const result=(await staff.call(`/api/conversations/${general}/messages`)).data.messages.find(m=>m.id===announcement);assert.equal(result.acknowledgements,1);assert.equal(result.acknowledged,true);
    assert.equal((await admin.call(`/api/conversations/${general}/messages`)).data.messages.find(m=>m.id===announcement).acknowledged,false);
    assert.equal((await admin.call(`/api/messages/${announcement}/receipts`)).data.people[0].name,'Selin Aydın');
  });
  await t.test('hide affects one account, including previews, counts and searches',async()=>{
    const id=(await send(admin,general,{body:'Sadece benden gizlenecek'})).data.id;
    assert.equal((await staff.call(`/api/messages/${id}/hide`,{})).status,200);
    assert.equal((await staff.call(`/api/conversations/${general}/messages`)).data.messages.some(m=>m.id===id),false);
    assert.equal((await admin.call(`/api/conversations/${general}/messages`)).data.messages.some(m=>m.id===id),true);
    assert.equal((await staff.call('/api/conversations')).data.conversations.find(r=>r.id===general).lastMessage.id===id,false);
    assert.equal((await staff.call('/api/search?q=gizlenecek')).data.messages.length,0);
  });
  await t.test('recall removes text, file and pins for everyone, including quote previews',async()=>{
    const id=(await send(admin,it,{attachment:file,body:'Geri alınacak içerik'})).data.id;
    await send(staff,it,{body:'Yanıt',replyTo:id});await admin.call(`/api/messages/${id}/pin`,{pinned:true});
    assert.equal((await staff.call('/api/messages/'+id,null,'DELETE')).status,404);
    assert.equal((await admin.call('/api/messages/'+id,null,'DELETE')).status,200);
    assert.equal(db.prepare('SELECT body FROM messages WHERE id=?').get(id).body,'');assert.equal(db.prepare('SELECT * FROM attachments WHERE message_id=?').get(id),undefined);
    assert.equal((await staff.download('/api/attachments/'+id)).status,404);
    const rows=(await staff.call(`/api/conversations/${it}/messages`)).data.messages;assert.equal(rows.find(m=>m.id===id).deleted,true);assert.equal(rows.find(m=>m.reply?.id===id).reply.body,'Silinen mesaj');
    assert.equal((await staff.call('/api/search?q=alınacak')).data.messages.length,0);
    assert.equal((await admin.call('/api/messages/'+id,{body:'Restore'},'PATCH')).status,404);
  });
  await t.test('filtered search never reveals inaccessible rooms',async()=>{
    const result=await staff.call(`/api/search?q=Test&room=${general}&sender=${admin.id}&from=2020-01-01&to=2099-12-31`);assert.equal(result.status,200);assert.ok(result.data.messages.length);assert.ok(result.data.messages.every(m=>m.conversationId===general&&m.sender.id===admin.id));
    assert.equal((await outsider.call(`/api/search?q=Test&room=${it}&files=1`)).data.messages.length,0);
    assert.equal((await staff.call('/api/search?q=Test&sender=bad')).status,400);
  });
  await t.test('revoking other sessions leaves the current session active',async()=>{
    const other=await client('orkun','admin');const before=await admin.call('/api/sessions');assert.equal(before.data.sessions.filter(s=>s.current).length,1);assert.equal(before.data.sessions.length,2);
    assert.equal((await admin.call('/api/sessions/others',null,'DELETE')).status,200);assert.equal((await other.call('/api/me')).status,401);assert.equal((await admin.call('/api/me')).status,200);
  });
  await t.test('bulk import is atomic, creates only members and forces a password change',async()=>{
    const departmentId=rooms.find(r=>r.id===it).departmentId,rows=[{name:'Toplu Personel Bir',username:'toplu.bir',departmentId,email:'bir@example.invalid',role:'super_admin'},{name:'Toplu Personel İki',username:'toplu.iki',departmentId,email:''}];
    assert.equal((await staff.call('/api/admin/import',{rows})).status,403);
    const count=db.prepare('SELECT count(*) n FROM users').get().n;
    assert.equal((await admin.call('/api/admin/import',{rows:[rows[0],{...rows[1],departmentId:-1}]})).status,400);assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,count);
    const result=await admin.call('/api/admin/import',{rows});assert.equal(result.status,201);assert.equal(result.data.created.length,2);assert.ok(result.data.created.every(row=>row.user.role==='member'&&row.user.mustChangePassword&&row.temporaryPassword.length>=10));
    const newcomer=await client('toplu.bir',result.data.created[0].temporaryPassword);assert.equal((await newcomer.call('/api/conversations')).status,428);
    assert.equal((await admin.call('/api/admin/import',{rows})).status,400);assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,count+2);
  });
  await t.test('a slow edit cannot restore the body after a concurrent recall',async()=>{
    const id=(await send(admin,it,{body:'Yarışan geri alma'})).data.id,http=require('node:http');
    let finish;const started=new Promise(resolve=>{finish=resolve;});
    const result=new Promise((resolve,reject)=>{const req=http.request(base+'/api/messages/'+id,{method:'PATCH',headers:{Origin:base,Cookie:admin.cookie,'X-CSRF-Token':admin.csrf,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.flushHeaders();req.write('{"body":');finish(req);});
    const request=await started;await new Promise(r=>setTimeout(r,30));assert.equal((await admin.call('/api/messages/'+id,null,'DELETE')).status,200);request.end('"Geri gelen metin"}');assert.equal(await result,404);assert.equal(db.prepare('SELECT body FROM messages WHERE id=?').get(id).body,'');
  });
});
