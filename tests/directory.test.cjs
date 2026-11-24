const {test}=require('node:test'),assert=require('node:assert/strict');
const {createChat}=require('../server.cjs');const {createRooms}=require('../rooms.cjs');const catalog=require('../department-catalog.cjs');
test('official 29 directorates seed idempotently and alias migration preserves room history',async()=>{
  const app=createChat({dbPath:':memory:'});
  try{
    assert.equal(catalog.names.length,29);assert.equal(new Set(catalog.names).size,29);assert.equal(app.db.prepare('SELECT count(*) n FROM departments WHERE official=1').get().n,29);
    app.db.prepare("INSERT INTO users(id,username,name,department,password,role) VALUES(1,'test','Test Personel','İnsan Kaynakları Müdürlüğü','unused','admin')").run();
    createRooms(app.db);
    const user=app.db.prepare('SELECT * FROM users WHERE id=1').get();assert.equal(user.department,'İnsan Kaynakları ve Eğitim Müdürlüğü');
    const own=app.db.prepare("SELECT id FROM conversations WHERE department_id=? AND scope='department'").get(user.department_id);
    app.db.prepare('INSERT INTO messages(conversation_id,sender_id,body,client_id) VALUES(?,1,?,?)').run(own.id,'Korunan paylaşım','preserved-post');
    const before=app.db.prepare('SELECT count(*) n FROM conversations').get().n;createRooms(app.db);assert.equal(app.db.prepare('SELECT count(*) n FROM conversations').get().n,before);assert.equal(app.db.prepare('SELECT body FROM messages WHERE conversation_id=?').get(own.id).body,'Korunan paylaşım');
    assert.equal(app.db.prepare('SELECT count(*) n FROM members WHERE user_id=1').get().n,2);
    for(const name of catalog.names)assert.ok(app.db.prepare("SELECT c.id FROM conversations c JOIN departments d ON d.id=c.department_id WHERE d.name=? AND c.scope='department'").get(name),name);
  }finally{await app.close();}
});
