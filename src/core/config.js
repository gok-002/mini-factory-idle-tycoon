// Merkezi oyun verisi. Ekonomiyi dengelemek için yalnızca bu dosyayı düzenlemek yeterli.
// Yeni makine eklemek = MACHINES dizisine bir satır eklemek (sıra = satın alma sırası).

import { formatNum } from './format.js';

export const SAVE_VERSION = 2;
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

export const THEMES = {
  classic: { name: 'Klasik' }, // kozmetik temalar için ayrılmış yer (bkz. docs/MONETIZATION.md)
};
