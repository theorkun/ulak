// Managed rooms: one institution-wide room and one room per directorate.
// Older conversations remain in SQLite for preservation but are never exposed.
function createRooms(db) {
  db.exec('CREATE TABLE IF NOT EXISTS departments(id INTEGER PRIMARY KEY,name TEXT NOT NULL,key TEXT NOT NULL UNIQUE)');
  const has = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
  if (!has('users', 'department_id')) db.exec('ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id)');
  if (!has('conversations', 'scope')) db.exec("ALTER TABLE conversations ADD COLUMN scope TEXT NOT NULL DEFAULT 'legacy'");
  if (!has('conversations', 'department_id')) db.exec('ALTER TABLE conversations ADD COLUMN department_id INTEGER REFERENCES departments(id)');
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS one_general_room ON conversations(scope) WHERE scope='general'; CREATE UNIQUE INDEX IF NOT EXISTS one_department_room ON conversations(department_id) WHERE scope='department'");
  const key = name => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
  function general(owner) {
    let row = db.prepare("SELECT * FROM conversations WHERE scope='general'").get();
    if (!row) {
      const old = db.prepare("SELECT id FROM conversations WHERE kind='group' AND scope='legacy' AND title IN ('Genel sohbet','Genel Alan') ORDER BY id LIMIT 1").get();
      if (old) db.prepare("UPDATE conversations SET scope='general',title='Genel Alan',topic='Tüm müdürlüklerin ortak iletişim alanı' WHERE id=?").run(old.id);
      else db.prepare("INSERT INTO conversations(kind,title,topic,creator_id,scope) VALUES('group','Genel Alan','Tüm müdürlüklerin ortak iletişim alanı',?,'general')").run(owner);
      row = db.prepare("SELECT * FROM conversations WHERE scope='general'").get();
    }
    return row;
  }
  function department(name, owner) {
    name = name.trim().replace(/\s+/g, ' ');
    let row = db.prepare('SELECT * FROM departments WHERE key=?').get(key(name));
    if (!row) { const id = Number(db.prepare('INSERT INTO departments(name,key) VALUES(?,?)').run(name,key(name)).lastInsertRowid); row = db.prepare('SELECT * FROM departments WHERE id=?').get(id); }
    if (!db.prepare("SELECT id FROM conversations WHERE scope='department' AND department_id=?").get(row.id)) db.prepare("INSERT INTO conversations(kind,title,topic,creator_id,scope,department_id) VALUES('group',?,?,?,'department',?)").run(row.name,'Müdürlük içi koordinasyon ve paylaşımlar',owner,row.id);
    return row;
  }
  function sync(id) {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!user) return;
    const owner = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get().id;
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
  try { for (const user of db.prepare('SELECT id FROM users ORDER BY id').all()) sync(user.id); db.exec('COMMIT'); }
  catch(e) { db.exec('ROLLBACK'); throw e; }
  return { general, department, sync };
}
module.exports = { createRooms };
