// İngilizce çeviri verisi. RULES: cümle yapısını değiştiren kalıplar (sayılar yakalanır). PHRASES: en uzun ifade önce eşleşen sözlük.
// Yeni bir Türkçe metin eklenince buraya karşılığını ekle; tests/i18n.test.js kaynak koddaki Türkçe metinlerin çevrildiğini denetler.

export const RULES = [];
const R = (re, fn) => RULES.push([re, fn]);
const num = (x) => String(x).replace(',', '.');

// ---- görev / rozet / günlük görev şablonları
R(/^(\d+) Kozmik Çekirdek kazan$/, (m) => `Earn ${m[1]} Cosmic Core${m[1] === '1' ? '' : 's'}`);
R(/^(\d+) Altın Kasa yakala$/, (m) => `Catch ${m[1]} Golden Crates`);
R(/^Toplam (.+) ürün sat$/, (m) => `Sell ${m[1]} items in total`);
R(/^(.+) ürün sat$/, (m) => `Sell ${m[1]} items`);
R(/^(.+) ürün üret$/, (m) => `Produce ${m[1]} items`);
R(/^(.+) yükseltme satın al$/, (m) => `Buy ${m[1]} upgrades`);
R(/^(.+) yükseltme yap$/, (m) => `Make ${m[1]} upgrades`);
R(/^(\d+) makineyi otomatikleştir$/, (m) => `Automate ${m[1]} machines`);
R(/^(\d+)\. makineyi satın al$/, (m) => `Buy machine #${m[1]}`);
R(/^(\d+) makine kur$/, (m) => `Build ${m[1]} machines`);
R(/^(\d+) makine$/, (m) => `${m[1]} machines`);
R(/^(\d+) bölge aç$/, (m) => `Unlock ${m[1]} zones`);
R(/^Bir makineyi Sv\.(\d+) yap$/, (m) => `Get a machine to Lv.${m[1]}`);
R(/^(.+) bölgesini aç$/, (m, T) => `Unlock the ${T(m[1])} zone`);
R(/^Toplam (.+) Patent Yıldızı kazan$/, (m) => `Earn ${m[1]} Patent Stars in total`);
R(/^Toplam (.+) kazan$/, (m) => `Earn ${m[1]} in total`);
R(/^(.+) kazan$/, (m) => `Earn ${m[1]}`);
R(/^(.+) kez dokun$/, (m) => `Tap ${m[1]} times`);
R(/^Saniyelik geliri (.+) yap$/, (m) => `Reach an income of ${m[1]}/s`);
R(/^Fabrikayı (\d+) kez yenile$/, (m) => `Renovate the factory ${m[1]} times`);
R(/^(\d+) Acil Sipariş tamamla$/, (m) => `Complete ${m[1]} Rush Orders`);
R(/^(\d+) günlük görev tamamla$/, (m) => `Complete ${m[1]} daily missions`);
R(/^Günlük hediyede (\d+) günlük seri yap$/, (m) => `Reach a ${m[1]}-day daily gift streak`);
R(/^(\d+) fabrika olayı atlat$/, (m) => `Get through ${m[1]} factory events`);
R(/^Çalışanlara toplam (\d+) seviye ver$/, (m) => `Give staff ${m[1]} levels in total`);
R(/^Ar-Ge'de toplam (\d+) seviye aç$/, (m) => `Unlock ${m[1]} research levels in total`);
R(/^Katalogda (\d+) eşik tamamla$/, (m) => `Complete ${m[1]} catalog milestones`);
R(/^(.+): 3 makineyi de kur$/, (m, T) => `${T(m[1])}: build all 3 machines`);
R(/^(.+): tüm makineleri Sv\.(\d+) yap$/, (m, T) => `${T(m[1])}: get all machines to Lv.${m[2]}`);
R(/^(\d+) \/ (\d+) görevi bitirince açılır$/, (m) => `Opens when all missions are done (${m[1]} / ${m[2]})`);

// ---- arayüz cümleleri
R(/^BÖLÜM (\d+)$/, (m) => `CHAPTER ${m[1]}`);
R(/^(\d+)\. gün( \(süper ödül!\))?$/, (m) => `Day ${m[1]}${m[2] ? ' (super reward!)' : ''}`);
R(/^Önce (.+) Sv\.(\d+) olmalı!$/, (m, T) => `First get ${T(m[1])} to Lv.${m[2]}!`);
R(/^Önceki makine Sv\.(\d+) olmalı \((.+)\)$/, (m) => `Previous machine must be Lv.${m[1]} (${m[2]})`);
R(/^Önceki makinenin seviyesi yetersiz \(Sv\.(\d+)\)$/, (m) => `Previous machine's level is too low (Lv.${m[1]})`);
R(/^\+ SATIN AL\s+(.+)$/, (m) => `+ BUY  ${m[1]}`);
R(/^(.+) kuruldu!$/, (m, T) => `${T(m[1])} installed!`);
R(/^\+(.+) kazandın!?$/, (m) => `+${m[1]} earned!`);
R(/^Rozet: (.+)$/, (m, T) => `Badge: ${T(m[1])}`);
R(/^\+%(\d+) gelir$/, (m) => `+${m[1]}% income`);
R(/^Gelir bonusu \+%(.+)$/, (m) => `Income bonus +${m[1]}%`);
R(/^(.+): (\d+) adet sat$/, (m, T) => `${T(m[1])}: sell ${m[2]} items`);
R(/^(\d+) rozet kazandın! \(Hedefler → Rozetler\)$/, (m) => `You earned ${m[1]} badges! (Goals → Badges)`);
R(/^Bu tema için (\d+) rozet gerekli$/, (m) => `This theme needs ${m[1]} badges`);
R(/^\(En fazla (\d+) saatlik kazanç hesaplandı\)$/, (m) => `(Earnings capped at ${m[1]} hours)`);
R(/^Galaktik Genişleme! \+(\d+) Kozmik Çekirdek$/, (m) => `Galactic Expansion! +${m[1]} Cosmic Core${m[1] === '1' ? '' : 's'}`);
R(/^Fabrika yenilendi! \+(.+) Yıldız$/, (m) => `Factory renovated! +${m[1]} Stars`);
R(/^(.+) kazanç gerekli \(bu koşuda\)$/, (m) => `${m[1]} earnings needed (this run)`);
R(/^(.+) kazanınca açılır$/, (m) => `Unlocks at ${m[1]} earnings`);
R(/^(.+) ömür boyu yıldızda açılır$/, (m) => `Unlocks at ${m[1]} lifetime stars`);
R(/^Çevrimdışı kazanç: en fazla (\d+) saat, %(\d+) verimle\. (.+)$/, (m, T) => `Offline earnings: up to ${m[1]} hours at ${m[2]}% efficiency. ${T(m[3])}`);
R(/^Her ürün türünden belirli sayıda satınca bir katalog eşiği tamamlanır \((.+)\)\. Her eşik kalıcı \+%(.+) gelir verir\.$/,
  (m) => `Selling a set number of each product type completes a catalog milestone (${m[1]}). Each milestone gives a permanent +${num(m[2])}% income.`);
R(/^Her Patent Yıldızı kalıcı olarak \+%(\d+) gelir verir\. Yenilemeden önce daha fazla kazanırsan daha fazla yıldız alırsın\.$/,
  (m) => `Each Patent Star permanently gives +${m[1]}% income. The more you earn before renovating, the more stars you get.`);

const P = {
  // ---- bölgeler ve hikâyeler
  'Oyuncak Atölyesi': 'Toy Workshop', 'Elektronik Hattı': 'Electronics Line', 'Robot Fabrikası': 'Robot Factory', 'Ay Üssü': 'Moon Base',
  'Kristal Madeni': 'Crystal Mine', 'Zaman Laboratuvarı': 'Time Lab', 'Kuantum Çekirdeği': 'Quantum Core', 'Galaktik Merkez': 'Galactic Center',
  'Her büyük fabrika küçük bir atölyeyle başlar. İlk makineni çalıştır!': 'Every great factory starts as a small workshop. Start your first machine!',
  'Oyuncaklar yetmedi: devreler, çipler ve akıllı cihazlar üretme zamanı.': 'Toys were not enough: time to make circuits, chips and smart devices.',
  'Robotlar artık robot üretiyor. Fabrikan kendi kendini büyütmeye başladı.': 'Robots are now building robots. Your factory has started to grow by itself.',
  "Dünya'ya sığmıyoruz! Düşük yer çekimi, sonsuz alan: fabrikan Ay'a taşındı.": "Earth is too small for us! Low gravity, endless space: your factory moved to the Moon.",
  'Ayın altında parlayan bir kristal damarı bulundu. Enerji dolu ve çok değerli!': 'A glowing crystal vein was found under the Moon. Full of energy and very valuable!',
  'Kristaller zamanı büküyor. Dün ürettiklerini bugün sat, yarın bile!': 'Crystals bend time. Sell yesterday\'s products today, even tomorrow\'s!',
  'Atomaltı parçacıklar senin için çalışıyor. Ürünlerin aynı anda her yerde!': 'Subatomic particles work for you. Your products are everywhere at once!',
  'Yıldızlar senin dökümhanen, kara delikler depon. Evrenin en büyük fabrikasına hoş geldin!': 'Stars are your foundry, black holes your warehouse. Welcome to the biggest factory in the universe!',

  // ---- makineler
  'Blok Presi': 'Block Press', 'Boyama Kabini': 'Paint Booth', 'Montaj Kolu': 'Assembly Arm', 'Devre Basıcı': 'Circuit Printer', 'Lehim Robotu': 'Soldering Robot',
  'Kalite Tarayıcı': 'Quality Scanner', 'Titan Presi': 'Titan Press', 'Krom Kaplama': 'Chrome Plating', 'Robot Kol Hattı': 'Robot Arm Line', 'Ay Presi': 'Moon Press',
  'Yakıt Karıştırıcı': 'Fuel Mixer', 'Roket Montajı': 'Rocket Assembly', 'Kristal Kırıcı': 'Crystal Crusher', 'Prizma Parlatıcı': 'Prism Polisher',
  'Mücevher Tarayıcı': 'Gem Scanner', 'Zaman Dişlisi Dökümü': 'Time Gear Casting', 'Kum Saati Dolumu': 'Hourglass Filling', 'Paradoks Kolu': 'Paradox Arm',
  'Kuantum Basıcı': 'Quantum Printer', 'Foton Kaynakçı': 'Photon Welder', 'Parçacık Tarayıcı': 'Particle Scanner', 'Yıldız Dökümü': 'Star Foundry',
  'Kara Delik Portalı': 'Black Hole Portal', 'Evren Montajı': 'Universe Assembly',

  // ---- ürünler
  'Blok': 'Block', 'Top': 'Ball', 'Çip': 'Chip', 'Dişli': 'Gear', 'Kutu': 'Box', 'Roket': 'Rocket', 'Kristal': 'Crystal', 'Yıldız': 'Star', 'Küre': 'Orb', 'Kum Saati': 'Hourglass',

  // ---- yükseltmeler, patentler
  'Üretim Hızı': 'Production Speed', 'Ürün Değeri': 'Item Value', 'Depolama': 'Storage', 'Otomasyon': 'Automation',
  'Mühendislik Ödülü': 'Engineering Award', 'Gece Vardiyası': 'Night Shift', 'Otomatik Müdür': 'Auto Manager', 'Usta Dokunuş': 'Master Touch', 'Toptan Alım': 'Bulk Buying',
  'Miras Makineler': 'Heritage Machines', 'Altın Kasa Çağrısı': 'Golden Crate Call',
  'Çevrimdışı süre sınırı +2 saat': 'Offline time limit +2 hours', 'Çevrimdışı verim +%5': 'Offline efficiency +5%', 'Dokunuş gücü +0,25 sn': 'Tap power +0.25 s',
  'Makine fiyatları -%4': 'Machine prices -4%', 'Yeni koşuya +2 hazır otomatik makine': 'Start a new run with +2 ready automated machines',
  'Altın Kasa %10 daha sık gelir': 'Golden Crates appear 10% more often',

  // ---- çalışanlar
  'Kasiyer': 'Cashier', 'Gece Bekçisi': 'Night Guard', 'Vardiya Amiri': 'Shift Supervisor', 'Teknisyen': 'Technician', 'Satış Müdürü': 'Sales Manager', 'Tezgahtar Eğitmeni': 'Booth Trainer',
  'Çevrimdışı süre +1 saat': 'Offline time +1 hour', 'Çevrimdışı verim +%3': 'Offline efficiency +3%',
  "Altın Kasa'yı kendiliğinden toplar (seviye arttıkça daha çabuk)": 'Collects the Golden Crate by itself (faster at higher levels)',
  'Acil Sipariş: ödül +%20, süre +3 sn': 'Rush Orders: reward +20%, time +3 s', 'Dokunuş gücü +0,1 sn': 'Tap power +0.1 s',

  // ---- Ar-Ge
  'Verimlilik': 'Efficiency', 'Şans': 'Luck',
  'Hassas Ölçüm': 'Precise Measurement', 'Kaizen': 'Kaizen', 'Yalın Üretim': 'Lean Production', 'Hızlı Eller': 'Quick Hands', 'Gece Mesaisi': 'Overtime', 'Akıllı Bant': 'Smart Belt',
  'Altın Radar': 'Golden Radar', 'Sağlam Kasa': 'Sturdy Vault', 'Sipariş Ağı': 'Order Network',
  'Makine fiyatları -%3': 'Machine prices -3%', 'Dokunuş gücü +0,15 sn': 'Tap power +0.15 s', 'Çevrimdışı süre +2 saat': 'Offline time +2 hours', 'Çevrimdışı verim +%4': 'Offline efficiency +4%',
  'Altın Kasa %10 daha sık': 'Golden Crates 10% more often', 'Altın Kasa ödülü +%15': 'Golden Crate reward +15%', 'Acil Sipariş ödülü +%20, daha sık': 'Rush Order reward +20%, more often',

  // ---- takvim ve temalar
  'Hafta Sonu': 'Weekend', 'Verimlilik Haftası': 'Efficiency Week', 'Şans Haftası': 'Luck Week', 'Sipariş Haftası': 'Order Week', 'Görev Haftası': 'Mission Week',
  'Altın Kasa %50 daha sık': 'Golden Crates 50% more often', 'Acil Sipariş ödülü +%50': 'Rush Order reward +50%', 'Günlük görev ödülleri +%50': 'Daily mission rewards +50%',
  'Klasik': 'Classic', 'Şeker Dünyası': 'Candy World', 'Neon Şehir': 'Neon City', 'Altın Çağ': 'Golden Age',

  // ---- rozet adları
  'İlk Parça': 'First Piece', 'Seri Üretim': 'Mass Production', 'Fabrika Ruhu': 'Factory Spirit', 'Parmak Isınması': 'Finger Warm-up', 'Tıkır Tıkır': 'Click Clack',
  'Çelik Parmaklar': 'Steel Fingers', 'Tezgahtar': 'Shopkeeper', 'Toptancı': 'Wholesaler', 'Ticaret İmparatoru': 'Trade Emperor', 'Harçlık': 'Pocket Money', 'Milyoner': 'Millionaire',
  'Milyarder': 'Billionaire', 'Trilyoner': 'Trillionaire', 'Servet Avcısı': 'Fortune Hunter', 'Evren Zengini': 'Richest in the Universe', 'Çırak': 'Apprentice', 'Kalfa': 'Journeyman',
  'Usta': 'Master', 'Otomasyon Merakı': 'Automation Buff', 'Robot Ordusu': 'Robot Army', 'Tam Otomasyon': 'Full Automation', 'Küçük Girişim': 'Small Venture', 'Büyüyen İş': 'Growing Business',
  'Fabrika Patronu': 'Factory Boss', 'Yeni Ufuklar': 'New Horizons', 'Ay Yolcusu': 'Moon Traveler', 'Evren Gezgini': 'Universe Wanderer', 'Akan Para': 'Flowing Money',
  'Para Yağmuru': 'Money Rain', 'Altın Nehir': 'Golden River', 'Sonsuz Kaynak': 'Endless Source', 'Usta Mühendis': 'Master Engineer', 'Yüzlük': 'Centurion',
  'Mühendis Dehası': 'Engineering Genius', 'Şanslı': 'Lucky', 'Hazine Avcısı': 'Treasure Hunter', 'Yeniden Doğuş': 'Rebirth', 'Bitmeyen Döngü': 'Endless Cycle',
  'Fabrika Anka Kuşu': 'Factory Phoenix', 'Yıldız Tozu': 'Stardust', 'Takım Yıldızı': 'Constellation', 'Samanyolu': 'Milky Way', 'Acil Servis': 'Emergency Service',
  'Hızlı Teslimat': 'Fast Delivery', 'Kurye Efsanesi': 'Courier Legend', 'Görev Adamı': 'Task Runner', 'Düzenli Çalışan': 'Regular Worker', 'Vardiya Şefi': 'Shift Chief',
  'Sadık Çalışan': 'Loyal Worker', 'Olay Yönetimi': 'Event Handling', 'Kriz Yöneticisi': 'Crisis Manager', 'İlk Çalışan': 'First Hire', 'İK Müdürü': 'HR Manager', 'Dev Kadro': 'Huge Staff',
  'Laboratuvar Önlüğü': 'Lab Coat', 'Baş Bilim İnsanı': 'Chief Scientist', 'Koleksiyoncu': 'Collector', 'Katalog Ustası': 'Catalog Master', 'Tam Katalog': 'Full Catalog',
  'Kozmik Çekirdek': 'Cosmic Core', 'Galaksiler Ötesi': 'Beyond Galaxies',

  // ---- görev başlıkları (sabit)
  'İlk yükseltmeni satın al': 'Buy your first upgrade', 'Bir makineyi otomatikleştir': 'Automate a machine', 'İlk Altın Kasayı yakala': 'Catch your first Golden Crate',
  'Fabrikayı ilk kez yenile': 'Renovate the factory for the first time',

  // ---- ana ekran, dock, bildirimler
  'Fabrika Sv.': 'Factory Lv.', 'Sv.': 'Lv.', 'Makine Al': 'Buy', 'Geliştir': 'Upgrade', 'Görevler': 'Quests', 'Bölgeler': 'Zones', 'Patent': 'Patent',
  'YÜKSELT': 'LEVEL UP', 'MAKS': 'MAX', 'gerek': 'needed', 'Bölge aç': 'Unlock zone', 'Tamam': 'OK', 'Elle': 'Manual', '/ürün': '/item', '/sn': '/s', 'Otomasyon!': 'Automation!',
  'sn': 's', 'dk': 'm', 'sa': 'h', 'saat': 'hours', 'gün': 'd', 'kaldı': 'left', 'boyunca yoktun': 'away',
  'Başlamak için dokun': 'Tap to start', 'SİPARİŞ': 'ORDER', 'Elle çalışır': 'Manual',
  'Alım miktarı': 'Purchase amount', 'Günlük hediye': 'Daily gift', 'Ayarlar': 'Settings', 'Fabrika Merkezi': 'Factory Hub', 'Acil Sipariş': 'Rush Order', 'Fabrika olayı': 'Factory event',
  'Önceki bölge': 'Previous zone', 'Sonraki bölge': 'Next zone', 'Kapat': 'Close', 'Fabrika': 'Factory', 'Fabrika kartı': 'Factory card',
  'Yükselt: makine daha çok kazandırır!': 'Level up: the machine earns more!',
  'Geliştir → Otomasyon: makine kendi kendine çalışsın!': 'Upgrade → Automation: let the machine run by itself!',
  'Yeni makine al, fabrikan büyüsün!': 'Buy a new machine and grow your factory!', 'Görev ödülünü topla!': 'Collect your quest reward!', 'Yeni bir bölge açabilirsin!': 'You can unlock a new zone!',
  'Yeni makine için bir sonraki bölgeyi aç!': 'Unlock the next zone for a new machine!', 'Tüm makineler alındı!': 'All machines bought!', 'Bant dolu! Depolamayı geliştir.': 'Belt is full! Upgrade storage.',
  'Önce önceki makineyi satın al.': 'Buy the previous machine first.', 'Bu bölge kilitli.': 'This zone is locked.',
  'Elektrik kesintisi! Üstteki banda dokunarak onar.': 'Power outage! Tap the banner above to repair.',
  'Otomasyon açıldı!': 'Automation enabled!', 'Altın Kasa belirdi! Yakala!': 'A Golden Crate appeared! Catch it!', 'Patent Laboratuvarı açıldı! Fabrikanı yenileyebilirsin.': 'Patent Lab unlocked! You can renovate your factory.',
  'Görev tamamlandı! Ödülünü al.': 'Quest complete! Claim your reward.', 'Yeterli paran yok!': 'Not enough money!', 'Yeterli Yıldız yok!': 'Not enough Stars!',
  'Yeterli araştırma puanı yok!': 'Not enough research points!', 'Önce ön koşul düğümünü yükselt!': 'Upgrade the prerequisite node first!', 'Yapılamaz': 'Not possible',
  'Günlük görev tamamlandı!': 'Daily mission complete!', 'Hedefler → Günlük': 'Goals → Daily', 'Günün sandığı açıldı!': "Today's chest opened!",
  'Acil Sipariş!': 'Rush Order!', 'Ödül': 'Reward', 'Sipariş teslim edildi!': 'Order delivered!', 'Sipariş kaçtı… Bir sonrakinde yakala!': 'Order missed… Catch the next one!',
  'Üstteki banda hızlıca dokunup onar': 'Tap the banner above quickly to repair', 'Elektrik kesintisi!': 'Power outage!', 'VIP müşteri geldi!': 'A VIP customer arrived!',
  'Gelir x3 · 15 sn': 'Income x3 · 15 s', 'Talep patlaması!': 'Demand surge!', 'Gelir x2 · 45 sn': 'Income x2 · 45 s', 'Elektrik geri geldi!': 'Power is back!',
  'Elektrik kendiliğinden geri geldi': 'Power came back by itself', 'Yeni çalışan işe alındı!': 'New staff hired!', 'Araştırma tamamlandı!': 'Research complete!',
  'Katalog eşiği tamamlandı!': 'Catalog milestone complete!', 'Kayıt yapılamadı (depolama dolu/kapalı)': 'Could not save (storage full/disabled)',
  'Kayıt yüklenemedi (depolama dolu/kapalı)': 'Could not load the save (storage full/disabled)', 'Kayıt yedekten kurtarıldı': 'Save recovered from backup',
  'Kayıt okunamadı, yeni oyun başladı': 'Save could not be read, new game started', 'Makineye dokunarak üretimi hızlandır!': 'Tap the machine to speed up production!',
  'Fabrika yenilendi!': 'Factory renovated!', 'kazandın': 'earned',
  'KESİNTİ! Sigortaya dokun': 'OUTAGE! Tap the fuse box', 'VIP MÜŞTERİ': 'VIP CUSTOMER', 'TALEP PATLAMASI': 'DEMAND SURGE', 'gelir': 'income', 'KESİNTİ': 'OUTAGE', 'ONARILDI!': 'REPAIRED!',

  // ---- sahne (canvas)
  'DOKUN!': 'TAP!', 'BANT DOLU': 'BELT FULL', 'Önceki makineyi yükselt': 'Upgrade the previous machine', 'Daha fazla para biriktir': 'Save up more money', 'YENİ MAKİNE!': 'NEW MACHINE!',
  'OTOMATİK!': 'AUTOMATED!', 'SEVİYE': 'LEVEL', 'SİPARİŞ!': 'ORDER!', 'TESLİM EDİLDİ!': 'DELIVERED!', 'COŞKU x3!': 'FRENZY x3!', 'ZİNCİR': 'CHAIN',

  // ---- paneller: yükseltmeler
  'Hedefler': 'Goals', 'Fabrika Bölgeleri': 'Factory Zones', 'Patent Laboratuvarı': 'Patent Lab', 'İstatistikler': 'Statistics', 'Çalışanlar': 'Staff', 'Ürün Kataloğu': 'Product Catalog',
  'Temalar': 'Themes', 'Etkinlikler': 'Events', 'Ar-Ge': 'R&D', 'Katalog': 'Catalog',
  '+%30 ürün değeri': '+30% item value', 'ürün değeri': 'item value', '(şu an': '(now', 'Bant kapasitesi': 'Belt capacity', 'Maksimum seviye': 'Max level',
  'Makine kendi kendine çalışıyor!': 'The machine runs by itself!', 'Dokunma gerektirmeden sürekli üretir': 'Produces continuously without tapping', 'AÇIK': 'ON', 'AL': 'GET', 'AÇ': 'OPEN',
  'Aktif görevler': 'Active quests', 'Tamamlanan': 'Completed', 'Günlük': 'Daily', 'Rozetler': 'Badges', 'Rozet': 'Badges',
  'Yeni bir bölgeyi açmak için önceki bölgedeki tüm makineleri satın almalısın.': 'To unlock a new zone you must buy all machines in the previous zone.',
  'Buradasın': 'You are here', 'BURADA': 'HERE', 'GİT': 'GO', 'Açmaya hazır!': 'Ready to unlock!', 'Önce önceki bölgeyi tamamla': 'Finish the previous zone first', 'Makineler': 'Machines',

  // ---- günlük görevler / rozetler
  'Günlük görevler': 'Daily missions', 'Günün Sandığı': "Today's Chest", 'Ödül alındı': 'Reward claimed', 'Bugünkü sandık açıldı': "Today's chest opened",

  // ---- ayarlar
  'Ses efektleri': 'Sound effects', 'Müzik': 'Music', 'Titreşim': 'Vibration', 'Kayıt Kodu (Yedekle / Yükle)': 'Save Code (Backup / Load)',
  'Kayıt kodu ile ilerlemeni telefon ve bilgisayar arasında taşıyabilirsin.': 'You can move your progress between phone and computer with the save code.',
  'İlerlemeyi Sıfırla': 'Reset Progress', 'Her şey silinecek!': 'Everything will be deleted!', 'Tüm ilerlemen kalıcı olarak silinir. Emin misin?': 'All your progress will be permanently deleted. Are you sure?',
  'Evet, sıfırla': 'Yes, reset', 'Vazgeç': 'Cancel',
  'Kayıt Kodu': 'Save Code', 'Bu kodu kopyala. Başka bir cihazda “Kodu Yükle” ile ilerlemeni aktarabilirsin.': 'Copy this code. On another device use “Load Code” to transfer your progress.',
  'Kodu Yükle': 'Load Code', 'Kopyala': 'Copy', 'Kopyalandı!': 'Copied!', 'Kodu elle seçip kopyala': 'Select and copy the code manually', 'Yükle': 'Load',
  'Başka cihazdan aldığın kayıt kodunu yapıştır. Mevcut ilerlemenin üzerine yazılır.': 'Paste the save code from your other device. It overwrites your current progress.',
  'Kod eksik ya da bozuk': 'Code is incomplete or corrupted', 'Geçersiz kayıt kodu': 'Invalid save code', 'İlerlemenin üzerine yazılsın?': 'Overwrite your progress?',
  'Şu anki ilerlemen silinir ve koddaki kayıt yüklenir.': 'Your current progress is deleted and the save from the code is loaded.',

  // ---- istatistikler
  'Oynama süresi': 'Play time', 'Fabrika seviyesi': 'Factory level', 'Üretilen ürün': 'Items produced', 'Satılan ürün': 'Items sold', 'Toplam kazanç': 'Total earnings',
  'Bu koşudaki kazanç': 'Earnings this run', 'En yüksek gelir': 'Highest income', 'Dokunuş': 'Taps', 'Yükseltme': 'Upgrades', 'Altın Kasa': 'Golden Crate', 'Günlük görev': 'Daily missions',
  'Yenileme': 'Renovations', 'Çevrimdışı kazanç': 'Offline earnings', 'Başlangıç': 'Started',

  // ---- patent laboratuvarı
  'Patent Laboratuvarı kilitli': 'Patent Lab locked', 'Açılması için bu koşuda': 'To unlock, earn', 'kazan.': 'this run.', 'Sonra fabrikanı yenileyip kalıcı': 'Then renovate to earn permanent',
  'Patent Yıldızı': 'Patent Stars', ' kazanırsın: her yıldız': '. Each star gives', 'gelir ve güçlü kalıcı geliştirmeler.': 'income and powerful permanent upgrades.',
  'Fabrikayı yenile?': 'Renovate the factory?', 'Para, makineler ve bölgeler sıfırlanır. Görevler, yıldızlar ve patentler kalır.': 'Money, machines and zones are reset. Quests, stars and patents stay.',
  'kazanırsın (gelir çarpanı': 'you gain (income multiplier', 'Yenile!': 'Renovate!',
  'Patentler (Yıldızla alınır)': 'Patents (bought with Stars)', 'Açılınca alabileceklerin': 'What you can buy once unlocked', 'Gelir çarpanı': 'Income multiplier', 'Toplam': 'Total',
  'Bu koşuda kazanç:': 'Earnings this run:', 'FABRİKAYI YENİLE': 'RENOVATE FACTORY', 'Fabrikayı yenile (kilitli)': 'Renovate factory (locked)',
  'İlerleme sıfırlanır, kalıcı bonus kazanırsın': 'Progress resets, you gain a permanent bonus', 'KİLİTLİ': 'LOCKED',
  'Daha fazla Patent Yıldızı biriktirmelisin': 'You need to collect more Patent Stars', 'Galaktik Genişleme?': 'Galactic Expansion?',
  'Yıldızlar, patentler, çalışanlar ve fabrika sıfırlanır. Rozetler, Ar-Ge ve katalog kalır.': 'Stars, patents, staff and the factory are reset. Badges, R&D and the catalog stay.',
  ': her çekirdek geliri': ': each core raises income by', ' artırır ve yıldızların etkisini': ' and boosts star effect by', ' güçlendirir.': '.', 'Genişle!': 'Expand!',
  'Kozmik Çekirdek:': 'Cosmic Core:', 'Yıldız etkisi': 'Star effect', 'Ömür boyu yıldız': 'Lifetime stars', 'GALAKTİK GENİŞLEME': 'GALACTIC EXPANSION',
  'Galaktik Genişleme (kilitli)': 'Galactic Expansion (locked)', 'Yıldızlar ve patentler sıfırlanır, çekirdek kazanırsın': 'Stars and patents reset, you gain cores',

  // ---- merkez ve alt paneller
  '‹ Merkez': '‹ Hub', 'Toplam seviye': 'Total level', 'makine gerekli': 'machines needed', 'puan': 'points', 'eşik': 'milestones', 'aktif': 'active', 'Resim olarak paylaş': 'Share as image',
  'Fabrika Kartı': 'Factory Card', 'Paylaş': 'Share', 'Resim oluşturulamadı': 'Could not create the image', 'Resim indirildi': 'Image downloaded',
  'Çalışanlar kilitli': 'Staff locked', 'En az': 'Build at least', 'kurunca işe alım başlar.': 'to start hiring.', 'İŞE AL': 'HIRE',
  'Çalışanlar para ile işe alınır; fabrikayı yenilediğinde ayrılırlar. Fiyatlar gelirinle birlikte büyür.': 'Staff are hired with money and leave when you renovate the factory. Prices grow with your income.',
  'Araştırma Puanı': 'Research Points', 'Toplam kazanılan': 'Total earned', 'sonraki puan:': 'next point:', 'ürün daha': 'items to go', 'Kilitli:': 'Locked:',
  'Araştırma puanı toplam üretimden gelir ve kalıcıdır (yeniden doğuşta korunur). Bir dalda ilerlemek için önceki düğümü yükseltmelisin.':
    'Research points come from total production and are permanent (kept on renovation). Upgrade the previous node to progress in a branch.',
  'satıldı': 'sold', 'Kullanılıyor': 'In use', 'Açık': 'Unlocked', 'SEÇ': 'SELECT', 'SEÇİLİ': 'SELECTED',
  'Temalar rozet kazandıkça açılır ve yalnızca görünümü değiştirir.': 'Themes unlock as you earn badges and only change the look.',
  'Şu an aktif': 'Active now', 'Fabrika olayları': 'Factory events', 'Talep Patlaması': 'Demand Surge', 'VIP Müşteri': 'VIP Customer', 'Elektrik Kesintisi': 'Power Outage',
  'Bir süre boyunca gelirin x2 olur.': 'Your income is x2 for a while.', 'Kısa süreliğine gelirin x3 olur.': 'Your income is x3 for a short time.',
  'Üretim durur. Üstteki banda 8 kez dokunarak onar, ödül kazan.': 'Production stops. Tap the banner above 8 times to repair it and earn a reward.',
  'Atlattığın fabrika olayı:': 'Factory events survived:', 'Olaylar rastgele aralıklarla gelir; çevrimdışıyken beklemez.': 'Events arrive at random intervals and do not wait while you are offline.',

  // ---- pencereler
  'Günlük hediye alındı': 'Daily gift claimed', 'Yarın tekrar gel, seri devam etsin!': 'Come back tomorrow to keep your streak!', 'Günlük Hediye': 'Daily Gift', 'Başla!': 'Start!',
  'Fabrikan çalışmaya devam etti!': 'Your factory kept working!', 'Çevrimdışı kazanç:': 'Offline earnings:', 'TOPLA': 'COLLECT', 'Sen de kendi fabrikanı kur!': 'Build your own factory!',
  'Gelir/sn': 'Income/s', 'Gelir': 'Income',
};
export const PHRASES = P;
