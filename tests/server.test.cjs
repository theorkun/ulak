const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createChat } = require('../server.cjs');

test('KurumNet: authentication, permissions, persistence and 200 live connections', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kurumnet-test-'));
  const dbPath = path.join(dir, 'test.db');
  let app = createChat({ dbPath, setupToken: 'test-setup-token' });
  let base;
  async function listen() { await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${app.server.address().port}`; }
  await listen();
  t.after(async () => { await app.close(); assert.equal(path.dirname(dir), os.tmpdir()); assert.ok(path.basename(dir).startsWith('kurumnet-test-')); fs.rmSync(dir, { recursive: true, force: true }); });
  function client() {
    const user = { cookie: '', csrf: '', id: 0 };
    user.call = async (route, data, method, extra = {}) => {
      const headers = { Origin: base, Cookie: user.cookie, ...(data || method ? { 'Content-Type': 'application/json', 'X-CSRF-Token': user.csrf } : {}), ...extra };
      const response = await fetch(base + route, { method: method || (data ? 'POST' : 'GET'), headers, body: data ? JSON.stringify(data) : undefined });
      const setCookie = response.headers.get('set-cookie'); if (setCookie) user.cookie = setCookie.split(';')[0];
      const result = await response.json(); if (result.csrf) user.csrf = result.csrf; if (result.user) user.id = result.user.id;
      return { status: response.status, data: result, headers: response.headers };
    };
    return user;
  }
  const admin = client(), alice = client(), bob = client(), eve = client(), visitor = client();
  let directId, groupId, firstMessage;
  const password = 'Test-Parola-2026!';
  await t.test('first setup requires token, passwords are hashed, no open signup', async () => {
    assert.equal((await visitor.call('/api/status')).data.setupRequired, true);
    assert.equal((await visitor.call('/api/users')).status, 401);
    assert.equal((await visitor.call('/api/setup', { token: 'wrong', name: 'Test Admin', username: 'admin', password })).status, 403);
    const result = await admin.call('/api/setup', { token: 'test-setup-token', name: 'Test Admin', username: 'admin', password });
    assert.equal(result.status, 201); assert.equal(result.data.user.role, 'admin'); assert.ok(result.headers.get('set-cookie').includes('HttpOnly'));
    assert.equal((await visitor.call('/api/setup', { token: 'test-setup-token' })).status, 409);
    assert.notEqual(app.db.prepare('SELECT password FROM users WHERE id=?').get(admin.id).password, password);
    assert.equal((await visitor.call('/api/register', {})).status, 401);
  });
  await t.test('admin provisions employees; temporary password must change', async () => {
    for (const [username, user] of [['alice', alice], ['bob', bob], ['eve', eve]]) {
      const result = await admin.call('/api/admin/users', { username, name: 'Test ' + username, department: 'Test Birimi' });
      assert.equal(result.status, 201); const temp = result.data.temporaryPassword;
      const login = await user.call('/api/login', { username, password: temp });
      assert.equal(login.status, 200); assert.equal(login.data.user.mustChangePassword, true);
      assert.equal((await user.call('/api/conversations')).status, 428);
      assert.equal((await user.call('/api/password', { currentPassword: temp, password })).status, 200);
      assert.equal((await user.call('/api/conversations')).status, 200);
    }
    assert.equal((await alice.call('/api/admin/users')).status, 403);
    assert.equal((await alice.call('/api/admin/users', { username: 'fake' })).status, 403);
    assert.equal((await admin.call('/api/admin/users', { username: 'alice', name: 'Duplicate' })).status, 409);
  });
  await t.test('CSRF, host and source checks reject forged requests', async () => {
    assert.equal((await alice.call('/api/conversations', { kind: 'direct', members: [bob.id] }, 'POST', { 'X-CSRF-Token': 'fake' })).status, 403);
    assert.equal((await alice.call('/api/conversations', { kind: 'direct', members: [bob.id] }, 'POST', { Origin: 'http://evil.invalid' })).status, 403);
    const status = await new Promise((resolve, reject) => { require('node:http').get(base + '/api/status', { headers: { Host: 'evil.invalid' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject); }); assert.equal(status, 403);
  });
  await t.test('direct conversations are unique and member-only, including admins', async () => {
    const result = await alice.call('/api/conversations', { kind: 'direct', members: [bob.id] }); directId = result.data.id; assert.equal(result.status, 201);
    assert.equal((await bob.call('/api/conversations', { kind: 'direct', members: [alice.id] })).data.id, directId);
    assert.equal((await eve.call(`/api/conversations/${directId}/messages`)).status, 404);
    assert.equal((await admin.call(`/api/conversations/${directId}/messages`)).status, 404);
    assert.equal((await eve.call(`/api/conversations/${directId}/messages`, { body: 'Intrude', clientId: crypto.randomUUID() })).status, 404);
    assert.equal((await eve.call(`/api/conversations/${directId}/read`, { lastId: 0 })).status, 404);
  });
  await t.test('message send is idempotent; unread and Turkish search work', async () => {
    const input = { body: 'GÖRÜŞME saatini teyit edelim. <img src=x onerror=alert(1)>', clientId: crypto.randomUUID() };
    const sent = await alice.call(`/api/conversations/${directId}/messages`, input); firstMessage = sent.data.id; assert.equal(sent.status, 201);
    assert.equal((await alice.call(`/api/conversations/${directId}/messages`, input)).data.id, firstMessage);
    const messages = (await bob.call(`/api/conversations/${directId}/messages`)).data.messages; assert.equal(messages.length, 1); assert.equal(messages[0].body, input.body);
    assert.equal((await bob.call('/api/conversations')).data.conversations.find(c => c.id === directId).unread, 1);
    assert.equal((await bob.call('/api/search?q=gorusme')).data.messages.length, 1);
    assert.equal((await eve.call('/api/search?q=gorusme')).data.messages.length, 0);
    assert.equal((await bob.call(`/api/conversations/${directId}/read`, { lastId: firstMessage })).status, 200);
    assert.equal((await bob.call('/api/conversations')).data.conversations.find(c => c.id === directId).unread, 0);
  });
  await t.test('groups, replies and message modification enforce ownership', async () => {
    groupId = (await alice.call('/api/conversations', { kind: 'group', members: [bob.id], title: 'Test Projesi', topic: 'Planlama' })).data.id;
    const reply = await bob.call(`/api/conversations/${directId}/messages`, { body: 'Tamamdır.', clientId: crypto.randomUUID(), replyTo: firstMessage }); assert.equal(reply.status, 201);
    assert.equal((await bob.call(`/api/conversations/${groupId}/messages`, { body: 'Cross-chat', clientId: crypto.randomUUID(), replyTo: firstMessage })).status, 400);
    assert.equal((await bob.call(`/api/conversations/${directId}/messages`, { body: 'Malformed', clientId: crypto.randomUUID(), replyTo: 'bad' })).status, 400);
    assert.equal((await bob.call(`/api/messages/${firstMessage}`, { body: 'Edit others' }, 'PATCH')).status, 404);
    assert.equal((await alice.call(`/api/messages/${firstMessage}`, { body: 'Görüşme güncellendi.' }, 'PATCH')).status, 200);
    assert.ok((await bob.call(`/api/conversations/${directId}/messages`)).data.messages[0].editedAt);
    assert.equal((await alice.call(`/api/messages/${firstMessage}`, null, 'DELETE')).status, 200);
    const rows = (await bob.call(`/api/conversations/${directId}/messages`)).data.messages; assert.equal(rows[0].body, ''); assert.equal(rows[0].deleted, true); assert.equal(rows[1].reply.body, 'Silinen mesaj');
  });
  await t.test('history pagination and reply anchors do not cross permissions', async () => {
    const insert = app.db.prepare('INSERT INTO messages(conversation_id,sender_id,body,client_id) VALUES(?,?,?,?)');
    for (let i = 0; i < 68; i++) insert.run(directId, alice.id, 'History ' + i, crypto.randomUUID());
    const latest = (await bob.call(`/api/conversations/${directId}/messages`)).data; assert.equal(latest.messages.length, 50); assert.equal(latest.hasMore, true);
    const before = (await bob.call(`/api/conversations/${directId}/messages?before=${latest.messages[0].id}`)).data; assert.equal(before.messages.length, 20); assert.equal(before.hasMore, false);
    const around = (await bob.call(`/api/conversations/${directId}/messages?around=${latest.messages[10].id}`)).data; assert.ok(around.messages.some(m => m.id === latest.messages[10].id));
    assert.equal((await eve.call(`/api/conversations/${directId}/messages?around=${latest.messages[10].id}`)).status, 404);
  });
  async function stream(user) {
    const controller = new AbortController();
    const response = await fetch(base + '/api/events', { headers: { Cookie: user.cookie }, signal: controller.signal });
    assert.equal(response.status, 200); return { controller, reader: response.body.getReader() };
  }
  async function until(stream, predicate, timeoutMs = 5000) {
    let timer;
    try { return await Promise.race([(async () => { let content = ''; while (true) { const result = await stream.reader.read(); if (result.done) throw Error('Stream ended'); content += new TextDecoder().decode(result.value); if (predicate(content)) return content; } })(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('SSE timeout')), timeoutMs); })]); }
    finally { clearTimeout(timer); }
  }
  await t.test('live events never expose a private chat to a nonmember', async () => {
    const streamEve = await stream(eve); await until(streamEve, content => content.includes('connected'));
    await alice.call(`/api/conversations/${directId}/messages`, { body: 'private-event', clientId: crypto.randomUUID() });
    const general = (await alice.call('/api/conversations')).data.conversations.find(c => c.title === 'Genel sohbet').id;
    await alice.call(`/api/conversations/${general}/messages`, { body: 'public-marker', clientId: crypto.randomUUID() });
    const events = await until(streamEve, content => content.includes(`"conversationId":${general}`));
    assert.equal(events.includes(`"conversationId":${directId}`), false); assert.equal(events.includes('private-event'), false);
    streamEve.controller.abort();
  });
  await t.test('200 distinct live clients receive a new-message event', async () => {
    const general = (await admin.call('/api/conversations')).data.conversations.find(c => c.title === 'Genel sohbet').id;
    const passwordHash = app.db.prepare('SELECT password FROM users WHERE id=?').get(admin.id).password;
    const clients = [];
    app.db.exec('BEGIN');
    try {
      for (let i = 0; i < 200; i++) {
        const id = Number(app.db.prepare("INSERT INTO users(username,name,password,role) VALUES(?,?,?,'member')").run('load-' + i, 'Load ' + i, passwordHash).lastInsertRowid);
        app.db.prepare('INSERT INTO members(conversation_id,user_id) VALUES(?,?)').run(general, id);
        const token = crypto.randomBytes(32).toString('hex'); app.db.prepare('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), id, 'load', Date.now() + 60000);
        clients.push({ cookie: 'kn_session=' + token });
      }
      app.db.exec('COMMIT');
    } catch (e) { app.db.exec('ROLLBACK'); throw e; }
    const streams = await Promise.all(clients.map(stream));
    try {
      await Promise.all(streams.map(s => until(s, value => value.includes('connected'))));
      const started = Date.now();
      assert.equal((await alice.call(`/api/conversations/${general}/messages`, { body: 'load-marker', clientId: crypto.randomUUID() })).status, 201);
      await Promise.all(streams.map(s => until(s, value => value.includes(`"kind":"message","conversationId":${general}`), 10000)));
      assert.ok(Date.now() - started < 10000);
    } finally { streams.forEach(s => s.controller.abort()); }
  });
  await t.test('disabled users, expired sessions and resets invalidate access', async () => {
    assert.equal((await admin.call('/api/admin/users/' + eve.id, { active: false }, 'PATCH')).status, 200);
    assert.equal((await eve.call('/api/me')).status, 401);
    assert.equal((await eve.call('/api/login', { username: 'eve', password })).status, 401);
    app.db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(bob.id);
    assert.equal((await bob.call('/api/me')).status, 401);
    const reset = await admin.call(`/api/admin/users/${alice.id}/reset`, {}); assert.equal(reset.status, 200);
    assert.equal((await alice.call('/api/me')).status, 401);
    assert.equal((await alice.call('/api/login', { username: 'alice', password: reset.data.temporaryPassword })).data.user.mustChangePassword, true);
    assert.equal((await alice.call('/api/password', { currentPassword: reset.data.temporaryPassword, password: password + 'new' })).status, 200);
  });
  await t.test('messages and accounts survive a server restart', async () => {
    await app.close(); app = createChat({ dbPath, setupToken: 'new-setup-token' }); await listen();
    assert.equal((await visitor.call('/api/status')).data.setupRequired, false);
    assert.equal((await bob.call('/api/login', { username: 'bob', password })).status, 200);
    const history = await bob.call(`/api/conversations/${directId}/messages`); assert.equal(history.status, 200); assert.equal(history.data.messages.length, 50);
    assert.ok(app.db.prepare('SELECT count(*) n FROM audit').get().n > 0);
    const staticResponse = await fetch(base + '/'); assert.equal(staticResponse.status, 200); assert.ok((await staticResponse.text()).includes('KurumNet'));
    const dotFile = await fetch(base + '/data/kurumnet.db'); assert.equal(dotFile.status, 404);
  });
});
