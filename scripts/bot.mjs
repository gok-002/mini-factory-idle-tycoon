// Denge botu: açgözlü bir oyuncuyu simüle eder. Testler ve `npm run balance` raporu kullanır.
import { MACHINES, ZONES, UPGRADES, machineReq } from '../src/core/config.js';
import { createDefaultState } from '../src/core/state.js';
import { Game } from '../src/core/sim.js';
import { levelUpCost, trackCost, trackMaxed, incomePerSec } from '../src/core/economy.js';

// Tek makinede değişiklik yapılmış gibi geliri hesaplar (kopya maliyeti düşük: yalnızca o makine kopyalanır).
function incomeWith(game, i, patch) {
  const machines = game.state.machines.slice();
  machines[i] = { ...machines[i], ...patch(machines[i]) };
  return incomePerSec({ ...game.state, machines }, game.gm);
}

/** Satın alınabilecek seçenekleri {cost, gain, run} olarak döndürür. */
function options(game) {
  const s = game.state, out = [];
  const base = game.income;
  for (let i = 0; i < MACHINES.length; i++) {
    const m = s.machines[i], def = MACHINES[i];
    if (!m.owned) {
      const block = game.machineBlock(i);
      const bundle = game.machineCost(i) + def.autoCost;
      if (!block) {
        const gain = incomeWith(game, i, () => ({ owned: true, auto: true })) - base;
        out.push({ cost: bundle, gain, run: () => game.buyMachine(i) && true });
      } else if (block.type === 'level' && game.nextMachineIndex() === i) {
        // Seviye şartı: önceki makineyi yükselt (hedef makinenin getirisi seviye sayısına bölünür)
        const prev = s.machines[i - 1], n = block.need - prev.level;
        const gain = def.baseValue / def.baseTime / n;
        out.push({ cost: levelUpCost(MACHINES[i - 1], prev.level), gain, run: () => game.levelUp(i - 1, 1) });
      }
      continue;
    }
    if (!m.auto) out.push({ cost: def.autoCost, need: def.autoCost, gain: incomeWith(game, i, () => ({ auto: true })) - base, run: () => game.buyAuto(i) });
    out.push({ cost: levelUpCost(def, m.level), need: levelUpCost(def, m.level), gain: m.auto ? incomeWith(game, i, (m) => ({ level: m.level + 1 })) - base : 0.0001, run: () => game.levelUp(i, 1) });
    for (const t of Object.keys(UPGRADES)) {
      if (trackMaxed(t, m[t])) continue;
      const c = trackCost(def, t, m[t]);
      out.push({ cost: c, need: c, gain: m.auto ? incomeWith(game, i, (m) => ({ [t]: m[t] + 1 })) - base : 0.0001, run: () => game.buyTrack(i, t) });
    }
  }
  for (let z = 1; z < ZONES.length; z++) {
    if (!game.canUnlockZone(z)) continue;
    const first = MACHINES.find((d) => d.zone === z); // bölge + ilk makine paketi
    out.push({ cost: ZONES[z].unlockCost + first.baseCost + first.autoCost, gain: first.baseValue / first.baseTime, run: () => game.unlockZone(z) });
  }
  return out;
}

/**
 * @param {number} maxSeconds simüle edilecek oyun süresi
 * @param {{tapsPerSec?: number}} opts
 * @returns {{game: Game, log: Array}}
 */
export function playBot(maxSeconds, opts = {}) {
  const tapsPerSec = opts.tapsPerSec ?? 3;
  const game = new Game(createDefaultState(0));
  const log = [];
  const marks = new Map();
  const dt = 0.1;
  let t = 0, think = 0, tapAcc = 0;
  const mark = (name) => { if (!marks.has(name)) { marks.set(name, t); log.push({ t, name, income: game.income }); } };

  while (t < maxSeconds) {
    // Aktif oyuncu: otomatik olmayan makinelere dokun
    tapAcc += dt * tapsPerSec;
    while (tapAcc >= 1) {
      tapAcc -= 1;
      for (let i = 0; i < MACHINES.length; i++) {
        const m = game.state.machines[i];
        if (m.owned && !m.auto) { game.tap(i); break; }
      }
    }
    game.update(dt);
    t += dt;
    if ((think += dt) >= (t > 3600 * 20 ? 5 : 1)) {
      think = 0;
      game.refresh(t * 1000);
      // Alınabilir en iyi geri dönüşlü seçeneği al
      for (let guard = 0; guard < 20; guard++) {
        const cand = options(game).filter((o) => o.gain > 0);
        if (!cand.length) break;
        cand.sort((a, b) => a.cost / a.gain - b.cost / b.gain);
        if (game.state.money < cand[0].cost || !cand[0].run()) break; // en iyi hedef için biriktir
      }
      for (let i = 0; i < MACHINES.length; i++) if (game.state.machines[i].owned) mark('machine' + (i + 1));
      for (let i = 0; i < MACHINES.length; i++) if (game.state.machines[i].auto) mark('auto' + (i + 1));
      for (let z = 1; z < ZONES.length; z++) if (game.state.zones[z].unlocked) mark('zone' + (z + 1));
    }
  }
  return { game, log, marks };
}
