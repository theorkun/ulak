window.ULAK_DEMO_DEPARTMENTS=["Afet İşleri ve Risk Yönetimi Müdürlüğü","Basın Yayın ve Halkla İlişkiler Müdürlüğü","Bilgi İşlem Müdürlüğü","Destek Hizmetleri Müdürlüğü","Emlak ve İstimlak Müdürlüğü","Fen İşleri Müdürlüğü","Gelirler Müdürlüğü","Gençlik ve Spor Hizmetleri Müdürlüğü","Hukuk İşleri Müdürlüğü","İklim Değişikliği ve Sıfır Atık Müdürlüğü","İmar ve Şehircilik Müdürlüğü","İnsan Kaynakları ve Eğitim Müdürlüğü","Kadın ve Aile Hizmetleri Müdürlüğü","Kırsal Hizmetler Müdürlüğü","Kültür, Sanat ve Sosyal İşler Müdürlüğü","Makine İkmal, Bakım ve Onarım Müdürlüğü","Mali Hizmetler Müdürlüğü","Muhtarlık İşleri Müdürlüğü","Özel Kalem Müdürlüğü","Park ve Bahçeler Müdürlüğü","Rehberlik ve Teftiş Kurulu Müdürlüğü","Ruhsat ve Denetim Müdürlüğü","Sağlık İşleri Müdürlüğü","Sosyal Hizmetler Müdürlüğü","Strateji Geliştirme Müdürlüğü","Temizlik İşleri Müdürlüğü","Yapı Kontrol Müdürlüğü","Yazı İşleri Müdürlüğü","Zabıta Müdürlüğü"];
// Disposable simulation for GitHub Pages. Never included by the institution server.
// Accounts and messages stay in memory. The UI separately stores device preferences and tab drafts.
(() => {
  'use strict';
  const password='UlakDemo2026!';
  const departments=window.ULAK_DEMO_DEPARTMENTS.map((name,i)=>({id:i+1,name,official:true}));
  const people=[
    ['orkun','Deniz Yılmaz','Bilgi İşlem Müdürlüğü','super_admin'],
    ['demo.insan','Elif Demir','İnsan Kaynakları ve Eğitim Müdürlüğü','member'],
    ['demo.destek','Mert Kaya','Destek Hizmetleri Müdürlüğü','member'],
    ['demo.mali','Zeynep Arslan','Mali Hizmetler Müdürlüğü','member'],
    ['demo.bilgi','Selin Aydın','Bilgi İşlem Müdürlüğü','member'],
    ['demo.personel','Esra Koç','İnsan Kaynakları ve Eğitim Müdürlüğü','member'],
    ['demo.teknik','Can Aksoy','Destek Hizmetleri Müdürlüğü','member'],
    ['demo.butce','Ece Şahin','Mali Hizmetler Müdürlüğü','member']
  ].map(([username,name,department,role],i)=>({id:i+1,username,name,department,departmentId:departments.find(d=>d.name===department).id,role,active:true,mustChangePassword:false,password:username==='orkun'?'admin':password}));
  const messages=[],audit=[],reads=new Map(),hidden=new Set(),acks=new Set(),fileUrls=new Set();let current=null,nextMessage=1;
  const now=()=>new Date().toISOString();
  const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e;};
  const fold=s=>String(s).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  const publicUser=u=>{const {password,email,phone,...user}=u;return {...user,avatarUrl:u.avatarUrl||'',online:u.id===current?.id};};
  const me=()=>({user:publicUser(current),csrf:'browser-demo'});
  const log=(action,target)=>audit.unshift({action,target,actor:current.name,created_at:now()});
  const roomId=id=>id+1;
  const allowed=id=>id===1||id===roomId(current.departmentId);
  const guard=id=>{if(!allowed(id))fail(403,'Yalnızca Genel Sohbet ve kendi müdürlüğünüze erişebilirsiniz.');};
  const admin=()=>{if(!['admin','super_admin'].includes(current.role))fail(403,'Yönetici yetkisi gerekli.');};
  const manage=user=>{if(current.role!=='super_admin'&&user.role!=='member')fail(403,'Yönetici hesapları süper admin yetkisi gerektirir.');};
  const validText=(value,min,max,label)=>{const s=String(value||'').trim();if(s.length<min||s.length>max)fail(400,label+' uzunluğu uygun değil.');return s;};
  function post(conversationId,senderId,body,minutes=0,extra={}){
    const m={id:nextMessage++,conversationId,senderId,body,createdAt:new Date(Date.now()-minutes*60000).toISOString(),editedAt:null,deleted:false,replyTo:null,...extra};messages.push(m);return m;
  }
  const visible=m=>!hidden.has(current.id+':'+m.id);
  function message(m){const reply=messages.find(r=>r.id===m.replyTo);return {...m,body:m.deleted?'':m.body,attachment:m.deleted?null:m.attachment||null,acknowledged:acks.has(current.id+':'+m.id),acknowledgements:[...acks].filter(key=>key.endsWith(':'+m.id)).length,sender:publicUser(people.find(p=>p.id===m.senderId)),reply:reply?{id:reply.id,name:people.find(p=>p.id===reply.senderId).name,body:reply.deleted?'Bu mesaj geri alındı.':reply.body}:null};}
  function room(id){const general=id===1,d=departments.find(d=>roomId(d.id)===id),latest=messages.filter(m=>m.conversationId===id&&visible(m)).at(-1);return{id,pins:messages.filter(m=>m.conversationId===id&&m.pinned&&!m.deleted&&visible(m)).map(message),lastMessage:latest?message(latest):null,title:general?'Genel Sohbet':d.name,scope:general?'general':'department',topic:general?'Tüm kurum personeli':'Müdürlük personeli',people:people.filter(p=>p.active&&(general||p.departmentId===d.id)).map(publicUser),unread:messages.filter(m=>m.conversationId===id&&visible(m)&&m.id>(reads.get(current.id+':'+id)||0)&&m.senderId!==current.id&&!m.deleted).length};}
  post(1,2,'Günaydın. Yeni dönem oryantasyon programı için müdürlüklerin personel listelerini cuma gününe kadar tamamlıyoruz.',85);
  post(1,3,'Toplantı salonlarının haftalık kullanım planı güncellendi. Taleplerinizi müdürlüğünüz üzerinden iletebilirsiniz.',65);
  post(1,1,'Kurum içi iletişim alanımıza hoş geldiniz. Genel Sohbet tüm müdürlüklerin ortak gündemi, müdürlük odaları ise kendi ekiplerimizin koordinasyonu için hazır.',42);
  post(1,4,'Haftalık faaliyet özetlerini ortak takvime göre tamamlıyoruz.',24);
  post(1,2,'Yarın saat 10.30’da kurum içi bilgilendirme toplantısı yapılacak. Tüm müdürlüklerin temsilcilerini bekliyoruz.',8);
  for(const [senderId,body] of [[5,'Sunucu bakım kontrollerini tamamladım. Destek taleplerini burada koordine edebiliriz.'],[1,'Teşekkürler. Bugünkü test sonuçlarını burada paylaşalım.'],[6,'Yeni başlayan personelin oryantasyon dosyaları hazır.'],[2,'Personel listeleri son halini alınca birlikte gözden geçirelim.'],[7,'Toplantı salonu hazırlıklarını bitirdik.'],[4,'Müdürlük içi bütçe değerlendirmesinin gündemini bu alanda toparlayalım.']])post(roomId(people.find(p=>p.id===senderId).departmentId),senderId,body,15);
  window.ULAK_DEMO={isAttachmentUrl:url=>fileUrls.has(url),async request(route,input,method){
    const verb=method||(input?'POST':'GET');
    const url=new URL(route,'https://demo.invalid'),path=url.pathname;input=input||{};
    if(path==='/api/status')return{setupRequired:false,preview:true,browserDemo:true,recoveryChannels:{email:false}};
    if(path.startsWith('/api/recovery/'))fail(503,'E-posta gönderimi bu önizlemede etkin değildir.');
    if(path==='/api/login'&&verb==='POST'){
      const user=people.find(p=>p.active&&p.username===String(input.username).trim().toLowerCase()&&p.password===input.password);
      if(!user)fail(401,'Kullanıcı adı veya parola hatalı.');current=user;return me();
    }
    if(!current?.active)fail(401,'Giriş yapın.');
    if(path==='/api/me')return me();
    if(path==='/api/logout'){current=null;return{ok:true};}
    if(path==='/api/password'){
      if(input.currentPassword!==current.password)fail(400,'Mevcut parola hatalı.');
      current.password=validText(input.password,10,128,'Yeni parola');current.mustChangePassword=false;log('password_changed',current.id);return me();
    }
    if(current.mustChangePassword)fail(428,'Geçici parolanızı değiştirin.');
    if(path==='/api/profile/avatar'&&['POST','DELETE'].includes(verb)){
      if(verb==='POST'&&(!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.data||'')||input.data.length>200100))fail(400,'Geçersiz fotoğraf.');current.avatarUrl=verb==='DELETE'?'':input.data;log('avatar_changed',current.id);return me();
    }
    if(path==='/api/sessions')return{sessions:[{id:'demo',current:true,createdAt:Date.now(),expiresAt:Date.now()+43200000,agent:'Tarayıcı demosu · Bu sayfa'}]};
    if(path==='/api/sessions/others')return{ok:true};
    let feature=path.match(/^\/api\/messages\/(\d+)\/(hide|pin|acknowledge|receipts)$/);
    if(feature){const m=messages.find(m=>m.id===Number(feature[1]));if(!m)fail(404,'Mesaj bulunamadı.');guard(m.conversationId);const action=feature[2];
      if(action==='hide'&&verb==='POST'){hidden.add(current.id+':'+m.id);return{ok:true};}
      if(m.deleted)fail(404,'Mesaj silinmiş.');
      if(action==='pin'&&verb==='POST'){admin();if(input.pinned&&!m.pinned&&messages.filter(p=>p.conversationId===m.conversationId&&p.pinned&&!p.deleted).length>=3)fail(400,'En fazla 3 sabit mesaj olabilir.');m.pinned=!!input.pinned;return{ok:true};}
      if(!m.announcement)fail(400,'Bu mesaj bir duyuru değil.');
      if(action==='acknowledge'&&verb==='POST'){acks.add(current.id+':'+m.id);return{ok:true};}
      if(action==='receipts'&&verb==='GET')return{people:people.filter(p=>acks.has(p.id+':'+m.id)).map(p=>({name:p.name,created_at:m.createdAt}))};fail(405,'Yöntem desteklenmiyor.');
    }
    if(path==='/api/directory')return{departments:departments.map(d=>({...d,accessible:d.id===current.departmentId}))};
    const binary=path.match(/^\/api\/conversations\/(\d+)\/file-message$/);
    if(binary&&verb==='POST'){
      const id=Number(binary[1]);guard(id);const file=input.file,info=input.attachment;
      if(!file||typeof file.slice!=='function'||!file.size||file.size>100*1024*1024||!info?.name||!['application/pdf','text/plain','image/png','image/jpeg','image/heic','image/heif','image/x-adobe-dng','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(info.type))fail(400,'Geçersiz dosya veya boyut; en fazla 100 MB.');
      const body=validText(input.body,1,4000,'Mesaj');if(input.announcement)admin();if(input.replyTo&&!messages.some(m=>m.id===input.replyTo&&m.conversationId===id&&!m.deleted))fail(400,'Yanıtlanan mesaj bulunamadı.');
      const duplicate=messages.find(m=>m.senderId===current.id&&m.clientId===input.clientId&&m.conversationId===id);if(duplicate)return{id:duplicate.id};
      const url=URL.createObjectURL(file);fileUrls.add(url);const m=post(id,current.id,body,0,{clientId:input.clientId,replyTo:input.replyTo||null,announcement:!!input.announcement,attachment:{name:info.name,type:info.type,size:file.size,url}});return{id:m.id};
    }
    if(path==='/api/conversations'&&verb==='GET')return{conversations:[room(1),room(roomId(current.departmentId))]};
    let match=path.match(/^\/api\/conversations\/(\d+)\/(messages|read)$/);
    if(match){
      const id=Number(match[1]);guard(id);
      if(match[2]==='read'){reads.set(current.id+':'+id,Number(input.lastId)||0);return{ok:true};}
      if(verb==='POST'){
        const body=validText(input.body,1,4000,'Mesaj');
        const duplicate=messages.find(m=>m.senderId===current.id&&m.clientId===input.clientId&&m.conversationId===id);if(duplicate)return{message:message(duplicate)};
        if(input.replyTo&&!messages.some(m=>m.id===input.replyTo&&m.conversationId===id&&!m.deleted))fail(400,'Yanıtlanan mesaj bulunamadı.');
        if(input.announcement)admin();
        let attachment=null;if(input.attachment){const f=input.attachment;if(typeof f.name!=='string'||!/^data:(application\/pdf|text\/plain|image\/(png|jpeg|heic|heif|x-adobe-dng)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet));base64,[A-Za-z0-9+/]+={0,2}$/.test(f.data||'')||f.data.length>2800000)fail(400,'Geçersiz dosya veya boyut.');attachment={name:f.name,type:f.data.slice(5,f.data.indexOf(';')),size:Math.floor(f.data.split(',')[1].length*3/4),url:f.data};}
        return{message:message(post(id,current.id,body,0,{clientId:input.clientId,replyTo:input.replyTo||null,attachment,announcement:!!input.announcement}))};
      }
      let rows=messages.filter(m=>m.conversationId===id&&visible(m));const before=Number(url.searchParams.get('before')),around=Number(url.searchParams.get('around'));
      if(before)rows=rows.filter(m=>m.id<before);
      if(around){const index=rows.findIndex(m=>m.id===around);if(index>=0)rows=rows.slice(Math.max(0,index-20),index+21);}
      return{messages:rows.slice(-50).map(message),hasMore:rows.length>50};
    }
    match=path.match(/^\/api\/messages\/(\d+)$/);
    if(match){const m=messages.find(m=>m.id===Number(match[1]));if(!m||m.deleted)fail(404,'Mesaj bulunamadı.');guard(m.conversationId);if(m.senderId!==current.id)fail(403,'Yalnızca kendi mesajınızı düzenleyebilirsiniz.');if(verb==='DELETE'){m.deleted=true;m.body='';if(fileUrls.has(m.attachment?.url)){URL.revokeObjectURL(m.attachment.url);fileUrls.delete(m.attachment.url);}m.attachment=null;m.pinned=false;log('message_recalled',m.id);}else if(verb==='PATCH'){m.body=validText(input.body,1,4000,'Mesaj');m.editedAt=now();}else fail(405,'İşlem desteklenmiyor.');return{message:message(m)};}
    if(path==='/api/search'){const q=fold(validText(url.searchParams.get('q'),2,100,'Arama'));let rows=messages.filter(m=>allowed(m.conversationId)&&visible(m)&&!m.deleted&&fold(m.body).includes(q));const p=url.searchParams;rows=rows.filter(m=>(!p.get('room')||m.conversationId===Number(p.get('room')))&&(!p.get('sender')||m.senderId===Number(p.get('sender')))&&(!p.get('from')||m.createdAt.slice(0,10)>=p.get('from'))&&(!p.get('to')||m.createdAt.slice(0,10)<=p.get('to'))&&(p.get('files')!=='1'||m.attachment)&&(!p.get('before')||m.id<Number(p.get('before')))).reverse();return{messages:rows.slice(0,60).map(message),hasMore:rows.length>60};}
    if(path.startsWith('/api/admin/')){
      admin();
      if(path==='/api/admin/import'&&verb==='POST'){
        if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>50)fail(400,'En fazla 50 personel seçin.');const names=new Set();
        const rows=input.rows.map(row=>{const username=validText(row.username,3,40,'Kullanıcı adı').toLowerCase(),name=validText(row.name,2,80,'Ad soyad'),d=departments.find(d=>d.id===Number(row.departmentId));if(!/^[a-z0-9._-]+$/.test(username)||!d||names.has(username)||people.some(p=>p.username===username))fail(400,'Kullanıcı adı veya müdürlük geçersiz: '+username);names.add(username);if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))fail(400,'E-posta geçersiz.');return{username,name,d,email:row.email||''};});
        const created=rows.map(row=>{const temporaryPassword='Demo-'+crypto.randomUUID().slice(0,12)+'!',user={id:Math.max(...people.map(p=>p.id))+1,username:row.username,name:row.name,department:row.d.name,departmentId:row.d.id,role:'member',active:true,mustChangePassword:true,password:temporaryPassword,email:row.email};people.push(user);log('user_created',user.id);return{user:publicUser(user),temporaryPassword};});return{created};
      }
      if(path==='/api/admin/audit')return{entries:audit};
      if(path==='/api/admin/departments'){
        if(verb==='GET')return{departments:departments.map(d=>({...d,people:people.filter(p=>p.active&&p.departmentId===d.id).length}))};
        const name=validText(input.name,2,80,'Müdürlük adı');if(departments.some(d=>fold(d.name)===fold(name)))fail(409,'Müdürlük zaten var.');
        const d={id:Math.max(...departments.map(d=>d.id))+1,name,official:false};departments.push(d);log('department_created',d.id);return{department:d};
      }
      if(path==='/api/admin/users'){
        if(verb==='GET')return{users:people.map(u=>({...publicUser(u),email:u.email||'',phone:u.phone||''}))};
        const username=validText(input.username,3,40,'Kullanıcı adı').toLowerCase(),name=validText(input.name,2,80,'Ad soyad'),d=departments.find(d=>d.id===Number(input.departmentId));
        if(!/^[a-z0-9._-]+$/.test(username)||!d||!['super_admin','admin','member'].includes(input.role))fail(400,'Bilgileri kontrol edin.');
        if(input.role!=='member'&&current.role!=='super_admin')fail(403,'Yönetici yetkisini yalnızca süper admin verebilir.');
        if(people.some(p=>p.username===username))fail(409,'Kullanıcı adı zaten var.');
        const temporaryPassword='Demo-'+crypto.randomUUID().slice(0,12)+'!';
        const user={id:Math.max(...people.map(p=>p.id))+1,username,name,department:d.name,departmentId:d.id,role:input.role,active:true,mustChangePassword:true,password:temporaryPassword,email:String(input.email||''),phone:String(input.phone||'')};people.push(user);log('user_created',user.id);return{user:publicUser(user),temporaryPassword};
      }
      match=path.match(/^\/api\/admin\/users\/(\d+)(\/reset)?$/);
      if(match){
        const user=people.find(p=>p.id===Number(match[1]));if(!user)fail(404,'Personel bulunamadı.');
        manage(user);
        if(Object.hasOwn(input,'role')){
          if(current.role!=='super_admin'||!['super_admin','admin','member'].includes(input.role))fail(403,'Yetki değişikliği süper admin gerektirir.');
          if(user.id===current.id&&input.role!==current.role)fail(400,'Kendi süper admin yetkinizi kaldıramazsınız.');
          if(user.role==='super_admin'&&user.active&&input.role!=='super_admin'&&people.filter(p=>p.active&&p.role==='super_admin').length<=1)fail(400,'Son aktif süper admin kaldırılamaz.');
          user.role=input.role;log('role_changed',user.id);
        }
        if(Object.hasOwn(input,'email')||Object.hasOwn(input,'phone')){user.email=String(input.email??user.email??'');user.phone=String(input.phone??user.phone??'');log('contact_changed',user.id);}
        if(match[2]){if(user.id===current.id)fail(400,'Kendi parolanızı profilinizden değiştirin.');const temporaryPassword='Demo-'+crypto.randomUUID().slice(0,12)+'!';user.password=temporaryPassword;user.mustChangePassword=true;log('password_reset',user.id);return{temporaryPassword};}
        if(input.departmentId){const d=departments.find(d=>d.id===Number(input.departmentId));if(!d)fail(400,'Müdürlük bulunamadı.');user.departmentId=d.id;user.department=d.name;log('department_changed',user.id);}
        if(typeof input.active==='boolean'){if(user.id===current.id)fail(400,'Kendi hesabınızı kapatamazsınız.');user.active=input.active;log(user.active?'user_enabled':'user_disabled',user.id);}
        return{user:publicUser(user)};
      }
    }
    fail(403,'Bu işlem demo kapsamında kullanılamıyor.');
  }};
})();
