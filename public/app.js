const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fold = value => String(value).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const iconPaths = { chat:'<path d="M21 11a8 8 0 0 1-8 8H5l-4 3 2-7a8 8 0 0 1 2-10 9 9 0 0 1 16 6Z"/><path d="M7 10h9M7 14h6"/>', users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9"/><circle cx="9" cy="7" r="4"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>', search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>', shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>', logout:'<path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h13"/>', plus:'<path d="M12 5v14M5 12h14"/>', refresh:'<path d="M20 4v5h-5M4 20v-5h5M4 9a8 8 0 0 1 13-5l3 5M4 15l3 5a8 8 0 0 0 13-5"/>', lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>', chevron:'<path d="m9 5 7 7-7 7"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>', spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>', close:'<path d="m5 5 14 14M19 5 5 19"/>', send:'<path d="m22 2-7 20-4-9L2 9l20-7ZM11 13 22 2"/>' };
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
$$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const state = { user: null, csrf: '', chats: [], users: [], active: null, messages: [], more: false, tab: 'all', history: false, version: 0, reply: null, edit: null, source: null, drafts: new Map(), selected: new Set(), sending: false, preview: false };
const initials = name => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toLocaleUpperCase('tr');
const time = value => new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const day = value => new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
let toastTimer, refreshTimer, currentFocus, setupRequired = false, adminUsers = [];
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000); }
async function api(route, data, method) {
  const response = await fetch(route, { method: method || (data ? 'POST' : 'GET'), headers: data || method ? { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf } : {}, credentials: 'same-origin', body: data ? JSON.stringify(data) : undefined });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.user) signOut(false);
    if (response.status === 428 && state.user) passwordDialog();
    const error = new Error(result.error || 'İşlem tamamlanamadı.'); error.status = response.status; throw error;
  }
  return result;
}
function dialog(id) { if (state.user?.mustChangePassword && id !== '#profile-dialog') return; $$('dialog[open]').forEach(d => d.close()); currentFocus = document.activeElement; $(id).showModal(); }
function closeDialogs() { if (state.user?.mustChangePassword) return; $$('dialog[open]').forEach(d => d.close()); currentFocus?.focus(); }
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDialogs(); });
$$('dialog').forEach(d => {
  d.addEventListener('cancel', e => { if (state.user?.mustChangePassword) e.preventDefault(); });
  d.addEventListener('close', () => { if (d.id === 'credential-dialog') { $('#credential-value').textContent = ''; $('#credential-user').textContent = ''; } });
});
async function boot() {
  try {
    const status = await api('/api/status'); setupRequired = status.setupRequired; state.preview = status.preview === true;
    if (setupRequired) {
      $('#auth-title').textContent = 'İlk adımı birlikte atalım.'; $('#auth-description').textContent = status.localSetup ? 'Sunucu konsolundaki kodla ilk yönetici hesabınızı oluşturun.' : 'İlk kurulum sunucu bilgisayarında tamamlanmalı.';
      $('#auth-eyebrow').textContent = 'KURUMNET İLK KURULUM'; $('#setup-fields').hidden = !status.localSetup; $('#auth-submit').textContent = 'Yönetici hesabını oluştur'; $('#auth-submit').disabled = !status.localSetup;
      $('#setup-token').required = status.localSetup; $('#setup-name').required = status.localSetup; $('#login-password').minLength = 10; $('#login-password').autocomplete = 'new-password';
      $('#auth-help').textContent = 'Kurulum yalnızca bir kez yapılır. Çalışan hesaplarını daha sonra yönetim ekranından açabilirsiniz.';
      const token = new URLSearchParams(location.hash.slice(1)).get('setup'); if (token) { $('#setup-token').value = token; history.replaceState(null, '', '/'); }
      return;
    }
    try { const me = await api('/api/me'); await enter(me); } catch (e) { if (e.status !== 401) throw e; }
  } catch (e) { $('#auth-error').textContent = e.message || 'Sunucuya ulaşılamıyor.'; }
}
$('#auth-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#auth-submit').disabled = true; $('#auth-error').textContent = '';
  try {
    const input = { username: $('#login-username').value.trim(), password: $('#login-password').value };
    if (setupRequired) { input.name = $('#setup-name').value.trim(); input.token = $('#setup-token').value; }
    const me = await api(setupRequired ? '/api/setup' : '/api/login', input);
    $('#auth-form').reset(); setupRequired = false; await enter(me);
  } catch (error) { $('#auth-error').textContent = error.message; }
  finally { $('#auth-submit').disabled = false; }
});
async function enter(me) {
  state.user = me.user; state.csrf = me.csrf;
  $('#auth-screen').hidden = true; $('#workspace').hidden = false;
  $('#profile-open').textContent = initials(state.user.name); $('#profile-open').title = state.user.name;
  $('#welcome-title').textContent = `Merhaba, ${state.user.name.split(' ')[0]}.`;
  $('#admin-open').hidden = state.user.role !== 'admin';
  if (state.user.mustChangePassword) { passwordDialog(); return; }
  await refresh(true); connect();
  if (state.preview) {
    $('#logout').setAttribute('aria-label', 'Önizlemeyi yenile'); $('#logout').innerHTML = icon('refresh');
    document.body.classList.add('preview-mode');
    if (!$('#preview-note')) {
      const note = document.createElement('div'); note.id = 'preview-note'; note.className = 'preview-note';
      note.textContent = 'ÖNİZLEME · Örnek çalışanlar ve mesajlar · Veriler kapanınca silinir';
      document.body.prepend(note);
    }
    const id = Number(new URLSearchParams(location.hash.slice(1)).get('chat'));
    if (state.chats.some(c => c.id === id)) await openChat(id);
  }
}
function signOut(showToast = true) {
  state.source?.close(); state.source = null; state.user = null; state.csrf = ''; state.active = null; state.chats = []; state.users = []; state.messages = []; state.drafts.clear(); state.reply = null; state.edit = null; state.version++;
  $$('dialog[open]').forEach(d => d.close()); $('#workspace').hidden = true; $('#auth-screen').hidden = false; $('#conversation-list').replaceChildren(); $('#message-feed').replaceChildren(); $('#message-input').value = '';
  $('#auth-title').textContent = 'Güne bir merhaba.'; $('#auth-description').textContent = 'Kurum hesabınızla giriş yapın.'; $('#setup-fields').hidden = true; $('#setup-token').required = false; $('#setup-name').required = false; $('#auth-submit').textContent = 'Giriş yap'; $('#login-password').minLength = 1; $('#login-password').autocomplete = 'current-password';
  if (showToast) toast('Oturumunuz kapatıldı.');
}
$('#logout').addEventListener('click', async () => { if (state.preview) { location.reload(); return; } try { await api('/api/logout', {}); signOut(); } catch (e) { toast(e.message); } });
function connect() {
  state.source?.close();
  const source = new EventSource('/api/events'); state.source = source;
  source.addEventListener('connected', () => { $('#connection-dot').classList.add('connected'); $('#connection-text').textContent = 'Canlı bağlantı'; scheduleRefresh({ kind: 'presence' }); });
  source.addEventListener('refresh', e => {
    const value = JSON.parse(e.data); scheduleRefresh(value);
  });
  source.onerror = () => { $('#connection-dot').classList.remove('connected'); $('#connection-text').textContent = 'Bağlantı yenileniyor…'; if (state.user) api('/api/me').catch(e => { if (e.status !== 401) console.debug('Bağlantı bekleniyor.'); }); };
}
let pendingMessage = false, pendingDirectory = false;
function scheduleRefresh(value = {}) {
  if (value.conversationId === state.active) pendingMessage = true;
  if (value.kind === 'presence' || value.kind === 'directory') pendingDirectory = true;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (!state.user || state.user.mustChangePassword) return;
    try {
      const directory = pendingDirectory; pendingDirectory = false;
      await refresh(directory);
      if (pendingMessage && state.active) {
        pendingMessage = false;
        if (state.history) $('#jump-latest').hidden = false;
        else await loadMessages(false);
      }
    } catch (e) { if (state.user) toast(e.message); }
  }, 180);
}
async function refresh(includeUsers = false) {
  const [chats, people] = await Promise.all([api('/api/conversations'), includeUsers ? api('/api/users') : Promise.resolve(null)]);
  if (!state.user) return;
  state.chats = chats.conversations; if (people) state.users = people.users;
  renderConversations(); renderHeader();
}
function renderConversations() {
  const query = fold($('#chat-filter').value);
  const visible = state.chats.filter(c => fold(c.title).includes(query) && (state.tab === 'all' || state.tab === 'unread' && c.unread > 0 || state.tab === 'groups' && c.kind === 'group'));
  $('#unread-total').textContent = state.chats.reduce((s,c) => s + c.unread, 0);
  $('#conversation-list').innerHTML = visible.length ? visible.map(c => `<button class="conversation ${c.id === state.active ? 'active' : ''} ${c.unread ? 'unread' : ''}" data-chat="${c.id}" aria-label="${esc(c.title)}${c.unread ? `, ${c.unread} okunmamış mesaj` : ''}" ${c.id === state.active ? 'aria-current="true"' : ''}><span class="avatar ${c.kind === 'group' ? 'group' : ''} ${c.online ? 'online' : ''}">${c.kind === 'group' ? '#' : esc(initials(c.title))}</span><span class="conversation-copy"><span class="conversation-row"><span class="conversation-name">${esc(c.title)}</span>${c.lastMessage ? `<time>${time(c.lastMessage.createdAt)}</time>` : ''}</span><span class="conversation-row"><span class="conversation-preview">${esc(c.lastMessage ? c.lastMessage.deleted ? 'Bu mesaj silindi' : (c.lastMessage.sender.id === state.user.id ? 'Siz: ' : c.kind === 'group' ? c.lastMessage.sender.name.split(' ')[0] + ': ' : '') + c.lastMessage.body : 'Sohbeti başlatın.')}</span>${c.unread ? `<span class="unread-badge">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}</span></span></button>`).join('') : '<p class="empty-feed">Bu görünümde sohbet yok.</p>';
}
function renderHeader() {
  const c = state.chats.find(c => c.id === state.active); if (!c) return;
  $('#chat-title').textContent = c.title; $('#chat-avatar').textContent = c.kind === 'group' ? '#' : initials(c.title); $('#chat-avatar').className = `avatar ${c.kind === 'group' ? 'group' : ''} ${c.online ? 'online' : ''}`;
  $('#chat-subtitle').textContent = c.kind === 'group' ? `${c.people.length} katılımcı` : c.online ? 'Çevrimiçi' : c.people.find(p => p.id !== state.user.id)?.active ? 'Çevrimdışı' : 'Hesap pasif';
  $('#chat-topic').textContent = c.topic || (c.kind === 'group' ? 'Ekibinizle aynı sayfada kalın.' : 'Bu sohbet yalnızca iki katılımcıya açıktır.');
}
async function openChat(id, around = null) {
  if (state.active) state.drafts.set(state.active, $('#message-input').value);
  state.active = id; state.version++; state.messages = []; state.history = !!around; state.reply = null; state.edit = null;
  $('#message-input').value = state.drafts.get(id) || ''; updateComposer(); $('#reply-preview').hidden = true; $('#welcome').hidden = true; $('#chat-section').hidden = false; $('#workspace').classList.add('chat-open');
  $('#jump-latest').hidden = !around; renderConversations(); renderHeader(); $('#message-feed').innerHTML = '<p class="empty-feed">Mesajlar yükleniyor…</p>';
  try { await loadMessages(true, around); } catch (e) { toast(e.message); }
}
async function loadMessages(scroll, around = null) {
  const id = state.active, version = state.version;
  const feed = $('#message-feed'), nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
  const result = await api(`/api/conversations/${id}/messages${around ? '?around=' + around : ''}`);
  if (state.active !== id || version !== state.version || !state.user) return;
  state.messages = result.messages; state.more = result.hasMore;
  const oldScroll = feed.scrollTop; renderMessages(around);
  if (around) document.getElementById(`message-${around}`)?.scrollIntoView({ block: 'center' });
  else if (scroll || nearBottom) feed.scrollTop = feed.scrollHeight; else feed.scrollTop = oldScroll;
  if (!state.history && (scroll || nearBottom) && document.visibilityState === 'visible') await markRead();
  else if (!nearBottom && !around) $('#jump-latest').hidden = false;
}
async function markRead() {
  const id = state.active, lastId = state.messages.at(-1)?.id; if (!lastId || !state.user) return;
  await api(`/api/conversations/${id}/read`, { lastId });
  if (id === state.active) { const chat = state.chats.find(c => c.id === id); if (chat) chat.unread = 0; renderConversations(); }
}
function renderMessages(highlight) {
  let previousDay = '';
  let html = state.more ? '<button class="older-messages" id="load-older">Önceki mesajları yükle</button>' : '';
  for (const m of state.messages) {
    const date = day(m.createdAt), mine = m.sender.id === state.user.id;
    if (date !== previousDay) { html += `<div class="date-divider">${esc(date)}</div>`; previousDay = date; }
    html += `<article id="message-${m.id}" class="message ${mine ? 'mine' : ''} ${m.deleted ? 'deleted' : ''} ${m.id === highlight ? 'highlight' : ''}"><span class="avatar" aria-hidden="true">${esc(initials(m.sender.name))}</span><div class="message-content"><p class="message-author">${mine ? 'Siz' : esc(m.sender.name)}</p><div class="message-bubble">${m.reply ? `<button class="message-quote" data-jump="${m.reply.id}"><strong>${esc(m.reply.name)}</strong><span>${esc(m.reply.body)}</span></button>` : ''}${esc(m.deleted ? 'Bu mesaj silindi.' : m.body)}</div><div class="message-meta"><time datetime="${esc(m.createdAt)}">${time(m.createdAt)}</time>${m.editedAt ? '<span>· düzenlendi</span>' : ''}${!m.deleted ? `<span class="message-controls"><button data-reply="${m.id}">Yanıtla</button>${mine ? `<button data-edit="${m.id}">Düzenle</button><button data-delete="${m.id}">Sil</button>` : ''}</span>` : ''}</div></div></article>`;
  }
  $('#message-feed').innerHTML = html || '<p class="empty-feed">Henüz mesaj yok. İlk merhabayı siz gönderin.</p>';
}
async function older() {
  const id = state.active, version = state.version, first = state.messages[0]?.id; if (!first) return;
  const feed = $('#message-feed'), oldHeight = feed.scrollHeight, oldTop = feed.scrollTop;
  try {
    const result = await api(`/api/conversations/${id}/messages?before=${first}`); if (id !== state.active || version !== state.version) return;
    state.messages = [...result.messages, ...state.messages]; state.more = result.hasMore; state.history = true;
    renderMessages(); feed.scrollTop = feed.scrollHeight - oldHeight + oldTop; $('#jump-latest').hidden = false;
  } catch (e) { toast(e.message); }
}
function updateComposer() { const input = $('#message-input'); input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 135) + 'px'; $('#message-length').textContent = `${input.value.length} / 4000`; }
$('#message-input').addEventListener('input', () => { updateComposer(); if (state.active) state.drafts.set(state.active, $('#message-input').value); });
$('#message-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#message-form').requestSubmit(); } });
function cancelReply() { state.reply = null; state.edit = null; $('#reply-preview').hidden = true; }
$('#cancel-reply').addEventListener('click', cancelReply);
let pendingSend = null;
$('#message-form').addEventListener('submit', async e => {
  e.preventDefault(); const body = $('#message-input').value.trim(), id = state.active;
  if (!body || !id || state.sending) return;
  const edited = state.edit, replyTo = state.reply?.id || null;
  if (!pendingSend || pendingSend.id !== id || pendingSend.body !== body || pendingSend.replyTo !== replyTo) pendingSend = { id, body, replyTo, clientId: [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('') };
  state.sending = true; $('#send-message').disabled = true;
  try {
    if (edited) await api(`/api/messages/${edited.id}`, { body }, 'PATCH');
    else await api(`/api/conversations/${id}/messages`, { body, clientId: pendingSend.clientId, replyTo });
    pendingSend = null; state.drafts.delete(id);
    if (state.active === id) { $('#message-input').value = ''; updateComposer(); cancelReply(); state.history = false; $('#jump-latest').hidden = true; await loadMessages(true); }
    await refresh();
  } catch (error) { toast(error.message); }
  finally { state.sending = false; $('#send-message').disabled = false; $('#message-input').focus(); }
});
$('#jump-latest').addEventListener('click', () => { state.history = false; $('#jump-latest').hidden = true; loadMessages(true).catch(e => toast(e.message)); });
$('#mobile-back').addEventListener('click', () => $('#workspace').classList.remove('chat-open'));
$('#chats-view').addEventListener('click', () => $('#workspace').classList.remove('chat-open'));
$('#chat-filter').addEventListener('input', renderConversations);
$$('[data-tab]').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; $$('[data-tab]').forEach(t => { t.classList.toggle('active', t === b); t.setAttribute('aria-pressed', String(t === b)); }); renderConversations(); }));
$('#refresh').addEventListener('click', () => scheduleRefresh({ conversationId: state.active }));

function newChat() { state.selected.clear(); $('#new-form').reset(); $('#group-fields').hidden = true; $('#group-title').required = false; $('#new-error').textContent = ''; renderPeople(); dialog('#new-dialog'); }
function renderPeople() {
  const group = $('#new-form [name=kind]:checked').value === 'group', query = fold($('#people-filter').value);
  const people = state.users.filter(u => u.id !== state.user.id && fold(u.name + ' ' + u.department).includes(query));
  $('#people-list').innerHTML = people.length ? people.map(u => `<label class="person"><span class="avatar ${u.online ? 'online' : ''}">${esc(initials(u.name))}</span><div><strong>${esc(u.name)}</strong><small>${esc(u.department || 'Genel')} · ${u.online ? 'Çevrimiçi' : 'Çevrimdışı'}</small></div><input type="${group ? 'checkbox' : 'radio'}" name="person" value="${u.id}" ${state.selected.has(u.id) ? 'checked' : ''}></label>`).join('') : '<p class="muted small">Gösterilecek çalışan yok. Yönetici yeni hesap ekleyebilir.</p>';
  $('#selection-count').textContent = state.selected.size ? `${state.selected.size} kişi seçildi.` : group ? 'Gruba katılacak kişileri seçin.' : 'Bir kişi seçin.';
}
['#new-chat', '#welcome-new', '#people-open'].forEach(s => $(s).addEventListener('click', newChat));
$('#people-filter').addEventListener('input', renderPeople);
$('#new-form').addEventListener('change', e => {
  if (e.target.name === 'kind') { state.selected.clear(); $('#group-fields').hidden = e.target.value !== 'group'; $('#group-title').required = e.target.value === 'group'; renderPeople(); }
  if (e.target.name === 'person') { if (e.target.type === 'radio') state.selected.clear(); if (e.target.checked) state.selected.add(Number(e.target.value)); else state.selected.delete(Number(e.target.value)); $('#selection-count').textContent = `${state.selected.size} kişi seçildi.`; }
});
$('#new-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#new-error').textContent = '';
  try { const result = await api('/api/conversations', { kind: $('#new-form [name=kind]:checked').value, members: [...state.selected], title: $('#group-title').value, topic: $('#group-topic').value }); closeDialogs(); await refresh(); await openChat(result.id); }
  catch (error) { $('#new-error').textContent = error.message; }
});
function searchDialog() { $('#search-results').replaceChildren(); $('#message-search').value = ''; dialog('#search-dialog'); $('#message-search').focus(); }
['#global-search', '#chat-search'].forEach(s => $(s).addEventListener('click', searchDialog));
$('#search-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#search-results').textContent = 'Aranıyor…';
  try { const result = await api('/api/search?q=' + encodeURIComponent($('#message-search').value.trim())); $('#search-results').innerHTML = result.messages.length ? result.messages.map(m => `<button class="search-result" data-result="${m.id}" data-conversation="${m.conversationId}"><strong>${esc(state.chats.find(c => c.id === m.conversationId)?.title || 'Sohbet')} · ${esc(m.sender.name)}</strong><p>${esc(m.body.slice(0, 500))}</p><small>${esc(day(m.createdAt))} ${time(m.createdAt)}</small></button>`).join('') : '<p class="muted">Sonuç bulunamadı.</p>'; }
  catch (error) { $('#search-results').textContent = error.message; }
});
function passwordDialog() { $('#password-form').reset(); $('#password-error').textContent = ''; $('#password-note').textContent = state.user.mustChangePassword ? 'Hesabınızı kullanmaya başlamak için geçici parolanızı değiştirin.' : `${state.user.name} · ${state.user.username}`; $('#profile-dialog [data-close]').hidden = state.user.mustChangePassword; dialog('#profile-dialog'); }
$('#profile-open').addEventListener('click', passwordDialog);
$('#password-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#password-error').textContent = '';
  if ($('#new-password').value !== $('#repeat-password').value) { $('#password-error').textContent = 'Yeni parolalar eşleşmiyor.'; return; }
  const submit = e.target.querySelector('[type=submit]'); submit.disabled = true;
  state.source?.close(); state.source = null;
  try { const me = await api('/api/password', { currentPassword: $('#current-password').value, password: $('#new-password').value }); state.user = me.user; state.csrf = me.csrf; closeDialogs(); $('#password-form').reset(); await enter(me); toast('Parolanız değiştirildi. Diğer oturumlar kapatıldı.'); }
  catch (error) { $('#password-error').textContent = error.message; if (state.user && !state.user.mustChangePassword) connect(); } finally { submit.disabled = false; }
});
async function adminPanel() {
  try {
    const [people, audit] = await Promise.all([api('/api/admin/users'), api('/api/admin/audit')]); adminUsers = people.users;
    $('#admin-users').innerHTML = adminUsers.map(u => `<div class="admin-user ${u.active ? '' : 'inactive'}"><div><strong>${esc(u.name)}</strong><p>${esc(u.username)} · ${esc(u.department || 'Genel')} · ${u.role === 'admin' ? 'Yönetici' : 'Çalışan'} · ${u.active ? 'Aktif' : 'Pasif'}</p></div>${u.id !== state.user.id ? `<button data-reset-user="${u.id}">Parola sıfırla</button><button data-toggle-user="${u.id}">${u.active ? 'Pasife al' : 'Etkinleştir'}</button>` : '<span class="muted small">Siz</span>'}</div>`).join('');
    const labels = { setup: 'İlk kurulum', user_created: 'Kullanıcı oluşturuldu', user_enabled: 'Hesap açıldı', user_disabled: 'Hesap kapatıldı', password_reset: 'Parola sıfırlandı', password_changed: 'Parola değiştirildi', conversation_created: 'Sohbet oluşturuldu' };
    $('#audit-list').innerHTML = audit.entries.map(a => `<div class="audit-entry">${esc(day(a.created_at))} ${time(a.created_at)} · ${esc(a.actor || 'Sistem')} · ${esc(labels[a.action] || a.action)} · Kayıt ${esc(a.target)}</div>`).join('');
  } catch (e) { $('#admin-error').textContent = e.message; }
}
$('#admin-open').addEventListener('click', () => { $('#admin-error').textContent = ''; dialog('#admin-dialog'); adminPanel(); });
function showCredential(username, password) { dialog('#credential-dialog'); $('#credential-user').textContent = 'Kullanıcı adı: ' + username; $('#credential-value').textContent = password; }
$('#user-form').addEventListener('submit', async e => {
  e.preventDefault(); const button = e.target.querySelector('[type=submit]'); button.disabled = true; $('#admin-error').textContent = '';
  try { const input = Object.fromEntries(new FormData(e.target)); const result = await api('/api/admin/users', input); e.target.reset(); await refresh(true); showCredential(result.user.username, result.temporaryPassword); }
  catch (error) { $('#admin-error').textContent = error.message; } finally { button.disabled = false; }
});
function chatDetails() {
  const chat = state.chats.find(c => c.id === state.active); if (!chat) return;
  $('#detail-title').textContent = chat.title;
  $('#detail-content').innerHTML = `<p class="muted">${esc(chat.topic || (chat.kind === 'direct' ? 'Birebir sohbet' : 'Grup sohbeti'))}</p><p class="muted small">${chat.people.length} katılımcı</p>${chat.people.map(p => `<div class="detail-person">${esc(p.name)} ${p.id === state.user.id ? '(Siz)' : ''}<small>${esc(p.department || 'Genel')}${p.active ? '' : ' · Hesap pasif'}</small></div>`).join('')}`;
  dialog('#detail-dialog');
}
['#chat-info', '#chat-details'].forEach(s => $(s).addEventListener('click', chatDetails));
document.addEventListener('click', async e => {
  try {
    const chat = e.target.closest('[data-chat]'); if (chat) await openChat(Number(chat.dataset.chat));
    if (e.target.closest('#load-older')) await older();
    const result = e.target.closest('[data-result]'); if (result) { closeDialogs(); await openChat(Number(result.dataset.conversation), Number(result.dataset.result)); }
    const reply = e.target.closest('[data-reply]'), edit = e.target.closest('[data-edit]');
    if (reply || edit) {
      const m = state.messages.find(m => m.id === Number((reply || edit).dataset[reply ? 'reply' : 'edit'])); if (!m) return;
      state.reply = edit ? null : m; state.edit = edit ? m : null;
      $('#reply-preview').hidden = false; $('#reply-label').textContent = edit ? 'Mesajı düzenle' : m.sender.name + ' kişisine yanıt'; $('#reply-text').textContent = m.body;
      if (edit) { $('#message-input').value = m.body; updateComposer(); } $('#message-input').focus();
    }
    const remove = e.target.closest('[data-delete]'); if (remove && confirm('Kendi mesajınızı sohbetten kaldırmak istiyor musunuz?')) { await api('/api/messages/' + remove.dataset.delete, null, 'DELETE'); await loadMessages(false); await refresh(); }
    const jump = e.target.closest('[data-jump]'); if (jump) await openChat(state.active, Number(jump.dataset.jump));
    const toggle = e.target.closest('[data-toggle-user]');
    if (toggle) { const u = adminUsers.find(u => u.id === Number(toggle.dataset.toggleUser)); if (u && confirm(`${u.name} hesabı ${u.active ? 'pasife alınsın' : 'etkinleştirilsin'} mı?`)) { await api('/api/admin/users/' + u.id, { active: !u.active }, 'PATCH'); await adminPanel(); await refresh(); } }
    const reset = e.target.closest('[data-reset-user]');
    if (reset) { const u = adminUsers.find(u => u.id === Number(reset.dataset.resetUser)); if (u && confirm(`${u.name} için yeni geçici parola oluşturulsun mu? Mevcut oturumları kapatılacak.`)) { const result = await api(`/api/admin/users/${u.id}/reset`, {}); showCredential(u.username, result.temporaryPassword); } }
  } catch (error) { toast(error.message); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.user && !state.user.mustChangePassword) scheduleRefresh({ conversationId: state.active }); });
boot();
