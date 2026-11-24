const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startPreview } = require('../preview.cjs');
test('preview uses disposable example data and accepts local chat interactions', async t => {
  const preview = await startPreview({ port: 0, quiet: true });
  t.after(() => preview.close());
  assert.equal(preview.proxy.address().address, '127.0.0.1');
  const base = `http://127.0.0.1:${preview.proxy.address().port}`;
  const status = await (await fetch(base + '/api/status')).json(); assert.equal(status.preview, true); assert.equal(status.setupRequired, false);
  const me = await (await fetch(base + '/api/me')).json(); assert.equal(me.user.name, 'Deniz Yılmaz');
  const chats = await (await fetch(base + '/api/conversations')).json(); assert.equal(chats.conversations.length, 6);
  const messages = await (await fetch(base + '/api/conversations/2/messages')).json(); assert.equal(messages.messages.length, 6);
  const sent = await fetch(base + '/api/conversations/2/messages', { method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-CSRF-Token':me.csrf},body:JSON.stringify({ body:'Geçici önizleme mesajı',clientId:'preview-test-send' }) });
  assert.equal(sent.status, 201);
  const foreign = await fetch(base + '/api/conversations/2/messages', { method:'POST',headers:{Origin:'http://other.invalid','Content-Type':'application/json','X-CSRF-Token':me.csrf},body:JSON.stringify({ body:'No',clientId:'preview-foreign-send' }) });
  assert.equal(foreign.status,403);
});
