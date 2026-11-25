# ULAK — Müdürlükler için kurum iletişim alanı

ULAK, kurumun yerel ağında kullanılan, **yalnızca grup paylaşımlarından oluşan** bir iletişim portalıdır. Kullanıcılar kullanıcı adı ve parolayla giriş yapar. Her personel kendi müdürlük odasına ve tüm kurum personelinin ortak **Genel Alan** odasına erişir.

Kaynak depo: https://github.com/theorkun/ulak

Arayüzde Selçuklu turkuazı (`#008C95`), koyu lacivert (`#132A45`) ve altın sarısı (`#C6A04B`) kullanılır. Turkuaz işlemlerde ve seçili alanlarda, lacivert başlık ve üst menüde, altın sarısı ince çizgi ve vurgularda yer alır. Okunabilirlik için turkuaz düğmelerde koyu ton (`#007F86`) kullanılır. Giriş ekranındaki Sarıçam Belediyesi logosu [belediyenin resmî sitesinden](https://www.saricam.bel.tr/files/ui/logo2.png) alınmış ve `public/saricam-belediyesi-logo.png` dosyasıyla paketlenmiştir; yerel ağda görünmesi için internet bağlantısı gerekmez. Logo özgün dosyası, renkleri ve oranlarıyla korunur.

## GitHub üzerinden tarayıcı demosu

Giriş arka planında Selçuklu geometrisinden esinlenen sekiz köşeli yıldız ve geçme çizgilerinden oluşan düşük yoğunluklu bir SVG deseni kullanılır. `public/selcuklu-motif.svg` yerel olarak paketlenir; internet bağlantısı gerektirmez. Desen dekoratiftir, formun arkasında kalır ve fare/klavye etkileşimini engellemez. Belediye logosuna uygulanmaz.

**[Demoyu aç](https://theorkun.github.io/ulak/)** · Önizleme süper admini: `orkun` · Parola: `admin`

Bu yayın, aynı arayüzün yalnızca tarayıcı belleğinde çalışan örnek sürümüdür. Örnek hesaplarla giriş, Genel Alan, müdürlük odaları, mesaj gönderme/düzenleme/silme/yanıtlama, arama ve personel yönetimi denenebilir. Veriler diğer ziyaretçilere gönderilmez, sayfa yenilenince sıfırlanır. Gerçek parolalar veya kurum bilgileri girmeyin. Gerçek çok kullanıcılı mesajlaşma için aşağıdaki yerel sunucu kurulumu gerekir.

`node scripts/build-pages.cjs` komutu yalnızca arayüzü ve örnek verileri `docs/` klasörüne hazırlar. Tasarım değiştiğinde komutu tekrar çalıştırıp `docs/` dosyalarını da gönderin. GitHub Pages kaynağı **main /docs** olarak ayarlanır. Sunucu, veritabanı ve ortam dosyaları bu klasöre kopyalanmaz. Demo kodu kurum sunucusunun giriş sayfasına eklenmez.

## Sarıçam Belediyesi müdürlük dizini

Sol menüde belediyenin [resmî müdürlükler sayfasından](https://www.saricam.bel.tr/mudurlukler) 24 Kasım 2026 tarihinde kontrol edilen **29 müdürlük** yer alır. Kayıtlar `department-catalog.cjs` içinde kaynak adresi ve kontrol tarihiyle saklanır; uygulamanın çalışması için belediye sitesine veya internete bağlantı gerekmez. Sayfada kısaltılmış “Destek Hiz.” adı açık yazımıyla kullanılmıştır.

Menüde Genel Alan ve kullanıcının kendi müdürlüğü doğrudan gösterilir. Diğer müdürlükler açılır bir listede toplanır; arama sırasında liste otomatik açılır. Kilit simgeli satıra tıklamak erişim açıklamasını gösterir. Paylaşımları veya personel bilgileri açılmaz. Müdürlük araması bütün dizini filtreler. Yetkiler değişmez: personel yalnızca kendi odasına ve Genel Alan'a erişebilir.

Resmî kayıtlar ilk kurulumda otomatik hazırlanır; yeni personel açarken yönetici listeden müdürlüğü seçebilir. Önceki “İnsan Kaynakları Müdürlüğü” gibi bilinen kısa adlar, resmî ad henüz ayrı bir kayıt olarak yoksa oda geçmişi ve personel atamaları korunarak resmî ada güncellenir. Kurumun ayrıca tanımladığı özel birimler silinmez.

## İletişim modeli

**Süper admin:** Önizlemede `orkun` hesabına atanmıştır. Yönetimde kullanıcıların personel/yönetici/süper admin rollerini değiştirebilir ve yönetici hesaplarını düzenleyebilir. Normal yöneticiler personel hesaplarını yönetir; yönetici hesabı oluşturamaz, başka yöneticileri düzenleyemez veya yetki veremez. Yetki değişiklikleri ilgili hesabın oturumlarını ve bekleyen parola yenileme kodlarını iptal eder ve işlem kaydına yazılır. Kendi üst yetkisini kaldırma ve son aktif süper admini kapatma engellenir. Süper adminin grup içeriklerine erişimi de hesabının müdürlük atamasına göre belirlenir.

Yeni gerçek kurulumun ilk yönetici hesabı süper admin olur; kullanıcı adına bakılarak otomatik yetki verilmez. Eski veritabanlarındaki hesaplar korunur ve `is_super_admin` alanı eklenirken mevcut yöneticiler otomatik yükseltilmez. Eski bir kurulumda üst yetki aktarımı gerekiyorsa kurum BT birimi yedek alıp yetkili hesabı ayrıca belirlemelidir.

- **Genel Alan:** Tüm müdürlüklerin aktif personeli otomatik katılır; herkes paylaşım yapabilir.
- **Müdürlük odası:** Her müdürlüğün tek odası vardır. Yalnızca o müdürlüğe atanmış aktif personel okuyabilir, arayabilir ve paylaşım yapabilir.
- **Yönetim:** Yönetici müdürlük tanımlar, personel hesabı açar, müdürlük atamasını değiştirir, hesabı pasife alır veya geçici parolayı yeniler.
- Birebir mesajlaşma ve kullanıcıların serbest grup oluşturması sunucu API'sinde de kapalıdır.
- Yönetici rolü diğer müdürlüklerin içeriklerine otomatik erişim vermez. Yönetici, müdürlük atamalarını düzenleyebilir; oda erişimi hesabın mevcut müdürlüğüne göre belirlenir.

Giriş ekranı, lacivert belediye kimliği alanı ve açık renkli form panelinden oluşur. Mobilde kimlik alanı kısalır ve form tek sütunda gösterilir. Parola alanında erişilebilir göster/gizle kontrolü vardır; form sıfırlandığında parola tekrar gizlenir. Uygulama içinde solda alanlar menüsü ve tek sütun mesaj akışı bulunur. Katılımcılar alan başlığındaki düğmeden açılır. Yönetimde personel ve müdürlük ekleme formları açılır bölümlerdedir; mevcut personel ad, kullanıcı adı veya müdürlüğe göre filtrelenebilir. Mesajlar en yeniden eskiye sıralanır. Enter yeni satır ekler; **Ctrl + Enter** mesajı gönderir.

## Örneklerle tarayıcı önizlemesi

Node.js 24 veya üzeriyle `ONIZLEME.cmd` ya da `node preview.cjs` çalıştırın. Adres: **http://127.0.0.1:8096/**

Önce boş giriş formu gelir; örnek hesap seçicisi ve otomatik parola doldurma kaldırılmıştır. Önizleme yönetici hesabı **`orkun` / `admin`** olarak ayarlanmıştır. Diğer örnek personel hesaplarının parolası **`UlakDemo2026!`** olarak kalır. Bu bilgiler yalnızca geçici örnek ortam içindir; gerçek kurum kurulumunda bu hesaplar oluşturulmaz.

| Kullanıcı | Müdürlük | Yetki |
| --- | --- | --- |
| `orkun` | Bilgi İşlem Müdürlüğü | Süper admin |
| `demo.insan` | İnsan Kaynakları Müdürlüğü | Personel |
| `demo.destek` | Destek Hizmetleri Müdürlüğü | Personel |
| `demo.mali` | Mali Hizmetler Müdürlüğü | Personel |

Her hesap Genel Alan ve kendi müdürlük odasını kullanabilir. Diğer müdürlüklerin adları sol menüde kilitli olarak listelenir. Örnek ortam yalnızca `127.0.0.1` adresinde çalışır; örnek hesaplar/paylaşımlar bellekte tutulur ve kapanınca silinir. Gerçek kullanıcı veritabanını kullanmaz. Bu örnek hesaplar gerçek sunucu kurulumunda oluşturulmaz.

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
4. Yönetim merkezinde müdürlükleri tanımlayın. Personel hesabı açarken ilgili müdürlüğü seçin. Yeni hesap Genel Alan ve kendi müdürlük odasına otomatik katılır.
5. Geçici parolayı personele kurumun güvenli kanalıyla iletin. İlk girişte parola değişimi zorunludur.
6. Sunucuyu Ctrl+C ile durdurun. Yerel ağ kullanımı için `BASLAT-AG.cmd` çalıştırın. Diğer kurum bilgisayarlarından konsolda yazan `http://SUNUCU-IP:8095` adresini açın.

Sunucu bilgisayarı açık kalmalıdır. Güvenlik duvarı otomatik değiştirilmez. Kurum BT birimi erişimi yalnızca özel kurum ağına açmalı; internete port yönlendirmesi yapılmamalıdır. GitHub kaynak kodunu saklar; uygulama Node.js sunucusu gerektirdiğinden GitHub Pages üzerinde tek başına çalışmaz.

## Eski sürümden geçiş

Önce `node backup.cjs` ile yedek alın. Aynı `data/kurumnet.db` dosyası yeni sürümde kullanılmaya devam eder. İlk açılışta mevcut personelin birim bilgilerine göre müdürlük kayıtları ve odaları oluşturulur. Eski Genel sohbet odası Genel Alan'a dönüştürülür ve geçmişi korunur.

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

## Veri ve güvenlik sınırları

- Parolalar scrypt ve rastgele tuzla özetlenir. Oturum çerezleri HttpOnly ve SameSite=Strict'tir. Değişiklik isteklerinde CSRF/kaynak kontrolü yapılır. Hesap kapatılınca veya parola değişince eski oturumlar geçersizleşir.
- Varsayılan yerel/pilot bağlantı **HTTP**'dir; ağ trafiği şifrelenmez. Gerçek ve hassas kurumsal yazışmalardan önce BT tarafından güvenilir **HTTPS** yapılandırılmalıdır. Doğrudan TLS veya HTTPS reverse proxy kullanılabilir. Proxy SSE yanıtlarını tamponlamamalıdır.
- Mesajlar SQLite veritabanında açık metindir. Sunucu dosyalarına erişebilen BT yöneticisi veritabanı içeriğine erişebilir. Uçtan uca şifreleme bulunmaz.
- “Kaldır” paylaşımı uygulamada gizler; orijinal metin veritabanında kalır. Kurumsal veri imha/arşiv politikası bu sürümde uygulanmış değildir.
- Dosya paylaşımı, ses/görüntülü görüşme, AD/SSO, arka plan push bildirimi ve çok sunuculu ölçekleme bu sürümde yoktur.
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

Testler geçici verilerle çalışır. Müdürlük erişimleri, Genel Alan üyeliği, birebir mesaj engeli, müdürlük değişimi, Türkçe arama, eski şema geçişi, parola işlemleri ve 200 ayrı canlı bağlantı kapsanır. Ekran akışları ayrıca DOM ortamında kontrol edilmiştir; bu kontrol piksel düzeyinde tarayıcı görüntülemesi değildir.
