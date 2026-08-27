export type LegalDocKey = 'privacy' | 'terms' | 'kvkk' | 'community'

export const legalDocuments: Record<LegalDocKey, { title: string; content: string }> = {
  privacy: {
    title: 'Gizlilik Politikası',
    content: `PULBI GİZLİLİK POLİTİKASI
Son Güncelleme: 11 Ağustos 2026
1. Veri Sorumlusu
Veri Sorumlusu: Kerem YORDAMLI
Uygulama: Pulbi
E-posta: pulbiapp@gmail.com
2. Yaş Sınırı
Pulbi 18 yaş ve üzerindeki kullanıcılar için tasarlanmıştır. 18 yaşından küçük kişilerin Pulbi'yi
kullanmasına izin verilmez.
3. Topladığımız Kişisel Veriler
Hesap Bilgileri: E-posta adresi, kimlik doğrulama bilgileri, ad, soyad, doğum tarihi, cinsiyet, profil
fotoğrafı, biyografi/hakkında bilgisi ve ilgi alanları.
Pulbi'de telefon numarası ile kayıt veya telefon numarası üzerinden kimlik doğrulama yapılmamaktadır.
Kullanıcılar Google hesabı üzerinden giriş yapabilir.
4. Konum Verileri
Radar, Yankılar, yakın kullanıcı keşfi ve bazı eşleşme özelliklerinin çalışabilmesi için konum verileri
işlenebilir.
Pulbi, uygulama açıkken ve uygulama arka plandayken cihazın konum bilgisini alabilir. Konum verileri
Firebase altyapısında işlenebilir.
Pulbi kullanıcının yalnızca en son konumunu tutar. Yeni konum alındığında önceki son konum
güncellenir.
5. Kesin Konum Bilgisi
Pulbi'nin sistemleri yakınlık hesaplamaları için kesin GPS koordinatlarını işleyebilir. Kullanıcıların kesin
GPS koordinatları diğer kullanıcılara gösterilmez.
6. Radar
Radar, çevredeki Pulbi kullanıcılarını keşfetmeye yardımcı olur. Sistem kullanıcıların konumlarını ve
aralarındaki yakınlığı işleyebilir; kesin GPS koordinatları diğer kullanıcılara açıklanmaz.
7. Ghost Mode (Gizalet Modu)
Ghost Mode etkinleştirildiğinde kullanıcı radar üzerinde görünmez; diğer kullanıcılar kullanıcının
konumunu veya mesafe bilgisini göremez. Konum paylaşımı/radar görünürlüğü durur. Kullanıcı
mesajlaşmaya devam edebilir ve Ghost Mode açıkken diğer kullanıcıların radarını göremez. Ghost Mode
ücretsizdir.
8. Yankılar
Yankılar, kullanıcıların geçmişteki fiziksel yakınlıklarını ve karşılaşmalarını keşfetmelerine yardımcı olur.
Karşılaşılan kullanıcı, karşılaşma tarihi, karşılaşmanın gerçekleştiği bölge ve karşılaşma sayısı
İşlenebilir. Örneğin "10 Ağustos - Kadıköy / Moda'da karşılaştınız." gibi bilgiler gösterilebilir.
Yankılar kapsamında oluşturulan karşılaşma kayıtları mevcut sistemde süresiz olarak saklanmaktadır.
9. Spark ve Bluetooth/BLE
Bluetooth/BLE ve konum tabanlı teknolojiler; yakındaki Pulbi kullanıcılarını tespit etmek, iki kullanıcının
yakınlığını doğrulamak, Spark özelliğini çalıştırmak ve Yankılar'daki karşılaşmaları tespit etmek için
kullanılabilir.
Bluetooth cihaz kimliği/teknik cihaz kimliği saklanmaz. Bluetooth, yakınlığı tespit etmek amacıyla
kullanılır.
Bu özellikler kullanıcıların sosyalleşmesine, yeni arkadaşlıklar ve sosyal bağlantılar kurmasına yardımcı
olmak amacıyla sunulur.
10. Mesajlaşma Verileri
Kullanıcılar metin mesajları, fotoğraflar, videolar ve ses kayıtları gönderebilir. Mesaj ve bağlantılı
içerikler Firebase altyapısında saklanabilir.
Kullanıcılar kendi mesajlarını silebilir; sohbetin diğer tarafı da ilgili mesajları silebilir. Her iki kullanıcı
aynı sohbeti sildiğinde ilgili sohbet verileri ve bağlantılı medya içerikleri sistemden tamamen silinir.
11. Mesajların Otomatik Silinmesi
Bir kullanıcı hesabına 3 ay boyunca giriş yapmazsa, bu kullanıcıya ait mesajların silinmesi uygulanır.
12. Fotoğraf, Video ve Ses Kayıtları
Profil fotoğrafları ile sohbet fotoğrafları, videoları ve ses kayıtları Firebase Storage'da saklanabilir.
İlgili mesaj veya sohbet silindiğinde bağlantılı medya içerikleri de silinir. Hesap silindiğinde kullanıcıya
ait fotoğraf, video ve ses kayıtları da silinir.
13. Engelleme ve Şikâyet
Kullanıcılar birbirlerini engelleyebilir ve şikâyet edebilir. Şikâyetler güvenlik ve kötüye kullanım
incelemeleri amacıyla yetkili Pulbi yöneticileri tarafından incelenebilir.
14. Bildirimler
Pulbi, Firebase Cloud Messaging kullanarak yeni mesajlar, eşleşmeler, Spark veya benzeri etkileşimler,
Yankılar ve diğer uygulama içi etkileşimler hakkında push bildirimleri gönderebilir.
Bildirim izni verilmediğinde uygulamanın temel özellikleri kullanılmaya devam eder; ancak bildirim
gerektiren bazı özellikler ve bildirimler çalışmayabilir.
15. Firebase Hizmetleri
Pulbi şu Firebase hizmetlerini kullanmaktadır: Firebase Authentication, Cloud Firestore, Firebase
Storage ve Firebase Cloud Messaging.
Pulbi şu anda Firebase Analytics, Firebase Crashlytics veya Firebase Cloud Functions
kullanmamaktadır.
16. Kullanıcı Verilerine Erişim
Yetkili Pulbi yöneticileri; güvenlik, kötüye kullanım incelemesi, teknik destek, kullanıcı desteği ve yasal
yükümlülüklerin yerine getirilmesi gibi gerekli durumlarda kullanıcı verilerine erişebilir.
Normal kullanıcılar başka kullanıcıların gizli kişisel verilerine veya kesin GPS koordinatlarına erişemez.
17. Kişisel Verilerin Kullanım Amaçları
Kişisel veriler; hesap oluşturma ve yönetimi, kimlik doğrulama, radar, yakın kullanıcı keşfi,
Spark/eşleşme, Yankılar, sosyal bağlantılar, mesajlaşma, profil özellikleri, Ghost Mode, bildirimler,
güvenlik, şikâyetlerin değerlendirilmesi, kötüye kullanımın önlenmesi, teknik hizmetler ve yasal
yükümlülüklerin yerine getirilmesi amaçlarıyla işlenebilir.
18. Kişisel Verilerin Hukuki İşlenme Sebepleri
Kişisel veriler uygulanabilir mevzuata göre sözleşmenin kurulması veya ifası, hukuki yükümlülükler,
meşru menfaatler, bir hakkın tesisi/kullanılması/korunması ve gerekli durumlarda açık rıza gibi hukuki
sebeplere dayanılarak işlenebilir.
19. Kişisel Verilerin Paylaşılması
Pulbi kullanıcıların kişisel verilerini satmaz veya reklam amacıyla üçüncü kişilere kiralamaz. Hizmetin
sağlanması kapsamında veriler Firebase altyapısında işlenebilir.
Veriler; kullanıcının izni, yasal zorunluluk, yetkili kamu kurumlarının hukuka uygun talepleri,
güvenlik/kötüye kullanımın önlenmesi veya hukuki hakların korunması gibi durumlarda paylaşılabilir.
20. Reklam
Pulbi reklam sunmamaktadır. Mevcut hizmette reklam amacıyla kullanıcı profili oluşturulmamaktadır.
Gelecekte reklam teknolojileri eklenirse bu politika güncellenecektir.
21. Verilerin Saklanması
Konum: Yalnızca en son konum tutulur ve yeni konumla güncellenir.
Yankılar: Karşılaşma kayıtları mevcut sistemde süresiz saklanır.
Mesajlar ve medya: Sohbet silme veya ilgili saklama koşulları gerçekleştiğinde silinir; 3 ay giriş
yapılmayan hesaplara ait mesajların silinmesi uygulanır.
22. Hesap Silme
Kullanıcı hesabını uygulama içerisinden silebilir. Hesap silindiğinde hesap bilgileri, ad/soyad, profil
fotoğrafı, doğum tarihi, cinsiyet, biyografi, ilgi alanları, son konum, Yankılar/karşılaşma kayıtları,
mesajlar, fotoğraf/video/ses kayıtları ve Firebase Authentication hesabı silinir.
23. Kullanıcıların Kişisel Veri Hakları
Uygulanabilir KVKK ve GDPR hükümleri kapsamında kullanıcılar; verilerinin işlenip işlenmediğini
öğrenme, erişim, düzeltme, silme, işleme faaliyetinin sınırlandırılmasını isteme, belirli durumlarda itiraz
etme, açık rızayı geri çekme ve uygulanabilir olduğu ölçüde veri taşınabilirliği gibi haklara sahip olabilir.
24. Veri İndirme
Pulbi şu anda kullanıcıların kişisel verilerini doğrudan uygulama üzerinden indirmesine olanak sağlayan
bir özellik sunmamaktadır. Kullanıcılar veri taleplerini e-posta üzerinden iletebilir.
25. Veri Güvenliği
Pulbi, kişisel verilerin korunması için uygun teknik ve idari tedbirleri uygulamayı amaçlar.
26. Çocukların Gizliliği
Pulbi 18 yaşından küçük kişilere yönelik değildir ve 18 yaşından küçük kişilerden bilerek kişisel veri
toplamayı amaçlamaz.
27. Gizlilik Politikası Değişiklikleri
Pulbi bu politikayı gerektiğinde güncelleyebilir. Güncellenmiş politika uygulama içerisinde yayınlanabilir
ve önemli değişikliklerde kullanıcılar uygun yöntemlerle bilgilendirilebilir.
28. İletişim
Pulbi
Veri Sorumlusu: Kerem YORDAMLI
E-posta: pulbiapp@gmail.com`
  },
  terms: {
    title: 'Kullanıcı Sözleşmesi',
    content: `PULBI KULLANICI SÖZLEŞMESİ VE KULLANIM KOŞULLARI
Son Güncelleme: 11 Ağustos 2026
Uygulama: Pulbi
Geliştirici / İşleten: Kerem YORDAMLI
E-posta: pulbiapp@gmail.com
1. Sözleşmenin Kabulü
Pulbi mobil uygulamasını indirerek, hesap oluşturarak veya kullanarak bu Kullanıcı Sözleşmesi ve
Kullanım Koşullarını kabul etmiş olursunuz. Bu koşulları kabul etmiyorsanız Pulbi'yi kullanmamalısınız.
Pulbi'nin kullanımı aynı zamanda uygulamada sunulan Gizlilik Politikası ve uygulanabilir diğer politika
ve kurallara tabidir.
2. Yaş ve Kullanıcı Uygunluğu
Pulbi yalnızca 18 yaş ve üzerindeki kişiler tarafından kullanılabilir. Kullanıcı, kayıt sırasında verdiği
bilgilerin doğru ve güncel olduğunu kabul eder.
3. Pulbi'nin Amacı
Pulbi; kullanıcıların çevrelerindeki diğer Pulbi kullanıcılarını keşfetmelerine, sosyal bağlantılar
kurmalarına, yeni arkadaşlıklar edinmelerine, Spark ve benzeri eşleşme özelliklerini kullanmalarına ve
Yankılar aracılığıyla geçmişteki karşılaşmalarını keşfetmelerine yardımcı olan konum tabanlı bir sosyal
uygulamadır.
Pulbi belirli bir kullanıcıyla arkadaşlık, eşleşme, görüşme veya gerçek hayatta buluşma sonucunu
garanti etmez.
4. Hesap Oluşturma ve Güvenlik
Kullanıcılar e-posta ve şifre ile veya Google hesabı üzerinden hesap oluşturabilir. Kullanıcı hesabının
güvenliğinden ve hesap bilgilerini korumaktan kullanıcı sorumludur.
Kullanıcı, hesabını başka bir kişiye devredemez veya başka bir kişinin hesabını izinsiz kullanamaz.
5. Profil Bilgileri
Kullanıcılar ad, soyad, profil fotoğrafı, doğum tarihi, cinsiyet, biyografi ve ilgi alanları gibi bilgileri
profillerinde kullanabilir.
Kullanıcı, paylaştığı bilgilerin kendisine ait olduğunu ve başkasının haklarını ihlal etmediğini kabul eder.
6. Radar ve Konum Özellikleri
Pulbi, radar ve yakınlık özelliklerini sağlamak için cihaz konumunu kullanabilir. Konum açıkken
uygulama açık veya arka planda olabilir.
Diğer kullanıcılar birbirlerinin kesin GPS koordinatlarını göremez. Kullanıcı konum iznini vermez veya
sonradan kapatırsa radar ve Yankılar gibi konum tabanlı özellikler kullanılamayabilir.
7. Ghost Mode (Gizalet Modu)
Ghost Mode ücretsiz bir özelliktir. Etkinleştirildiğinde kullanıcı radar üzerinde görünmez; diğer
kullanıcılar kullanıcının konumunu veya mesafesini göremez. Kullanıcı mesajlaşmaya devam edebilir
ancak Ghost Mode açıkken diğer kullanıcıların radarını göremez.
8. Spark ve Bluetooth/BLE
Pulbi, yakındaki Pulbi kullanıcılarını tespit etmek, yakınlığı doğrulamak, Spark özelliklerini çalıştırmak ve
Yankılar'daki karşılaşmaları belirlemek için Bluetooth/BLE ve konum teknolojilerinden yararlanabilir.
Bluetooth cihaz kimlikleri veya teknik cihaz kimlikleri saklanmaz.
9. Yankılar
Yankılar, kullanıcıların geçmişte karşılaştıkları diğer Pulbi kullanıcılarını ve karşılaşma bilgilerini
keşfetmelerine yardımcı olur. Karşılaşma tarihi, bölge ve karşılaşma sayısı gösterilebilir.
Belirli koşulların gerçekleşmesi halinde, örneğin üç karşılaşma sonrasında, kullanıcılar arasında sohbet
özelliği açılabilir.
10. Mesajlaşma ve Medya
Kullanıcılar metin, fotoğraf, video ve ses kaydı gönderebilir. Kullanıcılar kendi mesajlarını silebilir;
sohbetin diğer tarafı da ilgili mesajları silebilir.
Her iki kullanıcı aynı sohbeti sildiğinde ilgili sohbet verilerinin ve bağlantılı medya içeriklerinin
sistemden tamamen silinmesi amaçlanır.
Bir kullanıcı hesabına üç ay boyunca giriş yapmazsa kullanıcıya ait mesajların silinmesi uygulanabilir.
11. Engelleme ve Şikâyet
Kullanıcılar diğer kullanıcıları engelleyebilir ve şikâyet edebilir. Şikâyetler güvenlik, kötüye kullanım,
taciz veya topluluk kurallarının ihlali açısından incelenebilir.
12. Yasaklanan Kullanımlar
Kullanıcıların Pulbi'yi hukuka aykırı veya başkalarının haklarını ihlal edecek şekilde kullanması yasaktır.
Özellikle aşağıdakiler yasaktır:
• Taciz, tehdit, takip, şantaj veya zorbalık.
• Dolandırıcılık, sahte kimlik veya başka bir kişinin kimliğine bürünme.
Spam, istenmeyen reklam veya kötü amaçlı içerik.
• Başka kişilerin kişisel verilerini izinsiz paylaşmak.
İstenmeyen cinsel içerik veya hukuka aykırı içerik paylaşmak.
• Uygulamanın güvenlik mekanizmalarını aşmaya çalışmak.
Bot, otomasyon veya yetkisiz yazılımlarla hizmeti kötüye kullanmak.
• Pulbi'yi başka kişilere zarar vermek veya suç işlemek amacıyla kullanmak.
13. Kullanıcı İçerikleri
Kullanıcının Pulbi'ye yüklediği profil bilgileri, fotoğraflar, videolar, ses kayıtları ve mesajlar kullanıcı
tarafından oluşturulan içeriklerdir.
Kullanıcı, yüklediği içerikler üzerinde gerekli haklara sahip olduğunu ve içeriklerin hukuka aykırı
olmadığını kabul eder.
Pulbi, güvenlik, şikâyet, kötüye kullanım veya yasal yükümlülükler kapsamında gerekli işlemleri
yapabilir.
14. Kullanıcı Güvenliği ve Gerçek Hayat Buluşmaları
Pulbi, kullanıcıların sosyal bağlantılar kurmasına yardımcı olur; ancak kullanıcıların gerçek hayattaki
davranışlarını, kimliklerini, niyetlerini veya güvenilirliklerini garanti etmez.
Kullanıcılar başka bir kullanıcıyla gerçek hayatta görüşmeye karar verdiklerinde kendi güvenliklerinden
sorumludur.
15. Hesap Askıya Alma ve Sonlandırma
Pulbi, bu sözleşmenin, topluluk kurallarının veya uygulanabilir yasaların ihlal edildiğini düşündüğü
durumlarda hesabı geçici olarak kısıtlayabilir, askıya alabilir veya sonlandırabilir.
Şikâyet, güvenlik tehdidi, kötüye kullanım, sahte hesap, dolandırıcılık veya hukuki zorunluluk gibi
durumlarda gerekli önlemler alınabilir.
16. Hesap Silme
Kullanıcı hesabını uygulama içinden silebilir. Hesap silindiğinde Gizlilik Politikası'nda açıklanan kapsam
dahilinde kullanıcıya ait hesap ve kişisel verilerin silinmesi gerçekleştirilir.
Hesap silme işlemi geri alınamayabilir.
17. Fikri Mülkiyet
Pulbi uygulamasının yazılımı, tasarımı, marka unsurları, logoları, arayüzleri ve Pulbi tarafından
oluşturulan diğer içerikler, uygulanabilir fikri mülkiyet mevzuatı kapsamında korunabilir.
Kullanıcı, Pulbi'nin yazılı izni olmaksızın uygulamayı kopyalayamaz, değiştiremez, yeniden dağıtamaz,
tersine mühendislik yapamaz veya ticari olarak kullanamaz; uygulanabilir hukukun izin verdiği
istisnalar saklıdır.
18. Hizmetin Kullanılabilirliği
Pulbi hizmetin kesintisiz, hatasız veya her zaman erişilebilir olacağını garanti etmez.
Bakım, güncelleme, teknik sorunlar, internet bağlantısı, cihaz işletim sistemi, üçüncü taraf altyapılar
veya kontrolümüz dışındaki olaylar nedeniyle hizmette geçici kesintiler yaşanabilir.
19. Konum ve Bluetooth Teknolojilerinin Sınırları
GPS, Bluetooth/BLE, internet bağlantısı ve cihaz sensörleri fiziksel çevre, cihaz ayarları, izinler, sinyal
kalitesi ve teknik koşullardan etkilenebilir.
Bu nedenle radar, Spark veya Yankılar özelliklerinin her zaman eksiksiz veya hatasız çalışacağı garanti
edilmez.
20. Sorumluluk Sınırları
Pulbi, kullanıcılar arasındaki gerçek hayat etkileşimlerinin sonucundan, kullanıcıların kendi
davranışlarından veya kullanıcı tarafından paylaşılan bilgilerin doğruluğundan sorumlu değildir;
uygulanabilir tüketici ve zorunlu hukuk hükümleri saklıdır.
Hiçbir hüküm, yürürlükteki mevzuat uyarınca sınırlandırılması mümkün olmayan bir sorumluluğu
ortadan kaldırma amacı taşımaz.
21. Ücretler ve Gelecekteki Özellikler
Pulbi'nin ücretlendirme modeli ve bazı özellikleri zaman içinde değişebilir. Yeni ücretli özellikler veya
uygulama içi satın almalar sunulması halinde kullanıcılar ilgili koşullar hakkında uygun şekilde
bilgilendirilecektir.
22. Gizlilik
Kullanıcı verilerinin toplanması, kullanılması, saklanması ve silinmesi Gizlilik Politikası'nda açıklanır.
23. Değişiklikler
Pulbi bu Kullanıcı Sözleşmesi'ni gerektiğinde güncelleyebilir. Önemli değişiklikler uygulama içinde veya
uygun başka bir yöntemle kullanıcıların dikkatine sunulabilir.
24. Uygulanacak Hukuk
Bu Sözleşme, uygulanabilir zorunlu tüketici ve kişisel veri mevzuatı saklı kalmak üzere Türkiye
Cumhuriyeti hukukuna göre değerlendirilir.
Uyuşmazlıkların çözümünde, uygulanabilir mevzuatın görev ve yetki kuralları saklıdır.
25. İletişim
Pulbi
Geliştirici / İşleten: Kerem YORDAMLI
E-posta: pulbiapp@gmail.com`
  },
  kvkk: {
    title: 'KVKK Aydınlatma Metni',
    content: `PULBI KVKK AYDINLATMA METNİ
Son Güncelleme: 11 Ağustos 2026
Veri Sorumlusu: Kerem YORDAMLI
Uygulama: Pulbi
E-posta: pulbiapp@gmail.com
1. Amaç ve Kapsam
Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında Pulbi mobil
uygulamasını kullanan kişilerin kişisel verilerinin işlenmesi hakkında ilgili kişileri bilgilendirmek
amacıyla hazırlanmıştır.
Bu metin, kişisel verilerin hangi kategorilerde işlendiğini, işleme amaçlarını, veri toplama yöntemlerini,
hukuki sebepleri, aktarım durumlarını ve ilgili kişilerin haklarını açıklar.
2. Veri Sorumlusu
KVKK kapsamında kişisel verileriniz bakımından veri sorumlusu Kerem YORDAMLI'dır.
İletişim: pulbiapp@gmail.com
3. İşlenen Kişisel Veri Kategorileri
Kimlik ve profil verileri: Ad, soyad, doğum tarihi, cinsiyet, profil fotoğrafı, biyografi ve ilgi alanları.
İletişim verileri: E-posta adresi.
Hesap ve kimlik doğrulama verileri: Firebase Authentication kapsamında hesap ve kimlik doğrulama
bilgileri; Google ile giriş kullanılması halinde ilgili kimlik doğrulama bilgileri.
Konum verileri: Kullanıcının son konumu ve yakınlık/karşılaşma özellikleri için kullanılan konum bilgileri.
Mesajlaşma ve içerik verileri: Metin mesajları, fotoğraflar, videolar ve ses kayıtları.
Karşılaşma verileri: Yankılar kapsamında karşılaşılan kullanıcı, karşılaşma tarihi, bölge ve karşılaşma
sayısı.
İşlem ve teknik veriler: Hizmetin çalışması için gerekli olabilecek cihaz ve uygulama teknik verileri.
Bildirim verileri: Push bildirimlerinin iletilmesi için gerekli teknik bilgiler.
4. Bluetooth / Yakınlık Verileri
Pulbi, yakındaki Pulbi kullanıcılarını tespit etmek, iki kullanıcının yakınlığını doğrulamak, Spark özelliğini
çalıştırmak ve Yankılar'daki karşılaşmaları belirlemek amacıyla Bluetooth/BLE teknolojisinden
yararlanabilir.
Bluetooth cihaz kimliği veya benzersiz teknik cihaz kimliği saklanmaz. Bluetooth yalnızca yakınlık
tespiti amacıyla kullanılır.
5. Kişisel Verilerin İşlenme Amaçları
Kişisel verileriniz; hesap oluşturma ve yönetme, kimlik doğrulama, radar hizmetini sunma, yakındaki
kullanıcıları keşfetme, Spark/eşleşme özelliklerini çalıştırma, Yankılar özelliğini sunma, sosyal
bağlantıların kurulmasına yardımcı olma, mesajlaşma ve medya paylaşımını sağlama, Ghost Mode'u
uygulama, bildirim gönderme, kullanıcı güvenliğini sağlama, şikâyetleri değerlendirme, kötüye
kullanımı önleme, teknik hizmetleri yürütme ve yasal yükümlülükleri yerine getirme amaçlarıyla
işlenebilir.
6. Kişisel Verilerin Toplanma Yöntemleri
Veriler; mobil uygulama üzerinden doğrudan kullanıcı tarafından sağlanması, hesap oluşturma ve
Google ile giriş süreçleri, cihaz izinleri, konum hizmetleri, Bluetooth/BLE, Firebase Authentication, Cloud
Firestore, Firebase Storage ve Firebase Cloud Messaging altyapıları aracılığıyla otomatik veya kısmen
otomatik yöntemlerle toplanabilir.
7. Kişisel Verilerin İşlenmesinin Hukuki Sebepleri
KVKK'nın 5. maddesi kapsamında kişisel veriler; kanunlarda açıkça öngörülmesi, bir sözleşmenin
kurulması veya ifasıyla doğrudan doğruya ilgili olması, veri sorumlusunun hukuki yükümlülüğünü
yerine getirmesi, bir hakkın tesisi/kullanılması/korunması, ilgili kişinin temel hak ve özgürlüklerine zarar
vermemek kaydıyla veri sorumlusunun meşru menfaatinin bulunması veya gerekli hallerde açık rıza
hukuki sebeplerine dayanılarak işlenebilir.
Konum, Bluetooth ve benzeri cihaz izinleri bakımından ilgili işletim sisteminin izin mekanizmaları
uygulanır. Açık rıza gerektiren bir işleme faaliyeti bulunması halinde ilgili rıza ayrıca alınır.
8. Konum ve Arka Plan Konumu
Radar, Yankılar ve yakınlık tabanlı özellikler için konum verileri uygulama açıkken veya izin verilmişse
arka planda işlenebilir.
Pulbi yalnızca kullanıcının son konumunu tutar; yeni konum geldiğinde önceki son konum güncellenir.
Diğer kullanıcılarla kesin GPS koordinatları paylaşılmaz.
Konum izni verilmediğinde konum gerektiren özellikler çalışmayabilir; hesap ve mesajlaşma gibi konum
gerektirmeyen özellikler kullanılabilir.
9. Yankılar ve Karşılaşma Geçmişi
Yankılar özelliği kapsamında kullanıcıların birbirleriyle karşılaşmaları; tarih, bölge ve karşılaşma sayısı
gibi bilgilerle ilişkilendirilebilir.
Mevcut sistem tasarımında Yankılar karşılaşma kayıtları süresiz saklanmaktadır.
10. Mesajlar ve Medya
Mesajlaşma kapsamında metin, fotoğraf, video ve ses kayıtları işlenebilir. Bu içerikler Firebase
altyapısında saklanabilir.
Her iki kullanıcı aynı sohbeti sildiğinde ilgili sohbet ve bağlantılı medya içerikleri tamamen silinir.
Hesabını 3 ay boyunca kullanmayan kullanıcıların mesajlarının silinmesi uygulanır.
11. Kişisel Verilerin Aktarılması
Kişisel veriler, Pulbi hizmetlerinin sağlanması kapsamında kullanılan Firebase altyapısı ve ilgili hizmet
sağlayıcıları tarafından işlenebilir.
Yurt içi veya yurt dışına veri aktarımı söz konusu olduğunda, aktarım ilgili KVKK hükümlerine ve
uygulanabilir düzenlemelere uygun hukuki mekanizmalar kullanılarak gerçekleştirilir.
12. Kişisel Verilere Erişim
Yetkili Pulbi yöneticileri; güvenlik, kötüye kullanım incelemesi, teknik destek, kullanıcı desteği veya
yasal yükümlülüklerin yerine getirilmesi gibi gerekli durumlarda kullanıcı verilerine erişebilir.
Normal kullanıcılar başka kullanıcıların gizli kişisel verilerine veya kesin GPS koordinatlarına erişemez.
13. Saklama Süreleri
Son konum: Yeni konumla güncellenir; eski son konum tutulmaz.
Yankılar: Karşılaşma kayıtları mevcut sistemde süresiz saklanır.
Mesajlar: Sohbet silme koşullarında silinir; ayrıca 3 ay giriş yapılmayan hesaplara ait mesajların
silinmesi uygulanır.
Hesap: Kullanıcı hesabını sildiğinde hesap ve kullanıcıya ait belirtilen kişisel veriler silinir. Yasal olarak
saklanması zorunlu veriler varsa ilgili mevzuattaki süreler saklıdır.
14. Kullanıcı Hakları
KVKK'nın 11. maddesi kapsamında ilgili kişiler; kişisel verilerinin işlenip işlenmediğini öğrenme,
işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını
öğrenme, yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse
düzeltilmesini isteme, KVKK'nın şartları kapsamında silinmesini veya yok edilmesini isteme, yapılan
işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz
sonucu aleyhe bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara
uğraması halinde zararın giderilmesini talep etme haklarına sahiptir.
15. Başvuru Yöntemi
KVKK kapsamındaki taleplerinizi pulbiapp@gmail.com adresine iletebilirsiniz.
Başvurular, kimlik doğrulaması ve talebin niteliğine göre gerekli bilgilerin sağlanması sonrasında
yürürlükteki KVKK ve ilgili ikincil düzenlemelerde öngörülen usul ve süreler çerçevesinde
değerlendirilir.
16. Hesap Silme
Kullanıcı hesabını doğrudan uygulama içerisinden silebilir. Hesap silindiğinde; hesap bilgileri, profil
bilgileri, son konum, Yankılar/karşılaşma kayıtları, mesajlar, fotoğraf/video/ses kayıtları ve Firebase
Authentication hesabı dahil olmak üzere kullanıcıya ait verilerin silinmesi gerçekleştirilir; yasal saklama
yükümlülükleri saklıdır.
17. Çocukların Verileri
Pulbi 18 yaşından küçük kişilere yönelik değildir. 18 yaşından küçük kişilerden bilerek kişisel veri
toplanması amaçlanmamaktadır.
18. Değişiklikler
Mevzuat, uygulama özellikleri veya veri işleme süreçlerinde değişiklik olması halinde bu Aydınlatma
Metni güncellenebilir. Güncel metin uygulama içerisinde kullanıcıların erişimine sunulabilir.
19. İletişim
Veri Sorumlusu: Kerem YORDAMLI
Uygulama: Pulbi
E-posta: pulbiapp@gmail.com`
  },
  community: {
    title: 'Topluluk Kuralları',
    content: `PULBI TOPLULUK KURALLARI
Son Güncelleme: 11 Ağustos 2026
Uygulama: Pulbi
Geliştirici / İşleten: Kerem YORDAMLI
İletişim: pulbiapp@gmail.com
1. Topluluk Kurallarının Amacı
Pulbi; insanların çevrelerindeki kullanıcıları keşfetmesine, Spark ve Yankılar gibi özelliklerle sosyal
bağlantılar kurmasına, yeni arkadaşlıklar edinmesine ve mesajlaşmasına yardımcı olan bir sosyal
uygulamadır.
Bu kuralların amacı Pulbi'yi güvenli, saygılı ve keyifli bir ortam olarak korumaktır.
2. 18 Yaş Sınırı
Pulbi 18 yaş ve üzerindeki kullanıcılar içindir. 18 yaşından küçük kişilerin hesap oluşturması veya
uygulamayı kullanması yasaktır.
Başka bir kişinin 18 yaşından küçük olduğunu bilerek onunla cinsel veya istismar edici amaçlarla
İletişim kurmak kesinlikle yasaktır.
3. Saygılı Davranış
Diğer kullanıcılara karşı saygılı ve dürüst davranın. Hakaret, aşağılama, tehdit, zorbalık, sürekli rahatsız
etme ve korkutma kabul edilmez.
Bir kullanıcı iletişim kurmak istemiyorsa buna saygı gösterilmelidir.
4. Taciz ve Israrlı Takip
Bir kullanıcıyı istemediği halde sürekli mesajlarla, eşleşmelerle veya diğer uygulama özellikleriyle
rahatsız etmek yasaktır.
Bir kişiyi gerçek hayatta takip etmek, konumunu öğrenmeye veya izlemeye çalışmak, kişisel
hareketlerini izlemek veya korkutmak amacıyla Pulbi'yi kullanmak yasaktır.
5. Tehdit ve Şiddet
Fiziksel şiddet tehdidi, ciddi zarar verme tehdidi, şantaj, zorla bir şey yaptırmaya çalışma veya şiddeti
teşvik eden içerikler yasaktır.
6. Nefret ve Ayrımcılık
Bir kişiye veya gruba karşı kimliği veya kişisel özellikleri nedeniyle nefret, dışlama, insanlıktan çıkarma
veya şiddet çağrısı içeren içerikler yasaktır.
7. Cinsel İçerik ve İstenmeyen İçerik
İstenmeyen cinsel içerik göndermek, cinsel taciz, cinsel şantaj veya başka bir kullanıcıyı cinsel içerik
göndermeye zorlamak yasaktır.
18 yaşından küçük kişilerle bağlantılı cinsel içerik, cinsel sömürü veya istismar içeren herhangi bir
İçerik kesinlikle yasaktır.
Pulbi, yetişkinlere yönelik açık cinsel içerik paylaşım platformu değildir.
8. Çıplaklık ve Uygunsuz Profil İçeriği
Profil fotoğrafı, biyografi, sohbet veya diğer alanlarda kullanıcıları rahatsız edecek, cinsel istismar veya
açık cinsel davranışı teşvik edecek içerikler paylaşılmamalıdır.
Pulbi, güvenlik veya topluluk standartları kapsamında uygunsuz içerikleri kaldırabilir.
9. Sahte Kimlik ve Dolandırıcılık
Başka bir kişinin adını, fotoğrafını veya kimliğini izinsiz kullanarak sahte hesap oluşturmak yasaktır.
Para, banka bilgileri, şifreler, doğrulama kodları veya kişisel bilgileri dolandırıcılık amacıyla istemek
veya kullanıcıları kandırmak yasaktır.
10. Spam ve Reklam
İstenmeyen toplu mesajlar, otomatik mesajlar, zincir mesajlar, kullanıcıları başka hizmetlere
yönlendirmek amacıyla yapılan spam faaliyetleri ve izinsiz reklamlar yasaktır.
11. Kişisel Verilerin Korunması
Başka bir kullanıcının telefon numarası, adresi, özel mesajları, ekran görüntüleri, kesin konumu veya
diğer kişisel bilgilerini izinsiz paylaşmak yasaktır.
Bir kullanıcının Pulbi'de görünen bilgilerini, o kişiye zarar vermek, tehdit etmek veya onu gerçek
hayatta bulmak amacıyla kullanmak yasaktır.
12. Konum ve Radarın Kötüye Kullanılması
Radar, Spark, Yankılar veya konum özellikleri başka kişileri takip etmek, gözetlemek, taciz etmek veya
gerçek konumlarını ortaya çıkarmaya çalışmak için kullanılamaz.
Pulbi'nin kesin GPS koordinatları kullanıcılar arasında paylaşılmadığı için herhangi bir yöntemle başka
bir kullanıcının kesin konumunu çıkarmaya çalışmak yasaktır.
13. Bluetooth ve Teknik Sistemlerin Kötüye Kullanılması
Bluetooth/BLE yakınlık mekanizmasını manipüle etmek, sahte yakınlık/karşılaşma üretmek veya
uygulamanın eşleşme sistemini yanıltmak yasaktır.
Pulbi'nin teknik altyapısını bozacak, aşırı yükleyecek veya yetkisiz şekilde erişmeye çalışacak işlemler
yasaktır.
14. Spark ve Yankılar
Spark ve Yankılar yalnızca gerçek kullanıcı etkileşimlerini ve uygulamanın amaçlanan yakınlık
özelliklerini desteklemek için kullanılmalıdır.
Sahte hesaplarla karşılaşma üretmek, konum verisini manipüle etmek veya karşılaşma sayısını yapay
şekilde artırmak yasaktır.
15. Mesajlaşma Kuralları
Mesajlaşmada karşılıklı saygı esastır. İstenmeyen mesajlar, tehditler, taciz, dolandırıcılık, spam, cinsel
taciz ve kişisel veri paylaşımı yasaktır.
Bir kullanıcı sizi engellediyse yeni hesaplarla veya başka yöntemlerle o kullanıcıyla tekrar iletişim
kurmaya çalışmayın.
16. Fotoğraf, Video ve Ses Kayıtları
Yüklediğiniz fotoğraf, video ve ses kayıtlarının paylaşım hakkına sahip olmanız gerekir.
Başka kişilerin özel görüntülerini veya ses kayıtlarını izinsiz paylaşmak, tehdit veya şantaj amacıyla
kullanmak yasaktır.
17. Yasa Dışı Faaliyetler
Pulbi; suç işlemek, yasa dışı mal veya hizmetlerin ticaretini yapmak, dolandırıcılık, tehdit, şantaj veya
başka bir yasa dışı faaliyeti organize etmek amacıyla kullanılamaz.
18. Botlar ve Otomasyon
Bot, script, scraper, otomatik hesap oluşturma sistemi veya Pulbi'nin normal çalışma biçimini değiştiren
yetkisiz yazılımlar kullanılamaz.
Spam üretmek, sahte etkileşim oluşturmak veya uygulamanın güvenlik mekanizmalarını aşmak
amacıyla otomasyon kullanılması yasaktır.
19. Kullanıcıları Raporlama
Kuralları ihlal ettiğini düşündüğünüz bir kullanıcıyı uygulamadaki mevcut şikâyet/raporlama
mekanizmaları üzerinden bildirebilirsiniz.
Rapor gönderirken mümkün olduğunca doğru ve gerçek bilgiler sağlayın. Kasıtlı olarak sahte
şikâyetlerle başka bir kullanıcıya zarar vermek de kurallara aykırıdır.
20. Engelleme
Bir kullanıcıyı engellemek, iletişimi ve uygulamadaki belirli etkileşimleri sınırlandırmak için kullanılabilir.
Engellenen bir kullanıcının engeli aşmak için yeni hesaplar oluşturması veya başka yöntemler
kullanması yasaktır.
21. Moderasyon ve İçerik İşlemleri
Pulbi, güvenlik, kullanıcı şikâyetleri, kötüye kullanım, yasal yükümlülükler veya bu kuralların ihlali
durumunda içerikleri kaldırabilir, görünürlüğü sınırlayabilir, özellikleri kısıtlayabilir veya hesabı askıya
alabilir.
Pulbi'nin her içeriği önceden incelemesi garanti edilmez. Kullanıcıların şüpheli veya zararlı içerikleri
bildirmesi topluluk güvenliğine katkı sağlar.
22. Hesap Askıya Alma veya Kapatma
Kuralların ciddi veya tekrarlanan şekilde ihlal edilmesi halinde hesap geçici olarak askıya alınabilir veya
kalıcı olarak kapatılabilir.
Ciddi güvenlik riski, dolandırıcılık, tehdit, çocukların cinsel istismarı, şiddet tehdidi veya diğer ağır
ihlallerde Pulbi gerekli önlemleri derhal alabilir.
23. Kullanıcı Güvenliği
Pulbi, kullanıcıların kimliğini, niyetini veya gerçek hayattaki davranışlarını garanti etmez. Bir
kullanıcıyla gerçek hayatta görüşmeden önce kendi güvenliğinizi değerlendirin.
İlk buluşmalar için kamuya açık ve güvenli yerleri tercih etmek, kişisel bilgileri gereğinden fazla
paylaşmamak ve güvendiğiniz bir kişiyi bilgilendirmek iyi güvenlik uygulamalarıdır.
24. Topluluk Kurallarındaki Değişiklikler
Pulbi, güvenlik ihtiyaçları, yeni özellikler veya yasal gereklilikler nedeniyle bu Topluluk Kurallarını
güncelleyebilir. Güncel kurallar uygulama içinde yayınlanabilir.
25. İletişim
Topluluk Kuralları hakkında sorularınız veya güvenlik bildirimleriniz için:
Pulbi
Geliştirici / İşleten: Kerem YORDAMLI
E-posta: pulbiapp@gmail.com`
  }
}