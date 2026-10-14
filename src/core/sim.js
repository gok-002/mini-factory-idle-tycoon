// Merkezi üretim simülasyonu + tüm satın alma/yükseltme kuralları. Görsel koddan bağımsızdır.
import { TUNING, UPGRADES, MACHINES, ZONES, QUESTS, PRESTIGE, PATENTS, GOLDEN, DAILY, machineReq } from './config.js';
import {
  cycleTime, itemValue, storageCap, incomePerSec, levelUpCost, maxAffordableLevels,
  trackCost, trackMaxed, globalMult, tapSeconds, machineBuyCost, goldenIntervalMult, patentCost, patentLvl, prestigeGain, prestigeUnlocked,
} from './economy.js';
import { createDefaultState } from './state.js';
import { computeOffline } from './offline.js';
import { questDone, questClaimed, questReward } from './quests.js';

const noop = () => {};

/** Yerel takvim günü anahtarı (YYYY-MM-DD). */
export function dayKey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const yesterdayKey = (ms) => { const d = new Date(ms); d.setDate(d.getDate() - 1); return dayKey(d.getTime()); };

function makeRuntime() {
  // Çalışma zamanı (kaydedilmez): üretim ilerlemesi ve banttaki ürün yaşları.
  return { progress: 0, count: 0, ages: new Float64Array(TUNING.maxStorage + 1), blocked: false, pulse: 0, born: 1 };
}

export class Game {
  /**
   * @param {object} state sanitizeState çıktısı
   * @param {(type: string, a?: any, b?: any, c?: any) => void} emit olay bildirimi (UI/ses/efekt)
   */
  constructor(state, emit = noop, rng = Math.random) {
    this.state = state;
    this.emit = emit;
    this.rng = rng;
    this.golden = null;             // { x, y, ttl, max }: sahne üzerinde 0..1 konumu
    this.goldenTimer = 45 + rng() * 30;
    this.rt = MACHINES.map(makeRuntime);
    this.gm = 1;
    this.income = 0;
    this.readyQuests = new Set();
    this._patentOpen = prestigeUnlocked(state);    // Patent Laboratuvarı zaten açıksa açılış bildirimi verme
    this.refresh(Date.now());
    for (const q of QUESTS) if (questDone(state, q) && !questClaimed(state, q)) this.readyQuests.add(q.id);
  }

  /** Türetilmiş değerleri yeniden hesaplar (satın alma / yükseltme / saniyede birkaç kez). */
  refresh(nowMs = Date.now()) {
    const s = this.state;
    this.gm = globalMult(s, nowMs);
    this.income = incomePerSec(s, this.gm);
    if (this.income > s.stats.maxIncome) s.stats.maxIncome = this.income;
    if (!this._patentOpen && prestigeUnlocked(s)) { this._patentOpen = true; this.emit('patentUnlocked'); }
    this._checkQuests();
  }

  /** Her karede çağrılır; son görülme zamanını güncel tutar (çevrimdışı hesabın doğruluğu için). */
  touch(nowMs) { this.state.lastSeen = nowMs; }

  _earn(x) {
    if (!(x > 0) || !Number.isFinite(x)) return;
    const s = this.state;
    s.money = Math.min(TUNING.maxMoney, s.money + x);
    s.stats.earned += x;
    s.stats.runEarned += x;
  }

  _spend(cost) {
    const s = this.state;
    if (!Number.isFinite(cost) || cost < 0 || s.money < cost) return false;
    s.money -= cost;
    return true;
  }

  canAfford(cost) { return Number.isFinite(cost) && this.state.money >= cost; }

  // ---------------------------------------------------------------- simülasyon
  update(dt) {
    if (!(dt > 0)) return;
    if (dt > TUNING.maxFrameDt) dt = TUNING.maxFrameDt;
    const s = this.state;
    this._goldenTick(dt);
    for (let i = 0; i < MACHINES.length; i++) {
      const m = s.machines[i];
      if (!m.owned) continue;
      const def = MACHINES[i], r = this.rt[i];
      const cap = storageCap(m);

      if (r.pulse > 0) r.pulse = Math.max(0, r.pulse - dt * 4);
      if (r.born < 1) r.born = Math.min(1, r.born + dt * 2.2);

      if (m.auto) {
        if (r.count < cap) {
          r.progress += dt / cycleTime(def, m);
          r.blocked = false;
        } else r.blocked = true;
      }
      while (r.progress >= 1 && r.count < cap) {
        r.progress -= 1;
        this._spawn(i);
      }
      if (r.progress > 1) r.progress = 1; // bant doluysa bekle

      // bant: ürünleri yaşlandır, varanları sat
      const n = r.count;
      for (let k = 0; k < n; k++) r.ages[k] += dt;
      let sold = 0;
      while (r.count > 0 && r.ages[0] >= TUNING.beltTravelTime) {
        r.ages.copyWithin(0, 1, r.count);
        r.count--;
        sold++;
      }
      if (sold > 0) this._sell(i, sold);
    }
  }

  _spawn(i) {
    const r = this.rt[i];
    r.ages[r.count++] = 0;
    r.pulse = 1;
    this.state.stats.produced++;
    this.emit('produce', i);
    this._checkQuests();
  }

  _sell(i, count) {
    const m = this.state.machines[i];
    const amount = itemValue(MACHINES[i], m, this.gm) * count;
    this._earn(amount);
    this.state.stats.sold += count;
    this.emit('sell', i, amount, count);
    this._checkQuests();
  }

  /** Oyuncu makineye dokundu. Üretimi ilerletir. */
  tap(i) {
    const m = this.state.machines[i];
    if (!m || !m.owned) return false;
    const def = MACHINES[i], r = this.rt[i];
    this.state.stats.taps++;
    if (r.count >= storageCap(m)) { this.emit('blocked', i); return false; }
    const secs = tapSeconds(this.state, m.auto);
    r.progress += secs / cycleTime(def, m);
    while (r.progress >= 1 && r.count < storageCap(m)) { r.progress -= 1; this._spawn(i); }
    if (r.progress > 1) r.progress = 1;
    this.emit('tap', i);
    return true;
  }

  select(i) {
    if (this.state.machines[i] && this.state.machines[i].owned) this.state.selected = i;
  }

  // ------------------------------------------------------------ satın alma kuralları
  /** Satın alınabilecek bir sonraki makine (yoksa -1). */
  nextMachineIndex() {
    for (let i = 0; i < MACHINES.length; i++) {
      if (!this.state.machines[i].owned) return this.state.zones[MACHINES[i].zone].unlocked ? i : -1;
    }
    return -1;
  }

  /** Satın alınamıyorsa nedenini döndürür: { type: 'order'|'zone'|'level'|'owned', need?, have? }; alınabilirse null. */
  machineBlock(i) {
    const s = this.state;
    if (s.machines[i].owned) return { type: 'owned' };
    if (i > 0 && !s.machines[i - 1].owned) return { type: 'order' };
    if (!s.zones[MACHINES[i].zone].unlocked) return { type: 'zone' };
    const need = machineReq(i);
    if (i > 0 && s.machines[i - 1].level < need) return { type: 'level', need, have: s.machines[i - 1].level };
    return null;
  }

  canBuyMachine(i) {
    return i === this.nextMachineIndex() && this.machineBlock(i) === null;
  }

  machineCost(i) { return machineBuyCost(this.state, MACHINES[i]); }

  buyMachine(i) {
    const block = this.machineBlock(i);
    if (block) { if (block.type === 'level') this.emit('deny', 'level', block.need); return false; }
    if (i !== this.nextMachineIndex()) return false;
    if (!this._spend(this.machineCost(i))) { this.emit('deny', 'money'); return false; }
    const m = this.state.machines[i];
    m.owned = true;
    this.rt[i] = makeRuntime();
    this.rt[i].born = 0;
    this.state.selected = i;
    this.refresh();
    this.emit('buyMachine', i);
    return true;
  }

  /** @param {number} n kaç seviye; -1 = alabildiğin kadar */
  levelUp(i, n = 1) {
    const m = this.state.machines[i];
    if (!m || !m.owned || m.level >= TUNING.maxLevel) return false;
    const def = MACHINES[i];
    if (n < 0) n = maxAffordableLevels(def, m.level, this.state.money);
    n = Math.min(Math.max(1, n | 0), TUNING.maxLevel - m.level);
    if (!this._spend(levelUpCost(def, m.level, n))) { this.emit('deny', 'money'); return false; }
    const before = m.level;
    m.level += n;
    this.state.stats.upgrades++;
    this.rt[i].pulse = 1;
    this.refresh();
    this.emit('levelUp', i, m.level, before);
    return true;
  }

  trackCostOf(i, track) {
    const m = this.state.machines[i];
    return trackMaxed(track, m[track]) ? Infinity : trackCost(MACHINES[i], track, m[track]);
  }

  buyTrack(i, track) {
    const m = this.state.machines[i];
    if (!m || !m.owned || !UPGRADES[track] || trackMaxed(track, m[track])) return false;
    if (!this._spend(trackCost(MACHINES[i], track, m[track]))) { this.emit('deny', 'money'); return false; }
    m[track]++;
    this.state.stats.upgrades++;
    this.rt[i].pulse = 1;
    this.refresh();
    this.emit('upgrade', i, track);
    return true;
  }

  buyAuto(i) {
    const m = this.state.machines[i];
    if (!m || !m.owned || m.auto) return false;
    if (!this._spend(MACHINES[i].autoCost)) { this.emit('deny', 'money'); return false; }
    m.auto = true;
    this.state.stats.upgrades++;
    this.refresh();
    this.emit('auto', i);
    return true;
  }

  nextZoneIndex() {
    const z = this.state.zones.findIndex((x) => !x.unlocked);
    return z;
  }

  /** Bölge açma: önceki bölgenin tüm makineleri alınmış olmalı. */
  canUnlockZone(z) {
    const s = this.state;
    if (z < 1 || z >= ZONES.length || s.zones[z].unlocked || !s.zones[z - 1].unlocked) return false;
    for (let i = 0; i < MACHINES.length; i++) if (MACHINES[i].zone === z - 1 && !s.machines[i].owned) return false;
    return true;
  }

  unlockZone(z) {
    if (!this.canUnlockZone(z)) return false;
    if (!this._spend(ZONES[z].unlockCost)) { this.emit('deny', 'money'); return false; }
    this.state.zones[z].unlocked = true;
    this.refresh();
    this.emit('zone', z);
    return true;
  }

  // ------------------------------------------------------------------ görevler
  _checkQuests() {
    for (const q of QUESTS) {
      if (!this.readyQuests.has(q.id) && !questClaimed(this.state, q) && questDone(this.state, q)) {
        this.readyQuests.add(q.id);
        this.emit('questReady', q.id);
      }
    }
  }

  /** Ödül yalnızca bir kez alınır: önce "alındı" işaretlenir, sonra para eklenir. */
  claimQuest(id) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || questClaimed(this.state, q) || !questDone(this.state, q)) return 0;
    this.state.quests[id] = true;
    this.readyQuests.delete(id);
    const reward = questReward(q, this.income);
    this._earn(reward);
    this.emit('questClaimed', id, reward);
    return reward;
  }

  // ------------------------------------------------------------- Altın Kasa
  _nextGolden() {
    this.goldenTimer = (GOLDEN.minInterval + this.rng() * (GOLDEN.maxInterval - GOLDEN.minInterval)) * goldenIntervalMult(this.state);
  }

  _goldenTick(dt) {
    const g = this.golden;
    if (g) {
      g.ttl -= dt;
      if (g.ttl <= 0) { this.golden = null; this._nextGolden(); }
      return;
    }
    if (this.income <= 0) return;
    this.goldenTimer -= dt;
    if (this.goldenTimer <= 0) {
      this.golden = { x: 0.15 + this.rng() * 0.7, y: 0.2 + this.rng() * 0.6, ttl: GOLDEN.ttl, max: GOLDEN.ttl };
      this.emit('goldenSpawn');
    }
  }

  /** Altın Kasaya dokunuldu: para ya da kısa süreli x3 "coşku" bonusu. */
  collectGolden(nowMs = Date.now()) {
    if (!this.golden) return null;
    this.golden = null;
    this._nextGolden();
    this.state.stats.golden++;
    const frenzy = this.rng() < GOLDEN.frenzyChance;
    let reward = 0;
    if (frenzy) {
      const keep = this.state.boosts.filter((x) => x.id !== 'frenzy' && x.until > nowMs);
      keep.push({ id: 'frenzy', mult: GOLDEN.frenzyMult, until: nowMs + GOLDEN.frenzySecs * 1000 });
      this.state.boosts = keep;
    } else {
      const secs = GOLDEN.rewardSecsMin + this.rng() * (GOLDEN.rewardSecsMax - GOLDEN.rewardSecsMin);
      reward = Math.floor(this.income * secs);
      this._earn(reward);
    }
    this.refresh(nowMs);
    this.emit('goldenCollected', reward, frenzy);
    return { reward, frenzy };
  }

  // ------------------------------------------------------------ Günlük hediye
  /** @returns {{available: boolean, day: number, secs: number}} bugün alınabilecek hediye (gün 1..7) */
  dailyStatus(nowMs = Date.now()) {
    const d = this.state.daily, today = dayKey(nowMs);
    if (d.last === today) return { available: false, day: d.streak, secs: 0 };
    const day = d.last === yesterdayKey(nowMs) && d.streak < 7 ? d.streak + 1 : 1;
    return { available: true, day, secs: DAILY.secs[day - 1] };
  }

  claimDaily(nowMs = Date.now()) {
    const st = this.dailyStatus(nowMs);
    if (!st.available) return null;
    const d = this.state.daily;
    d.last = dayKey(nowMs); d.streak = st.day;        // önce işaretle, sonra öde
    const money = Math.floor(Math.max(DAILY.minMoney, this.income * st.secs));
    this._earn(money);
    let stars = 0;
    if (st.day === 7) { stars = DAILY.starsOnLastDay; this.state.meta.stars += stars; this.state.meta.totalStars += stars; }
    this.refresh(nowMs);
    this.emit('daily', money, stars);
    return { money, stars, day: st.day };
  }

  // -------------------------------------------------- Patent Laboratuvarı / yeniden doğuş
  buyPatent(id) {
    const p = PATENTS.find((x) => x.id === id), meta = this.state.meta;
    if (!p) return false;
    const lvl = patentLvl(this.state, id);
    if (lvl >= p.max) return false;
    const cost = patentCost(p, lvl);
    if (meta.stars < cost) { this.emit('deny', 'stars'); return false; }
    meta.stars -= cost;
    meta.shop[id] = lvl + 1;
    this.refresh();
    this.emit('patent', id);
    return true;
  }

  canPrestige() { return prestigeGain(this.state) >= PRESTIGE.minGain; }

  /** Fabrikayı yeniler: ilerleme sıfırlanır; Patent Yıldızları, görevler ve ayarlar korunur. */
  prestige() {
    const s = this.state, gain = prestigeGain(s);
    if (gain < PRESTIGE.minGain) return 0;
    s.meta.stars += gain; s.meta.totalStars += gain; s.meta.prestiges++;
    const fresh = createDefaultState(s.lastSeen);
    s.money = TUNING.startMoney;
    s.machines = fresh.machines;
    s.zones = fresh.zones;
    s.boosts = [];
    s.selected = 0;
    s.stats.runEarned = 0;
    const n = Math.min(MACHINES.length, 2 * patentLvl(s, 'heritage'));
    for (let i = 0; i < n; i++) {
      s.machines[i].owned = true; s.machines[i].auto = true;
      s.zones[MACHINES[i].zone].unlocked = true;
    }
    this.rt = MACHINES.map(makeRuntime);
    this.golden = null; this._nextGolden();
    this.refresh();
    this.emit('prestige', gain);
    return gain;
  }

  // -------------------------------------------------------------- çevrimdışı
  /**
   * Son görülmeden bu yana geçen süreyi TEK SEFERDE işler ve lastSeen'i günceller;
   * aynı süre için ikinci kez çağrılırsa 0 döner.
   */
  applyOffline(nowMs, opts) {
    const s = this.state;
    const elapsed = (nowMs - s.lastSeen) / 1000;
    s.lastSeen = nowMs;
    if (!Number.isFinite(elapsed) || elapsed < 2) return null;     // saat geri alındı / ihmal edilebilir
    const res = computeOffline(s, elapsed, opts);
    if (res.earned > 0) {
      this._earn(res.earned);
      s.stats.sold += res.items;
      s.stats.produced += res.items;
      s.stats.offlineEarned += res.earned;
    }
    for (const r of this.rt) { r.count = 0; r.progress = 0; r.blocked = false; }
    this.refresh(nowMs);
    return res.earned > 0 ? res : null;
  }
}
