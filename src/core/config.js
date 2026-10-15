// Merkezi oyun verisi. Ekonomiyi dengelemek için yalnızca bu dosyayı düzenlemek yeterli.
// Yeni makine eklemek = MACHINES dizisine bir satır eklemek (sıra = satın alma sırası).

import { formatNum } from './format.js';

export const SAVE_VERSION = 4;
export const SAVE_KEY = 'miniFactory.save';

export const TUNING = {
  startMoney: 100,
  maxMoney: 1e300,
  maxLevel: 500,
  levelCostGrowth: 1.28,          // her seviyede maliyet çarpanı
  milestones: [10, 25, 50, 100, 150, 200, 300, 400, 500], // bu seviyelerde değer x2
  milestoneMult: 2,
  beltTravelTime: 2.2,            // ürünün banttan satış noktasına varış süresi (sn)
  baseStorage: 3,                 // banttaki ürün kapasitesi (başlangıç)
  maxStorage: 32,                 // çalışma zamanı tampon dizisi üst sınırı
  minCycleTime: 0.25,
  tapSecondsManual: 1.0,          // manuel makinede 1 dokunuş = 1 sn üretim ilerlemesi
  tapSecondsAuto: 0.5,            // otomatik makinede dokunuş bonusu
  autosaveSec: 10,
  maxFrameDt: 0.25,
  offline: {
    efficiency: 0.5,              // çevrimdışıyken kazancın yüzdesi
    capHours: 8,                  // en fazla bu kadar saat hesaplanır
    popupMinSeconds: 60,          // bundan kısa süreler için pencere gösterme (tam verimle işlenir)
  },
};

// Makine başına yükseltme kolları. cost = machine.upgradeCost * costMul * growth^seviye
export const UPGRADES = {
  speed:   { name: 'Üretim Hızı',  max: 12, costMul: 3,   growth: 2.4, perLevel: 0.9 },  // süre x0.9
  value:   { name: 'Ürün Değeri',  max: 15, costMul: 2.5, growth: 2.2, perLevel: 1.3 },  // değer x1.3
  storage: { name: 'Depolama',     max: 8,  costMul: 2,   growth: 3.0, perLevel: 2 },    // +2 ürün
};

export const ZONES = [
  { id: 'workshop',    name: 'Oyuncak Atölyesi',   unlockCost: 0,      deco: 'windows',  wall: '#7fb3e6', wall2: '#5d93cc', floor: '#e9d9bd', floor2: '#dcc9a6', belt: '#4a5568',
    story: 'Her büyük fabrika küçük bir atölyeyle başlar. İlk makineni çalıştır!' },
  { id: 'electronics', name: 'Elektronik Hattı',   unlockCost: 200000, deco: 'windows',  wall: '#8fd3c0', wall2: '#5fb5a0', floor: '#dfe6e3', floor2: '#cdd7d3', belt: '#3b4a52',
    story: 'Oyuncaklar yetmedi: devreler, çipler ve akıllı cihazlar üretme zamanı.' },
  { id: 'robotics',    name: 'Robot Fabrikası',    unlockCost: 2e7,    deco: 'windows',  wall: '#c9a4e8', wall2: '#a47fc9', floor: '#d9d6e2', floor2: '#c8c4d6', belt: '#40384f',
    story: 'Robotlar artık robot üretiyor. Fabrikan kendi kendini büyütmeye başladı.' },
  { id: 'moon',        name: 'Ay Üssü',            unlockCost: 4e10,   deco: 'stars',    wall: '#2b3a67', wall2: '#1b2650', floor: '#b9bfcf', floor2: '#a9afc2', belt: '#363b57',
    story: 'Dünya\'ya sığmıyoruz! Düşük yer çekimi, sonsuz alan: fabrikan Ay\'a taşındı.' },
  { id: 'crystal',     name: 'Kristal Madeni',     unlockCost: 4e12,   deco: 'crystals', wall: '#5a3f8f', wall2: '#3f2b6b', floor: '#cdbfe6', floor2: '#bcaed8', belt: '#3a2d58',
    story: 'Ayın altında parlayan bir kristal damarı bulundu. Enerji dolu ve çok değerli!' },
  { id: 'time',        name: 'Zaman Laboratuvarı', unlockCost: 4e14,   deco: 'clocks',   wall: '#c58a3e', wall2: '#9c6a28', floor: '#eadfc4', floor2: '#dccfae', belt: '#5a4524',
    story: 'Kristaller zamanı büküyor. Dün ürettiklerini bugün sat, yarın bile!' },
  { id: 'quantum',     name: 'Kuantum Çekirdeği',  unlockCost: 4e16,   deco: 'neon',     wall: '#12332f', wall2: '#0c2422', floor: '#9fd6c8', floor2: '#8cc5b6', belt: '#16403a',
    story: 'Atomaltı parçacıklar senin için çalışıyor. Ürünlerin aynı anda her yerde!' },
  { id: 'galaxy',      name: 'Galaktik Merkez',    unlockCost: 4e18,   deco: 'galaxy',   wall: '#1a0f3a', wall2: '#0f0826', floor: '#b8a6e8', floor2: '#a794d8', belt: '#2a1d5a',
    story: 'Yıldızlar senin dökümhanen, kara delikler depon. Evrenin en büyük fabrikasına hoş geldin!' },
];

// kind: çizim stili, product: ürün şekli. zone: ZONES indeksi.
// İlk 9 makine elle ayarlıdır; sonrakiler aşağıda formülle üretilir (maliyet x7, değer x7 her makinede).
const HAND = [
  { id: 'press',     name: 'Blok Presi',        zone: 0, kind: 'press',   product: 'block', color: '#ff8a3d', baseCost: 0,      baseTime: 3, baseValue: 10,     upgradeCost: 75,      autoCost: 150 },
  { id: 'painter',   name: 'Boyama Kabini',     zone: 0, kind: 'painter', product: 'ball',  color: '#ec4f8c', baseCost: 400,    baseTime: 4, baseValue: 42,     upgradeCost: 320,     autoCost: 900 },
  { id: 'assembler', name: 'Montaj Kolu',       zone: 0, kind: 'arm',     product: 'bot',   color: '#3fb6a8', baseCost: 3500,   baseTime: 5, baseValue: 210,    upgradeCost: 2600,    autoCost: 7000 },
  { id: 'printer',   name: 'Devre Basıcı',      zone: 1, kind: 'printer', product: 'chip',  color: '#4f8fe8', baseCost: 300000,  baseTime: 6, baseValue: 1300,   upgradeCost: 60000,   autoCost: 275000 },
  { id: 'welder',    name: 'Lehim Robotu',      zone: 1, kind: 'welder',  product: 'gear',  color: '#f2b035', baseCost: 2.25e6, baseTime: 7, baseValue: 7500,   upgradeCost: 420000,  autoCost: 2e6 },
  { id: 'scanner',   name: 'Kalite Tarayıcı',   zone: 1, kind: 'scanner', product: 'box',   color: '#8a6fe0', baseCost: 1.6e7,  baseTime: 8, baseValue: 46000,  upgradeCost: 3e6,     autoCost: 1.5e7 },
  { id: 'forge',     name: 'Titan Presi',       zone: 2, kind: 'press',   product: 'gear',  color: '#e0524f', baseCost: 1.25e8,  baseTime: 9, baseValue: 300000, upgradeCost: 2.1e7,     autoCost: 1e8 },
  { id: 'chromer',   name: 'Krom Kaplama',      zone: 2, kind: 'painter', product: 'ball',  color: '#6c7a9c', baseCost: 1e9,    baseTime: 10, baseValue: 2e6,   upgradeCost: 1.5e8,     autoCost: 7.5e8 },
  { id: 'robotarm',  name: 'Robot Kol Hattı',   zone: 2, kind: 'arm',     product: 'bot',   color: '#2fc46b', baseCost: 8e9,  baseTime: 12, baseValue: 1.4e7, upgradeCost: 1.05e9,   autoCost: 5.5e9 },
];

const NEW_MACHINES = [
  ['lunarpress', 'Ay Presi',               3, 'press',   'box',       '#9aa5c9'],
  ['fuelmix',    'Yakıt Karıştırıcı',      3, 'painter', 'orb',       '#ff8a5c'],
  ['rocketasm',  'Roket Montajı',          3, 'arm',     'rocket',    '#e8505b'],
  ['crusher',    'Kristal Kırıcı',         4, 'press',   'crystal',   '#c77dff'],
  ['polisher',   'Prizma Parlatıcı',       4, 'welder',  'crystal',   '#4cc9f0'],
  ['gemscan',    'Mücevher Tarayıcı',      4, 'scanner', 'crystal',   '#f72585'],
  ['gearcast',   'Zaman Dişlisi Dökümü',   5, 'press',   'gear',      '#e9b44c'],
  ['sandfill',   'Kum Saati Dolumu',       5, 'painter', 'hourglass', '#f4a261'],
  ['paradox',    'Paradoks Kolu',          5, 'arm',     'hourglass', '#2a9d8f'],
  ['qprinter',   'Kuantum Basıcı',         6, 'printer', 'orb',       '#06d6a0'],
  ['photon',     'Foton Kaynakçı',         6, 'welder',  'star',      '#ffd166'],
  ['particle',   'Parçacık Tarayıcı',      6, 'scanner', 'orb',       '#118ab2'],
  ['starforge',  'Yıldız Dökümü',          7, 'reactor', 'star',      '#ff9f1c'],
  ['blackhole',  'Kara Delik Portalı',     7, 'portal',  'orb',       '#9d4edd'],
  ['universe',   'Evren Montajı',          7, 'reactor', 'star',      '#ef476f'],
];

export const COST_RATIO = 7;
export const VALUE_RATIO = 7;

function genMachines() {
  const out = HAND.slice();
  let cost = HAND[HAND.length - 1].baseCost, value = HAND[HAND.length - 1].baseValue;
  NEW_MACHINES.forEach(([id, name, zone, kind, product, color], n) => {
    cost *= COST_RATIO; value *= VALUE_RATIO;
    const k = HAND.length + n;
    out.push({ id, name, zone, kind, product, color,
      baseCost: cost, baseTime: Math.min(20, 12 + (k - 8)), baseValue: value, upgradeCost: cost * 0.14, autoCost: cost * 0.7 });
  });
  return out;
}
export const MACHINES = genMachines();
// Yeni bölgelerin açma bedeli, bölgenin ilk makinesinin fiyatına bağlıdır.
ZONES.forEach((z, zi) => { if (zi >= 3) z.unlockCost = Math.round(0.4 * MACHINES.find((m) => m.zone === zi).baseCost); });

// Bir makineyi satın almak için bir önceki makinenin ulaşması gereken seviye.
export function machineReq(i) {
  return i <= 0 ? 0 : Math.min(60, 6 + 3 * i);
}

export const SLOTS_PER_ZONE = 3;

// ---------------------------------------------------------------- görev merdivenleri
// Her merdiven (series) aynı anda yalnızca sıradaki görevi gösterir. reward: sabit para ve/veya saniyelik gelir (büyük olan).
export const QUESTS = [];
const L = (series, metric, title, rungs, extra = {}) => {
  rungs.forEach(([target, id, money = 0, secs = 0]) => {
    QUESTS.push({ id: id || series + '_' + target, series, metric, target, title: title(target), reward: { money, secs }, ...extra });
  });
};
const sec = (i) => Math.round(60 * Math.pow(1.7, i));

L('produced', 'produced', (t) => `${formatNum(t)} ürün üret`,
  [[10, 'produce10', 40], [100, 0, 150, 30], [1e3, 0, 500, 60], [1e4, 0, 0, 180], [1e5, 0, 0, 400], [1e6, 0, 0, 900], [1e7, 0, 0, 1800]]);
L('sold', 'sold', (t) => `Toplam ${formatNum(t)} ürün sat`,
  [[100, 'sell100', 150], [1e3, 'sell1000', 800, 90], [1e4, 0, 0, 200], [1e5, 0, 0, 450], [1e6, 0, 0, 900], [1e7, 0, 0, 1800], [1e8, 0, 0, 3600]]);
L('upgrades', 'upgrades', (t) => t === 1 ? 'İlk yükseltmeni satın al' : `${formatNum(t)} yükseltme satın al`,
  [[1, 'upgrade1', 60], [10, 0, 250, 20], [50, 0, 0, 120], [200, 0, 0, 400], [1000, 0, 0, 1200], [3000, 0, 0, 2400]]);
L('automations', 'automations', (t) => t === 1 ? 'Bir makineyi otomatikleştir' : `${t} makineyi otomatikleştir`,
  [[1, 'auto1', 100], [3, 0, 600, 120], [6, 0, 0, 300], [12, 0, 0, 800], [18, 0, 0, 1800], [24, 0, 0, 3600]]);
L('machines', 'machines', (t) => `${t}. makineyi satın al`,
  [[2, 'machine2', 300, 30], [3, 'machine3', 1500, 90], [5, 0, 0, 240], [8, 0, 0, 480], [12, 0, 0, 900], [16, 0, 0, 1800], [20, 0, 0, 3000], [24, 0, 0, 6000]]);
L('income', 'maxIncome', (t) => `Saniyelik geliri ${formatNum(t)} yap`,
  [[10, 'income10', 200, 30], [500, 'income500', 3000, 120], [1e4, 0, 0, 200], [1e5, 0, 0, 300], [1e6, 'income1m', 2e7, 600], [1e7, 0, 0, 700], [1e8, 0, 0, 900],
    [1e9, 0, 0, 1200], [1e10, 0, 0, 1500], [1e12, 0, 0, 1800], [1e14, 0, 0, 2400], [1e16, 0, 0, 3000], [1e18, 0, 0, 3600], [1e20, 0, 0, 4200], [1e22, 0, 0, 5000], [1e24, 0, 0, 6000]]);
L('level', 'maxLevel', (t) => `Bir makineyi Sv.${t} yap`,
  [[10, 'level10', 400, 60], [25, 'level25', 5000, 180], [50, 0, 0, 400], [100, 0, 0, 900], [150, 0, 0, 1800], [200, 0, 0, 3600], [300, 0, 0, 7200]]);
L('zones', 'zones', (t) => `${ZONES[t - 1].name} bölgesini aç`,
  [[2, 'zone2', 20000, 120], [3, 'zone3', 5e6, 300], [4, 0, 0, 600], [5, 0, 0, 900], [6, 0, 0, 1200], [7, 0, 0, 1800], [8, 0, 0, 2400]]);
L('earned', 'earned', (t) => `Toplam ${formatNum(t)} kazan`,
  [[1e6, 'earn1m', 50000, 240], [1e9, 0, 0, 300], [1e12, 0, 0, 500], [1e15, 0, 0, 800], [1e18, 0, 0, 1200], [1e21, 0, 0, 1800], [1e24, 0, 0, 2400], [1e27, 0, 0, 3600]]);
L('taps', 'taps', (t) => `${formatNum(t)} kez dokun`,
  [[50, 0, 100, 10], [500, 0, 0, 60], [2500, 0, 0, 150], [10000, 0, 0, 400], [50000, 0, 0, 1000]]);
L('golden', 'golden', (t) => t === 1 ? 'İlk Altın Kasayı yakala' : `${t} Altın Kasa yakala`,
  [[1, 0, 200, 30], [5, 0, 0, 120], [25, 0, 0, 400], [100, 0, 0, 1200], [300, 0, 0, 3000]]);
L('prestige', 'prestiges', (t) => t === 1 ? 'Fabrikayı ilk kez yenile' : `Fabrikayı ${t} kez yenile`,
  [[1, 0, 0, 600], [3, 0, 0, 1200], [10, 0, 0, 2400], [25, 0, 0, 4800], [100, 0, 0, 9600]]);
L('stars', 'totalStars', (t) => `Toplam ${formatNum(t)} Patent Yıldızı kazan`,
  [[5, 0, 0, 300], [25, 0, 0, 900], [100, 0, 0, 1800], [500, 0, 0, 3600], [2500, 0, 0, 7200]]);

// Bölüm (chapter) görevleri: bölge açıldıkça görünür.
ZONES.forEach((z, zi) => {
  const s = 'ch' + zi, mult = 1 + zi * 0.6;
  const r = (i) => Math.round(sec(i) * mult);
  QUESTS.push({ id: s + '_own', series: s, zone: zi, metric: 'zoneOwned', arg: zi, target: 3, title: `${z.name}: 3 makineyi de kur`, reward: { money: 0, secs: r(2) } });
  [15, 30, 60].forEach((lv, i) => QUESTS.push({ id: s + '_l' + lv, series: s, zone: zi, metric: 'zoneMin', arg: zi, target: lv, title: `${z.name}: tüm makineleri Sv.${lv} yap`, reward: { money: 0, secs: r(3 + i * 1.5) } }));
});

// ---------------------------------------------------------------- Yeniden doğuş (prestij)
export const PRESTIGE = {
  base: 2e9,            // yıldız = floor(sqrt(buKoşuKazancı / base))
  exponent: 0.5,
  starBonus: 0.10,      // toplam yıldız başına +%10 gelir
  minGain: 1,
};

// Patent Laboratuvarı: Yıldızla alınan kalıcı geliştirmeler. cost = ceil(base * growth^seviye)
export const PATENTS = [
  { id: 'income',   name: 'Mühendislik Ödülü',   desc: '+%20 gelir',                         max: 40, base: 2, growth: 1.5 },
  { id: 'offcap',   name: 'Gece Vardiyası',      desc: 'Çevrimdışı süre sınırı +2 saat',     max: 10, base: 3, growth: 1.7 },
  { id: 'offeff',   name: 'Otomatik Müdür',      desc: 'Çevrimdışı verim +%5',               max: 10, base: 4, growth: 1.8 },
  { id: 'tap',      name: 'Usta Dokunuş',        desc: 'Dokunuş gücü +0,25 sn',              max: 10, base: 2, growth: 1.6 },
  { id: 'discount', name: 'Toptan Alım',         desc: 'Makine fiyatları -%4',               max: 10, base: 5, growth: 1.9 },
  { id: 'heritage', name: 'Miras Makineler',     desc: 'Yeni koşuya +2 hazır otomatik makine', max: 11, base: 6, growth: 2.2 },
  { id: 'golden',   name: 'Altın Kasa Çağrısı',  desc: 'Altın Kasa %10 daha sık gelir',      max: 8,  base: 3, growth: 1.7 },
];

export const GOLDEN = {
  minInterval: 70, maxInterval: 160, ttl: 12,
  rewardSecsMin: 40, rewardSecsMax: 100,
  frenzyChance: 0.18, frenzyMult: 3, frenzySecs: 20,
};

// Günlük hediye: gelirin kaç saniyesi (7. gün + 1 Yıldız).
export const DAILY = { secs: [300, 600, 900, 1200, 1800, 2700, 7200], minMoney: 500, starsOnLastDay: 1 };

// ---------------------------------------------------------------- Rozetler (başarımlar)
// Her rozet kalıcıdır, ödül olarak gelire ACH_BONUS kadar kalıcı çarpan ekler (yeniden doğuşta korunur).
export const ACH_BONUS = 0.01;
const ACH_DESC = {
  produced:     (n) => `${formatNum(n)} ürün üret`,
  taps:         (n) => `${formatNum(n)} kez dokun`,
  sold:         (n) => `Toplam ${formatNum(n)} ürün sat`,
  earned:       (n) => `Toplam ${formatNum(n)} kazan`,
  upgrades:     (n) => `${formatNum(n)} yükseltme satın al`,
  automations:  (n) => `${n} makineyi otomatikleştir`,
  machines:     (n) => `${n} makine kur`,
  zones:        (n) => `${n} bölge aç`,
  maxIncome:    (n) => `Saniyelik geliri ${formatNum(n)} yap`,
  maxLevel:     (n) => `Bir makineyi Sv.${n} yap`,
  golden:       (n) => `${n} Altın Kasa yakala`,
  prestiges:    (n) => `Fabrikayı ${n} kez yenile`,
  totalStars:   (n) => `Toplam ${formatNum(n)} Patent Yıldızı kazan`,
  rushDone:     (n) => `${n} Acil Sipariş tamamla`,
  missionsDone: (n) => `${n} günlük görev tamamla`,
  dailyStreak:  (n) => `Günlük hediyede ${n} günlük seri yap`,
  eventsDone:   (n) => `${n} fabrika olayı atlat`,
  staffTotal:   (n) => `Çalışanlara toplam ${n} seviye ver`,
  rdTotal:      (n) => `Ar-Ge'de toplam ${n} seviye aç`,
  catalogTiers: (n) => `Katalogda ${n} eşik tamamla`,
  cores:        (n) => `${n} Kozmik Çekirdek kazan`,
};
export const ACHIEVEMENTS = [];
const A = (metric, rungs) => rungs.forEach(([target, id, title], k) => ACHIEVEMENTS.push({
  id, metric, target, title, series: metric, tier: Math.min(3, k), desc: ACH_DESC[metric](target),
}));
A('produced',     [[1, 'a_prod1', 'İlk Parça'], [1e4, 'a_prod2', 'Seri Üretim'], [1e6, 'a_prod3', 'Fabrika Ruhu']]);
A('taps',         [[100, 'a_tap1', 'Parmak Isınması'], [2000, 'a_tap2', 'Tıkır Tıkır'], [20000, 'a_tap3', 'Çelik Parmaklar']]);
A('sold',         [[500, 'a_sold1', 'Tezgahtar'], [5e4, 'a_sold2', 'Toptancı'], [5e6, 'a_sold3', 'Ticaret İmparatoru']]);
A('earned',       [[1e3, 'a_earn1', 'Harçlık'], [1e6, 'a_earn2', 'Milyoner'], [1e9, 'a_earn3', 'Milyarder'], [1e12, 'a_earn4', 'Trilyoner'], [1e15, 'a_earn5', 'Servet Avcısı'], [1e21, 'a_earn6', 'Evren Zengini']]);
A('upgrades',     [[25, 'a_upg1', 'Çırak'], [250, 'a_upg2', 'Kalfa'], [2000, 'a_upg3', 'Usta']]);
A('automations',  [[3, 'a_auto1', 'Otomasyon Merakı'], [12, 'a_auto2', 'Robot Ordusu'], [24, 'a_auto3', 'Tam Otomasyon']]);
A('machines',     [[3, 'a_mach1', 'Küçük Girişim'], [12, 'a_mach2', 'Büyüyen İş'], [24, 'a_mach3', 'Fabrika Patronu']]);
A('zones',        [[2, 'a_zone1', 'Yeni Ufuklar'], [4, 'a_zone2', 'Ay Yolcusu'], [8, 'a_zone3', 'Evren Gezgini']]);
A('maxIncome',    [[1e3, 'a_inc1', 'Akan Para'], [1e6, 'a_inc2', 'Para Yağmuru'], [1e12, 'a_inc3', 'Altın Nehir'], [1e18, 'a_inc4', 'Sonsuz Kaynak']]);
A('maxLevel',     [[25, 'a_lvl1', 'Usta Mühendis'], [100, 'a_lvl2', 'Yüzlük'], [250, 'a_lvl3', 'Mühendis Dehası']]);
A('golden',       [[3, 'a_gold1', 'Şanslı'], [25, 'a_gold2', 'Hazine Avcısı'], [100, 'a_gold3', 'Altın Çağ']]);
A('prestiges',    [[1, 'a_pres1', 'Yeniden Doğuş'], [5, 'a_pres2', 'Bitmeyen Döngü'], [20, 'a_pres3', 'Fabrika Anka Kuşu']]);
A('totalStars',   [[5, 'a_star1', 'Yıldız Tozu'], [50, 'a_star2', 'Takım Yıldızı'], [500, 'a_star3', 'Samanyolu']]);
A('rushDone',     [[1, 'a_rush1', 'Acil Servis'], [10, 'a_rush2', 'Hızlı Teslimat'], [50, 'a_rush3', 'Kurye Efsanesi']]);
A('missionsDone', [[3, 'a_msn1', 'Görev Adamı'], [30, 'a_msn2', 'Düzenli Çalışan'], [150, 'a_msn3', 'Vardiya Şefi']]);
A('dailyStreak',  [[7, 'a_streak', 'Sadık Çalışan']]);
A('eventsDone',   [[1, 'a_evt1', 'Olay Yönetimi'], [25, 'a_evt2', 'Kriz Yöneticisi']]);
A('staffTotal',   [[1, 'a_staff1', 'İlk Çalışan'], [15, 'a_staff2', 'İK Müdürü'], [40, 'a_staff3', 'Dev Kadro']]);
A('rdTotal',      [[1, 'a_rd1', 'Laboratuvar Önlüğü'], [20, 'a_rd2', 'Baş Bilim İnsanı']]);
A('catalogTiers', [[1, 'a_cat1', 'Koleksiyoncu'], [10, 'a_cat2', 'Katalog Ustası'], [40, 'a_cat3', 'Tam Katalog']]);
A('cores',        [[1, 'a_core1', 'Kozmik Çekirdek'], [3, 'a_core2', 'Galaksiler Ötesi']]);

// ---------------------------------------------------------------- Günlük görevler
// Her gün (yerel takvim günü) havuzdan 3 görev seçilir; hepsi bitince sandık açılır.
// lo/hi: hedef aralığı. rate: hedef, mevcut üretim/gelirin 15 dakikalık karşılığı olarak ölçeklenir. needs: 'rush' -> Acil Sipariş açıkken, 'income' -> geliri olan oyuncuya (Altın Kasa yalnızca gelirle belirir).
export const MISSIONS = {
  count: 3, rateWindow: 900, chestSecs: 1500, chestMin: 3000,
  pool: [
    { id: 'tap',  metric: 'taps',     text: (n) => `${formatNum(n)} kez dokun`,          lo: 150, hi: 350, secs: 240, min: 300 },
    { id: 'upg',  metric: 'upgrades', text: (n) => `${n} yükseltme yap`,                lo: 5, hi: 12, secs: 300, min: 400 },
    { id: 'gold', metric: 'golden',   text: (n) => `${n} Altın Kasa yakala`,            lo: 1, hi: 3, secs: 300, min: 400, needs: 'income' },
    { id: 'rush', metric: 'rushDone', text: (n) => `${n} Acil Sipariş tamamla`,         lo: 1, hi: 2, secs: 420, min: 600, needs: 'rush' },
    { id: 'sell', metric: 'sold',     text: (n) => `${formatNum(n)} ürün sat`,          rate: 'items', floor: 40, secs: 240, min: 300 },
    { id: 'earn', metric: 'earned',   text: (n) => `${formatNum(n)} kazan`,             rate: 'income', floor: 2000, secs: 240, min: 300 },
  ],
};

// ---------------------------------------------------------------- Acil Sipariş
// Bir müşteri belirli bir makinenin ürününden kısa sürede N adet ister (aktif oyun için bonus; yok sayılabilir).
export const RUSH = {
  minSold: 150, minMachines: 2,
  ttl: 30,                          // sipariş süresi (sn)
  firstMin: 150, firstMax: 240,     // ilk siparişe kadar (sn)
  gapMin: 240, gapMax: 420,         // sonraki siparişe kadar (sn)
  factor: 1.8,                      // hedef = normal üretimin kaç katı
  minTarget: 3,
  rewardSecs: 100, rewardMin: 500,  // ödül = max(rewardMin, gelir x rewardSecs, ürün değeri x hedef x 3)
};

// ---------------------------------------------------------------- Çalışanlar
// Para ile işe alınır, her biri kalıcı (koşu boyunca) bir yetenek verir. Fiyat = max(gelirin 30 sn'si, son makinenin yarı fiyatı) x mul x growth^seviye.
export const STAFF_UNLOCK_MACHINES = 3;
export const STAFF = [
  { id: 'cashier', name: 'Kasiyer',            desc: 'Gelir +%4',                                   max: 15, mul: 2, growth: 1.55 },
  { id: 'night',   name: 'Gece Bekçisi',       desc: 'Çevrimdışı süre +1 saat',                     max: 8,  mul: 3, growth: 1.7 },
  { id: 'shift',   name: 'Vardiya Amiri',      desc: 'Çevrimdışı verim +%3',                        max: 10, mul: 3, growth: 1.6 },
  { id: 'tech',    name: 'Teknisyen',          desc: 'Altın Kasa\'yı kendiliğinden toplar (seviye arttıkça daha çabuk)', max: 5, mul: 5, growth: 2.0 },
  { id: 'sales',   name: 'Satış Müdürü',       desc: 'Acil Sipariş: ödül +%20, süre +3 sn',         max: 5,  mul: 4, growth: 1.9 },
  { id: 'coach',   name: 'Tezgahtar Eğitmeni', desc: 'Dokunuş gücü +0,1 sn',                        max: 10, mul: 2, growth: 1.5 },
];

// ---------------------------------------------------------------- Ar-Ge ağacı
// Araştırma puanı (AP) toplam üretimden gelir: floor(sqrt(üretilen / RESEARCH_DIV)). Düğüm maliyeti = ceil(base * growth^seviye).
export const RESEARCH_DIV = 50;
export const RESEARCH_BRANCHES = { eff: 'Verimlilik', auto: 'Otomasyon', luck: 'Şans' };
export const RESEARCH = [
  { id: 'r_inc1',  branch: 'eff',  name: 'Hassas Ölçüm',   desc: 'Gelir +%5',                        max: 5, base: 1, growth: 1.5 },
  { id: 'r_inc2',  branch: 'eff',  name: 'Kaizen',         desc: 'Gelir +%8',                        max: 5, base: 3, growth: 1.6, req: ['r_inc1', 2] },
  { id: 'r_disc',  branch: 'eff',  name: 'Yalın Üretim',   desc: 'Makine fiyatları -%3',             max: 5, base: 6, growth: 1.7, req: ['r_inc2', 2] },
  { id: 'r_tap',   branch: 'auto', name: 'Hızlı Eller',    desc: 'Dokunuş gücü +0,15 sn',            max: 5, base: 1, growth: 1.5 },
  { id: 'r_cap',   branch: 'auto', name: 'Gece Mesaisi',   desc: 'Çevrimdışı süre +2 saat',          max: 5, base: 3, growth: 1.6, req: ['r_tap', 2] },
  { id: 'r_eff',   branch: 'auto', name: 'Akıllı Bant',    desc: 'Çevrimdışı verim +%4',             max: 5, base: 6, growth: 1.7, req: ['r_cap', 2] },
  { id: 'r_gold',  branch: 'luck', name: 'Altın Radar',    desc: 'Altın Kasa %10 daha sık',          max: 5, base: 1, growth: 1.5 },
  { id: 'r_vault', branch: 'luck', name: 'Sağlam Kasa',    desc: 'Altın Kasa ödülü +%15',            max: 5, base: 3, growth: 1.6, req: ['r_gold', 2] },
  { id: 'r_rush',  branch: 'luck', name: 'Sipariş Ağı',    desc: 'Acil Sipariş ödülü +%20, daha sık', max: 5, base: 6, growth: 1.7, req: ['r_vault', 2] },
];

// ---------------------------------------------------------------- Zincir bonusu
// Aynı bölgede arka arkaya otomatik çalışan makineler birbirini besler: her bağlantı aşağı akıştaki makinenin değerine x(1+bonus) ekler.
export const CHAIN_BONUS = 0.10;

// ---------------------------------------------------------------- Ürün kataloğu
export const PRODUCT_NAMES = { block: 'Blok', ball: 'Top', bot: 'Robot', chip: 'Çip', gear: 'Dişli', box: 'Kutu', rocket: 'Roket', crystal: 'Kristal', star: 'Yıldız', orb: 'Küre', hourglass: 'Kum Saati' };
export const CATALOG_TIERS = [100, 1e3, 1e4, 1e5, 1e6];   // satılan adet eşikleri
export const CATALOG_BONUS = 0.004;                        // tamamlanan her eşik için kalıcı gelir bonusu

// ---------------------------------------------------------------- Galaktik Genişleme (ikinci prestij)
// Ömür boyu kazanılan Patent Yıldızı yeterliyse yıldızlar, patentler ve koşu sıfırlanır; Kozmik Çekirdek verir.
export const ASCEND = { need: 250, coreIncome: 0.5, coreStar: 0.5 };   // çekirdek başına gelir +%50 ve yıldız etkisi +%50

// ---------------------------------------------------------------- Rastgele fabrika olayları
export const EVENTS = {
  minSold: 300, firstMin: 240, firstMax: 420, gapMin: 420, gapMax: 780,
  types: [
    { id: 'surge',    weight: 3, secs: 45, mult: 2 },                   // Talep Patlaması: x2 gelir
    { id: 'vip',      weight: 2, secs: 15, mult: 3 },                   // VIP Müşteri: x3 gelir
    { id: 'blackout', weight: 2, secs: 25, taps: 8, rewardSecs: 60 },  // Elektrik Kesintisi: dokunarak onar
  ],
};

// ---------------------------------------------------------------- Takvim etkinlikleri (yerel saate göre)
export const CALENDAR = {
  weekend: { id: 'weekend', name: 'Hafta Sonu', desc: 'Gelir +%25', income: 1.25 },
  weeks: [
    { id: 'w_eff',  name: 'Verimlilik Haftası', desc: 'Gelir +%10',                      income: 1.10 },
    { id: 'w_luck', name: 'Şans Haftası',       desc: 'Altın Kasa %50 daha sık',         golden: 1.5 },
    { id: 'w_rush', name: 'Sipariş Haftası',    desc: 'Acil Sipariş ödülü +%50',         rush: 1.5 },
    { id: 'w_task', name: 'Görev Haftası',      desc: 'Günlük görev ödülleri +%50',      mission: 1.5 },
  ],
};

// ---------------------------------------------------------------- Kozmetik temalar (rozet sayısıyla açılır)
// tint: sahnenin üstüne bindirilen renk; belt: bant rengi; hue: makine/ürün renk kaydırma (derece).
export const THEMES = {
  classic: { name: 'Klasik',       badges: 0,  tint: null,                       belt: null,      hue: 0 },
  candy:   { name: 'Şeker Dünyası', badges: 5,  tint: 'rgba(255,140,200,.20)',    belt: '#b04a88', hue: 300 },
  night:   { name: 'Gece Vardiyası', badges: 12, tint: 'rgba(15,25,90,.42)',      belt: '#2d3a6b', hue: 0 },
  neon:    { name: 'Neon Şehir',   badges: 20, tint: 'rgba(0,255,210,.14)',       belt: '#0b4f48', hue: 150 },
  golden:  { name: 'Altın Çağ',    badges: 30, tint: 'rgba(255,196,60,.24)',      belt: '#7a5c10', hue: 40 },
};
