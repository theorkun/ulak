const {test}=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {createChat}=require('../server.cjs');
test('old schema migrates without deleting private history or exposing it as a room',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ulak-migration-')),dbPath=path.join(dir,'old.db');const db=new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,department TEXT NOT NULL DEFAULT '',password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,must_change INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT '2026-11-24');
  CREATE TABLE conversations(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL DEFAULT '',topic TEXT NOT NULL DEFAULT '',creator_id INTEGER NOT NULL,direct_key TEXT UNIQUE,created_at TEXT NOT NULL DEFAULT '2026-11-24');
  CREATE TABLE members(conversation_id INTEGER NOT NULL,user_id INTEGER NOT NULL,last_read INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(conversation_id,user_id));
  CREATE TABLE messages(id INTEGER PRIMARY KEY,conversation_id INTEGER NOT NULL,sender_id INTEGER NOT NULL,body TEXT NOT NULL,client_id TEXT NOT NULL,reply_to INTEGER,created_at TEXT NOT NULL DEFAULT '2026-11-24T10:00:00Z',edited_at TEXT,deleted_at TEXT,UNIQUE(sender_id,client_id));
  INSERT INTO users(id,username,name,department,password,role) VALUES(1,'old-admin','Eski Yönetici','Bilgi İşlem','unused','admin'),(2,'old-staff','Eski Personel','İnsan Kaynakları','unused','member');
  INSERT INTO conversations(id,kind,title,creator_id) VALUES(10,'group','Genel sohbet',1),(11,'direct','',1),(12,'group','Eski proje',1);
  INSERT INTO members(conversation_id,user_id,last_read) VALUES(10,1,7),(10,2,0),(11,1,0),(11,2,0),(12,1,0);
  INSERT INTO messages(conversation_id,sender_id,body,client_id) VALUES(10,1,'Genel geçmiş','old-general'),(11,1,'Özel geçmiş','old-private'),(12,1,'Eski grup geçmişi','old-group');`);db.close();
  let app;
  try{
    app=createChat({dbPath});assert.equal(app.db.prepare("SELECT title FROM conversations WHERE scope='general'").get().title,'Genel Alan');assert.ok(app.db.prepare("SELECT count(*) n FROM conversations WHERE scope='department'").get().n>=29);
    assert.equal(app.db.prepare('SELECT scope FROM conversations WHERE id=11').get().scope,'legacy');assert.equal(app.db.prepare('SELECT scope FROM conversations WHERE id=12').get().scope,'legacy');assert.equal(app.db.prepare('SELECT count(*) n FROM messages').get().n,3);assert.equal(app.db.prepare('SELECT last_read FROM members WHERE conversation_id=10 AND user_id=1').get().last_read,7);
    const count=app.db.prepare('SELECT count(*) n FROM conversations').get().n;await app.close();app=createChat({dbPath});assert.equal(app.db.prepare('SELECT count(*) n FROM conversations').get().n,count);assert.equal(app.db.prepare('SELECT count(*) n FROM messages').get().n,3);
  }finally{if(app)await app.close();assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('ulak-migration-'));fs.rmSync(dir,{recursive:true,force:true});}
});
