const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {startPreview}=require('../preview.cjs'),{decodeBinary}=require('../collaboration.cjs'),limits=require('../public/upload-limits.js');
test('100 MB boundary is exact and phone formats retain their original bytes',()=>{
  const buffer=Buffer.alloc(limits.fileBytes+1);buffer.write('II');buffer.writeUInt16LE(42,2);buffer.writeUInt32LE(8,4);
  assert.equal(decodeBinary({name:'photo.dng',type:'image/x-adobe-dng'},buffer.subarray(0,limits.fileBytes)).bytes.length,100*1024*1024);
  assert.throws(()=>decodeBinary({name:'photo.dng',type:'image/x-adobe-dng'},buffer),{status:400});
  assert.throws(()=>decodeBinary({name:'photo.heic',type:'image/heic'},Buffer.from('not a HEIC')),{status:400});
});
test('ProRAW-style DNG uses its embedded JPEG for viewing, never executes contents',async()=>{
  const bytes=fs.readFileSync(path.join(__dirname,'fixtures/preview/phone.dng'));let answer;const context=vm.createContext({Blob,ArrayBuffer,DataView,Uint8Array,Set,Map});context.self=context;context.postMessage=result=>{answer=result;};vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/photo-preview-worker.js'),'utf8'),context);await context.onmessage({data:{kind:'dng',buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}});assert.equal(answer.error,undefined);assert.equal(answer.blob.type,'image/jpeg');const jpg=Buffer.from(await answer.blob.arrayBuffer());assert.equal(jpg[0],255);assert.equal(jpg[1],216);assert.ok(jpg.length>100);
});
test('75 MB photo uploads as binary with permissions, duplicate protection and recall',async t=>{
  const p=await startPreview({port:0,quiet:true});t.after(()=>p.close());const base='http://127.0.0.1:'+p.server.address().port;
  const login=async(username,password)=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username,password})}),me=await r.json();return{cookie:r.headers.get('set-cookie').split(';')[0],csrf:me.csrf};};
  const admin=await login('orkun','admin'),other=await login('demo.insan','UlakDemo2026!');
  const rooms=await(await fetch(base+'/api/conversations',{headers:{Cookie:admin.cookie}})).json(),id=rooms.conversations.find(r=>r.scope==='department').id;
  const bytes=Buffer.alloc(75*1024*1024);fs.readFileSync(path.join(__dirname,'fixtures/preview/phone.dng')).copy(bytes);const input={body:'iPhone photo test',clientId:crypto.randomUUID(),announcement:false,attachment:{name:'phone.dng',type:'image/x-adobe-dng'}};
  const metadata=Buffer.from(JSON.stringify(input)),prefix=Buffer.alloc(4);prefix.writeUInt32BE(metadata.length);
  const payload=new Blob([prefix,metadata,bytes],{type:'application/x-turkuaz-upload'});
  const upload=(client,body=payload)=>fetch(base+`/api/conversations/${id}/file-message`,{method:'POST',headers:{Origin:base,Cookie:client.cookie,'X-CSRF-Token':client.csrf,'Content-Type':'application/x-turkuaz-upload'},body});
  assert.equal((await upload(other,new Blob([prefix,metadata,bytes.subarray(0,100)]))).status,404);
  const r=await upload(admin);assert.equal(r.status,201);const posted=await r.json();assert.equal(p.app.db.prepare('SELECT length(bytes) n FROM attachments WHERE message_id=?').get(posted.id).n,75*1024*1024);
  const duplicate=await upload(admin,new Blob([prefix,metadata,bytes.subarray(0,4096)]));assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).id,posted.id);
  const view=await fetch(base+'/api/attachments/'+posted.id+'?view=1',{headers:{Cookie:admin.cookie}});assert.equal(view.headers.get('content-type'),'image/x-adobe-dng');const received=Buffer.from(await view.arrayBuffer());assert.deepEqual(received.subarray(0,4096),bytes.subarray(0,4096));assert.equal(received.length,bytes.length);
  assert.equal((await upload(admin,new Blob([Buffer.from([0,0,255,255,1])]))).status,400);
  const del=await fetch(base+'/api/messages/'+posted.id,{method:'DELETE',headers:{Origin:base,Cookie:admin.cookie,'X-CSRF-Token':admin.csrf}});assert.equal(del.status,200);assert.equal(p.app.db.prepare('SELECT * FROM attachments WHERE message_id=?').get(posted.id),undefined);
});
