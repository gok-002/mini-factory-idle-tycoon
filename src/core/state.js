import { SAVE_VERSION, TUNING, MACHINES, ZONES, QUESTS, UPGRADES, PATENTS, ACHIEVEMENTS, MISSIONS, STAFF, RESEARCH, PRODUCT_NAMES, THEMES } from './config.js';

export const TUTORIAL_STEPS = ['level', 'auto', 'buy', 'quest', 'zone'];

export function createDefaultState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    money: TUNING.startMoney,
    stats: { produced: 0, sold: 0, earned: 0, upgrades: 0, maxIncome: 0, taps: 0, offlineEarned: 0, runEarned: 0, golden: 0, rushDone: 0, missionsDone: 0, playSecs: 0, eventsDone: 0 },
    meta: { stars: 0, totalStars: 0, prestiges: 0, shop: {}, cores: 0, ascensions: 0, lifeStars: 0 },   // kalıcı (yeniden doğuşta korunur)
    daily: { last: '', streak: 0 },
    staff: {},                        // { [çalışanId]: seviye } (yeniden doğuşta sıfırlanır)
    rd: {},                           // { [araştırmaId]: seviye } kalıcı
    catalog: {},                      // { [ürün]: satılan adet } kalıcı
    ach: {},                          // { [rozetId]: true } kalıcı rozetler (yeniden doğuşta korunur)
    dm: { day: '', list: [], chest: false },   // günlük görevler: [{ id, target, base, claimed }]
    tut: {},                          // gösterilmiş ipuçları { [adım]: true }
    machines: MACHINES.map((d, i) => ({ id: d.id, owned: i === 0, level: 1, speed: 0, value: 0, storage: 0, auto: false })),
    zones: ZONES.map((z) => ({ id: z.id, unlocked: z.unlockCost === 0 })),
    quests: {},                       // { [questId]: true } -> ödülü alındı
    settings: { sound: true, haptics: true, music: true, lang: '' },
    theme: 'classic',
    boosts: [],                       // [{ id, mult, until }] geçici bonuslar (ödüllü reklam vb. için ayrılmış)
    selected: 0,
    lastSeen: now,
    createdAt: now,
  };
}

function num(x, def, min, max) {
  const n = typeof x === 'number' ? x : Number(x);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
const int = (x, def, min, max) => Math.floor(num(x, def, min, max));

/** Bozuk/eksik/eski veriyi geçerli bir oyun durumuna çevirir. Asla fırlatmaz. */
export function sanitizeState(raw, now = Date.now()) {
  const s = createDefaultState(now);
  if (!raw || typeof raw !== 'object') return s;

  s.money = num(raw.money, s.money, 0, TUNING.maxMoney);
  const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  for (const k of Object.keys(s.stats)) s.stats[k] = num(st[k], 0, 0, Number.MAX_VALUE);
  if (st.runEarned === undefined) s.stats.runEarned = s.stats.earned; // v1 kayıtları: mevcut koşu = o ana kadarki kazanç

  const rawMachines = Array.isArray(raw.machines) ? raw.machines : [];
  s.machines.forEach((m, i) => {
    const r = rawMachines.find((x) => x && x.id === m.id);
    if (!r) return;
    m.owned = i === 0 ? true : r.owned === true;
    m.level = int(r.level, 1, 1, TUNING.maxLevel);
    for (const t of Object.keys(UPGRADES)) m[t] = int(r[t], 0, 0, UPGRADES[t].max);
    m.auto = r.auto === true;
    if (!m.owned) { m.level = 1; m.speed = m.value = m.storage = 0; m.auto = false; }
  });

  const rawZones = Array.isArray(raw.zones) ? raw.zones : [];
  s.zones.forEach((z, i) => {
    const r = rawZones.find((x) => x && x.id === z.id);
    z.unlocked = i === 0 ? true : !!(r && r.unlocked === true);
  });

  if (raw.quests && typeof raw.quests === 'object') {
    for (const q of QUESTS) if (raw.quests[q.id] === true) s.quests[q.id] = true;
  }
  if (raw.settings && typeof raw.settings === 'object') {
    s.settings.sound = raw.settings.sound !== false;
    s.settings.haptics = raw.settings.haptics !== false;
    s.settings.music = raw.settings.music !== false;
    s.settings.lang = raw.settings.lang === 'tr' || raw.settings.lang === 'en' ? raw.settings.lang : '';
  }
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  s.meta.stars = num(meta.stars, 0, 0, 1e15);
  s.meta.totalStars = Math.max(s.meta.stars, num(meta.totalStars, 0, 0, 1e15));
  s.meta.prestiges = int(meta.prestiges, 0, 0, 1e9);
  const shop = meta.shop && typeof meta.shop === 'object' ? meta.shop : {};
  for (const p of PATENTS) { const l = int(shop[p.id], 0, 0, p.max); if (l > 0) s.meta.shop[p.id] = l; }
  s.meta.cores = int(meta.cores, 0, 0, 1e6);
  s.meta.ascensions = int(meta.ascensions, 0, 0, 1e6);
  s.meta.lifeStars = Math.max(s.meta.totalStars, num(meta.lifeStars, 0, 0, 1e15));
  if (raw.staff && typeof raw.staff === 'object') for (const r of STAFF) { const l = int(raw.staff[r.id], 0, 0, r.max); if (l > 0) s.staff[r.id] = l; }
  if (raw.rd && typeof raw.rd === 'object') for (const n of RESEARCH) { const l = int(raw.rd[n.id], 0, 0, n.max); if (l > 0) s.rd[n.id] = l; }
  if (raw.catalog && typeof raw.catalog === 'object') for (const k of Object.keys(PRODUCT_NAMES)) { const c = num(raw.catalog[k], 0, 0, Number.MAX_VALUE); if (c > 0) s.catalog[k] = c; }
  const d = raw.daily && typeof raw.daily === 'object' ? raw.daily : {};
  s.daily.last = typeof d.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.last) ? d.last : '';
  s.daily.streak = int(d.streak, 0, 0, 7);
  if (raw.ach && typeof raw.ach === 'object') for (const a of ACHIEVEMENTS) if (raw.ach[a.id] === true) s.ach[a.id] = true;
  if (raw.tut && typeof raw.tut === 'object') for (const k of TUTORIAL_STEPS) if (raw.tut[k] === true) s.tut[k] = true;
  const dm = raw.dm && typeof raw.dm === 'object' ? raw.dm : {};
  if (typeof dm.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dm.day) && Array.isArray(dm.list)) {
    const list = [];
    for (const it of dm.list.slice(0, MISSIONS.count)) {
      const def = it && MISSIONS.pool.find((p) => p.id === it.id);
      if (!def || list.some((x) => x.id === def.id)) continue;
      list.push({ id: def.id, target: Math.max(1, num(it.target, 1, 1, 1e30)), base: num(it.base, 0, 0, Number.MAX_VALUE), claimed: it.claimed === true });
    }
    if (list.length === MISSIONS.count) { s.dm.day = dm.day; s.dm.list = list; s.dm.chest = dm.chest === true; }   // bozuksa yarın/yenilemede yeniden üretilir
  }
  if (typeof raw.theme === 'string' && THEMES[raw.theme]) s.theme = raw.theme;
  if (Array.isArray(raw.boosts)) {
    s.boosts = raw.boosts
      .filter((b) => b && Number.isFinite(b.mult) && Number.isFinite(b.until) && b.until > now)
      .map((b) => ({ id: String(b.id || 'boost'), mult: Math.min(100, Math.max(1, b.mult)), until: b.until }));
  }
  s.selected = int(raw.selected, 0, 0, MACHINES.length - 1);
  if (!s.machines[s.selected].owned) s.selected = 0;

  // Gelecekteki bir zaman damgası çevrimdışı kazancı şişirmesin.
  const seen = num(raw.lastSeen, now, 0, Number.MAX_VALUE);
  s.lastSeen = seen > now ? now : seen;
  s.createdAt = num(raw.createdAt, now, 0, now);
  return s;
}
