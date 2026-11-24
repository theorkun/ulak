# KurumNet — Kurum içi mesajlaşma

50–200 çalışanlı bir kurumun yerel ağında pilot kullanım için hazırlanan, tek sunuculu web uygulaması. Tarayıcılar ortak Node.js sunucusuna bağlanır; veriler sunucu bilgisayarındaki SQLite veritabanında tutulur. Bulut hesabı, internet bağlantısı veya ek npm paketi gerekmez.

## İlk çalıştırma

1. Sunucu bilgisayarında **Node.js 24 veya üzeri** bulunmalı. Bu bilgisayardaki Codex Node çalışma ortamı da başlatma dosyaları tarafından bulunur; başka bilgisayara taşırken Node.js kurun.
2. Önce `BASLAT-YEREL.cmd` dosyasını çalıştırın. Alternatif: `node server.cjs`.
3. Konsolda çıkan **ilk kurulum bağlantısını** aynı bilgisayardaki tarayıcıda açın. Yönetici adını, kullanıcı adını ve en az 10 karakterli kendi parolanızı belirleyin. Kurulum kodu konsoldan forma da yazılabilir.
4. Uygulamadaki kalkan simgesinden çalışan hesaplarını açın. Oluşturulan geçici parolayı ilgili kişiye kurumun güvenli kanalıyla iletin. İlk girişte parola değişimi zorunludur.
5. Deneme bitince sunucuyu `Ctrl+C` ile durdurun. Yerel ağdan erişim için `BASLAT-AG.cmd` dosyasını çalıştırın. Konsolda yazan `http://SUNUCU-IP:8095` adresini kurum içindeki diğer bilgisayarlarda açın. İlk kurulum uzaktaki bir bilgisayardan yapılamaz.

Sunucu bilgisayarı açık kalmalıdır. Windows güvenlik duvarı veya ağ cihazında değişiklik otomatik yapılmaz. Kurum BT birimi, gerekirse 8095 TCP erişimini yalnızca kurumun özel ağına açmalı; modemden internete port yönlendirmesi yapılmamalıdır.

## Kullanım

### Örneklerle önizleme

`ONIZLEME.cmd` dosyası veya `node preview.cjs` komutu, örnek çalışan ve sohbetlerle `http://127.0.0.1:8096/?preview=1#chat=2` adresinde geçici bir önizleme açar. Bu ortamda örnek yöneticiye otomatik giriş yapılır. Önizleme sunucusu yalnızca loopback adresini dinler; kurum ağına veya internete açılmamalıdır. Örnek veriler bellekte tutulur ve kapanınca silinir; gerçek kullanıcı veritabanı kullanılmaz. Gerçek kullanım için `server.cjs` ve yukarıdaki normal kurulum adımları geçerlidir.

GitHub deposu kaynak kodunu saklar. Uygulamanın Node.js sunucusu gerektiği için GitHub Pages tek başına uygulamayı çalıştırmaz; normal kullanım kurum sunucusunda, örnek önizleme yerel bilgisayarda çalışır.

- Birebir mesajlaşma ve katılımcıları seçerek grup oluşturma
- Yeni çalışanların otomatik katıldığı **Genel sohbet**
- Canlı mesaj güncellemeleri, çevrimiçi bilgisi ve okunmamış mesaj sayacı
- Mesaj yanıtlama, kendi mesajını düzenleme veya sohbetten kaldırma
- Önceki mesajları sayfalayarak yükleme; yalnızca üyesi olunan sohbetlerde metin arama
- Çalışanları birime göre arama; telefona uyarlanan ekranlar
- Yönetici için hesap açma, geçici parola yenileme, hesabı pasife alma ve yönetim işlem kaydı

Yönetici rolü özel sohbetleri uygulama üzerinden topluca okuma yetkisi vermez. Yalnızca sohbet üyeleri mesaj API'lerine erişebilir. Sunucu dosyalarına veya veritabanına doğrudan erişen BT yöneticisi, veritabanındaki içeriğe erişebilir.

## Veri ve güvenlik sınırları

- Parolalar rastgele tuzla scrypt özeti olarak tutulur. Oturum çerezleri HttpOnly ve SameSite=Strict'tir; CSRF doğrulaması vardır. Geçici parolalar ilk girişte değiştirilir. Parola değişimi/sıfırlaması ve hesabın kapatılması eski oturumları iptal eder.
- Varsayılan yerel/pilot bağlantı **HTTP**'dir: uçtan uca şifreleme yoktur; HTTP ağ trafiği şifrelenmez. Gerçek kurumsal ve hassas yazışmalardan önce BT tarafından güvenilir **HTTPS** yapılandırılmalıdır. TLS anahtarı ve sertifikası `TLS_KEY_FILE` / `TLS_CERT_FILE` ile verilebilir. HTTPS reverse proxy kullanılırsa `PUBLIC_ORIGIN` dış adres ve `SECURE_COOKIE=1` olarak ayarlanmalıdır. Proxy SSE yanıtlarını tamponlamamalıdır.
- Mesajlar veritabanında açık metindir; disk erişimini ve yedekleri kurum politikalarına göre koruyun. “Sil” işlemi mesajı uygulamadan gizler; orijinal metin veritabanında kalır. Bir veri imha/kurumsal arşiv politikası uygulanmış değildir.
- Dosya gönderme, ses/görüntülü arama, Active Directory/SSO, arka plan push bildirimi ve çok sunuculu ölçekleme bu sürümde yoktur. Tarayıcı sekmesi açıkken canlı bağlantı vardır.
- 50–200 çalışan hedeflenmiştir. Entegrasyon/bağlantı testleri gerçek kurum ağına, sunucu donanımına ve bir sızma testine eşdeğer değildir; kurum içi yaygın kullanım öncesi pilot yapılmalıdır.

## Ayarlar

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Yerel ağ erişimi için `0.0.0.0` |
| `PORT` | `8095` | Sunucu portu |
| `ALLOWED_HOSTS` | localhost, sunucu adı ve ağ IP'leri | Virgülle ayrılmış ek intranet DNS adları |
| `TLS_KEY_FILE`, `TLS_CERT_FILE` | boş | Doğrudan HTTPS için PEM dosyaları |
| `PUBLIC_ORIGIN` | istek adresi | HTTPS proxy arkasındaki dış köken, ör. `https://sohbet.kurum.local` |
| `SECURE_COOKIE` | `0` | HTTPS reverse proxy için `1` |

## Yedekleme ve geri yükleme

`node backup.cjs` çalışırken de tutarlı SQLite yedeği oluşturur. Yedekler `data/backups/` içine yazılır; bunları sunucudan ayrı korumalı bir ortama kopyalayın. Yedekler kullanıcıları, parola özetlerini, oturumları ve mesajları içerir; herkese açık depoya yüklemeyin.

Geri yüklerken sunucuyu durdurun, mevcut `data` klasörünün tamamını ayrıca yedekleyin. Yeni, boş bir veri klasörüne seçilen yedeği `kurumnet.db` adıyla yerleştirin; eski WAL/SHM dosyalarını yeni veritabanıyla karıştırmayın. Sunucuyu başlatın. Hesaplar ve mesajlar geri gelir; güvenli geri yükleme için veritabanındaki eski oturumlar BT tarafından iptal edilmelidir.

## Doğrulama

`node --test tests/*.test.cjs`

Testler geçici veritabanı ve rastgele yerel port kullanır; gerçek kullanıcı verisine dokunmaz. Tarayıcı görsel doğrulamasının durumunu teslim notuyla birlikte değerlendirin.
