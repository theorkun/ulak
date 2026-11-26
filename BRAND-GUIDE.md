# Sarıçam kurumsal kimlik uygulaması

Kaynak: [Sarıçam Belediyesi Kurumsal Kimlik Kılavuzu](https://kobigo.com.tr/saricam/upload/files/kurumsal-kimlik-kilavuzu/kurumsal-kimlik-kilavuzu_8375.pdf). İnceleme: 26 Kasım 2026.

## Uygulanan kurallar

- **Sayfa 7–12:** Amblem, yazı ve motto birlikte, oranları korunarak gösterilir. Önceden kullanılan resmî PNG dosyasına müdahale edilmez; filtre, yeniden renklendirme veya yeniden dizilmiş logo yazısı kullanılmaz. Renkli karşılama panelinde beyaz boşluk alanı sağlanır. Web görünümünde amblem en az 96 px genişlikte gösterilir; kılavuzdaki baskı minimumu 2,5 × 3,2 cm'dir. Baskı ebatları web çıktısı için fiziksel ölçü garantisi değildir.
- **Sayfa 14–15:** Dijital renklerde kılavuzda yazan RGB değerleri esas alınır: turkuaz `0,178,169` (`#00B2A9`), kırmızı `200,16,46` (`#C8102E`), antrasit `77,77,77` (`#4D4D4D`). CMYK baskı önizlemesinden renk örneklenmez. Açık yüzeylerde metin/bağlantı okunabilirliği için koyu nötrler ve koyu turkuaz etkileşim tonu kullanılır; bunlar yeni kurumsal ana renkler olarak sunulmaz.
- **Sayfa 17–18:** Belediye logosunun özel Türkçeleştirilmiş Lucida yazısı resim içinde korunur. Sonraki kullanıcı talebiyle uygulamanın web tipografisi aşağıdaki belediye sitesi referansına göre Poppins/Quicksand olarak güncellenmiştir. Kılavuzdaki logo yazısı yeniden dizilmez ve PDF'den font çıkarılmaz.
- **Sayfa 34–35:** Turkuaz çerçeve, açık içerik zemini, düz bant ve köşeli geçme süslemesi dijital arayüze uyarlanır. Mevcut grup sohbeti ve erişim modeli korunur.

## Dosyalar

### Web tipografisi referansı

[Belediye sitesi](https://kobigo.com.tr/saricam/) gövdesinde `f-poppins` sınıfını, menülerinde ve çeşitli başlıklarında Quicksand ailesini kullanır. Kaynak: [main.css](https://kobigo.com.tr/saricam/public/site-v1/css/main.css). Bu uygulamada metin ve formlar Poppins, başlık/menü vurguları Quicksand'dır. Belediye amblemi aynıdır.

Fontlar resmî Google Fonts dağıtımından alınmıştır. Poppins 400/500/600/700 ve Quicksand 400–700 değişken ağırlıkları; Latin ve Türkçe harfleri içeren Latin Extended alt kümeleriyle `public/fonts/` içinde tutulur. İstemci dış font sunucularına bağlanmaz. [Poppins](https://github.com/google/fonts/blob/main/ofl/poppins/OFL.txt) ve [Quicksand](https://github.com/google/fonts/blob/main/ofl/quicksand/OFL.txt) SIL Open Font License metinleri de aynı klasördedir.

- `public/fonts.css`: yerel `@font-face` tanımları; `font-display: swap` kullanır.
- `font-assets.cjs`: sunucu ve Pages paketlemesinin ortak font dosyası izin listesi.

- `public/brand-guide.css`: kılavuz uyarlamasının tema katmanı; temel uygulama CSS'inden sonra yüklenir.
- `public/saricam-kurumsal-desen.png`: kılavuzun 14. sayfasındaki özgün üst geçme şeridinin PDF'den render edilmiş kırpımı. Kaynak logoya müdahale edilmez.
- `public/saricam-belediyesi-logo.png`: daha önce belediyenin resmî web sitesinden alınan logo; SHA-256 `2a3b643cf876a20b75491db7fb09301408c84ae5522c4c033a4161d080b4ecee` değişmez.

Bu çalışma kılavuzun web arayüzüne uyarlamasıdır; belediye tarafından verilmiş resmî uygunluk/onay beyanı değildir. Eski lacivert/altın paleti bu tema katmanında ana kurumsal palet olarak kullanılmaz.
