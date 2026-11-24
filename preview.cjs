// Local, disposable UI preview. Never bind this server to a network interface.
const http = require('node:http');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { createChat } = require('./server.cjs');
async function startPreview(options = {}) {
  const app = createChat({ dbPath: ':memory:' });
  const salt = crypto.randomBytes(16).toString('hex');
  const password = salt + ':' + (await promisify(crypto.scrypt)(crypto.randomBytes(32), salt, 64)).toString('hex');
  const employees = [
    ['onizleme', 'Deniz Yılmaz', 'Bilgi İşlem', 'admin'],
    ['elif.demir', 'Elif Demir', 'İnsan Kaynakları', 'member'],
    ['mert.kaya', 'Mert Kaya', 'İdari İşler', 'member'],
    ['zeynep.arslan', 'Zeynep Arslan', 'Proje Koordinasyon', 'member'],
    ['can.aksoy', 'Can Aksoy', 'Mali İşler', 'member'],
    ['selin.aydin', 'Selin Aydın', 'Bilgi İşlem', 'member']
  ];
  for (const [username, name, department, role] of employees) app.db.prepare('INSERT INTO users(username,name,department,role,password) VALUES(?,?,?,?,?)').run(username, name, department, role, password);
  const chats = [
    ['group', 'Genel sohbet', 'Kurum içi haberler ve ortak paylaşımlar', [1,2,3,4,5,6]],
    ['group', 'Proje ekibi', 'Planlar, fikirler ve birlikte ürettiklerimiz', [1,3,4,6]],
    ['group', 'Bilgi İşlem', 'Günlük koordinasyon ve teknik destek', [1,6]],
    ['direct', '', '', [1,2]],
    ['direct', '', '', [1,3]],
    ['direct', '', '', [1,4]]
  ];
  for (const [kind, title, topic, members] of chats) {
    const id = Number(app.db.prepare('INSERT INTO conversations(kind,title,topic,creator_id,direct_key) VALUES(?,?,?,?,?)').run(kind,title,topic,1,kind==='direct'?members.join(':'):null).lastInsertRowid);
    for (const user of members) app.db.prepare('INSERT INTO members(conversation_id,user_id) VALUES(?,?)').run(id,user);
  }
  let sequence = 0;
  function message(chat, sender, body, minutesAgo) {
    const created = new Date(Date.now() - minutesAgo * 60000).toISOString();
    app.db.prepare('INSERT INTO messages(conversation_id,sender_id,body,client_id,created_at) VALUES(?,?,?,?,?)').run(chat,sender,body,'preview-message-' + (++sequence),created);
  }
  message(1,2,'Günaydın ekip! Bugünkü oryantasyon programını saat 10.30’da toplantı salonunda başlatıyoruz.',65);
  message(1,3,'Salon hazırlıkları tamamlandı. Projeksiyon ve ses sistemini de kontrol ettik.',61);
  message(1,1,'Teşekkürler Mert. Teknik destek için buradayız.',60);
  message(3,6,'Yazıcıların haftalık bakımını tamamladım. Destek taleplerini bu gruptan takip edebiliriz.',44);
  message(5,3,'Deniz merhaba, toplantı salonunun bağlantısını birlikte kontrol edebilir miyiz?',36);
  message(5,1,'Tabii, 15 dakika sonra uğrarım.',35);
  message(4,2,'Merhaba Deniz, yeni başlayan arkadaşlarımızın hesaplarını bugün açabilir miyiz?',28);
  message(4,1,'Merhaba Elif, isim ve birim bilgilerini ilettiğinde hesaplarını hazırlayabilirim.',26);
  message(4,2,'Harika, bilgileri birazdan paylaşacağım. Teşekkür ederim!',23);
  message(6,4,'Proje toplantısının gündemini ekip grubuna bıraktım. Uygun olduğunda göz atabilir misin?',17);
  message(2,4,'Herkese merhaba! Yeni dönem planlaması için kısa bir değerlendirme yapalım mı?',14);
  message(2,3,'Merhaba, ben hazırım. İdari işler tarafındaki ihtiyaç listesini toparladım.',12);
  message(2,1,'Günaydın ekip. Teknik altyapı hazırlıklarımız tamamlandı. Bugün birlikte üzerinden geçebiliriz.',10);
  message(2,6,'Test ortamı da hazır. Toplantıda kısa bir demo gösterebilirim.',8);
  message(2,4,'Çok iyi! Saat 14.00’te buluşalım. Herkes kendi başlıklarını buradan paylaşabilir.',4);
  message(2,3,'Benim için uygun. Görüşmek üzere.',2);
  app.db.prepare('UPDATE members SET last_read=(SELECT coalesce(max(id),0) FROM messages WHERE conversation_id=members.conversation_id) WHERE user_id=1').run();
  app.db.prepare('UPDATE members SET last_read=0 WHERE user_id=1 AND conversation_id IN (4,6)').run();
  const token = crypto.randomBytes(32).toString('hex');
  app.db.prepare('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,1,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),crypto.randomBytes(24).toString('hex'),Date.now()+24*60*60*1000);
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  const target = app.server.address().port;
  const proxy = http.createServer((req,res) => {
    const local = ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (!local) { res.writeHead(403); res.end(); return; }
    if (req.url === '/api/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ setupRequired:false,localSetup:true,name:'KurumNet',preview:true })); return;
    }
    const upstream = http.request({ hostname:'127.0.0.1',port:target,path:req.url,method:req.method,headers:{...req.headers,cookie:`kn_session=${token}`} },response => {
      res.writeHead(response.statusCode,response.headers); response.pipe(res);
    });
    upstream.on('error',() => { if(!res.headersSent) res.writeHead(502); res.end('Önizleme sunucusuna ulaşılamıyor.'); });
    res.on('close',() => upstream.destroy());
    req.pipe(upstream);
  });
  const port = options.port ?? Number(process.env.PREVIEW_PORT || 8096);
  await new Promise((resolve,reject) => { proxy.once('error',reject); proxy.listen(port,'127.0.0.1',resolve); });
  if (!options.quiet) {
    console.log(`KurumNet örnek önizleme: http://127.0.0.1:${proxy.address().port}/?preview=1#chat=2`);
    console.log('Yalnızca bu bilgisayarda. Örnek kişiler ve mesajlar bellekte tutulur; kapanınca silinir.');
  }
  let stopping = false;
  const close = async () => { if(stopping)return;stopping=true;proxy.close();proxy.closeAllConnections();await app.close(); };
  if (require.main === module) { process.on('SIGINT',close);process.on('SIGTERM',close); }
  return { proxy, app, close };
}
if(require.main===module) startPreview().catch(e=>{console.error('Önizleme başlatılamadı:',e.message);process.exitCode=1;});
module.exports={startPreview};
