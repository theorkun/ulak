# ULAK — Müdürlükler için kurum iletişim alanı

ULAK, kurumun yerel ağında kullanılan, **yalnızca grup paylaşımlarından oluşan** bir iletişim portalıdır. Kullanıcılar kullanıcı adı ve parolayla giriş yapar. Her personel kendi müdürlük odasına ve tüm kurum personelinin ortak **Genel Alan** odasına erişir.

Kaynak depo: https://github.com/theorkun/ulak

## Sarıçam Belediyesi müdürlük dizini

Sol menüde belediyenin [resmî müdürlükler sayfasından](https://www.saricam.bel.tr/mudurlukler) 24 Kasım 2026 tarihinde kontrol edilen **29 müdürlük** yer alır. Kayıtlar `department-catalog.cjs` içinde kaynak adresi ve kontrol tarihiyle saklanır; uygulamanın çalışması için belediye sitesine veya internete bağlantı gerekmez. Sayfada kısaltılmış “Destek Hiz.” adı açık yazımıyla kullanılmıştır.

Menüde Genel Alan, kullanıcının kendi müdürlüğü ve diğer müdürlükler ayrı bölümlerde gösterilir. Diğer müdürlüklerin yalnızca adları listelenir; kilit simgeli satıra tıklamak erişim açıklamasını gösterir. Paylaşımları veya personel bilgileri açılmaz. Müdürlük araması bütün dizini filtreler. Yetkiler değişmez: personel yalnızca kendi odasına ve Genel Alan'a erişebilir.

Resmî kayıtlar ilk kurulumda otomatik hazırlanır; yeni personel açarken yönetici listeden müdürlüğü seçebilir. Önceki “İnsan Kaynakları Müdürlüğü” gibi bilinen kısa adlar, resmî ad henüz ayrı bir kayıt olarak yoksa oda geçmişi ve personel atamaları korunarak resmî ada güncellenir. Kurumun ayrıca tanımladığı özel birimler silinmez.

## İletişim modeli

- **Genel Alan:** Tüm müdürlüklerin aktif personeli otomatik katılır; herkes paylaşım yapabilir.
- **Müdürlük odası:** Her müdürlüğün tek odası vardır. Yalnızca o müdürlüğe atanmış aktif personel okuyabilir, arayabilir ve paylaşım yapabilir.
- **Yönetim:** Yönetici müdürlük tanımlar, personel hesabı açar, müdürlük atamasını değiştirir, hesabı pasife alır veya geçici parolayı yeniler.
- Birebir mesajlaşma ve kullanıcıların serbest grup oluşturması sunucu API'sinde de kapalıdır.
- Yönetici rolü diğer müdürlüklerin içeriklerine otomatik erişim vermez. Yönetici, müdürlük atamalarını düzenleyebilir; oda erişimi hesabın mevcut müdürlüğüne göre belirlenir.

Kişisel konuşma balonları yerine ortak paylaşım kartları, kurum alanları menüsü ve alan/katılımcı bilgileri bulunan bir portal düzeni kullanılır. Paylaşımlar en yeniden eskiye sıralanır. Enter yeni satır ekler; **Ctrl + Enter** paylaşımı gönderir.

## Örneklerle tarayıcı önizlemesi

Node.js 24 veya üzeriyle `ONIZLEME.cmd` ya da `node preview.cjs` çalıştırın. Adres: **http://127.0.0.1:8096/**

Önce giriş ekranı gelir. Ekrandaki örnek hesap listesinden farklı müdürlükler seçilebilir. Örnek parola **`UlakDemo2026!`** olup yalnızca bu geçici örnek ortam için geçerlidir.

| Kullanıcı | Müdürlük | Yetki |
| --- | --- | --- |
| `demo.yonetici` | Bilgi İşlem Müdürlüğü | Yönetici |
| `demo.insan` | İnsan Kaynakları Müdürlüğü | Personel |
| `demo.destek` | Destek Hizmetleri Müdürlüğü | Personel |
| `demo.mali` | Mali Hizmetler Müdürlüğü | Personel |

Her hesap Genel Alan ve kendi müdürlük odasını kullanabilir. Diğer müdürlüklerin adları sol menüde kilitli olarak listelenir. Örnek ortam yalnızca `127.0.0.1` adresinde çalışır; örnek hesaplar/paylaşımlar bellekte tutulur ve kapanınca silinir. Gerçek kullanıcı veritabanını kullanmaz. Bu örnek hesaplar gerçek sunucu kurulumunda oluşturulmaz.

## Gerçek kurum kurulumu

1. Sunucu bilgisayarında **Node.js 24 veya üzeri** bulunmalı. Ek npm paketi veya internet bağlantısı gerekmez. Başlatma dosyaları bu bilgisayardaki Codex Node çalışma ortamını da bulabilir; başka bilgisayara taşırken Node.js kurun.
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
