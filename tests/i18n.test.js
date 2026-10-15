import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ZONES, MACHINES, UPGRADES, PATENTS, STAFF, RESEARCH, RESEARCH_BRANCHES, ACHIEVEMENTS, QUESTS, MISSIONS, PRODUCT_NAMES, THEMES, CALENDAR,
} from '../src/core/config.js';
import { t, setLang, getLang, detectLang } from '../src/i18n.js';

const TR = /[ğüşıöçĞÜŞİÖÇ]/;
const WHITELIST = new Set(['Türkçe']);

test.beforeEach(() => setLang('en'));
test.afterEach(() => setLang('tr'));

test('Türkçede metinler aynen döner; dil algılama', () => {
  setLang('tr');
  assert.equal(getLang(), 'tr');
  assert.equal(t('Görevler'), 'Görevler');
  assert.equal(detectLang('en'), 'en'); assert.equal(detectLang('tr'), 'tr');
  assert.equal(typeof detectLang(''), 'string');
});

test('İngilizce: yapı kuralları ve ifadeler doğru çalışır', () => {
  assert.equal(t('Önce Blok Presi Sv.9 olmalı!'), 'First get Block Press to Lv.9!');
  assert.equal(t('Rozet: İlk Parça  ·  Toplam 1K kazan  ·  +%1 gelir'), 'Badge: First Piece  ·  Earn 1K in total  ·  +1% income');
  assert.equal(t('3.0sn · 5.14K/ürün · Elle'), '3.0s · 5.14K/item · Manual');
  assert.equal(t('Fabrika Sv.7'), 'Factory Lv.7');
  assert.equal(t('Çevrimdışı verim +%5'), 'Offline efficiency +5%');
  assert.equal(t('4.91K'), '4.91K');                       // sayılar dokunulmaz
  assert.equal(t('Dokunuş gücü +0,25 sn'), 'Tap power +0.25 s');
});

test('kısmi eşleşmeler kelime ortasında çalışmaz', () => {
  assert.equal(t('Toplam'), 'Total');
  assert.equal(t('Toplamlar'), 'Toplamlar');
});

test('oyun verisindeki tüm adlar ve açıklamalar çevrilir (Türkçe karakter kalmaz)', () => {
  const strings = [];
  for (const z of ZONES) strings.push(z.name, z.story);
  for (const m of MACHINES) strings.push(m.name);
  for (const u of Object.values(UPGRADES)) strings.push(u.name);
  for (const p of PATENTS) strings.push(p.name, p.desc);
  for (const s of STAFF) strings.push(s.name, s.desc);
  for (const r of RESEARCH) strings.push(r.name, r.desc);
  strings.push(...Object.values(RESEARCH_BRANCHES), ...Object.values(PRODUCT_NAMES));
  for (const a of ACHIEVEMENTS) strings.push(a.title, a.desc);
  for (const q of QUESTS) strings.push(q.title);
  for (const p of MISSIONS.pool) for (const n of [1, 3, 250, 12000]) strings.push(p.text(n));
  for (const th of Object.values(THEMES)) strings.push(th.name);
  strings.push(CALENDAR.weekend.name, CALENDAR.weekend.desc);
  for (const w of CALENDAR.weeks) strings.push(w.name, w.desc);
  const bad = [];
  for (const s of strings) {
    const out = t(s);
    if (TR.test(out)) bad.push(s + '  =>  ' + out);
  }
  assert.deepEqual(bad, []);
  // adlar gerçekten değişmeli (yalnızca özel adlar aynı kalabilir)
  const same = ['Kaizen'];
  for (const m of MACHINES) assert.notEqual(t(m.name), m.name);
  for (const z of ZONES) { assert.notEqual(t(z.name), z.name); assert.notEqual(t(z.story), z.story); }
  for (const a of ACHIEVEMENTS) assert.ok(t(a.title) !== a.title || same.includes(a.title));
});

function literals(file) {
  let s = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.js')) s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const out = [];
  const re = file.endsWith('.html') ? />([^<>]*[A-Za-zğüşıöçĞÜŞİÖÇ][^<>]*)</g : /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(s))) {
    const x = (m[1] ?? m[2]).replace(/\\'/g, "'");
    if (m[2] !== undefined && /\$\{/.test(x)) continue;                     // şablonlar aşağıdaki derlenmiş örneklerle denetlenir
    const before = s.slice(0, m.index).trimEnd().slice(-1), after = s.slice(m.index + m[0].length).trimStart()[0];
    if (before === '+' || after === '+') continue;                          // birleştirilen parçalar
    for (let frag of x.replace(/<[^>]+>/g, '|').split('|')) {
      frag = frag.replace(/\s+/g, ' ').trim();
      if (frag.length > 1 && TR.test(frag)) out.push(frag);
    }
  }
  return out;
}

test('kaynak koddaki tam (birleştirilmemiş) Türkçe metinler çevrilir', () => {
  const files = ['src/ui/ui.js', 'src/main.js', 'src/render/renderer.js', 'src/ui/card.js', 'index.html'];
  const bad = [];
  for (const f of files) {
    for (const frag of literals(f)) {
      const out = t(frag);
      if (TR.test(out) && !WHITELIST.has(frag)) bad.push((f + ': ' + frag + '  =>  ' + out).slice(0, 200));
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});

test('çalışma anında birleştirilen cümleler (sayılarla) çevrilir', () => {
  const samples = [
    'Önce Boyama Kabini Sv.9 olmalı!', 'Önceki makine Sv.9 olmalı (1/9)', 'Önceki makinenin seviyesi yetersiz (Sv.12)', '+ SATIN AL  4.5K', 'Sv.9 gerek',
    'Blok Presi kuruldu!', '+60 kazandın!', '+1.2K kazandın', 'Rozet: İlk Parça', 'Toplam 1K kazan  ·  +%1 gelir', 'Aktif görevler  ·  Tamamlanan 3/124',
    'Günlük görevler  ·  5 sa 12 dk kaldı', '0 / 3 görevi bitirince açılır', 'Rozetler 12/63  ·  Gelir bonusu +%12', '3.00sn → 2.70sn', '+%30 ürün değeri (şu an 5.14K)',
    'Bant kapasitesi 3 → 5', 'Makineler 2/3  ·  Buradasın', '2B kazanç gerekli (bu koşuda)', '2B kazanınca açılır', '250 ömür boyu yıldızda açılır', 'Kozmik Çekirdek: 2',
    'Gelir x3.5  ·  Yıldız etkisi +%50', 'Ömür boyu yıldız 300 / 1K', 'GALAKTİK GENİŞLEME  +1', 'FABRİKAYI YENİLE  +12', 'Toplam 30 ★  ·  3 yenileme', 'Gelir çarpanı: x2.5',
    'Her Patent Yıldızı kalıcı olarak +%10 gelir verir. Yenilemeden önce daha fazla kazanırsan daha fazla yıldız alırsın.',
    'Çevrimdışı kazanç: en fazla 8 saat, %50 verimle. Kayıt kodu ile ilerlemeni telefon ve bilgisayar arasında taşıyabilirsin.',
    '3 makine', ' kurunca işe alım başlar.', 'Toplam seviye 12', '3 makine gerekli', '63 puan', '6/55 eşik', '3 aktif', 'Toplam kazanılan 12  ·  sonraki puan: 4.5K ürün daha',
    'Hassas Ölçüm  2/5', 'Hızlı Eller  ·  Kilitli: Hassas Ölçüm Sv.2', 'Katalog 6/55 eşik  ·  Gelir bonusu +%2.4', '1.5K satıldı',
    'Her ürün türünden belirli sayıda satınca bir katalog eşiği tamamlanır (100, 1K, 10K, 100K, 1M). Her eşik kalıcı +%0,4 gelir verir.',
    'Bu tema için 12 rozet gerekli', 'Rozet 3/5', 'Kullanılıyor', '  ·  3 gün 4 sa kaldı', 'Atlattığın fabrika olayı: 2. Olaylar rastgele aralıklarla gelir; çevrimdışıyken beklemez.',
    '1. gün', '3. gün', '7. gün (süper ödül!)', '+1 ★ Patent Yıldızı', 'BÖLÜM 3', '(En fazla 8 saatlik kazanç hesaplandı)', '5 dk 3 sn boyunca yoktun',
    'Boyama Kabini  5/14', 'Boyama Kabini: 14 adet sat · 30 sn · Ödül 11.3K', 'KESİNTİ! Sigortaya dokun 3/8', 'VIP MÜŞTERİ  x3 gelir', 'TALEP PATLAMASI  x2 gelir',
    'Katalog eşiği tamamlandı!', 'Elektrik kesintisi!', 'Yeni makine al, fabrikan büyüsün!', 'Fabrika yenilendi! +5 Yıldız', 'Galaktik Genişleme! +2 Kozmik Çekirdek',
    '12 rozet kazandın! (Hedefler → Rozetler)', 'Önceki makine Sv.9 olmalı (1/9)', 'Önceki makineyi yükselt', 'COŞKU x3!', 'SEVİYE 12!', 'ZİNCİR x1.21',
    'Kozmik Çekirdek  ·  3/5  ·  +%0,4 gelir', 'Gelir/sn', 'Fabrika Sv.', 'Sen de kendi fabrikanı kur!', 'MAKS +5', 'YÜKSELT x10',
    'Yıldızlar, patentler, çalışanlar ve fabrika sıfırlanır. Rozetler, Ar-Ge ve katalog kalır.', ': her çekirdek geliri +%50 artırır ve yıldızların etkisini +%50 güçlendirir.',
    ' kazanırsın (gelir çarpanı x2.5 → x3.5).', 'Açılması için bu koşuda', 'kazan.', 'Sonra fabrikanı yenileyip kalıcı', ' kazanırsın: her yıldız +%10 gelir ve güçlü kalıcı geliştirmeler.',
  ];
  const bad = [];
  for (const x of samples) { const out = t(x); if (TR.test(out)) bad.push(x + '  =>  ' + out); }
  assert.deepEqual(bad, []);
});
