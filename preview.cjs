// Disposable, loopback-only example environment. Uses the normal login flow.
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {createChat}=require('./server.cjs');
const {createRooms}=require('./rooms.cjs');
async function startPreview(options={}){
  const app=createChat({dbPath:':memory:',preview:true});
  const salt=crypto.randomBytes(16).toString('hex');
  const password=salt+':'+(await promisify(crypto.scrypt)('UlakDemo2026!',salt,64)).toString('hex');
  const people=[
    ['demo.yonetici','Deniz Yılmaz','Bilgi İşlem Müdürlüğü','admin'],
    ['demo.insan','Elif Demir','İnsan Kaynakları Müdürlüğü','member'],
    ['demo.destek','Mert Kaya','Destek Hizmetleri Müdürlüğü','member'],
    ['demo.mali','Zeynep Arslan','Mali Hizmetler Müdürlüğü','member'],
    ['demo.bilgi','Selin Aydın','Bilgi İşlem Müdürlüğü','member'],
    ['demo.personel','Esra Koç','İnsan Kaynakları Müdürlüğü','member'],
    ['demo.teknik','Can Aksoy','Destek Hizmetleri Müdürlüğü','member'],
    ['demo.butce','Ece Şahin','Mali Hizmetler Müdürlüğü','member']
  ];
  for(const [username,name,department,role]of people)app.db.prepare('INSERT INTO users(username,name,department,role,password) VALUES(?,?,?,?,?)').run(username,name,department,role,password);
  createRooms(app.db);
  const general=app.db.prepare("SELECT id FROM conversations WHERE scope='general'").get().id;
  const room=name=>app.db.prepare("SELECT c.id FROM conversations c JOIN departments d ON d.id=c.department_id WHERE c.scope='department' AND d.name=?").get(name).id;
  let sequence=0;
  const post=(id,sender,body,minutes)=>app.db.prepare('INSERT INTO messages(conversation_id,sender_id,body,client_id,created_at) VALUES(?,?,?,?,?)').run(id,sender,body,'preview-post-'+(++sequence),new Date(Date.now()-minutes*60000).toISOString());
  post(general,2,'Günaydın değerli çalışma arkadaşlarımız. Yeni dönem oryantasyon programı için müdürlüklerden gelecek personel listelerini cuma gününe kadar tamamlıyoruz. Katkılarınız için teşekkürler.',85);
  post(general,3,'Toplantı salonlarının haftalık kullanım planı güncellendi. Ortak alan taleplerinizi müdürlüğünüz üzerinden iletebilirsiniz.',65);
  post(general,1,'Kurum içi iletişim alanımıza hoş geldiniz. Genel Alan tüm müdürlüklerin ortak gündemi için; müdürlük odaları ise kendi ekiplerimizin koordinasyonu için hazır.',42);
  post(general,4,'Haftalık faaliyet özetlerini ortak takvime göre tamamlıyoruz. Müdürlükler arası ihtiyaç ve önerileri bu alanda paylaşabiliriz.',24);
  post(general,2,'Yarın saat 10.30’da yapılacak kurum içi bilgilendirme toplantısı için hazırlıklarımız tamamlandı. Tüm müdürlüklerin temsilcilerini bekliyoruz.',8);
  post(room('Bilgi İşlem Müdürlüğü'),5,'Sunucu bakım kontrollerini tamamladım. Destek taleplerini müdürlük alanımızda koordine edebiliriz.',30);
  post(room('Bilgi İşlem Müdürlüğü'),1,'Teşekkürler Selin. Bugünkü test sonuçlarını burada paylaşalım; sonrasında kurum genelindeki bilgilendirmeyi Genel Alan’dan yaparız.',12);
  post(room('İnsan Kaynakları Müdürlüğü'),6,'Yeni başlayan personelin oryantasyon dosyaları hazır. Birim içi kontrol listesini tamamlıyorum.',25);
  post(room('İnsan Kaynakları Müdürlüğü'),2,'Teşekkürler Esra. Personel listeleri son halini alınca birlikte gözden geçirelim.',11);
  post(room('Destek Hizmetleri Müdürlüğü'),7,'Toplantı salonu ve ortak alan hazırlıklarını bitirdik. Öğleden sonra son kontrolü yapacağım.',27);
  post(room('Mali Hizmetler Müdürlüğü'),4,'Müdürlük içi bütçe değerlendirmesinin gündemini bu alanda toparlayalım.',23);
  const port=options.port??Number(process.env.PREVIEW_PORT||8096);
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});
  if(!options.quiet){console.log(`ULAK önizleme: http://127.0.0.1:${app.server.address().port}/`);console.log('Örnek kullanıcı: demo.yonetici | Örnek parola: UlakDemo2026!');console.log('Giriş ekranından farklı müdürlük hesapları seçilebilir. Veriler kapanınca silinir.');}
  let stopping=false;const close=async()=>{if(stopping)return;stopping=true;await app.close();};
  if(require.main===module){process.on('SIGINT',close);process.on('SIGTERM',close);}
  return{app,server:app.server,close};
}
if(require.main===module)startPreview().catch(e=>{console.error('Önizleme başlatılamadı:',e.message);process.exitCode=1;});
module.exports={startPreview};
