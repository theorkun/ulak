const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold = s => String(s).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const paths = { search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',logout:'<path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h13"/>',shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',settings:'<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',building:'<rect x="5" y="3" width="14" height="19" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 22v-4h4v4"/>',users:'<circle cx="8" cy="7" r="3"/><path d="M2 21v-3a5 5 0 0 1 10 0v3M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 5 5v2"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',refresh:'<path d="M20 4v5h-5M4 20v-5h5M4 9a8 8 0 0 1 13-5l3 5M4 15l3 5a8 8 0 0 0 13-5"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>' };
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.building}</svg>`;
$$('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const initials = name => String(name).split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('tr');
const roleName = role => ({super_admin:'Süper admin',admin:'Yönetici',member:'Personel'}[role]||'Personel');
const clock = value => new Date(value).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
const day = value => new Date(value).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});
const state = { user:null,csrf:'',rooms:[],directory:[],active:null,messages:[],more:false,history:false,version:0,reply:null,edit:null,sending:false,source:null,preview:false,setup:false,drafts:new Map(),departments:[],adminUsers:[] };
let toastTimer,refreshTimer,readTimer,returnFocus,pendingMessage=false,pendingDirectory=false,pendingSend=null;
const markedReads=new Map();
const nearLatest = () => {const el=$('.chat-timeline');return el.scrollHeight-el.clientHeight-el.scrollTop<90;};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
async function api(route,data,method){
  if(window.ULAK_DEMO){try{return await window.ULAK_DEMO.request(route,data,method);}catch(e){if(e.status===401&&state.user)signOut();if(e.status===428&&state.user)passwordDialog();throw e;}}
  const response=await fetch(route,{method:method||(data?'POST':'GET'),headers:data||method?{'Content-Type':'application/json','X-CSRF-Token':state.csrf}:{},credentials:'same-origin',body:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok){if(response.status===401&&state.user)signOut();if(response.status===428&&state.user)passwordDialog();const e=new Error(result.error||'İşlem tamamlanamadı.');e.status=response.status;throw e;}return result;
}
function dialog(id){if(state.user?.mustChangePassword&&id!=='#profile-dialog')return;$$('dialog[open]').forEach(d=>d.close());returnFocus=document.activeElement;$(id).showModal();}
function closeDialogs(){if(state.importing){toast('Hesaplar oluşturuluyor; işlemin bitmesini bekleyin.');return;}if(state.user?.mustChangePassword)return;$$('dialog[open]').forEach(d=>d.close());returnFocus?.focus();}
$$('dialog').forEach(d=>{d.addEventListener('cancel',e=>{if(state.user?.mustChangePassword||state.importing)e.preventDefault();});d.addEventListener('close',()=>{if(d.id==='credential-dialog'){$('#credential-value').textContent='';$('#credential-user').textContent='';}});});
function profile(){
  if(!state.user)return;
  $('#profile-name').textContent=state.user.name;$('#profile-department').textContent=state.user.department;
  $('#profile-avatar').innerHTML=avatarContent(state.user);$('#admin-open').hidden=!['admin','super_admin'].includes(state.user.role);$('#profile-role').textContent=roleName(state.user.role);
  $$('#user-form [name="role"] option').forEach(option=>{option.hidden=option.disabled=option.value!=='member'&&state.user.role!=='super_admin';});
}
async function boot(){
  try{
    const status=await api('/api/status');state.setup=status.setupRequired;state.preview=status.preview===true;
    if(state.preview){
      document.body.classList.add('preview-mode');const note=document.createElement('div');note.className='preview-note';note.textContent=status.browserDemo?'Demo · Bu tarayıcıya özel · Yenilenince sıfırlanır':'Önizleme · Örnek veriler';document.body.prepend(note);
      if(status.browserDemo)$('#auth-help').textContent='Bu ekran önizlemedir. Gerçek kurum hesabı veya kişisel bilgi kullanmayın.';
    }
    state.recoveryChannels=status.recoveryChannels||{};
    if(state.setup){
      $('#forgot-password').hidden=true;
      $('#auth-title').textContent=state.setup?'İlk kurulum':'Hoş geldiniz';$('#auth-description').textContent=status.localSetup?'Sunucu konsolundaki kodla yönetici hesabınızı oluşturun.':'Kurulum sunucu bilgisayarında yapılmalı.';
      $('#setup-fields').hidden=!status.localSetup;['#setup-token','#setup-name','#setup-department'].forEach(s=>$(s).required=status.localSetup);$('#auth-submit').disabled=!status.localSetup;$('#auth-submit').textContent='Kurum hesabını oluştur';$('#login-password').minLength=10;$('#login-password').autocomplete='new-password';
      const token=new URLSearchParams(location.hash.slice(1)).get('setup');if(token){$('#setup-token').value=token;history.replaceState(null,'','/');}return;
    }
    try{await enter(await api('/api/me'));}catch(e){if(e.status!==401)throw e;}
  }catch(e){$('#auth-error').textContent=e.message;}
}
$('#auth-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#auth-error').textContent='';$('#auth-submit').disabled=true;
  try{const input={username:$('#login-username').value.trim(),password:$('#login-password').value};if(state.setup)Object.assign(input,{name:$('#setup-name').value,department:$('#setup-department').value,token:$('#setup-token').value});const me=await api(state.setup?'/api/setup':'/api/login',input);state.setup=false;$('#auth-form').reset();await enter(me);}catch(error){$('#auth-error').textContent=error.message;}finally{$('#auth-submit').disabled=false;}
});
async function enter(me){state.user=me.user;state.csrf=me.csrf;$('#auth-screen').hidden=true;$('#workspace').hidden=false;profile();if(state.user.mustChangePassword){passwordDialog();return;}await refresh(true);connect();if(!state.active){const room=state.rooms.find(r=>r.scope==='general')||state.rooms[0];if(room)await openRoom(room.id);}}
function signOut(){
  ChatUX.reset();cancelFileUpload();FilePreviews.reset();clearPrivateDrafts();clearAttachment();pendingSend=null;clearImport();
  clearTimeout(readTimer);markedReads.clear();
  $('#forgot-password').hidden=false;
  state.source?.close();state.source=null;state.user=null;state.csrf='';state.active=null;state.rooms=[];state.directory=[];state.messages=[];state.version++;state.drafts.clear();state.reply=null;state.edit=null;
  $$('dialog[open]').forEach(d=>d.close());$('#workspace').hidden=true;$('#auth-screen').hidden=false;$('#conversation-list').replaceChildren();$('#message-feed').replaceChildren();$('#message-input').value='';$('#chat-section').hidden=true;$('#welcome').hidden=false;
  $('#setup-fields').hidden=true;['#setup-token','#setup-name','#setup-department'].forEach(s=>$(s).required=false);$('#login-password').minLength=1;$('#login-password').autocomplete='current-password';$('#auth-title').textContent=state.setup?'İlk kurulum':'Hoş geldiniz';$('#auth-description').textContent='Kurum hesabınızla devam edin.';$('#auth-submit').textContent='Giriş yap';
}
$('#logout').addEventListener('click',async()=>{state.source?.close();try{await api('/api/logout',{});signOut();}catch(e){toast(e.message);if(state.user)connect();}});
function connect(){state.source?.close();if(window.ULAK_DEMO){$('#connection-text').textContent='Tarayıcı demosu';return;}const source=new EventSource('/api/events');state.source=source;source.addEventListener('connected',()=>{$('#connection-dot').classList.add('connected');$('#connection-text').textContent='Canlı bağlantı';scheduleRefresh({kind:'directory'});});source.addEventListener('refresh',e=>{const value=JSON.parse(e.data);ChatUX.event(value);if(value.kind!=='receipt')scheduleRefresh(value);});source.onerror=()=>{$('#connection-dot').classList.remove('connected');$('#connection-text').textContent='Yeniden bağlanıyor…';if(state.user)api('/api/me').catch(()=>{});};}
function scheduleRefresh(value={}){
  if(value.conversationId===state.active)pendingMessage=true;if(['directory','presence'].includes(value.kind))pendingDirectory=true;clearTimeout(refreshTimer);
  refreshTimer=setTimeout(async()=>{if(!state.user||state.user.mustChangePassword)return;try{const directory=pendingDirectory;pendingDirectory=false;await refresh(directory);if(pendingMessage&&state.active){pendingMessage=false;if(state.history)$('#jump-latest').hidden=false;else await loadMessages(false);}}catch(e){if(state.user)toast(e.message);}},180);
}
async function refresh(includeIdentity=false){
  const [rooms,me,directory]=await Promise.all([api('/api/conversations'),includeIdentity?api('/api/me'):Promise.resolve(null),includeIdentity?api('/api/directory'):Promise.resolve(null)]);if(!state.user)return;
  notifyNewMessages(state.rooms,rooms.conversations);state.rooms=rooms.conversations;if(directory)state.directory=directory.departments;if(me){state.user=me.user;state.csrf=me.csrf;profile();}
  if(state.active&&!state.rooms.some(r=>r.id===state.active)){state.active=null;state.messages=[];$('#message-feed').replaceChildren();const general=state.rooms.find(r=>r.scope==='general');if(general)await openRoom(general.id);}
  renderRooms();renderHeader();ChatUX.syncRooms(state.rooms);
}
function renderRooms(){
  const q=fold($('#chat-filter').value),visible=state.rooms.filter(r=>fold(r.title).includes(q));
  const other=state.directory.filter(d=>!d.accessible&&fold(d.name).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
  $('#room-count').textContent=state.directory.length+1;
  let html=visible.map(r=>`${r.scope==='department'?'<p class="room-section-label">MÜDÜRLÜĞÜM</p>':''}<button class="room-nav ${r.id===state.active?'active':''}" data-chat="${r.id}" ${r.id===state.active?'aria-current="true"':''} aria-label="${esc(r.title)}${r.unread?`, ${r.unread} okunmamış`:''}"><span class="room-nav-icon">${icon(r.scope==='general'?'globe':'building')}</span><span class="room-nav-copy"><strong>${esc(r.title)}</strong><small>${esc(r.lastMessage?(r.lastMessage.deleted?'Mesaj kaldırıldı':r.lastMessage.body):(r.scope==='general'?'Tüm kurum personeli':'Müdürlük içi iletişim'))}</small></span><span class="room-nav-meta">${r.lastMessage?.createdAt?`<time>${clock(r.lastMessage.createdAt)}</time>`:''}${r.unread?`<span class="unread-badge">${r.unread>99?'99+':r.unread}</span>`:''}</span></button>`).join('');
  const expanded=!!q||$('#directory-other')?.open===true;
  if(other.length)html+=`<details id="directory-other" class="directory-list" ${expanded?'open':''}><summary>Diğer müdürlükler <span>${other.length}</span></summary>`+other.map(d=>`<button class="room-nav locked-room" data-department-info="${d.id}" title="${esc(d.name)} · Müdürlük personeline özel" aria-label="${esc(d.name)}; müdürlük personeline özel"><span class="room-nav-icon">${icon('building')}</span><span class="room-nav-copy"><strong>${esc(d.name)}</strong><small>Müdürlük personeline özel</small></span><span class="room-lock" aria-hidden="true">${icon('lock')}</span></button>`).join('')+'</details>';
  $('#conversation-list').innerHTML=html||'<p class="muted small">Alan bulunamadı.</p>';
}
function renderHeader(){
  const r=state.rooms.find(r=>r.id===state.active);if(!r)return;
  $('#chat-title').textContent=r.title;
  $('#chat-topic').textContent=r.scope==='general'?'Tüm kurum personeli':'Müdürlük personeli';
  $('#chat-subtitle').textContent=`${r.people.filter(p=>p.active).length} katılımcı`;
  renderRoomExtras(r);
}
async function openRoom(id,around=null){
  FilePreviews.reset();
  clearAttachment();
  clearTimeout(readTimer);state.loadingOlder=false;state.unreadMarker=0;state.unreadCount=0;
  if(state.active)state.drafts.set(state.active,$('#message-input').value);state.active=id;state.version++;state.messages=[];state.history=!!around;cancelReply();$('#message-input').value=state.drafts.get(id)||'';updateComposer();$('#welcome').hidden=true;$('#chat-section').hidden=false;$('#jump-latest').hidden=!around;renderRooms();renderHeader();$('#message-feed').innerHTML='<p class="empty-feed">Alan paylaşımları yükleniyor…</p>';
  try{await loadMessages(true,around);}catch(e){toast(e.message);}
}
async function loadMessages(scroll,around=null){
  const id=state.active,version=state.version,container=$('.chat-timeline');
  const result=await api(`/api/conversations/${id}/messages${around?'?around='+around:''}`);if(id!==state.active||version!==state.version||!state.user)return;
  const atBottom=nearLatest(),oldTop=container.scrollTop,rect=container.getBoundingClientRect(),anchor=$$('#message-feed .post').find(el=>el.getBoundingClientRect().bottom>rect.top+1),anchorId=anchor?.id,anchorOffset=anchor?anchor.getBoundingClientRect().top-rect.top:0;
  if(scroll&&!around&&!state.unreadMarker){const unread=state.rooms.find(r=>r.id===id)?.unread||0;if(unread){state.unreadMarker=result.messages.filter(m=>m.sender.id!==state.user.id&&!m.deleted).slice(-unread)[0]?.id||0;state.unreadCount=unread;}}
  state.messages=result.messages;state.more=result.hasMore;renderMessages(around);
  if(around)document.getElementById(`message-${around}`)?.scrollIntoView({block:'center'});else if(scroll||atBottom){container.scrollTop=container.scrollHeight;$('#jump-latest').hidden=true;}else{const next=anchorId&&document.getElementById(anchorId);container.scrollTop=oldTop+(next?next.getBoundingClientRect().top-container.getBoundingClientRect().top-anchorOffset:0);$('#jump-latest').hidden=false;}
  await ChatUX.delivered(id,result.messages).catch(()=>{});
  if(!state.history&&(scroll||atBottom)&&document.visibilityState==='visible')await markRead();
}
async function markRead(){const id=state.active,lastId=state.messages.at(-1)?.id;if(!id||!lastId||!state.user)return;const key=state.user.id+':'+id;if((markedReads.get(key)||0)>=lastId)return;await api(`/api/conversations/${id}/read`,{lastId});markedReads.set(key,Math.max(markedReads.get(key)||0,lastId));if(id===state.active){const r=state.rooms.find(r=>r.id===id);if(r)r.unread=0;renderRooms();renderHeader();}}
function renderMessages(highlight){
  let previousDay='';
  let html=state.messages.map(m=>{
    const date=day(m.createdAt),own=m.sender.id===state.user.id;
    let prefix=date!==previousDay?`<div class="chat-day"><span>${esc(date===day(new Date())?'Bugün':date)}</span></div>`:'';previousDay=date;
    if(m.id===state.unreadMarker)prefix+=`<div class="unread-divider"><span>${state.unreadCount} okunmamış mesaj</span></div>`;
    return prefix+`<article id="message-${m.id}" tabindex="0" aria-haspopup="dialog" class="post ${own?'own':''} ${m.attachment&&!m.deleted?'has-attachment':''} ${m.deleted?'deleted':''} ${m.id===highlight?'highlight':''}"><header class="post-header"><span class="avatar">${avatarContent(m.sender)}</span><div class="post-author"><strong>${esc(own?'Siz':m.sender.name)}</strong><small>${esc(m.sender.department||'Kurum personeli')}</small></div>${m.pinned&&!m.deleted?'<span class="message-tag">Sabit</span>':''}</header>${m.reply?`<button class="post-quote" data-jump="${m.reply.id}"><strong>${esc(m.reply.name)}</strong><span>${esc(m.reply.body)}</span></button>`:''}${!m.attachment||m.deleted?`<div class="post-body">${m.deleted?'Bu mesaj geri alındı.':messageText(m.body)}</div>`:''}${messageAttachment(m)}<footer class="post-footer">${messageActions(m,own)}<span class="message-meta">${m.editedAt&&!m.deleted&&!m.attachment?'<span>Düzenlendi</span>':''}<time datetime="${esc(m.createdAt)}" title="${esc(date)}">${clock(m.createdAt)}</time></span></footer></article>`;
  }).join('');
  if(!html)html='<p class="empty-feed">Henüz mesaj yok. İlk mesajı siz gönderin.</p>';if(state.more)html='<button id="load-older" class="older-messages">Daha eski mesajları yükle</button>'+html;$('#message-feed').innerHTML=html;FilePreviews.sync();ChatUX.sync();
}
async function older(){const id=state.active,version=state.version,first=state.messages[0]?.id;if(!first||state.loadingOlder)return;state.loadingOlder=true;const container=$('.chat-timeline');try{const result=await api(`/api/conversations/${id}/messages?before=${first}`);if(id!==state.active||version!==state.version)return;const top=container.scrollTop,height=container.scrollHeight;state.messages=[...result.messages,...state.messages];state.more=result.hasMore;state.history=true;renderMessages();ChatUX.delivered(id,result.messages).catch(()=>{});container.scrollTop=top+container.scrollHeight-height;$('#jump-latest').hidden=false;}catch(e){toast(e.message);}finally{if(id===state.active&&version===state.version)state.loadingOlder=false;}}
function updateComposer(){const input=$('#message-input');$('#message-length').textContent=`${input.value.length} / 4000`;input.style.height='auto';input.style.height=Math.max(44,Math.min(input.scrollHeight,140))+'px';}
function cancelReply(){state.reply=null;state.edit=null;$('#reply-preview').hidden=true;$('#composer-title').textContent='Mesaj yaz';$('#send-message').textContent='Gönder';}
$('#message-input').addEventListener('input',()=>{updateComposer();if(state.active)state.drafts.set(state.active,$('#message-input').value);});
$('#message-input').addEventListener('keydown',e=>{const desktop=!window.matchMedia||window.matchMedia('(pointer:fine)').matches;if(e.key==='Enter'&&!e.isComposing&&(e.ctrlKey||e.metaKey||(desktop&&!e.shiftKey))){e.preventDefault();$('#message-form').requestSubmit();}});
$('#cancel-reply').addEventListener('click',cancelReply);
$('#message-form').addEventListener('submit',async e=>{
  e.preventDefault();const body=$('#message-input').value.trim()||selectedAttachment?.name||'',id=state.active;if(!body||!id||state.sending)return;const edited=state.edit,replyTo=state.reply?.id||null;
  const extra=composerExtras();if(!pendingSend||pendingSend.id!==id||pendingSend.body!==body||pendingSend.replyTo!==replyTo||pendingSend.attachment!==extra.attachment||pendingSend.announcement!==extra.announcement)pendingSend={id,body,replyTo,...extra,clientId:[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('')};
  state.sending=true;$('#message-file').disabled=$('#remove-attachment').disabled=true;$('#send-message').disabled=true;$('#send-message').textContent='Gönderiliyor…';let delivered=false;
  try{if(edited)await api('/api/messages/'+edited.id,{body},'PATCH');else await sendMessageWithFile(id,{body,clientId:pendingSend.clientId,replyTo,announcement:extra.announcement},extra.attachment);delivered=true;pendingSend=null;state.drafts.delete(id);savePrivateDrafts();if(id===state.active){clearAttachment();$('#message-input').value='';cancelReply();updateComposer();state.history=false;$('#jump-latest').hidden=true;await loadMessages(true);}await refresh();}catch(error){toast(delivered?'Mesaj gönderildi; görünüm yenilenemedi. Yenile düğmesini kullanın.':'Gönderilemedi: '+error.message+' Mesajınız korunuyor; tekrar deneyebilirsiniz.');}finally{state.sending=false;$('#message-file').disabled=$('#remove-attachment').disabled=false;$('#send-message').disabled=false;$('#send-message').textContent=state.edit?'Güncelle':'Gönder';}
});
$('#jump-latest').addEventListener('click',()=>{state.history=false;$('#jump-latest').hidden=true;loadMessages(true).catch(e=>toast(e.message));});
$('.chat-timeline').addEventListener('scroll',()=>{clearTimeout(readTimer);if(state.user&&state.active&&!state.history&&nearLatest()){$('#jump-latest').hidden=true;readTimer=setTimeout(()=>{if(state.user&&!state.history&&nearLatest()&&document.visibilityState==='visible')markRead().catch(e=>toast(e.message));},180);}});
$('#chat-filter').addEventListener('input',renderRooms);$('#refresh').addEventListener('click',()=>scheduleRefresh({kind:'directory',conversationId:state.active}));
function roomDetails(){const r=state.rooms.find(r=>r.id===state.active);if(!r)return;$('#detail-title').textContent=r.title+' · Katılımcılar';$('#detail-content').innerHTML=`<p class="muted small">${r.scope==='general'?'Tüm müdürlüklerin personeli bu alana erişebilir.':'Bu alana yalnızca ilgili müdürlüğün personeli erişebilir.'}</p>`+r.people.filter(p=>p.active).map(p=>`<div class="detail-person"><span class="avatar">${avatarContent(p)}</span><div>${esc(p.name)}${p.id===state.user.id?' (Siz)':''}<small>${esc(p.department)}</small></div></div>`).join('');dialog('#detail-dialog');}
['#chat-details'].forEach(s=>$(s).addEventListener('click',roomDetails));
$('#global-search').addEventListener('click',()=>{$('#search-results').replaceChildren();$('#message-search').value='';prepareSearch();dialog('#search-dialog');$('#message-search').focus();});
$('#search-form').addEventListener('submit',async e=>{e.preventDefault();await runAdvancedSearch(false);});
function passwordDialog(){$('#password-form').reset();$('#password-error').textContent='';$('#password-note').textContent=state.user.mustChangePassword?'Alanlara erişmeden önce geçici parolanızı değiştirin.':`${state.user.name} · ${state.user.department}`;$('#profile-dialog [data-close]').hidden=state.user.mustChangePassword;prepareProfile();dialog('#profile-dialog');}
['#profile-open'].forEach(s=>$(s).addEventListener('click',passwordDialog));
$('#password-form').addEventListener('submit',async e=>{e.preventDefault();$('#password-error').textContent='';if($('#new-password').value!==$('#repeat-password').value){$('#password-error').textContent='Yeni parolalar eşleşmiyor.';return;}const button=e.target.querySelector('[type=submit]');button.disabled=true;state.source?.close();try{const me=await api('/api/password',{currentPassword:$('#current-password').value,password:$('#new-password').value});state.user=me.user;state.csrf=me.csrf;closeDialogs();$('#password-form').reset();await enter(me);toast('Parolanız güncellendi. Diğer oturumlar kapatıldı.');}catch(error){$('#password-error').textContent=error.message;if(state.user&&!state.user.mustChangePassword)connect();}finally{button.disabled=false;}});
function departmentOptions(selected){return state.departments.map(d=>`<option value="${d.id}" ${d.id===selected?'selected':''}>${esc(d.name)}</option>`).join('');}
function renderAdminUsers(){
  const query=fold($('#admin-user-filter').value);
  const people=state.adminUsers.filter(u=>fold(u.name+' '+u.username+' '+u.department).includes(query));
  $('#admin-users').innerHTML=people.map(u=>{
    const manageable=state.user.role==='super_admin'||u.role==='member';
    return `<div class="admin-user ${u.active?'':'inactive'}"><div><strong>${esc(u.name)}</strong><p>${esc(u.username)} · ${roleName(u.role)} · ${u.active?'Aktif':'Pasif'}</p></div><select data-assignment="${u.id}" aria-label="${esc(u.name)} müdürlüğü" ${manageable?'':'disabled'}>${departmentOptions(u.departmentId)}</select>${manageable?`<button data-contact-user="${u.id}">İletişim</button><button data-assign-save="${u.id}">Ata</button>${u.id!==state.user.id?`<button data-reset-user="${u.id}">Parola yenile</button><button data-toggle-user="${u.id}">${u.active?'Pasife al':'Etkinleştir'}</button>`:''}`:''}${state.user.role==='super_admin'&&u.id!==state.user.id?`<div class="role-controls"><label for="role-${u.id}">Yetki</label><select id="role-${u.id}" data-role-assignment="${u.id}" aria-label="${esc(u.name)} yetkisi">${['member','admin','super_admin'].map(role=>`<option value="${role}" ${u.role===role?'selected':''}>${roleName(role)}</option>`).join('')}</select><button data-role-save="${u.id}">Yetkiyi kaydet</button></div>`:''}</div>`;
  }).join('')||'<p class="muted small">Personel bulunamadı.</p>';
}
$('#admin-user-filter').addEventListener('input',renderAdminUsers);
async function adminPanel(){
  try{
    const [people,depts,audit]=await Promise.all([api('/api/admin/users'),api('/api/admin/departments'),api('/api/admin/audit')]);state.adminUsers=people.users;state.departments=depts.departments;
    $('#user-department').innerHTML=departmentOptions(state.user.departmentId);$('#department-list').innerHTML=state.departments.map(d=>`<span class="department-tag">${esc(d.name)} · ${d.people} personel</span>`).join('');
    renderAdminUsers();
    const labels={message_recalled:'Mesaj geri alındı',message_pinned:'Mesaj sabitlendi',message_unpinned:'Mesaj sabitlemesi kaldırıldı',avatar_changed:'Profil fotoğrafı değişti',avatar_removed:'Profil fotoğrafı kaldırıldı',sessions_revoked:'Diğer oturumlar kapatıldı',role_changed:'Kullanıcı yetkisi değişti',contact_changed:'İletişim bilgileri değişti',password_recovered:'Parola kurtarıldı',recovery_delivery_failed:'Kurtarma iletisi gönderilemedi',setup:'İlk kurulum',user_created:'Personel hesabı açıldı',user_enabled:'Hesap etkinleştirildi',user_disabled:'Hesap kapatıldı',password_reset:'Parola sıfırlandı',password_changed:'Parola değiştirildi',department_created:'Müdürlük tanımlandı',department_changed:'Müdürlük ataması değişti',conversation_created:'Eski sohbet kaydı'};
    $('#audit-list').innerHTML=audit.entries.map(a=>`<div class="audit-entry">${esc(day(a.created_at))} ${clock(a.created_at)} · ${esc(a.actor||'Sistem')} · ${esc(labels[a.action]||a.action)} · Kayıt ${esc(a.target)}</div>`).join('');
  }catch(error){$('#admin-error').textContent=error.message;}
}
$('#admin-open').addEventListener('click',()=>{$('#admin-error').textContent='';dialog('#admin-dialog');adminPanel();});
$('#department-form').addEventListener('submit',async e=>{e.preventDefault();$('#admin-error').textContent='';const b=e.target.querySelector('[type=submit]');b.disabled=true;try{await api('/api/admin/departments',{name:$('#department-name').value});e.target.reset();await adminPanel();await refresh(true);toast('Müdürlük ve odası hazır.');}catch(error){$('#admin-error').textContent=error.message;}finally{b.disabled=false;}});
function showCredential(username,password){dialog('#credential-dialog');$('#credential-user').textContent='Kullanıcı adı: '+username;$('#credential-value').textContent=password;}
$('#user-form').addEventListener('submit',async e=>{e.preventDefault();$('#admin-error').textContent='';const b=e.target.querySelector('[type=submit]');b.disabled=true;try{const input=Object.fromEntries(new FormData(e.target));const result=await api('/api/admin/users',input);e.target.reset();await refresh(true);showCredential(result.user.username,result.temporaryPassword);}catch(error){$('#admin-error').textContent=error.message;}finally{b.disabled=false;}});
document.addEventListener('click',async e=>{
  try{
    if(e.target.closest('[data-close]'))closeDialogs();
    const room=e.target.closest('[data-chat]');if(room)await openRoom(Number(room.dataset.chat));
    const locked=e.target.closest('[data-department-info]');if(locked){const dept=state.directory.find(d=>d.id===Number(locked.dataset.departmentInfo));if(dept){$('#detail-title').textContent=dept.name;$('#detail-content').innerHTML='<p class="muted">Bu müdürlüğün odası yalnızca o müdürlüğe atanmış personel tarafından kullanılabilir.</p><p class="muted small">Tüm müdürlüklerle ortak paylaşım için Genel Sohbet’i kullanabilirsiniz. Müdürlük atamanızı kurum yöneticiniz düzenler.</p>';dialog('#detail-dialog');}}
    if(e.target.closest('#load-older'))await older();
    const result=e.target.closest('[data-result]');if(result){closeDialogs();await openRoom(Number(result.dataset.room),Number(result.dataset.result));}
    const reply=e.target.closest('[data-reply]'),edit=e.target.closest('[data-edit]');
    if(reply||edit){const m=state.messages.find(m=>m.id===Number((reply||edit).dataset[reply?'reply':'edit']));if(!m)return;state.reply=edit?null:m;state.edit=edit?m:null;$('#reply-preview').hidden=false;$('#reply-label').textContent=edit?'Mesajı düzenliyorsunuz':m.sender.name+' mesajına yanıt';$('#reply-text').textContent=m.body;if(edit){$('#message-input').value=m.body;$('#composer-title').textContent='Mesajı düzenle';$('#send-message').textContent='Güncelle';updateComposer();}$('#message-input').focus({preventScroll:true});}
    const remove=e.target.closest('[data-delete]');if(remove)openDeleteMessage(Number(remove.dataset.delete));
    const jump=e.target.closest('[data-jump]');if(jump)await openRoom(state.active,Number(jump.dataset.jump));
    const assign=e.target.closest('[data-assign-save]');if(assign){const id=Number(assign.dataset.assignSave),departmentId=Number($(`[data-assignment="${id}"]`).value);await api('/api/admin/users/'+id,{departmentId},'PATCH');await refresh(true);await adminPanel();toast('Müdürlük erişimi güncellendi.');}
    const toggle=e.target.closest('[data-toggle-user]');if(toggle){const u=state.adminUsers.find(u=>u.id===Number(toggle.dataset.toggleUser));if(u&&confirm(`${u.name} hesabı ${u.active?'pasife alınsın':'etkinleştirilsin'} mı?`)){await api('/api/admin/users/'+u.id,{active:!u.active},'PATCH');await adminPanel();await refresh(true);}}
    const reset=e.target.closest('[data-reset-user]');if(reset){const u=state.adminUsers.find(u=>u.id===Number(reset.dataset.resetUser));if(u&&confirm(`${u.name} için geçici parola yenilensin mi? Mevcut oturumları kapanacak.`)){const result=await api(`/api/admin/users/${u.id}/reset`,{});showCredential(u.username,result.temporaryPassword);}}
    const roleButton=e.target.closest('[data-role-save]');if(roleButton){const id=Number(roleButton.dataset.roleSave),u=state.adminUsers.find(u=>u.id===id),role=$(`[data-role-assignment="${id}"]`).value;if(u&&u.role!==role&&confirm(`${u.name} yetkisi ${roleName(role)} olarak değiştirilsin mi?`)){await api('/api/admin/users/'+id,{role},'PATCH');await adminPanel();toast('Kullanıcı yetkisi güncellendi.');}}
  }catch(error){toast(error.message);}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.user&&!state.user.mustChangePassword)scheduleRefresh({kind:'directory',conversationId:state.active});});
FilePreviews.init();
initCollaboration();
ChatUX.init();
boot();
