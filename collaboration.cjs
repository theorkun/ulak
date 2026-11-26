const crypto=require('node:crypto');
const bad=message=>{const e=Error(message);e.status=400;throw e;};
function decodeFile(input,avatar=false){
  if(!input||typeof input.data!=='string')bad('Dosya seçin.');
  const match=/^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(input.data);
  if(!match)bad('Dosya biçimi geçersiz.');
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>(avatar?150000:2*1024*1024)||bytes.toString('base64')!==match[2])bad(avatar?'Fotoğraf en fazla 150 KB olmalı.':'Dosya en fazla 2 MB olmalı.');
  const name=String(input.name||'foto.jpg').replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,120);
  const ext=name.split('.').at(-1).toLowerCase();
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
  const types={png:['image/png',png],jpg:['image/jpeg',jpg],jpeg:['image/jpeg',jpg],pdf:['application/pdf',bytes.subarray(0,5).toString()==='%PDF-'],txt:['text/plain',!bytes.includes(0)],docx:['application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes.subarray(0,4).equals(Buffer.from([80,75,3,4]))],xlsx:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes.subarray(0,4).equals(Buffer.from([80,75,3,4]))]};
  const item=types[ext];if(!item||!item[1]||match[1]!==item[0]||(avatar&&!['jpg','jpeg','png'].includes(ext)))bad('Desteklenmeyen dosya. PDF, TXT, DOCX, XLSX, PNG veya JPG kullanın.');
  return{name,type:item[0],bytes};
}
function install(db){
  const add=(table,name,definition)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);};
  add('users','avatar','BLOB');add('users','avatar_type',"TEXT NOT NULL DEFAULT ''");add('users','avatar_version',"TEXT NOT NULL DEFAULT ''");
  add('sessions','created_at','INTEGER NOT NULL DEFAULT 0');add('sessions','agent',"TEXT NOT NULL DEFAULT ''");
  add('messages','pinned','INTEGER NOT NULL DEFAULT 0');add('messages','announcement','INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS attachments(message_id INTEGER PRIMARY KEY REFERENCES messages(id),name TEXT NOT NULL,type TEXT NOT NULL,bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS hidden_messages(user_id INTEGER NOT NULL REFERENCES users(id),message_id INTEGER NOT NULL REFERENCES messages(id),PRIMARY KEY(user_id,message_id));
    CREATE TABLE IF NOT EXISTS acknowledgements(user_id INTEGER NOT NULL REFERENCES users(id),message_id INTEGER NOT NULL REFERENCES messages(id),created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),PRIMARY KEY(user_id,message_id));`);
}
function createCollaboration({db,body,session,member,json,fail,event,audit,limited,clients,publicUser}){
  return async function handle(req,res,url,user){
    const route=url.pathname,method=req.method;let match;
    if(route==='/api/profile/avatar'&&['POST','DELETE'].includes(method)){
      limited('avatar:'+user.id,10,60000);const file=method==='POST'?decodeFile(await body(req,220000),true):null;session(req);
      db.prepare('UPDATE users SET avatar=?,avatar_type=?,avatar_version=? WHERE id=?').run(file?.bytes||null,file?.type||'',file?crypto.randomBytes(8).toString('hex'):'',user.id);
      audit(user.id,file?'avatar_changed':'avatar_removed',user.id);event({kind:'directory'});json(res,200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),csrf:user.csrf});return true;
    }
    if((match=route.match(/^\/api\/avatars\/(\d+)$/))&&method==='GET'){
      const target=db.prepare('SELECT avatar,avatar_type FROM users WHERE id=? AND active=1').get(Number(match[1]));if(!target?.avatar)fail(404,'Fotoğraf bulunamadı.');res.writeHead(200,{'Content-Type':target.avatar_type,'Cache-Control':'private, no-store'});res.end(target.avatar);return true;
    }
    if(route==='/api/sessions'&&method==='GET'){
      json(res,200,{sessions:db.prepare('SELECT token,created_at,expires,agent FROM sessions WHERE user_id=? AND expires>? ORDER BY created_at DESC').all(user.id,Date.now()).map(s=>({current:s.token===user.session_token,createdAt:s.created_at,expiresAt:s.expires,agent:s.agent}))});return true;
    }
    if(route==='/api/sessions/others'&&method==='DELETE'){
      db.prepare('DELETE FROM sessions WHERE user_id=? AND token!=?').run(user.id,user.session_token);for(const c of clients)if(c.userId===user.id&&c.token!==user.session_token)c.res.end();audit(user.id,'sessions_revoked',user.id);json(res,200,{ok:true});return true;
    }
    if((match=route.match(/^\/api\/attachments\/(\d+)$/))&&method==='GET'){
      const m=db.prepare('SELECT * FROM messages WHERE id=? AND deleted_at IS NULL').get(Number(match[1]));if(!m)fail(404,'Dosya bulunamadı.');member(user.id,m.conversation_id);
      if(db.prepare('SELECT 1 FROM hidden_messages WHERE user_id=? AND message_id=?').get(user.id,m.id))fail(404,'Dosya bulunamadı.');
      const f=db.prepare('SELECT * FROM attachments WHERE message_id=?').get(m.id);if(!f)fail(404,'Dosya bulunamadı.');res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=\"download\"; filename*=UTF-8''"+encodeURIComponent(f.name),'Cache-Control':'private, no-store'});res.end(f.bytes);return true;
    }
    if((match=route.match(/^\/api\/messages\/(\d+)\/(hide|pin|acknowledge|receipts)$/))){
      const m=db.prepare('SELECT * FROM messages WHERE id=?').get(Number(match[1]));if(!m)fail(404,'Mesaj bulunamadı.');member(user.id,m.conversation_id);const action=match[2];
      if(action==='hide'&&method==='POST'){db.prepare('INSERT OR IGNORE INTO hidden_messages VALUES(?,?)').run(user.id,m.id);event({kind:'message',conversationId:m.conversation_id},m.conversation_id);json(res,200,{ok:true});return true;}
      if(action==='receipts'&&method==='GET'){if(!m.announcement||m.deleted_at)fail(404,'Duyuru bulunamadı.');json(res,200,{people:db.prepare('SELECT u.name,a.created_at FROM acknowledgements a JOIN users u ON u.id=a.user_id WHERE message_id=? ORDER BY a.created_at').all(m.id)});return true;}
      if(m.deleted_at)fail(404,'Mesaj silinmiş.');
      if(action==='pin'&&method==='POST'){
        if(!['admin','super_admin'].includes(publicUser(user).role))fail(403,'Sabitlemek için yönetici yetkisi gerekli.');const input=await body(req);session(req);member(user.id,m.conversation_id);if(typeof input.pinned!=='boolean')fail(400,'Sabitleme seçimi gerekli.');
        if(input.pinned&&!m.pinned&&db.prepare('SELECT count(*) n FROM messages WHERE conversation_id=? AND pinned=1 AND deleted_at IS NULL').get(m.conversation_id).n>=3)fail(400,'Bir sohbette en fazla 3 sabit mesaj olabilir.');
        db.prepare('UPDATE messages SET pinned=? WHERE id=?').run(input.pinned?1:0,m.id);audit(user.id,input.pinned?'message_pinned':'message_unpinned',m.id);
      }else if(action==='acknowledge'&&method==='POST'){
        if(!m.announcement)fail(400,'Bu mesaj bir duyuru değil.');db.prepare('INSERT OR IGNORE INTO acknowledgements(user_id,message_id) VALUES(?,?)').run(user.id,m.id);
      }else fail(405,'Yöntem desteklenmiyor.');
      event({kind:'message',conversationId:m.conversation_id},m.conversation_id);json(res,200,{ok:true});return true;
    }
    return false;
  };
}
module.exports={install,decodeFile,createCollaboration};
