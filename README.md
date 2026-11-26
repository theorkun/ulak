# Turkuaz Kurumsal İletişim — Müdürlükler için kurum iletişim alanı

Turkuaz Kurumsal İletişim, kurumun yerel ağında kullanılan, **yalnızca grup paylaşımlarından oluşan** bir iletişim portalıdır. Kullanıcılar kullanıcı adı ve parolayla giriş yapar. Her personel kendi müdürlük odasına ve tüm kurum personelinin ortak **Genel Sohbet** odasına erişir.

Kaynak depo: https://github.com/theorkun/ulak

Şablon [Sarıçam Belediyesi Kurumsal Kimlik Kılavuzu](https://kobigo.com.tr/saricam/upload/files/kurumsal-kimlik-kilavuzu/kurumsal-kimlik-kilavuzu_8375.pdf) esas alınarak uyarlanmıştır. Ana renkler kılavuzun 14. sayfasındaki RGB değerleridir: turkuaz `#00B2A9`, kırmızı `#C8102E`, antrasit `#4D4D4D`. Tema `public/brand-guide.css` üzerinden uygulanır. Sonraki kullanıcı talebiyle web tipografisi [referans belediye sitesine](https://kobigo.com.tr/saricam/) uyarlanmıştır: metin ve formlar **Poppins**, başlık ve menü vurguları **Quicksand** kullanır. Türkçe karakterleri kapsayan yerel WOFF2 dosyaları ve SIL OFL lisansları `public/fonts/` içindedir; istemci dış font sunucularına bağlanmaz. Uygulama haritası ve kaynak sayfalar [BRAND-GUIDE.md](BRAND-GUIDE.md) içindedir. Giriş ekranındaki resmî belediye logosu aynı PNG dosyası ve oranlarıyla, beyaz boşluk alanı içinde korunur.

## GitHub üzerinden tarayıcı demosu

Girişteki dekoratif geçme şeridi, kılavuzun 14. sayfasındaki özgün desenden alınmış `public/saricam-kurumsal-desen.png` dosyasıdır. Tema, 34–35. sayfalardaki dijital sunum örneklerine uygun turkuaz çerçeve ve açık içerik zemini kullanır. Desen etkileşimi engellemez ve ambleme uygulanmaz. Bütün görseller yerel paketlenir; internet bağlantısı gerekmez.

**[Demoyu aç](https://theorkun.github.io/ulak/)** · Önizleme süper admini: `orkun` · Parola: `admin`

Bu yayın, aynı arayüzün yalnızca tarayıcı belleğinde çalışan örnek sürümüdür. Örnek hesaplarla giriş, Genel Sohbet, müdürlük odaları, mesaj gönderme/düzenleme/silme/yanıtlama, arama ve personel yönetimi denenebilir. Veriler diğer ziyaretçilere gönderilmez, sayfa yenilenince sıfırlanır. Gerçek parolalar veya kurum bilgileri girmeyin. Gerçek çok kullanıcılı mesajlaşma için aşağıdaki yerel sunucu kurulumu gerekir.

`node scripts/build-pages.cjs` komutu yalnızca arayüzü ve örnek verileri `docs/` klasörüne hazırlar. Tasarım değiştiğinde komutu tekrar çalıştırıp `docs/` dosyalarını da gönderin. GitHub Pages kaynağı **main /docs** olarak ayarlanır. Sunucu, veritabanı ve ortam dosyaları bu klasöre kopyalanmaz. Demo kodu kurum sunucusunun giriş sayfasına eklenmez.

## Sarıçam Belediyesi müdürlük dizini

Sol menüde belediyenin [resmî müdürlükler sayfasından](https://www.saricam.bel.tr/mudurlukler) 24 Kasım 2026 tarihinde kontrol edilen **29 müdürlük** yer alır. Kayıtlar `department-catalog.cjs` içinde kaynak adresi ve kontrol tarihiyle saklanır; uygulamanın çalışması için belediye sitesine veya internete bağlantı gerekmez. Sayfada kısaltılmış “Destek Hiz.” adı açık yazımıyla kullanılmıştır.

Menüde Genel Sohbet ve kullanıcının kendi müdürlüğü doğrudan gösterilir. Diğer müdürlükler açılır bir listede toplanır; arama sırasında liste otomatik açılır. Kilit simgeli satıra tıklamak erişim açıklamasını gösterir. Paylaşımları veya personel bilgileri açılmaz. Müdürlük araması bütün dizini filtreler. Yetkiler değişmez: personel yalnızca kendi odasına ve Genel Sohbet'e erişebilir.

Resmî kayıtlar ilk kurulumda otomatik hazırlanır; yeni personel açarken yönetici listeden müdürlüğü seçebilir. Önceki “İnsan Kaynakları Müdürlüğü” gibi bilinen kısa adlar, resmî ad henüz ayrı bir kayıt olarak yoksa oda geçmişi ve personel atamaları korunarak resmî ada güncellenir. Kurumun ayrıca tanımladığı özel birimler silinmez.

## İletişim modeli

**Süper admin:** Önizlemede `orkun` hesabına atanmıştır. Yönetimde kullanıcıların personel/yönetici/süper admin rollerini değiştirebilir ve yönetici hesaplarını düzenleyebilir. Normal yöneticiler personel hesaplarını yönetir; yönetici hesabı oluşturamaz, başka yöneticileri düzenleyemez veya yetki veremez. Yetki değişiklikleri ilgili hesabın oturumlarını ve bekleyen parola yenileme kodlarını iptal eder ve işlem kaydına yazılır. Kendi üst yetkisini kaldırma ve son aktif süper admini kapatma engellenir. Süper adminin grup içeriklerine erişimi de hesabının müdürlük atamasına göre belirlenir.

Yeni gerçek kurulumun ilk yönetici hesabı süper admin olur; kullanıcı adına bakılarak otomatik yetki verilmez. Eski veritabanlarındaki hesaplar korunur ve `is_super_admin` alanı eklenirken mevcut yöneticiler otomatik yükseltilmez. Eski bir kurulumda üst yetki aktarımı gerekiyorsa kurum BT birimi yedek alıp yetkili hesabı ayrıca belirlemelidir.

- **Genel Sohbet:** Tüm müdürlüklerin aktif personeli otomatik katılır; herkes paylaşım yapabilir.
- **Müdürlük odası:** Her müdürlüğün tek odası vardır. Yalnızca o müdürlüğe atanmış aktif personel okuyabilir, arayabilir ve paylaşım yapabilir.
- **Yönetim:** Yönetici müdürlük tanımlar, personel hesabı açar, müdürlük atamasını değiştirir, hesabı pasife alır veya geçici parolayı yeniler.
- Birebir mesajlaşma ve kullanıcıların serbest grup oluşturması sunucu API'sinde de kapalıdır.
- Yönetici rolü diğer müdürlüklerin içeriklerine otomatik erişim vermez. Yönetici, müdürlük atamalarını düzenleyebilir; oda erişimi hesabın mevcut müdürlüğüne göre belirlenir.

Giriş ekranı, turkuaz belediye kimliği alanı ve açık renkli form panelinden oluşur. Mobilde kimlik alanı kısalır ve form tek sütunda gösterilir. Parola alanında erişilebilir göster/gizle kontrolü vardır; form sıfırlandığında parola tekrar gizlenir. Sohbette kendi mesajlarınız sağda turkuaz, diğer personelin mesajları solda açık renkli baloncuklarda gösterilir. Mesajlar eskiden yeniye sıralanır, tarih ve okunmamış mesaj ayraçları vardır. Yazma alanı altta, grup başlığı üstte sabittir; yalnızca mesaj geçmişi kayar. Sol menü son mesajı, saatini ve okunmamış sayısını gösterir.

Yeni mesaj geldiğinde en alttaysanız akış ilerler; eski mesajları okuyorsanız konumunuz korunur ve son mesajlara geçiş düğmesi gösterilir. Eski mesaj yükleme düğmesi geçmişin başındadır. Arama ve alıntı bağlantıları ilgili mesaja gider. Katılımcılar alan başlığındaki düğmeden açılır. Birebir mesajlaşma kapalıdır; grup erişim yetkileri aynıdır. Okunmamış sayıları gerçek okuma kayıtlarından gelir; kendi mesajlarınızı sola sürükleyerek kişi bazlı iletildi/görüldü bilgisi açılır.

Masaüstünde **Enter** mesajı gönderir; **Shift + Enter** yeni satır ekler. Dokunmatik klavyede Enter yeni satır ekler; Gönder düğmesi kullanılır. **Ctrl / Command + Enter** da gönderir. Yönetimde personel ve müdürlük ekleme formları açılır bölümlerdedir; mevcut personel ad, kullanıcı adı veya müdürlüğe göre filtrelenebilir.

## Örneklerle tarayıcı önizlemesi

Node.js 24 veya üzeriyle `ONIZLEME.cmd` ya da `node preview.cjs` çalıştırın. Adres: **http://127.0.0.1:8096/**

Önce boş giriş formu gelir; örnek hesap seçicisi ve otomatik parola doldurma kaldırılmıştır. Önizleme yönetici hesabı **`orkun` / `admin`** olarak ayarlanmıştır. Diğer örnek personel hesaplarının parolası **`UlakDemo2026!`** olarak kalır. Bu bilgiler yalnızca geçici örnek ortam içindir; gerçek kurum kurulumunda bu hesaplar oluşturulmaz.

| Kullanıcı | Müdürlük | Yetki |
| --- | --- | --- |
| `orkun` | Bilgi İşlem Müdürlüğü | Süper admin |
| `demo.insan` | İnsan Kaynakları Müdürlüğü | Personel |
| `demo.destek` | Destek Hizmetleri Müdürlüğü | Personel |
| `demo.mali` | Mali Hizmetler Müdürlüğü | Personel |

Her hesap Genel Sohbet ve kendi müdürlük odasını kullanabilir. Diğer müdürlüklerin adları sol menüde kilitli olarak listelenir. Örnek ortam yalnızca `127.0.0.1` adresinde çalışır; örnek hesaplar/paylaşımlar bellekte tutulur ve kapanınca silinir. Gerçek kullanıcı veritabanını kullanmaz. Bu örnek hesaplar gerçek sunucu kurulumunda oluşturulmaz.

## Gerçek kurum kurulumu

### Şifremi unuttum ve iletişim kayıtları

Giriş ekranındaki **Şifremi unuttum** bağlantısı yalnızca e-posta ile yenileme sunar. SMS kaldırılmıştır ve sunucu SMS talebini reddeder. Kullanıcı yalnızca kullanıcı adını girer; kod, yöneticinin kurum kayıtlarından doğrulayarak kaydettiği e-posta adresine gönderilir. Yönetimde yeni personel formu veya mevcut personelin **İletişim** düğmesi kullanılır. E-posta grup üyelerine gösterilmez. Önceki telefon kayıtları silinmez ancak parola yenilemede kullanılmaz.

**Webmail:** https://webmail.saricam.bel.tr. Bu, kullanıcı tarafından verilen webmail giriş adresidir; SMTP sunucusu/portu henüz doğrulanmamıştır. Gerçek kurum sunucusu henüz kurulmadığından ve SMTP hesabı bağlanmadığından gönderim başlangıçta pasiftir. GitHub Pages yalnızca arayüz önizlemesidir; gerçek e-posta göndermez veya kurum hesabı kurtarmaz.

SMTP bağlantısı hazırdır. Kurum sunucusunda:

1. `pnpm install --frozen-lockfile` ile sabitlenmiş Nodemailer bağımlılığını kurun. Normal Node.js kurulumunda alternatif olarak `npm install` kullanılabilir.
2. `smtp.env.example` dosyasını `smtp.env` adıyla kopyalayın. Bu dosya Git tarafından yok sayılır; Pages paketine kopyalanmaz.
3. BT biriminin verdiği `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` ve `SMTP_FROM` değerlerini girin. Webmail adresini otomatik olarak SMTP adresi saymayın. Özel karakterli parolaları çift tırnak içinde yazın.
4. `SMTP_ENABLED=1` yapın. `node scripts/check-mail.cjs` ile bağlantı ve hesap doğrulamasını kontrol edin; bu komut e-posta göndermez.
5. Sunucuyu başlatın/yeniden başlatın. `server.cjs`, `smtp.env` dosyasını başlangıçta yükler. Kullanıcıların kayıtlı e-posta adreslerini yönetimden doğrulayın. Hizmet doğrulamasından sonra kontrollü bir gerçek hesapla yenileme testi yapın.

Port 587 ve diğer STARTTLS portlarında TLS yükseltmesi zorunludur; 465 doğrudan TLS kullanır. Sertifika kontrolü kapatılmaz. SMTP parolası ve doğrulama kodu istemci koduna veya uygulama günlüklerine yazılmaz. `smtp.env` dosyasını yalnızca sunucudaki yetkili hesaba okunabilir tutun. Uygulama erişimi için kurum HTTPS ayarları ayrıca yapılandırılmalıdır. SMTP ayarlarının varlığı tek başına teslimat başarısı garantisi değildir; taşıyıcı hataları kurtarma kaydını iptal eder.

Sunucu, isteğe bağlı HTTPS teslim ağ geçidi sözleşmesini destekler:

- `RESET_DELIVERY_URL`: kurumun doğruladığı HTTPS ağ geçidi adresi.
- `RESET_DELIVERY_TOKEN`: yalnızca sunucu ortamında tutulan erişim anahtarı; GitHub'a veya `docs/` içine konmaz.
- `RESET_CHANNELS`: `email`.
- İstek: `POST`, `Authorization: Bearer …`; JSON: `{ "purpose":"ulak-password-reset", "channel":"email", "to":"kayıtlı e-posta", "code":"6 haneli kod", "expiresAt":"ISO tarih" }`. Ağ geçidi kabul ettiğinde 2xx döndürmelidir; yönlendirmeler izlenmez, 8 saniye zaman aşımı vardır. SMTP etkinleştirildiğinde öncelikli kullanılır.
- Servis sağlayıcı sözleşmesi farklıysa `createChat({recoveryDelivery, recoveryChannels})` ile sunucu adaptörü eklenebilir. Sağlayıcıya erişmek için kurum sunucusunda gerekli dış bağlantı izni bulunmalıdır.

Kod 10 dakika geçerli ve tek kullanımlıktır; veritabanında kodun özeti tutulur. Beş başarısız denemede işlem kapanır. IP/kullanıcı bazında talep sınırları uygulanır. Bilinmeyen kullanıcılar da aynı genel yanıtı alır. Başarılı yenileme bütün oturumları kapatır; yeni kod, iletişim bilgisi değişikliği, hesap kapatma ve başka parola değişiklikleri eski kodları iptal eder. Kod veya hizmet anahtarı istemci yanıtına/işlem kaydına yazılmaz. Gönderim hatası içerik taşımayan `recovery_delivery_failed` işlem kaydı oluşturur. Servis aktif olduğunda HTTPS ve güvenli çerez ayarları kullanılmalıdır.

### Bilgilendirme metinleri

KVKK aydınlatma, kullanım koşulları ve çerez metinleri giriş yapmadan açılır. Aydınlatma ve kullanım metinleri **kurum incelemesi için taslaktır**. Veri işleme şartları, hizmet sağlayıcılar ve aktarım durumu, saklama/imha süreleri ve resmî başvuru kanalı belediye tarafından kesinleştirilmelidir. Kaynak: [KVKK aydınlatma yükümlülüğü](https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-). Aydınlatma açık rıza olarak gösterilmez; girişte zorunlu rıza kutusu bulunmaz. Bu uygulama mesaj, personel, işlem ve yedek kayıtları için henüz otomatik süreli imha yapmaz.

### Kurulum adımları

1. Sunucu bilgisayarında **Node.js 24 veya üzeri** bulunmalı. SMTP kullanılacaksa yukarıdaki bağımlılık kurulumunu yapın; SMTP kapalıyken temel yerel mesajlaşma ek paket gerektirmez. Başlatma dosyaları bu bilgisayardaki Codex Node çalışma ortamını da bulabilir; başka bilgisayara taşırken Node.js kurun.
2. `BASLAT-YEREL.cmd` çalıştırın veya `node server.cjs` kullanın.
3. Konsoldaki ilk kurulum bağlantısını **aynı bilgisayarda** açın. Yönetici adını, müdürlüğünü, kullanıcı adını ve en az 10 karakterli kendi parolasını belirleyin.
4. Yönetim merkezinde müdürlükleri tanımlayın. Personel hesabı açarken ilgili müdürlüğü seçin. Yeni hesap Genel Sohbet ve kendi müdürlük odasına otomatik katılır.
5. Geçici parolayı personele kurumun güvenli kanalıyla iletin. İlk girişte parola değişimi zorunludur.
6. Sunucuyu Ctrl+C ile durdurun. Yerel ağ kullanımı için `BASLAT-AG.cmd` çalıştırın. Diğer kurum bilgisayarlarından konsolda yazan `http://SUNUCU-IP:8095` adresini açın.

Sunucu bilgisayarı açık kalmalıdır. Güvenlik duvarı otomatik değiştirilmez. Kurum BT birimi erişimi yalnızca özel kurum ağına açmalı; internete port yönlendirmesi yapılmamalıdır. GitHub kaynak kodunu saklar; uygulama Node.js sunucusu gerektirdiğinden GitHub Pages üzerinde tek başına çalışmaz.

## Eski sürümden geçiş

Önce `node backup.cjs` ile yedek alın. Aynı `data/kurumnet.db` dosyası yeni sürümde kullanılmaya devam eder. İlk açılışta mevcut personelin birim bilgilerine göre müdürlük kayıtları ve odaları oluşturulur. Eski Genel sohbet odası Genel Sohbet'e dönüştürülür ve geçmişi korunur.

Önceki birebir sohbetler ve serbest gruplar veritabanından silinmez; `legacy` olarak saklanır. Yeni arayüzde, mesaj API'lerinde ve aramada erişilemez. Müdürlük değişiminde eski müdürlük odasının erişimi kaldırılır, yeni müdürlüğe erişim verilir. Eski birimdeki paylaşımlar başka bir odaya taşınmaz. Değişiklikler yönetim kayıtlarına işlenir.

## Özellikler

- Parolalı oturum ve ilk girişte zorunlu geçici parola değişimi
- Kurum genelinde ve müdürlük içinde canlı grup paylaşımları
- Yanıtlama, kendi paylaşımını düzenleme ve kaldırma
- Okunmamış paylaşım sayacı, katılımcılar ve çevrimiçi bilgisi
- Yalnızca erişilen odalarda Türkçe metin araması ve eski paylaşımları yükleme
- Müdürlük tanımlama ve personel atama ekranı
- Hesap etkinleştirme/pasifleştirme, geçici parola yenileme ve yönetim işlem kayıtları
- Mobil ekranlara uyarlanan portal ve giriş sayfası

## Grup iletişimi geliştirmeleri

- **Profil fotoğrafı:** Üstteki profil düğmesinden JPG/PNG seçilir. En fazla 5 MB kaynak görsel, tarayıcıda merkezden kare kırpılıp 256×256 JPEG olarak küçültülür; sunucu en fazla 150 KB kabul eder. Fotoğraf kaldırılabilir. Gerçek sunucuda oturum açmış aktif personele sunulur; belediye logosu değiştirilmez.
- **Mesaj seçenekleri:** Basılı tutma, masaüstünde sağ tık veya klavyede Shift+F10 ile açılır. Metin mesajlarında yanıt, kopyalama ve kendi mesajını düzenleme bulunur. Kendi mesajınızda “Sil / Geri al” penceresi, bütün mesajlarda “Benden gizle” seçeneği vardır. Herkesten silme için zaman sınırı yoktur; yalnızca gönderen kendi mesajını geri alabilir. Eski sürümde yalnızca gizlenmiş içeriklere geriye dönük toplu silme uygulanmaz.
- **Dosya paylaşımı:** Mesaj başına bir dosya; PDF, TXT, DOCX, XLSX, JPG, PNG, HEIC/HEIF ve ProRAW/DNG; en fazla 100 MB. Boş metinle dosya gönderilebilir. İndirme anında oturum ve müdürlük üyeliği doğrulanır. Dosyalar SQLite içinde tutulur ve standart yedeğe dahildir. İçerik imzası/tür kontrolü yapılır, otomatik indirme veya çalıştırma yapılmaz; antivirüs taraması eklenmiş değildir. Gönderen başına 1 GB, kurum genelinde 10 GB ek dosya sınırı ve dakikada 10 yükleme sınırı vardır.
- **Sabitleme:** Yöneticiler eriştikleri odalarda en fazla 3 mesajı, basılı tutma menüsünden sabitleyebilir.
- **Mesaj bilgisi:** Kendi gönderinizi sola sürükleyin veya menüden Mesaj bilgisi seçin. Alıcının uygulaması mesaj verisini teslim aldığını bildirdiğinde iletildi; sohbet görünürken okuma kaydı oluştuğunda görüldü işaretlenir. Sunucu zaman damgaları kullanılır. Çevrimiçi durum teslimat sayılmaz. Kayıt bulunmayan eski mesajlar için tahmin yapılmaz. Yeni mesajlarda gönderim anındaki aktif alıcılar kaydedilir; sonradan eklenen kişiler geçmiş alıcı listesine katılmaz. Bu bilgi yalnızca mesaj sahibine ve oda erişimi devam ettiği sürece açılır. Duyuru/Okudum isteği yeni arayüzden kaldırılmıştır; eski API/kayıtlarla uyumluluk korunur.
- **Etiketleme ve bildirimler:** “@Kişi” düğmesi katılımcının kullanıcı adını metne ekler; etiket vurgulanır. Bildirim ve ses tercihleri profilden açılır; her oda sessize alınabilir. Masaüstü bildirimi HTTPS/localhost, destekleyen tarayıcı ve kullanıcı izni gerektirir. Uygulama açık olmalıdır; bildirim içeriğinde mesaj metni gösterilmez. Özellik, kapalı uygulamaya push göndermez ve etiketler için ayrı bildirim kuralı içermez.
- **Arama:** Sohbet, gönderen, başlangıç/bitiş tarihi ve dosyalı mesaj filtresi vardır; 60'ar sonuçla devam edilebilir. Tarih filtresi sunucudaki UTC mesaj tarihini kullanır. Benden gizlenen ve geri alınan mesajlar sonuçlarda çıkmaz.
- **Taslak ve oturum:** Metin taslakları kullanıcı kimliğiyle ayrılarak yalnızca ilgili sekmenin sessionStorage alanına kaydedilir; yenilemede geri gelir ve çıkışta temizlenir. Ek dosyalar taslak olarak saklanmaz. Bildirim/sessize alma tercihleri localStorage'da tutulur. Profilden açık oturumlar görülebilir ve diğer oturumlar kapatılabilir. Sayfanın açık olması kişinin aktif olarak ekran başında olduğunu kanıtlamaz.
- **Toplu personel:** Yönetim → CSV ile toplu personel ekle. UTF-8 CSV şablonu, noktalı virgül/virgül ayırıcı, önizleme ve kullanıcı/müdürlük doğrulaması desteklenir. Her seferinde en fazla 50 hesap, yalnızca personel yetkisiyle ve zorunlu ilk parola değişimiyle açılır. Bir satır hatalıysa hiçbir hesap eklenmez. Oluşturma sonrasında geçici parolalar yalnızca yönetim penceresi açıkken indirilebilir; pencere kapanınca listeden temizlenir. İndirilen dosyayı yetkili personel korumalıdır.
- **Demo:** Aynı ekran akışları sentetik verilerle denenebilir. Hesaplar, mesajlar, fotoğraflar, ekler ve onaylar yenilemede sıfırlanır; tarayıcı tercihleri ve sekme taslakları yukarıdaki şekilde saklanır. Gerçek kurumsal verilerle denemeyin.

### Sohbet etkileşimleri ve arka plan

Fotoğraf/dosya mesajları yalnızca önizleme kartı gösterir; otomatik dosya adı, boyut, açıklama ve görüntüleme etiketi altta gösterilmez. Kayıtlar silinmeden dosya mesajının metni sohbet görünümünden gizlenir. Dosya adı erişilebilir düğme adında ve büyük görüntüleyicinin başlığında kalır. Dosya seçimi + simgesindedir. Dosya işlemleri ve metin işlemleri mesajın basılı tutma menüsündedir.

Sohbet başlığındaki ayarlar simgesinden Açık, Turkuaz, Gece, Geometrik tema veya özel arka plan fotoğrafı seçilir. Arka plan kişiye, sohbete ve bu tarayıcıya özeldir; diğer personelin görünümünü etkilemez. JPEG/PNG/HEIC/DNG kaynaklar en fazla 100 MB kabul edilir, uzun kenar 1600 piksele küçültülür ve yerel tercihlere JPEG olarak kaydedilir. Kayıt boyutu sınırı/yerel depolama hatasında açıklama gösterilir. Varsayılana dön düğmesi o sohbetin fotoğrafını tercihlerden kaldırır.

### Dosyayı indirmeden önizleme

**Telefon fotoğrafları için sınır 100 MB:** Apple, 48 MP ProRAW için yaklaşık 75 MB örneği verir ([resmî açıklama](https://support.apple.com/en-ie/119916)). Bu değer her çekimin boyutunu garanti etmez. HEIC/HEIF ve DNG dosyaları orijinal baytları değiştirilmeden saklanır. HEIC, yerel libheif-js 1.23.5 çözümleyicisiyle ayrı worker içinde görüntüleme için JPEG'e dönüştürülür. DNG'de varsa gömülü JPEG önizlemesi gösterilir; RAW geliştirme yapılmaz. Gömülü önizlemesi olmayan DNG için açıklama gösterilir. HEIC önizlemesi en fazla 64 megapiksel kaynak ve 2048 piksel uzun kenarla sınırlıdır; orijinal görüntü değiştirilmez. Profil fotoğrafının ayrı küçültme sınırları değişmemiştir. Video yükleme eklenmemiştir.

Yeni dosya seçimi Base64/JSON yerine ikili aktarım kullanır; yükleme yüzdesi gösterilir. `POST /api/conversations/:id/file-message` gövdesi: 4 bayt big-endian JSON metadata uzunluğu, en fazla 24 KB UTF-8 JSON (`body`, `clientId`, `replyTo`, `announcement`, `attachment:{name,type}`), ardından dosyanın ham baytlarıdır. Oturum/CSRF/kaynak ve müdürlük kontrolleri uygulanır; aktarım bitiminde yetki tekrar doğrulanır. İstek kimliği tekrarları tek mesaj oluşturur. Sunucu aynı anda en fazla 2 ikili dosya aktarımı, kullanıcı başına 1 aktarım kabul eder; istek zaman aşımı 120 saniyedir. Eski JSON/base64 API'si küçük dosyalar için 2,9 MB istek sınırıyla korunmuştur. Ortak sınırlar `public/upload-limits.js` içindedir. Reverse proxy kurulurken en az 110 MB istek gövdesi ve uygun aktarım zaman aşımı ayrıca ayarlanmalıdır.

Libheif-js orijinal dağıtımı değiştirilmeden yerel paketlenmiştir; LGPL ve bileşen lisansları `public/vendor/preview/Libheif-*.txt` içindedir. Tam kaynak/bina yönergeleri [upstream deposunda](https://github.com/catdad-experiments/libheif-js) ve özgün dağıtım adresi `preview-assets.json` içindedir. Worker dış ağa bağlanmaz.

Sohbet içindeki dosya kartı artık indirme bağlantısı yerine içerik önizlemesi gösterir. Karta tıklanınca uygulama içindeki büyük görüntüleyici açılır:

- JPG/PNG: sohbet içinde görsel, açıldığında büyük görünüm.
- PDF: sohbet içinde ilk sayfanın görüntüsü; büyük görünümde önceki/sonraki sayfa düğmeleri. Şifreli veya bozuk PDF için açıklama gösterilir.
- TXT: sohbet içinde metin özeti, büyük görünümde UTF-8 metin.
- DOCX: Word belgesinin metin içeriği; özgün sayfa düzeni, tabloların yerleşimi ve gömülü görseller birebir korunmaz.
- XLSX: sohbet içinde ilk sayfanın tablo özeti; büyük görünümde çalışma sayfası seçimi. İlk 10 çalışma sayfasının en fazla 200 satırı ve 30 sütunu, hücre başına 2.000 karakter gösterilir. Formül, makro ve harici bağlantı çalıştırılmaz; mevcut hücre değerleri kullanılır.

Görüntüleyiciler `public/vendor/preview/` içinde yereldir: PDF.js 6.5.438 (uyumluluk derlemesi, Apache-2.0), Mammoth 1.13.0 (BSD-2-Clause), SheetJS 0.20.3 (Apache-2.0). Lisanslar aynı klasördedir; özgün kaynak adresleri ve SHA-256 özetleri `preview-assets.json` içinde kayıtlıdır. Çalışma sırasında Google/Microsoft veya başka bir dış önizleme servisine dosya gönderilmez. Güncellemelerde dosya özetleriyle birlikte manifest de güncellenmelidir.

Office önizlemesi ayrı ve süre sınırı olan bir Web Worker içinde çalışır. Arşiv boyutları önceden sınırlandırılır; çıkarılan metin/cell değerleri HTML olarak çalıştırılmadan gösterilir. TXT/DOCX için ilk 200.000 karakter sınırı vardır. Dosya başına yükleme ve okuma sınırı 100 MB’dır. Önizlemeler salt okunurdur, belge düzenleme sunulmaz.

Kurum sunucusunda `GET /api/attachments/:id?view=1`, dosyayı doğru MIME türü ve `inline` başlığıyla verir; normal indirme API'si geriye uyumluluk için korunur. Her iki yolda da oturum, müdürlük ve gizleme/silme kontrolü uygulanır; önbelleğe alma kapalıdır. Görüntüleyici kapatıldığında PDF kaynakları bırakılır, sohbet değişiminde/çıkışta geçici görseller temizlenir. Mesaj geri alındığında veya hesaptan gizlendiğinde açık dosya görüntüleyicisi kapanır. Önceden görülen/kopyalanan içerik geri alınamaz.

## Veri ve güvenlik sınırları

- Parolalar scrypt ve rastgele tuzla özetlenir. Oturum çerezleri HttpOnly ve SameSite=Strict'tir. Değişiklik isteklerinde CSRF/kaynak kontrolü yapılır. Hesap kapatılınca veya parola değişince eski oturumlar geçersizleşir.
- Varsayılan yerel/pilot bağlantı **HTTP**'dir; ağ trafiği şifrelenmez. Gerçek ve hassas kurumsal yazışmalardan önce BT tarafından güvenilir **HTTPS** yapılandırılmalıdır. Doğrudan TLS veya HTTPS reverse proxy kullanılabilir. Proxy SSE yanıtlarını tamponlamamalıdır.
- Mesajlar SQLite veritabanında açık metindir. Sunucu dosyalarına erişebilen BT yöneticisi veritabanı içeriğine erişebilir. Uçtan uca şifreleme bulunmaz.
- **Herkesten sil / Geri al**, gönderenin kendi mesajının metnini boşaltır; ek dosyayı, teslim/görülme kayıtlarını ve eski okudum onaylarını canlı veritabanından kaldırır, sabitlemeyi iptal eder. Mesajın kimlik/zaman kaydı ve geri alındı işareti kalır. Daha önce okunmuş, indirilmiş veya kopyalanmış içerikler, SQLite WAL/disk kalıntıları ve eski yedekler bu işlemle geri alınmaz. **Benden gizle**, yalnızca ilgili hesabın mesaj listesini, son mesaj önizlemesini ve aramasını etkiler. Saklama takvimine bağlı otomatik imha henüz yoktur.
- Ses/görüntülü görüşme, AD/SSO, uygulama kapalıyken arka plan push bildirimi ve çok sunuculu ölçekleme bu sürümde yoktur.
- Hedef 50–200 personeldir. Yerel 200 canlı bağlantı testi, gerçek kurum ağı/donanımı üzerinde pilotun veya sızma testinin yerine geçmez.

## Ayarlar

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Kurum ağı için `0.0.0.0` |
| `PORT` | `8095` | Gerçek sunucu portu |
| `PREVIEW_PORT` | `8096` | Geçici örnek ortam portu |
| `ALLOWED_HOSTS` | localhost, sunucu adı ve ağ IP'leri | Virgülle ayrılmış ek intranet DNS adları |
| `TLS_KEY_FILE`, `TLS_CERT_FILE` | boş | Doğrudan HTTPS için PEM dosyaları |
| `PUBLIC_ORIGIN` | istek adresi | Reverse proxy dış kökeni, ör. `https://ulak.kurum.local` |
| `SECURE_COOKIE` | `0` | HTTPS reverse proxy için `1` |

## Yedek ve geri yükleme

`node backup.cjs`, çalışan veritabanından da tutarlı SQLite yedeği alır. Yedekler `data/backups/` içine yazılır; ayrı ve korumalı bir yerde saklanmalıdır. Personel, parola özetleri, oturumlar ve paylaşımlar içerdiğinden veritabanlarını veya yedekleri GitHub'a yüklemeyin.

Geri yüklerken sunucuyu durdurun. Mevcut `data` klasörünü ayrıca yedekleyin. Yeni boş veri klasörüne seçilen yedeği `kurumnet.db` adıyla yerleştirin; eski WAL/SHM dosyalarını yeni veritabanıyla karıştırmayın. Güvenli geri yükleme için eski oturumlar BT tarafından iptal edilmelidir.

## Testler

`node --test tests/*.test.cjs`

Testler geçici verilerle çalışır. Müdürlük erişimleri, Genel Sohbet üyeliği, birebir mesaj engeli, müdürlük değişimi, Türkçe arama, eski şema geçişi, parola işlemleri ve 200 ayrı canlı bağlantı kapsanır. Ekran akışları ayrıca DOM ortamında kontrol edilmiştir; bu kontrol piksel düzeyinde tarayıcı görüntülemesi değildir.
