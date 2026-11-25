const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');
const { createRooms } = require('./rooms.cjs');
const { createRecovery, contacts } = require('./recovery.cjs');
const scrypt = promisify(crypto.scrypt);
const fold = value => String(value).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const userRole = u => u.is_super_admin ? 'super_admin' : u.role;
const publicUser = u => ({ id: u.id, username: u.username, name: u.name, department: u.department, departmentId: u.department_id, role: userRole(u), active: !!u.active, mustChangePassword: !!u.must_change });
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const text = (value, min, max, label) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${label}: ${min}–${max} karakter kullanın.`);
  return value.trim();
};
async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, 'Parola 10–128 karakter olmalı.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt}:${hash.toString('hex')}`;
}
async function passwordMatches(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function createChat(options = {}) {
  const dbPath = options.dbPath || path.join(__dirname, 'data', 'kurumnet.db');
  if (options.preview && dbPath !== ':memory:') throw Error('Önizleme yalnızca geçici veritabanıyla kullanılabilir.');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, department TEXT NOT NULL DEFAULT '', password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')), active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS conversations(id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('direct','group')), title TEXT NOT NULL DEFAULT '', topic TEXT NOT NULL DEFAULT '', creator_id INTEGER NOT NULL REFERENCES users(id), direct_key TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    CREATE TABLE IF NOT EXISTS members(conversation_id INTEGER NOT NULL REFERENCES conversations(id), user_id INTEGER NOT NULL REFERENCES users(id), last_read INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(conversation_id,user_id));
    CREATE INDEX IF NOT EXISTS members_user ON members(user_id,conversation_id);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id), sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, client_id TEXT NOT NULL, reply_to INTEGER REFERENCES messages(id), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), edited_at TEXT, deleted_at TEXT, UNIQUE(sender_id,client_id));
    CREATE INDEX IF NOT EXISTS messages_chat ON messages(conversation_id,id);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));`);
  if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='is_super_admin'))db.exec('ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_super_admin IN (0,1))');
  db.function('fold', { deterministic: true }, fold);
  const rooms = createRooms(db);
  const setupToken = options.setupToken || crypto.randomBytes(24).toString('hex');
  const sessionMs = options.sessionMs || 12 * 60 * 60 * 1000;
  const secure = !!options.tls || process.env.SECURE_COOKIE === '1';
  const clients = new Set();
  const limits = new Map();
  const localNames = new Set(['localhost', '127.0.0.1', '[::1]', '::1', os.hostname().toLowerCase()]);
  Object.values(os.networkInterfaces()).flat().filter(Boolean).forEach(i => localNames.add(i.address.toLowerCase()));
  String(options.allowedHosts || process.env.ALLOWED_HOSTS || '').split(',').filter(Boolean).forEach(h => localNames.add(h.trim().toLowerCase()));
  const countUsers = () => Number(db.prepare('SELECT count(*) n FROM users').get().n);
  const now = () => Date.now();
  const audit = (actor, action, target) => db.prepare('INSERT INTO audit(actor_id,action,target) VALUES(?,?,?)').run(actor, action, String(target));
  function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (e) { db.exec('ROLLBACK'); throw e; } }
  function limited(key, max, windowMs) {
    const current = limits.get(key);
    if (!current || current.until < now()) { limits.set(key, { count: 1, until: now() + windowMs }); return; }
    if (current.count >= max) fail(429, 'Çok sık işlem yapıldı. Biraz bekleyip yeniden deneyin.');
    current.count++;
  }
  const member = (userId, conversationId) => {
    const row = db.prepare("SELECT c.* FROM conversations c JOIN members m ON m.conversation_id=c.id JOIN users u ON u.id=m.user_id WHERE c.id=? AND m.user_id=? AND u.active=1 AND c.kind='group' AND (c.scope='general' OR (c.scope='department' AND c.department_id=u.department_id))").get(conversationId, userId);
    if (!row) fail(404, 'Sohbet bulunamadı veya bu sohbete erişiminiz yok.');
    return row;
  };
  function event(payload, conversationId = null) {
    const ids = conversationId ? new Set(db.prepare("SELECT m.user_id FROM members m JOIN users u ON u.id=m.user_id JOIN conversations c ON c.id=m.conversation_id WHERE m.conversation_id=? AND u.active=1 AND (c.scope='general' OR (c.scope='department' AND c.department_id=u.department_id))").all(conversationId).map(x => x.user_id)) : null;
    for (const client of clients) if (!ids || ids.has(client.userId)) {
      if (client.res.writableEnded || client.res.destroyed) continue;
      if (client.res.writableLength > 128 * 1024) { client.res.destroy(); continue; }
      client.res.write(`event: refresh\ndata: ${JSON.stringify(payload)}\n\n`);
    }
  }
  const online = userId => [...clients].some(c => c.userId === userId);
  function messageRow(row) {
    return { id: row.id, conversationId: row.conversation_id, sender: { id: row.sender_id, name: row.name, department:row.sender_department }, body: row.deleted_at ? '' : row.body, createdAt: row.created_at, editedAt: row.edited_at, deleted: !!row.deleted_at, reply: row.reply_to ? { id: row.reply_to, body: row.reply_deleted ? 'Silinen mesaj' : row.reply_body, name: row.reply_name } : null };
  }
  const messageSelect = `SELECT m.*,u.name,u.department sender_department,r.body reply_body,r.deleted_at reply_deleted,ru.name reply_name FROM messages m JOIN users u ON u.id=m.sender_id LEFT JOIN messages r ON r.id=m.reply_to LEFT JOIN users ru ON ru.id=r.sender_id`;
  function session(req) {
    const token = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('kn_session='))?.slice(11);
    if (!token || token.length > 200) fail(401, 'Oturum açmanız gerekiyor.');
    const tokenHash = hashToken(token);
    const row = db.prepare('SELECT u.*,s.csrf,s.expires,s.token session_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1').get(tokenHash, now());
    if (!row) fail(401, 'Oturumunuz sona erdi. Yeniden giriş yapın.');
    return row;
  }
  function issueSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex'), csrf = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)').run(hashToken(token), userId, csrf, now() + sessionMs);
    res.setHeader('Set-Cookie', `kn_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionMs / 1000)}${secure ? '; Secure' : ''}`);
    return csrf;
  }
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  async function body(req) {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'JSON içeriği bekleniyor.');
    let size = 0, data = '';
    for await (const chunk of req) { size += chunk.length; if (size > 24000) fail(413, 'İstek çok büyük.'); data += chunk; }
    try { const value = JSON.parse(data); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error(); return value; } catch { fail(400, 'Geçersiz istek.'); }
  }
  const admin = user => { if (user.role !== 'admin') fail(403, 'Bu işlem yönetici yetkisi gerektirir.'); };
  const manageUser = (actor,target) => {if(!actor.is_super_admin&&(target.role==='admin'||target.is_super_admin))fail(403,'Yönetici hesaplarını yalnızca süper admin düzenleyebilir.');};
  const recovery=createRecovery({db,options,limited,passwordHash,audit,transaction,endSessions:id=>{for(const c of clients)if(c.userId===id)c.res.end();}});
  async function handle(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    let url;
    try { url = new URL(req.url, `http://${req.headers.host}`); } catch { fail(400, 'Geçersiz adres.'); }
    if (!localNames.has(url.hostname.toLowerCase())) fail(403, 'Sunucu adı izinli değil. ALLOWED_HOSTS ayarını kontrol edin.');
    const route = url.pathname;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const expected = options.publicOrigin || process.env.PUBLIC_ORIGIN || `${options.tls ? 'https' : 'http'}://${req.headers.host}`;
      if (req.headers.origin !== expected) fail(403, 'İstek kaynağı doğrulanamadı.');
    }
    if (route === '/api/status' && req.method === 'GET') return json(res, 200, { setupRequired: countUsers() === 0, name: 'ULAK', preview: options.preview === true, recoveryChannels:recovery.channels, localSetup: ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) });
    if (route === '/api/recovery/request' && req.method === 'POST') return json(res,200,await recovery.request(await body(req),req.socket.remoteAddress));
    if (route === '/api/recovery/confirm' && req.method === 'POST') return json(res,200,await recovery.confirm(await body(req),req.socket.remoteAddress));
    if (route === '/api/setup' && req.method === 'POST') {
      limited(`setup:${req.socket.remoteAddress}`, 10, 60000);
      if (countUsers()) fail(409, 'Kurulum zaten tamamlandı.');
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail(403, 'İlk kurulum sunucu bilgisayarında yapılmalı.');
      const input = await body(req);
      if (typeof input.token !== 'string' || hashToken(input.token) !== hashToken(setupToken)) fail(403, 'Kurulum kodu hatalı. Sunucu konsolundaki kodu kullanın.');
      const name = text(input.name, 2, 80, 'Ad soyad'), username = text(input.username, 3, 40, 'Kullanıcı adı').toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(username)) fail(400, 'Kullanıcı adında İngilizce harf, rakam, nokta, tire kullanın.');
      const password = await passwordHash(input.password);
      if (countUsers()) fail(409, 'Kurulum zaten tamamlandı.');
      const userId = transaction(() => {
        const id = Number(db.prepare("INSERT INTO users(username,name,password,role,department) VALUES(?,?,?,'admin',?)").run(username, name, password,text(input.department || 'Yönetim',2,80,'Müdürlük')).lastInsertRowid);
        db.prepare('UPDATE users SET is_super_admin=1 WHERE id=?').run(id);
        rooms.sync(id);
        audit(id, 'setup', id); return id;
      });
      return json(res, 201, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId)), csrf: issueSession(res, userId) });
    }
    if (route === '/api/login' && req.method === 'POST') {
      limited(`login-ip:${req.socket.remoteAddress}`, 30, 15 * 60000);
      const input = await body(req), username = String(input.username || '').toLowerCase().trim().slice(0, 40);
      limited(`login-name:${username}`, 10, 15 * 60000);
      const user = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
      const fake = '0123456789abcdef0123456789abcdef:' + '00'.repeat(64);
      if (!await passwordMatches(input.password, user?.password || fake) || !user) fail(401, 'Kullanıcı adı veya parola hatalı.');
      limits.delete(`login-name:${username}`);
      return json(res, 200, { user: publicUser(user), csrf: issueSession(res, user.id) });
    }
    if (route.startsWith('/api/')) {
      const user = session(req);
      if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-csrf-token'] !== user.csrf) fail(403, 'İşlem doğrulanamadı. Sayfayı yenileyin.');
      if (route === '/api/me' && req.method === 'GET') return json(res, 200, { user: publicUser(user), csrf: user.csrf });
      if (route === '/api/logout' && req.method === 'POST') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(user.session_token);
        for (const c of clients) if (c.token === user.session_token) c.res.end();
        res.setHeader('Set-Cookie', 'kn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return json(res, 200, { ok: true });
      }
      if (route === '/api/password' && req.method === 'POST') {
        const input = await body(req);
        limited(`password:${user.id}`, 10, 60000);
        if (!await passwordMatches(input.currentPassword, user.password)) fail(400, 'Mevcut parola hatalı.');
        if (input.currentPassword === input.password) fail(400, 'Yeni parola mevcut paroladan farklı olmalı.');
        const password = await passwordHash(input.password);
        // Recheck session after the asynchronous password operation.
        session(req);
        transaction(() => { db.prepare('UPDATE users SET password=?,must_change=0 WHERE id=?').run(password, user.id); recovery.invalidate(user.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); audit(user.id, 'password_changed', user.id); });
        for (const c of clients) if (c.userId === user.id) c.res.end();
        return json(res, 200, { ok: true, csrf: issueSession(res, user.id), user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
      }
      if (user.must_change) fail(428, 'Devam etmeden önce geçici parolanızı değiştirin.');
      if (route === '/api/users' && req.method === 'GET') {
        const users = db.prepare('SELECT id,username,name,department,role,active,is_super_admin FROM users WHERE active=1 AND (department_id=? OR id=?) ORDER BY name').all(user.department_id,user.id);
        return json(res, 200, { users: users.map(u => {const {is_super_admin,...person}=u;return{...person,role:userRole(u),online:online(u.id)};}) });
      }
      if (route === '/api/directory' && req.method === 'GET') {
        const departments=db.prepare('SELECT id,name,official FROM departments ORDER BY name').all().map(d=>({id:d.id,name:d.name,official:!!d.official,accessible:d.id===user.department_id}));
        return json(res,200,{departments});
      }
      if (route === '/api/admin/departments' && req.method === 'GET') { admin(user); return json(res,200,{ departments: db.prepare('SELECT d.id,d.name,(SELECT count(*) FROM users u WHERE u.department_id=d.id AND u.active=1) people FROM departments d ORDER BY d.name').all() }); }
      if (route === '/api/admin/departments' && req.method === 'POST') { admin(user); const input=await body(req);session(req); const name=text(input.name,2,80,'Müdürlük adı'); const dept=transaction(()=>rooms.department(name,user.id)); audit(user.id,'department_created',dept.id); event({kind:'directory'}); return json(res,201,{department:dept}); }
      if (route === '/api/admin/users' && req.method === 'GET') { admin(user); return json(res, 200, { users: db.prepare('SELECT * FROM users ORDER BY active DESC,name').all().map(u=>({...publicUser(u),email:u.email,phone:u.phone})) }); }
      if (route === '/api/admin/users' && req.method === 'POST') {
        admin(user); const input = await body(req);
        const username = text(input.username, 3, 40, 'Kullanıcı adı').toLowerCase(), name = text(input.name, 2, 80, 'Ad soyad');
        const existingDepartment = input.departmentId != null ? db.prepare('SELECT * FROM departments WHERE id=?').get(Number(input.departmentId)) : null;
        if (input.departmentId != null && !existingDepartment) fail(400,'Müdürlük seçin.');
        const department = existingDepartment?.name || text(input.department,2,80,'Müdürlük');
        if (!/^[a-z0-9._-]+$/.test(username)) fail(400, 'Kullanıcı adı İngilizce harf, rakam, nokta ve tire içermeli.');
        if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) fail(409, 'Bu kullanıcı adı zaten var.');
        const temporaryPassword = crypto.randomBytes(12).toString('base64url');
        const role=input.role??'member';
        if(!['member','admin','super_admin'].includes(role))fail(400,'Geçersiz yetki.');
        if(role!=='member'&&!user.is_super_admin)fail(403,'Yönetici yetkisini yalnızca süper admin verebilir.');
        const contact=contacts(input);
        const password = await passwordHash(temporaryPassword); session(req);
        const id = transaction(() => {
          const id = Number(db.prepare('INSERT INTO users(username,name,department,password,role,must_change) VALUES(?,?,?,?,?,1)').run(username, name, department, password, role==='member'?'member':'admin').lastInsertRowid);
          if(role==='super_admin')db.prepare('UPDATE users SET is_super_admin=1 WHERE id=?').run(id);
          rooms.sync(id);
          db.prepare('UPDATE users SET email=?,phone=? WHERE id=?').run(contact.email,contact.phone,id);
          audit(user.id, 'user_created', id); return id;
        }); event({ kind: 'directory' });
        return json(res, 201, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)), temporaryPassword });
      }
      let match = route.match(/^\/api\/admin\/users\/(\d+)$/);
      if (match && req.method === 'PATCH') {
        admin(user); const id = Number(match[1]), input = await body(req);session(req);
        const target = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!target) fail(404, 'Kullanıcı bulunamadı.');
        manageUser(user,target);
        const changeRole=Object.hasOwn(input,'role');
        if(changeRole&&(!user.is_super_admin||!['member','admin','super_admin'].includes(input.role)))fail(403,'Yetki değişikliği süper admin gerektirir.');
        if(changeRole&&id===user.id&&input.role!==userRole(user))fail(400,'Kendi süper admin yetkinizi bu ekrandan kaldıramazsınız.');
        if(target.is_super_admin&&target.active&&(input.active===false||(changeRole&&input.role!=='super_admin'))&&db.prepare('SELECT count(*) n FROM users WHERE is_super_admin=1 AND active=1').get().n<=1)fail(400,'Son aktif süper admin kaldırılamaz.');
        if (id === user.id && input.active === false) fail(400, 'Kendi hesabınızı kapatamazsınız.');
        const changeContact=Object.hasOwn(input,'email')||Object.hasOwn(input,'phone');
        const contact=changeContact?contacts({email:input.email??target.email,phone:input.phone??target.phone}):null;
        if (typeof input.active !== 'boolean' && input.departmentId == null && !changeContact && !changeRole) fail(400,'Güncellenecek bilgi gerekli.');
        const dept = input.departmentId != null ? db.prepare('SELECT * FROM departments WHERE id=?').get(Number(input.departmentId)) : null;
        if (input.departmentId != null && !dept) fail(400,'Müdürlük bulunamadı.');
        transaction(() => {
          if(changeRole){db.prepare('UPDATE users SET role=?,is_super_admin=? WHERE id=?').run(input.role==='member'?'member':'admin',input.role==='super_admin'?1:0,id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);recovery.invalidate(id);audit(user.id,'role_changed',id);}
          if(contact){db.prepare('UPDATE users SET email=?,phone=? WHERE id=?').run(contact.email,contact.phone,id);audit(user.id,'contact_changed',id);}
          if(contact||typeof input.active==='boolean')recovery.invalidate(id);
          if (typeof input.active === 'boolean') { db.prepare('UPDATE users SET active=? WHERE id=?').run(input.active ? 1 : 0,id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); audit(user.id,input.active?'user_enabled':'user_disabled',id); }
          if (dept) { db.prepare('UPDATE users SET department_id=?,department=? WHERE id=?').run(dept.id,dept.name,id); audit(user.id,'department_changed',id); }
          rooms.sync(id);
        });
        if (typeof input.active === 'boolean'||changeRole) for (const c of clients) if (c.userId === id) c.res.end(); event({ kind: 'directory' }); return json(res, 200, { ok: true });
      }
      match = route.match(/^\/api\/admin\/users\/(\d+)\/reset$/);
      if (match && req.method === 'POST') {
        admin(user); const id = Number(match[1]);
        if (id === user.id) fail(400, 'Kendi parolanızı profil ekranından değiştirin.');
        const target=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!target)fail(404,'Kullanıcı bulunamadı.');manageUser(user,target);
        const temporaryPassword = crypto.randomBytes(12).toString('base64url'), password = await passwordHash(temporaryPassword); session(req);
        manageUser(user,db.prepare('SELECT * FROM users WHERE id=?').get(id));
        transaction(() => { db.prepare('UPDATE users SET password=?,must_change=1 WHERE id=?').run(password, id); recovery.invalidate(id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); audit(user.id, 'password_reset', id); });
        for (const c of clients) if (c.userId === id) c.res.end(); return json(res, 200, { temporaryPassword });
      }
      if (route === '/api/admin/audit' && req.method === 'GET') { admin(user); return json(res, 200, { entries: db.prepare('SELECT a.*,u.name actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100').all() }); }
      if (route === '/api/conversations' && req.method === 'GET') {
        const rows = db.prepare(`SELECT c.*,l.id latest_id,l.sender_id last_sender,l.body last_body,l.deleted_at last_deleted,l.created_at last_created,l.edited_at last_edited,lu.name last_name,
          (SELECT count(*) FROM messages WHERE conversation_id=c.id AND id>mem.last_read AND sender_id!=? AND deleted_at IS NULL) unread
          FROM conversations c JOIN members mem ON mem.conversation_id=c.id LEFT JOIN messages l ON l.id=(SELECT max(id) FROM messages WHERE conversation_id=c.id) LEFT JOIN users lu ON lu.id=l.sender_id WHERE mem.user_id=? AND c.kind='group' AND (c.scope='general' OR (c.scope='department' AND c.department_id=?)) ORDER BY c.scope DESC,c.id`).all(user.id,user.id,user.department_id);
        const allPeople = db.prepare('SELECT m.conversation_id,u.id,u.name,u.department,u.active FROM members m JOIN users u ON u.id=m.user_id WHERE m.conversation_id IN (SELECT conversation_id FROM members WHERE user_id=?)').all(user.id);
        const peopleByChat = new Map();
        for (const person of allPeople) { const id = person.conversation_id; delete person.conversation_id; if (!peopleByChat.has(id)) peopleByChat.set(id, []); peopleByChat.get(id).push(person); }
        const connected = new Set([...clients].filter(c => !c.res.writableEnded && !c.res.destroyed).map(c => c.userId));
        const conversations = rows.map(c => {
          const people = peopleByChat.get(c.id) || [];
          const other = people.find(p => p.id !== user.id);
          const latest = c.latest_id ? { id: c.latest_id, sender: { id: c.last_sender, name: c.last_name }, body: c.last_deleted ? '' : c.last_body, deleted: !!c.last_deleted, createdAt: c.last_created, editedAt: c.last_edited } : null;
          return { id: c.id, kind:'group',scope:c.scope,departmentId:c.department_id,title:c.title,topic:c.topic,creatorId:c.creator_id,people:people.map(p=>({...p,online:connected.has(p.id)})),unread:c.unread,lastMessage:latest };
        }); return json(res, 200, { conversations });
      }
      if (route === '/api/conversations' && req.method === 'POST') {
        fail(403,'Birebir mesajlaşma ve kişisel grup oluşturma kapalıdır. Müdürlük odaları yönetici tarafından tanımlanır.');
      }
      match = route.match(/^\/api\/conversations\/(\d+)\/messages$/);
      if (match && req.method === 'GET') {
        const id = Number(match[1]); member(user.id, id);
        const before = Number(url.searchParams.get('before') || 0), around = Number(url.searchParams.get('around') || 0);
        if (!Number.isSafeInteger(before) || !Number.isSafeInteger(around) || before < 0 || around < 0 || before && around) fail(400, 'Geçersiz sayfalama.');
        let rows;
        if (around) {
          rows = [...db.prepare(`${messageSelect} WHERE m.conversation_id=? AND m.id<=? ORDER BY m.id DESC LIMIT 26`).all(id, around).reverse(), ...db.prepare(`${messageSelect} WHERE m.conversation_id=? AND m.id>? ORDER BY m.id LIMIT 25`).all(id, around)];
        } else rows = db.prepare(`${messageSelect} WHERE m.conversation_id=? ${before ? 'AND m.id<?' : ''} ORDER BY m.id DESC LIMIT 50`).all(...(before ? [id, before] : [id])).reverse();
        return json(res, 200, { messages: rows.map(messageRow), hasMore: rows.length ? !!db.prepare('SELECT id FROM messages WHERE conversation_id=? AND id<? LIMIT 1').get(id, rows[0].id) : false });
      }
      if (match && req.method === 'POST') {
        const id = Number(match[1]); member(user.id, id); limited(`send:${user.id}`, 60, 60000);
        const input = await body(req), content = text(input.body, 1, 4000, 'Mesaj'), clientId = text(input.clientId, 8, 80, 'İstek kimliği');
        const duplicate = db.prepare('SELECT id,conversation_id FROM messages WHERE sender_id=? AND client_id=?').get(user.id, clientId);
        if (duplicate) { if (duplicate.conversation_id !== id) fail(409, 'İstek kimliği daha önce kullanıldı.'); return json(res, 200, { id: duplicate.id }); }
        const reply = input.replyTo == null ? null : Number(input.replyTo);
        if (reply !== null && (!Number.isSafeInteger(reply) || reply <= 0)) fail(400, 'Geçersiz yanıt mesajı.');
        if (reply && !db.prepare('SELECT id FROM messages WHERE id=? AND conversation_id=?').get(reply, id)) fail(400, 'Yanıtlanan mesaj bu sohbette bulunamadı.');
        const messageId = transaction(() => {
          const mid = Number(db.prepare('INSERT INTO messages(conversation_id,sender_id,body,client_id,reply_to) VALUES(?,?,?,?,?)').run(id, user.id, content, clientId, reply).lastInsertRowid);
          db.prepare('UPDATE members SET last_read=? WHERE conversation_id=? AND user_id=?').run(mid, id, user.id); return mid;
        }); event({ kind: 'message', conversationId: id }, id); return json(res, 201, { id: messageId });
      }
      match = route.match(/^\/api\/conversations\/(\d+)\/read$/);
      if (match && req.method === 'POST') {
        const id = Number(match[1]); member(user.id, id); const input = await body(req), lastId = Number(input.lastId);
        if (!Number.isSafeInteger(lastId) || lastId < 0 || lastId && !db.prepare('SELECT id FROM messages WHERE id=? AND conversation_id=?').get(lastId, id)) fail(400, 'Geçersiz okuma bilgisi.');
        db.prepare('UPDATE members SET last_read=max(last_read,?) WHERE conversation_id=? AND user_id=?').run(lastId, id, user.id); return json(res, 200, { ok: true });
      }
      match = route.match(/^\/api\/messages\/(\d+)$/);
      if (match && ['PATCH', 'DELETE'].includes(req.method)) {
        const id = Number(match[1]), message = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
        if (!message || message.sender_id !== user.id || message.deleted_at) fail(404, 'Mesaj bulunamadı veya düzenleme yetkiniz yok.');
        member(user.id, message.conversation_id);
        if (req.method === 'PATCH') { const input = await body(req); db.prepare("UPDATE messages SET body=?,edited_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(text(input.body, 1, 4000, 'Mesaj'), id); }
        else db.prepare("UPDATE messages SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(id);
        event({ kind: 'message', conversationId: message.conversation_id }, message.conversation_id); return json(res, 200, { ok: true });
      }
      if (route === '/api/search' && req.method === 'GET') {
        limited(`search:${user.id}`, 60, 60000); const query = text(url.searchParams.get('q'), 2, 100, 'Arama');
        const rows = db.prepare(`${messageSelect} JOIN members mem ON mem.conversation_id=m.conversation_id AND mem.user_id=? JOIN conversations c ON c.id=m.conversation_id WHERE c.kind='group' AND (c.scope='general' OR (c.scope='department' AND c.department_id=?)) AND m.deleted_at IS NULL AND instr(fold(m.body),fold(?))>0 ORDER BY m.id DESC LIMIT 60`).all(user.id,user.department_id,query);
        return json(res, 200, { messages: rows.map(messageRow) });
      }
      if (route === '/api/events' && req.method === 'GET') {
        if ([...clients].filter(c => c.userId === user.id).length >= 4) fail(429, 'Aynı hesapla en fazla 4 canlı sekme açabilirsiniz.');
        if (clients.size >= 800) fail(503, 'Canlı bağlantı kapasitesi dolu.');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 3000\nevent: connected\ndata: {}\n\n');
        const client = { res, userId: user.id, token: user.session_token };
        res.on('error', () => res.destroy());
        clients.add(client); event({ kind: 'presence' });
        const heartbeat = setInterval(() => { const valid = db.prepare('SELECT s.token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1').get(client.token, now()); if (!valid) res.end(); else res.write(': heartbeat\n\n'); }, 20000);
        res.on('close', () => { clearInterval(heartbeat); clients.delete(client); event({ kind: 'presence' }); }); return;
      }
      fail(404, 'İşlem bulunamadı.');
    }
    if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Yöntem desteklenmiyor.');
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/auth.js': ['auth.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/icon.svg': ['icon.svg', 'image/svg+xml'], '/selcuklu-motif.svg': ['selcuklu-motif.svg', 'image/svg+xml'], '/saricam-belediyesi-logo.png': ['saricam-belediyesi-logo.png', 'image/png'] };
    const file = files[route]; if (!file) fail(404, 'Sayfa bulunamadı.');
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end(); else res.end(fs.readFileSync(path.join(__dirname, 'public', file[0])));
  }
  const listener = (req, res) => handle(req, res).catch(error => {
    if (res.headersSent) { res.end(); return; }
    if (!error.status) console.error('KurumNet sunucu hatası:', error.code || error.name, error.message);
    json(res, error.status || 500, { error: error.status ? error.message : 'İşlem tamamlanamadı. Yeniden deneyin.' });
  });
  const server = options.tls ? https.createServer(options.tls, listener) : http.createServer(listener);
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  const cleanup = setInterval(() => { db.prepare('DELETE FROM sessions WHERE expires<?').run(now()); for (const [key, value] of limits) if (value.until < now()) limits.delete(key); }, 60000);
  cleanup.unref();
  const close = async () => { clearInterval(cleanup); for (const c of clients) c.res.end(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); db.close(); };
  return { server, db, setupToken, setupRequired: () => !countUsers(), close };
}
if (require.main === module) {
  const mailEnv=path.join(__dirname,'smtp.env');if(fs.existsSync(mailEnv))process.loadEnvFile(mailEnv);
  const tls = process.env.TLS_KEY_FILE && process.env.TLS_CERT_FILE ? { key: fs.readFileSync(process.env.TLS_KEY_FILE), cert: fs.readFileSync(process.env.TLS_CERT_FILE) } : null;
  const app = createChat({ tls });
  const port = Number(process.env.PORT || 8095), host = process.env.HOST || '127.0.0.1';
  app.server.listen(port, host, () => {
    console.log(`\nULAK hazır: ${tls ? 'https' : 'http'}://localhost:${port}\nDinleme adresi: ${host}`);
    if (app.setupRequired()) console.log(`\nİlk yönetici kurulum kodu (yalnızca bu bilgisayarda):\n${app.setupToken}\n\nİlk kurulum bağlantısı (bu bilgisayarda açın):\n${tls ? 'https' : 'http'}://localhost:${port}/#setup=${app.setupToken}\n`);
    if (host === '0.0.0.0') Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).forEach(i => console.log(`Yerel ağ adresi: ${tls ? 'https' : 'http'}://${i.address}:${port}`));
  });
  app.server.on('error', e => { console.error('Sunucu başlatılamadı:', e.code); process.exitCode = 1; app.close(); });
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await app.close(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
module.exports = { createChat };
