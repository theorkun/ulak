// Managed rooms: one institution-wide room and one room per directorate.
// Older conversations remain in SQLite for preservation but are never exposed.
const catalog = require('./department-catalog.cjs');
function createRooms(db) {
  db.exec('CREATE TABLE IF NOT EXISTS departments(id INTEGER PRIMARY KEY,name TEXT NOT NULL,key TEXT NOT NULL UNIQUE)');
  const has = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
  if (!has('users', 'department_id')) db.exec('ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id)');
  if (!has('conversations', 'scope')) db.exec("ALTER TABLE conversations ADD COLUMN scope TEXT NOT NULL DEFAULT 'legacy'");
  if (!has('conversations', 'department_id')) db.exec('ALTER TABLE conversations ADD COLUMN department_id INTEGER REFERENCES departments(id)');
  if (!has('departments','official')) db.exec('ALTER TABLE departments ADD COLUMN official INTEGER NOT NULL DEFAULT 0');
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS one_general_room ON conversations(scope) WHERE scope='general'; CREATE UNIQUE INDEX IF NOT EXISTS one_department_room ON conversations(department_id) WHERE scope='department'");
  const key = name => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
  const aliases = [
    ['İnsan Kaynakları Müdürlüğü','İnsan Kaynakları ve Eğitim Müdürlüğü'],
    ['Basın, Yayın ve Halkla İlişkiler Müdürlüğü','Basın Yayın ve Halkla İlişkiler Müdürlüğü'],
    ['Destek Hiz. Müdürlüğü','Destek Hizmetleri Müdürlüğü']
  ];
  let seededRooms = false;
  function seedCatalog(owner) {
    for (const [from,to] of aliases) {
      const old=db.prepare('SELECT id FROM departments WHERE key=?').get(key(from));
      if (old && !db.prepare('SELECT id FROM departments WHERE key=?').get(key(to))) {
        db.prepare('UPDATE departments SET name=?,key=? WHERE id=?').run(to,key(to),old.id);
        db.prepare('UPDATE users SET department=? WHERE department_id=?').run(to,old.id);
        db.prepare("UPDATE conversations SET title=? WHERE scope='department' AND department_id=?").run(to,old.id);
      }
    }
    for (const name of catalog.names) {
      db.prepare('INSERT OR IGNORE INTO departments(name,key,official) VALUES(?,?,1)').run(name,key(name));
      db.prepare('UPDATE departments SET official=1 WHERE key=?').run(key(name));
      if (owner) department(name,owner);
    }
    seededRooms=!!owner;
  }
  function general(owner) {
    let row = db.prepare("SELECT * FROM conversations WHERE scope='general'").get();
    if (!row) {
      const old = db.prepare("SELECT id FROM conversations WHERE kind='group' AND scope='legacy' AND title IN ('Genel sohbet','Genel Alan') ORDER BY id LIMIT 1").get();
      if (old) db.prepare("UPDATE conversations SET scope='general',title='Kurum Meydanı',topic='Tüm müdürlüklerin ortak iletişim alanı' WHERE id=?").run(old.id);
      else db.prepare("INSERT INTO conversations(kind,title,topic,creator_id,scope) VALUES('group','Kurum Meydanı','Tüm müdürlüklerin ortak iletişim alanı',?,'general')").run(owner);
      row = db.prepare("SELECT * FROM conversations WHERE scope='general'").get();
    }
    if (row.title !== 'Kurum Meydanı') {
      db.prepare("UPDATE conversations SET title=? WHERE id=?").run('Kurum Meydanı',row.id);
      row.title='Kurum Meydanı';
    }
    return row;
  }
  function department(name, owner) {
    name = name.trim().replace(/\s+/g, ' ');
    name = aliases.find(([from])=>key(from)===key(name))?.[1] || name;
    let row = db.prepare('SELECT * FROM departments WHERE key=?').get(key(name));
    if (!row) { const id = Number(db.prepare('INSERT INTO departments(name,key) VALUES(?,?)').run(name,key(name)).lastInsertRowid); row = db.prepare('SELECT * FROM departments WHERE id=?').get(id); }
    if (!db.prepare("SELECT id FROM conversations WHERE scope='department' AND department_id=?").get(row.id)) db.prepare("INSERT INTO conversations(kind,title,topic,creator_id,scope,department_id) VALUES('group',?,?,?,'department',?)").run(row.name,'Müdürlük içi koordinasyon ve paylaşımlar',owner,row.id);
    return row;
  }
  function sync(id) {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!user) return;
    const owner = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get().id;
    if (!seededRooms) seedCatalog(owner);
    const publicRoom = general(owner);
    let dept = user.department_id ? db.prepare('SELECT * FROM departments WHERE id=?').get(user.department_id) : null;
    if (!dept) { dept = department(user.department || 'Yönetim',owner); db.prepare('UPDATE users SET department_id=?,department=? WHERE id=?').run(dept.id,dept.name,id); }
    department(dept.name,owner);
    db.prepare("DELETE FROM members WHERE user_id=? AND conversation_id IN (SELECT id FROM conversations WHERE scope IN ('general','department')) AND (conversation_id NOT IN (?,(SELECT id FROM conversations WHERE scope='department' AND department_id=?)) OR ?=0)").run(id,publicRoom.id,dept.id,user.active);
    if (user.active) {
      const room = db.prepare("SELECT id FROM conversations WHERE scope='department' AND department_id=?").get(dept.id);
      db.prepare('INSERT OR IGNORE INTO members(conversation_id,user_id) VALUES(?,?)').run(publicRoom.id,id);
      db.prepare('INSERT OR IGNORE INTO members(conversation_id,user_id) VALUES(?,?)').run(room.id,id);
    }
  }
  db.exec('BEGIN IMMEDIATE');
  try { seedCatalog(db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get()?.id); for (const user of db.prepare('SELECT id FROM users ORDER BY id').all()) sync(user.id); db.exec('COMMIT'); }
  catch(e) { db.exec('ROLLBACK'); throw e; }
  return { general, department, sync };
}
module.exports = { createRooms };
