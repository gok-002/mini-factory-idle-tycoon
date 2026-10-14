// DOM arayüzü: HUD, alt dock, paneller (sheet) ve pencereler. Oyun mantığına yalnızca Game API'si üzerinden dokunur.
import { MACHINES, ZONES, QUESTS, UPGRADES, TUNING, PATENTS, PRESTIGE, DAILY, ACHIEVEMENTS, ACH_BONUS, MISSIONS } from '../core/config.js';
import {
  cycleTime, itemValue, storageCap, levelUpCost, maxAffordableLevels, factoryLevel, machineIncome,
  prestigeGain, patentLvl, patentCost, permMult, prestigeUnlocked, prestigeProgress, prestigeNeed, achCount,
} from '../core/economy.js';
import { formatNum, formatRate, formatDuration } from '../core/format.js';
import { questProgress, questDone, questClaimed, questReward, claimableCount, visibleQuests, completedCount } from '../core/quests.js';
import { achProgress, achDone } from '../core/achievements.js';
import { encodeSave, decodeSave } from '../core/savecode.js';
import { ICONS, hydrateIcons } from './icons.js';
import { drawMachine } from '../render/draw.js';
import { visualTier } from '../core/economy.js';

const $ = (id) => document.getElementById(id);
const MULTS = [1, 10, -1];

// Yeni oyuncu ipuçları: sırayla/öncelikle gösterilir; done() sağlanınca kalıcı olarak işaretlenir (state.tut).
const TUTORIAL = [
  { id: 'level', target: 'btn-level', text: 'Yükselt: makine daha çok kazandırır!',
    done: (g) => g.state.stats.upgrades > 0,
    show: (g) => g.canAfford(levelUpCost(MACHINES[g.state.selected], g.state.machines[g.state.selected].level, 1)) },
  { id: 'auto', target: 'btn-up', text: 'Geliştir → Otomasyon: makine kendi kendine çalışsın!',
    done: (g) => g.state.machines.some((m) => m.auto),
    show: (g) => g.canAfford(MACHINES[g.state.selected].autoCost) && !g.state.machines[g.state.selected].auto },
  { id: 'buy', target: 'btn-buy', text: 'Yeni makine al, fabrikan büyüsün!',
    done: (g) => g.state.machines.filter((m) => m.owned).length >= 2,
    show: (g) => g.canBuyMachine(1) && g.canAfford(g.machineCost(1)) },
  { id: 'quest', target: 'btn-quests', text: 'Görev ödülünü topla!',
    done: (g) => completedCount(g.state) >= 1,
    show: (g) => claimableCount(g.state) > 0 },
  { id: 'zone', target: 'btn-zones', text: 'Yeni bir bölge açabilirsin!',
    done: (g) => g.state.zones.filter((z) => z.unlocked).length >= 2,
    show: (g) => { const z = g.nextZoneIndex(); return z >= 0 && g.canUnlockZone(z) && g.canAfford(ZONES[z].unlockCost); } },
];

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const setText = (node, v) => { if (node.textContent !== v) node.textContent = v; };

export class UI {
  constructor(game, renderer, feedback, saveMgr, hooks = {}) {
    this.game = game; this.r = renderer; this.fb = feedback; this.saveMgr = saveMgr; this.hooks = hooks;
    this.mult = 0;                    // MULTS indeksi
    this.sheet = null;                // { name, update }
    this.lastGuard = 0;
    this.shownMoney = game.state.money;
    this.accum = 0;
    this.toastTimer = 0;
    this.n = {};
    for (const id of ['money', 'money-pill', 'income', 'flevel', 'flevel-bar', 'mc-name', 'mc-lv', 'mc-stats', 'btn-level', 'lvl-cost', 'lvl-lbl',
      'btn-mult', 'btn-buy', 'buy-cost', 'btn-up', 'up-hint', 'btn-quests', 'quest-badge', 'btn-zones', 'btn-settings', 'toast', 'sheet', 'sheet-title',
      'sheet-body', 'sheet-close', 'backdrop', 'modal', 'zone-prev', 'zone-next', 'btn-daily', 'btn-patent', 'patent-hint', 'stars-chip', 'boost-chip', 'mc-portrait',
      'rush', 'rush-name', 'rush-time', 'rush-fill', 'rush-tbar', 'notice', 'coach', 'coach-text', 'app']) this.n[id] = $(id);
    this.qTab = 'quests';
    this.noticeQ = [];
    this.noticeShown = 0;
    this.coachKey = '';
    this.portT = 0;
    this.po = { color: '#fff', tier: 0, p: 0, t: 0, pulse: 0, auto: false, blocked: false, level: 1 };
    renderer.onCoinArrive = () => this._popMoney();   // uçan jeton para kutusuna varınca küçük zıplama
    hydrateIcons();
    this._bind();
  }

  /** Satın alma düğmelerinde art arda çift dokunuşu engeller. */
  _guard() {
    const now = performance.now();
    if (now - this.lastGuard < 160) return false;
    this.lastGuard = now;
    return true;
  }

  _press(node, fn) {
    node.addEventListener('click', (e) => { this.fb.unlock(); fn(e); });
  }

  _bind() {
    const n = this.n, g = this.game;
    this._press(n['btn-level'], () => {
      if (!this._guard()) return;
      const ok = g.levelUp(g.state.selected, MULTS[this.mult]);
      this._after(ok, n['btn-level']);
    });
    this._press(n['btn-mult'], () => { this.mult = (this.mult + 1) % MULTS.length; this.fb.button(); this.update(); });
    this._press(n['btn-buy'], () => {
      if (!this._guard()) return;
      const i = g.nextMachineIndex();
      const block = i >= 0 ? g.machineBlock(i) : null;
      if (block && block.type === 'level') { this.toast('Önce ' + MACHINES[i - 1].name + ' Sv.' + block.need + ' olmalı!'); this.fb.deny(); return; }
      if (i < 0) { this.toast(g.nextZoneIndex() >= 0 ? 'Yeni makine için bir sonraki bölgeyi aç!' : 'Tüm makineler alındı!'); this.fb.deny(); return; }
      this._after(g.buyMachine(i), n['btn-buy']);
    });
    this._press(n['btn-up'], () => { this.fb.button(); this.openSheet('upgrades'); });
    this._press(n['btn-quests'], () => { this.fb.button(); this.openSheet('quests'); });
    this._press(n['btn-zones'], () => { this.fb.button(); this.openSheet('zones'); });
    this._press(n['btn-settings'], () => { this.fb.button(); this.openSheet('settings'); });
    this._press(n['btn-patent'], () => { this.fb.button(); this.openSheet('patent'); });
    this._press(n['btn-daily'], () => { this.fb.button(); this.showDaily(); });
    this._press(n['sheet-close'], () => this.closeSheet());
    this._press(n['backdrop'], () => this.closeSheet());
    this._press(n['zone-prev'], () => this.stepZone(-1));
    this._press(n['zone-next'], () => this.stepZone(1));
    this._press(n.rush, () => { if (g.rush) { this.fb.button(); this.goToMachine(g.rush.machine); } });

    // Sahneye dokunma: makineye dokun / kilitli yuvayı satın al
    const canvas = this.r.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.fb.unlock();
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      if (this.r.hitGolden(px, py)) { g.collectGolden(); this.update(); return; }   // Altın Kasa
      const h = this.r.hit(px, py);
      if (!h) return;
      const m = g.state.machines[h.machine];
      if (m.owned) {
        g.select(h.machine);
        if (g.tap(h.machine)) { this.fb.tap(); this.r.tapEffect(h.lane, h.x, h.y); }
        else { this.r.shakeLane(h.lane); this.fb.deny(); this.toast('Bant dolu! Depolamayı geliştir.'); }
        this.update();
      } else if (g.canBuyMachine(h.machine)) {
        if (!this._guard()) return;
        if (!g.buyMachine(h.machine)) this.r.shakeLane(h.lane);
        this.update();
      } else if (g.nextMachineIndex() === h.machine && g.machineBlock(h.machine) && g.machineBlock(h.machine).type === 'level') {
        this.r.shakeLane(h.lane); this.fb.deny();
        this.toast('Önce ' + MACHINES[h.machine - 1].name + ' Sv.' + g.machineBlock(h.machine).need + ' olmalı!');
      } else {
        this.r.shakeLane(h.lane); this.fb.deny();
        this.toast(g.state.zones[MACHINES[h.machine].zone].unlocked ? 'Önce önceki makineyi satın al.' : 'Bu bölge kilitli.');
      }
    });
  }

  /** Satın alma sonucu geri bildirimi (başarısızsa sarsıntı + ses). */
  _after(ok, btn) {
    if (!ok) {
      btn.classList.remove('deny'); void btn.offsetWidth; btn.classList.add('deny');
      return;
    }
    this.update();
  }

  toast(msg) {
    const t = this.n.toast;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
  }

  // ---------------------------------------------------------------- bölgeler
  zoneUnlocked() { return this.game.state.zones.map((z) => z.unlocked); }

  setZone(z) {
    if (!this.game.state.zones[z] || !this.game.state.zones[z].unlocked) return;
    this.r.setZone(z);
    const first = MACHINES.findIndex((m) => m.zone === z && this.game.state.machines[MACHINES.indexOf(m)].owned);
    if (first >= 0) this.game.select(first);
    this.update();
  }

  stepZone(d) {
    const un = this.zoneUnlocked();
    let z = this.r.zone;
    do { z += d; } while (z >= 0 && z < un.length && !un[z]);
    if (z >= 0 && z < un.length) this.setZone(z);
    this.fb.button();
  }

  // ----------------------------------------------------------------- paneller
  openSheet(name) {
    const n = this.n;
    this.closeSheet(true);
    const body = n['sheet-body'];
    body.innerHTML = '';
    const builders = {
      upgrades: () => this._buildUpgrades(body),
      quests: () => this._buildQuests(body),
      zones: () => this._buildZones(body),
      settings: () => this._buildSettings(body),
      patent: () => this._buildPatent(body),
      stats: () => this._buildStats(body),
    };
    const titles = { upgrades: 'Geliştir', quests: 'Hedefler', zones: 'Fabrika Bölgeleri', settings: 'Ayarlar', patent: 'Patent Laboratuvarı', stats: 'İstatistikler' };
    n['sheet-title'].textContent = titles[name];
    this.sheet = builders[name]();
    this.sheet.name = name;
    hydrateIcons(body);
    n.backdrop.hidden = false; n.sheet.hidden = false;
    this.sheet.update();
  }

  closeSheet(silent) {
    this.sheet = null;
    this.n.sheet.hidden = true; this.n.backdrop.hidden = true;
    if (!silent) this.fb.button();
  }

  _buildUpgrades(body) {
    const g = this.game;
    const head = el('div', 'sel-row');
    const prev = el('button', 'chip', '‹'), next = el('button', 'chip', '›'), nm = el('div', 'nm');
    head.append(prev, nm, next);
    body.append(head);
    const owned = () => MACHINES.map((_, i) => i).filter((i) => g.state.machines[i].owned);
    const stepSel = (d) => {
      const list = owned(); const k = list.indexOf(g.state.selected);
      g.select(list[(k + d + list.length) % list.length]);
      const z = MACHINES[g.state.selected].zone; if (z !== this.r.zone) this.r.setZone(z);
      this.fb.button(); this.update();
    };
    this._press(prev, () => stepSel(-1)); this._press(next, () => stepSel(1));

    const rows = {};
    const defs = [
      ['speed', 'speed', 'Üretim Hızı'], ['value', 'value', 'Ürün Değeri'], ['storage', 'storage', 'Depolama'], ['auto', 'auto', 'Otomasyon'],
    ];
    for (const [key, icon, title] of defs) {
      const row = el('div', 'row');
      row.innerHTML = `<div class="ri">${ICONS[icon]}</div><div class="rm"><div class="rt">${title}</div><div class="rs"></div></div>`;
      const btn = el('button', 'btn btn-green', '<span class="lbl"></span><span class="cost"><span class="ico sm">' + ICONS.coin + '</span><i></i></span>');
      row.append(btn); body.append(row);
      this._press(btn, () => {
        if (!this._guard()) return;
        const i = g.state.selected;
        const ok = key === 'auto' ? g.buyAuto(i) : g.buyTrack(i, key);
        this._after(ok, btn);
      });
      rows[key] = { row, btn, rs: row.querySelector('.rs'), rt: row.querySelector('.rt'), lbl: btn.querySelector('.lbl'), cost: btn.querySelector('.cost i'), costBox: btn.querySelector('.cost') };
    }
    return {
      update: () => {
        const i = g.state.selected, m = g.state.machines[i], def = MACHINES[i];
        nm.textContent = def.name + '  ·  Sv.' + m.level;
        const t = cycleTime(def, m);
        const info = {
          speed: [UPGRADES.speed, t.toFixed(2) + 'sn → ' + Math.max(TUNING.minCycleTime, t * UPGRADES.speed.perLevel).toFixed(2) + 'sn'],
          value: [UPGRADES.value, '+%30 ürün değeri (şu an ' + formatNum(itemValue(def, m, 1)) + ')'],
          storage: [UPGRADES.storage, 'Bant kapasitesi ' + storageCap(m) + ' → ' + (storageCap(m) + UPGRADES.storage.perLevel)],
        };
        for (const k of ['speed', 'value', 'storage']) {
          const R = rows[k], u = info[k][0], lvl = m[k];
          R.rt.textContent = u.name + '  ' + lvl + '/' + u.max;
          const maxed = lvl >= u.max;
          R.rs.textContent = maxed ? 'Maksimum seviye' : info[k][1];
          const cost = g.trackCostOf(i, k);
          R.costBox.hidden = maxed; R.lbl.textContent = maxed ? 'MAKS' : 'AL';
          if (!maxed) setText(R.cost, formatNum(cost));
          R.btn.classList.toggle('cant', !maxed && !g.canAfford(cost));
          R.btn.classList.toggle('max', maxed);
        }
        const A = rows.auto;
        A.rs.textContent = m.auto ? 'Makine kendi kendine çalışıyor!' : 'Dokunma gerektirmeden sürekli üretir';
        A.costBox.hidden = m.auto; A.lbl.textContent = m.auto ? 'AÇIK' : 'AL';
        if (!m.auto) setText(A.cost, formatNum(def.autoCost));
        A.btn.classList.toggle('cant', !m.auto && !g.canAfford(def.autoCost));
        A.btn.classList.toggle('max', m.auto);
      },
    };
  }

  /** Hedefler paneli: Görevler (merdiven) / Günlük görevler / Rozetler sekmeleri. */
  _buildQuests(body) {
    const g = this.game;
    if (claimableCount(g.state) === 0 && g.missionClaimable() > 0) this.qTab = 'daily';
    const tabs = el('div', 'tabs'), host = el('div', ''), btns = {};
    for (const [k, label] of [['quests', 'Görevler'], ['daily', 'Günlük'], ['medals', 'Rozetler']]) {
      const b = el('button', 'tab', label + '<i class="dot" hidden></i>');
      tabs.append(b); btns[k] = { b, dot: b.querySelector('.dot') };
      this._press(b, () => { this.qTab = k; this.fb.button(); show(); });
    }
    body.append(tabs, host);
    let sub = null;
    const show = () => {
      host.innerHTML = '';
      sub = this.qTab === 'daily' ? this._buildMissions(host) : this.qTab === 'medals' ? this._buildMedals(host) : this._buildQuestList(host);
      hydrateIcons(host);
      for (const k in btns) btns[k].b.classList.toggle('on', k === this.qTab);
      sub.update();
    };
    show();
    return {
      update: () => {
        sub.update();
        const q = claimableCount(g.state), d = g.missionClaimable();
        btns.quests.dot.hidden = q === 0; setText(btns.quests.dot, String(q));
        btns.daily.dot.hidden = d === 0; setText(btns.daily.dot, String(d));
      },
    };
  }

  _buildQuestList(body) {
    const g = this.game;
    const head = el('div', 'divider');
    body.append(head);
    const list = el('div', '');
    body.append(list);
    let lastKey = '', rows = new Map();
    const build = (vis) => {
      list.innerHTML = ''; rows = new Map();
      for (const q of vis) {
        const row = el('div', 'row');
        row.innerHTML = `<div class="ri">${ICONS.target}</div><div class="rm"><div class="rt">${q.title}</div><div class="rs"></div><div class="prog"><i></i></div></div>`;
        const btn = el('button', 'btn btn-green', '<span class="lbl">AL</span><span class="cost"><span class="ico sm">' + ICONS.coin + '</span><i></i></span>');
        row.append(btn); list.append(row);
        this._press(btn, () => {
          if (!this._guard()) return;
          const got = g.claimQuest(q.id);
          if (got > 0) { this.toast('+' + formatNum(got) + ' kazandın!'); this.update(); }
        });
        rows.set(q.id, { q, row, btn, rs: row.querySelector('.rs'), bar: row.querySelector('.prog i'), cost: btn.querySelector('.cost i') });
      }
    };
    return {
      update: () => {
        const vis = visibleQuests(g.state).sort((a, b) => (questDone(g.state, b) ? 1 : 0) - (questDone(g.state, a) ? 1 : 0));
        const key = vis.map((q) => q.id).join();
        if (key !== lastKey) { lastKey = key; build(vis); }
        setText(head, 'Aktif görevler  ·  Tamamlanan ' + completedCount(g.state) + '/' + QUESTS.length);
        for (const R of rows.values()) {
          const prog = questProgress(g.state, R.q), done = prog >= R.q.target;
          setText(R.rs, formatNum(prog) + ' / ' + formatNum(R.q.target));
          R.bar.style.width = (prog / R.q.target * 100).toFixed(1) + '%';
          R.row.classList.toggle('ready', done);
          R.btn.hidden = !done;
          if (done) setText(R.cost, formatNum(questReward(R.q, g.income)));
        }
      },
    };
  }

  _buildZones(body) {
    const g = this.game;
    const cards = ZONES.map((z, zi) => {
      const row = el('div', 'row');
      row.innerHTML = `<div class="ri">${ICONS.map}</div><div class="rm"><div class="rt">${z.name}</div><div class="rs"></div></div>`;
      const btn = el('button', 'btn btn-teal', '<span class="lbl"></span><span class="cost"><span class="ico sm">' + ICONS.coin + '</span><i></i></span>');
      row.append(btn); body.append(row);
      this._press(btn, () => {
        if (!this._guard()) return;
        const st = g.state.zones[zi];
        if (st.unlocked) { this.setZone(zi); this.closeSheet(); return; }
        const ok = g.unlockZone(zi);
        if (ok) { this.setZone(zi); this.closeSheet(); } else this._after(false, btn);
      });
      return { zi, row, btn, rs: row.querySelector('.rs'), lbl: btn.querySelector('.lbl'), cost: btn.querySelector('.cost i'), costBox: btn.querySelector('.cost'), icon: row.querySelector('.ri') };
    });
    body.append(el('div', 'note', 'Yeni bir bölgeyi açmak için önceki bölgedeki tüm makineleri satın almalısın.'));
    return {
      update: () => {
        for (const C of cards) {
          const st = g.state.zones[C.zi], owned = MACHINES.filter((m, i) => m.zone === C.zi && g.state.machines[i].owned).length;
          const total = MACHINES.filter((m) => m.zone === C.zi).length;
          C.icon.innerHTML = st.unlocked ? ICONS.map : ICONS.lock;
          if (st.unlocked) {
            C.rs.textContent = 'Makineler ' + owned + '/' + total + (C.zi === this.r.zone ? '  ·  Buradasın' : '');
            C.lbl.textContent = C.zi === this.r.zone ? 'BURADA' : 'GİT'; C.costBox.hidden = true;
            C.btn.classList.toggle('max', C.zi === this.r.zone); C.btn.classList.remove('cant');
          } else {
            const can = g.canUnlockZone(C.zi);
            C.rs.textContent = can ? 'Açmaya hazır!' : 'Önce önceki bölgeyi tamamla';
            C.lbl.textContent = 'AÇ'; C.costBox.hidden = false; setText(C.cost, formatNum(ZONES[C.zi].unlockCost));
            C.btn.classList.toggle('cant', !can || !g.canAfford(ZONES[C.zi].unlockCost));
            C.btn.classList.remove('max');
          }
        }
      },
    };
  }

  _buildSettings(body) {
    const s = this.game.state.settings;
    const mk = (label, key) => {
      const row = el('div', 'setting', `<span>${label}</span>`);
      const t = el('button', 'toggle'); t.setAttribute('role', 'switch');
      row.append(t); body.append(row);
      const sync = () => { t.classList.toggle('on', s[key]); t.setAttribute('aria-checked', String(s[key])); };
      this._press(t, () => {
        s[key] = !s[key]; sync();
        if (key === 'haptics' && s.haptics) this.fb.vibrate(30);
        if (key === 'music') this.fb.applyMusicSetting();
        this.fb.button(); this.hooks.save && this.hooks.save();
      });
      sync();
    };
    mk('Ses efektleri', 'sound');
    mk('Müzik', 'music');
    mk('Titreşim', 'haptics');
    const stats = el('button', 'btn btn-blue wide', 'İstatistikler');
    const code = el('button', 'btn btn-purple wide', 'Kayıt Kodu (Yedekle / Yükle)');
    body.append(stats, code);
    this._press(stats, () => { this.fb.button(); this.openSheet('stats'); });
    this._press(code, () => { this.fb.button(); this.showSaveCode(); });
    body.append(el('div', 'note', 'Çevrimdışı kazanç: en fazla ' + TUNING.offline.capHours + ' saat, %' + Math.round(TUNING.offline.efficiency * 100) + ' verimle. Kayıt kodu ile ilerlemeni telefon ve bilgisayar arasında taşıyabilirsin.'));
    const reset = el('button', 'btn btn-red wide', 'İlerlemeyi Sıfırla');
    body.append(reset);
    this._press(reset, () => this.confirm('Her şey silinecek!', 'Tüm ilerlemen kalıcı olarak silinir. Emin misin?', 'Evet, sıfırla', () => this.hooks.reset && this.hooks.reset()));
    return { update() {} };
  }

  _buildPatent(body) {
    const g = this.game, s = g.state;
    // Kilitliyken: şart + ilerleme çubuğu
    const lockCard = el('div', 'lock-card', `<div class="lk-ico" data-icon="lock"></div><div class="lk-t">Patent Laboratuvarı kilitli</div>
      <div class="lk-s">Açılması için bu koşuda <b class="need"></b> kazan.<br>Sonra fabrikanı yenileyip kalıcı <b>Patent Yıldızı</b> kazanırsın: her yıldız +%${Math.round(PRESTIGE.starBonus * 100)} gelir ve güçlü kalıcı geliştirmeler.</div>
      <div class="prog big"><i></i></div><div class="lk-p"></div>`);
    body.append(lockCard);
    const card = el('div', 'stat-card', '<div class="big"><span class="ico" data-icon="star"></span><span class="v1"></span></div><div class="sub s1"></div><div class="sub s2"></div>');
    body.append(card);
    const btn = el('button', 'btn btn-gold prestige', '<span class="lbl"></span><small></small>');
    body.append(btn);
    this._press(btn, () => {
      const gain = prestigeGain(s);
      if (gain < PRESTIGE.minGain) { this.fb.deny(); this.toast(formatNum(PRESTIGE.base) + ' kazanç gerekli (bu koşuda)'); return; }
      const after = 1 + PRESTIGE.starBonus * (s.meta.totalStars + gain);
      this.confirm('Fabrikayı yenile?', `Para, makineler ve bölgeler sıfırlanır. Görevler, yıldızlar ve patentler kalır.<br><b>+${formatNum(gain)} ★</b> kazanırsın (gelir çarpanı x${formatRate(permMult(s))} → x${formatRate(after * (1 + 0.2 * patentLvl(s, 'income')))}).`,
        'Yenile!', () => { this.closeSheet(true); g.prestige(); });
    });
    const shopTitle = el('div', 'divider', 'Patentler (Yıldızla alınır)');
    body.append(shopTitle);
    const rows = new Map();
    for (const p of PATENTS) {
      const row = el('div', 'row');
      row.innerHTML = `<div class="ri sm" data-icon="star"></div><div class="rm"><div class="rt"></div><div class="rs">${p.desc}</div></div>`;
      const b = el('button', 'btn btn-gold', '<span class="lbl">AL</span><span class="cost"><span class="ico sm" data-icon="star"></span><i></i></span>');
      row.append(b); body.append(row);
      this._press(b, () => { if (!this._guard()) return; this._after(g.buyPatent(p.id), b); });
      rows.set(p.id, { p, row, b, rt: row.querySelector('.rt'), cost: b.querySelector('.cost i'), costBox: b.querySelector('.cost'), lbl: b.querySelector('.lbl') });
    }
    const note = el('div', 'note', 'Her Patent Yıldızı kalıcı olarak +%' + Math.round(PRESTIGE.starBonus * 100) + ' gelir verir. Yenilemeden önce daha fazla kazanırsan daha fazla yıldız alırsın.');
    body.append(note);
    return {
      update: () => {
        const open = prestigeUnlocked(s), gain = prestigeGain(s);
        lockCard.hidden = open; card.hidden = !open; btn.hidden = !open;
        shopTitle.textContent = open ? 'Patentler (Yıldızla alınır)' : 'Açılınca alabileceklerin';
        if (!open) {
          setText(lockCard.querySelector('.need'), formatNum(prestigeNeed()));
          lockCard.querySelector('.prog i').style.width = (prestigeProgress(s) * 100).toFixed(1) + '%';
          setText(lockCard.querySelector('.lk-p'), formatNum(s.stats.runEarned) + ' / ' + formatNum(prestigeNeed()));
        } else {
          setText(card.querySelector('.v1'), formatNum(s.meta.stars) + ' Yıldız');
          setText(card.querySelector('.s1'), 'Gelir çarpanı: x' + formatRate(permMult(s)) + '  ·  Toplam ' + formatNum(s.meta.totalStars) + ' ★  ·  ' + s.meta.prestiges + ' yenileme');
          setText(card.querySelector('.s2'), 'Bu koşuda kazanç: ' + formatNum(s.stats.runEarned));
          btn.querySelector('.lbl').textContent = gain >= PRESTIGE.minGain ? 'FABRİKAYI YENİLE  +' + formatNum(gain) + ' ★' : 'Fabrikayı yenile (kilitli)';
          btn.querySelector('small').textContent = gain >= PRESTIGE.minGain ? 'İlerleme sıfırlanır, kalıcı bonus kazanırsın' : formatNum(PRESTIGE.base) + ' kazanınca açılır';
          btn.classList.toggle('cant', gain < PRESTIGE.minGain);
        }
        for (const R of rows.values()) {
          const lvl = patentLvl(s, R.p.id), maxed = lvl >= R.p.max, cost = patentCost(R.p, lvl);
          setText(R.rt, R.p.name + '  ' + lvl + '/' + R.p.max);
          R.row.classList.toggle('dim', !open);
          R.costBox.hidden = maxed; setText(R.lbl, maxed ? 'MAKS' : !open ? 'KİLİTLİ' : 'AL');
          if (!maxed) setText(R.cost, formatNum(cost));
          R.b.classList.toggle('cant', !open || (!maxed && s.meta.stars < cost));
          R.b.classList.toggle('max', maxed);
        }
      },
    };
  }

  /** Günlük görevler sekmesi. */
  _buildMissions(body) {
    const g = this.game;
    const head = el('div', 'divider');
    const list = el('div', '');
    body.append(head, list);
    const chest = el('div', 'row chest', `<div class="ri" data-icon="gift"></div><div class="rm"><div class="rt">Günün Sandığı</div><div class="rs"></div><div class="prog"><i></i></div></div>`);
    const cbtn = el('button', 'btn btn-gold', '<span class="lbl">AÇ</span><span class="cost"><span class="ico sm" data-icon="coin"></span><i></i></span>');
    chest.append(cbtn); body.append(chest);
    this._press(cbtn, () => {
      if (!this._guard()) return;
      const got = g.claimChest();
      if (got > 0) { this.update(); }
    });
    let key = '', rows = [];
    const build = () => {
      list.innerHTML = ''; rows = [];
      for (const m of g.missions()) {
        const row = el('div', 'row');
        row.innerHTML = `<div class="ri" data-icon="target"></div><div class="rm"><div class="rt"></div><div class="rs"></div><div class="prog"><i></i></div></div>`;
        const btn = el('button', 'btn btn-green', '<span class="lbl">AL</span><span class="cost"><span class="ico sm" data-icon="coin"></span><i></i></span>');
        row.append(btn); list.append(row);
        this._press(btn, () => {
          if (!this._guard()) return;
          const got = g.claimMission(m.idx);
          if (got > 0) { this.toast('+' + formatNum(got) + ' kazandın!'); this.update(); }
        });
        rows.push({ idx: m.idx, row, btn, rt: row.querySelector('.rt'), rs: row.querySelector('.rs'), bar: row.querySelector('.prog i'), cost: btn.querySelector('.cost i'), ico: row.querySelector('.ri') });
      }
      hydrateIcons(list);
    };
    return {
      update: () => {
        const k = g.state.dm.day + g.state.dm.list.map((m) => m.id + m.target).join();
        if (k !== key) { key = k; build(); }
        const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const done = g.missions().filter((m) => m.claimed).length;
        setText(head, 'Günlük görevler  ·  ' + formatDuration((next - now) / 1000) + ' kaldı');
        const ms = g.missions();
        for (const R of rows) {
          const m = ms[R.idx];
          setText(R.rt, m.text);
          setText(R.rs, m.claimed ? 'Ödül alındı' : formatNum(m.progress) + ' / ' + formatNum(m.target));
          R.bar.style.width = (m.progress / m.target * 100).toFixed(1) + '%';
          R.row.classList.toggle('ready', m.done && !m.claimed);
          R.row.classList.toggle('done', m.claimed);
          R.btn.hidden = !m.done || m.claimed;
          if (!R.btn.hidden) setText(R.cost, formatNum(m.reward));
        }
        const dm = g.state.dm, ready = g.chestReady();
        setText(chest.querySelector('.rs'), dm.chest ? 'Bugünkü sandık açıldı' : done + ' / ' + MISSIONS.count + ' görevi bitirince açılır');
        chest.querySelector('.prog i').style.width = (done / MISSIONS.count * 100).toFixed(1) + '%';
        chest.classList.toggle('ready', ready); chest.classList.toggle('done', dm.chest);
        cbtn.hidden = !ready;
        if (ready) setText(cbtn.querySelector('.cost i'), formatNum(g.chestReward()));
      },
    };
  }

  /** Rozetler sekmesi: kazanılanlar kalıcı gelir bonusu verir. */
  _buildMedals(body) {
    const g = this.game, s = g.state;
    const head = el('div', 'divider');
    const list = el('div', '');
    body.append(head, list);
    let key = -1, rows = [];
    const build = () => {
      list.innerHTML = ''; rows = [];
      const order = ACHIEVEMENTS.slice().sort((a, b) => (achDone(s, a) ? 1 : 0) - (achDone(s, b) ? 1 : 0) || achProgress(s, b) / b.target - achProgress(s, a) / a.target);
      for (const a of order) {
        const have = achDone(s, a);
        const row = el('div', 'row' + (have ? ' done' : ''));
        row.innerHTML = `<div class="ri medal medal-${a.tier}${have ? '' : ' off'}" data-icon="medal"></div><div class="rm"><div class="rt">${a.title}</div><div class="rs">${a.desc}</div>${have ? '' : '<div class="prog"><i></i></div>'}</div>${have ? '<div class="ri sm" data-icon="check"></div>' : '<div class="pct"></div>'}`;
        list.append(row);
        rows.push({ a, have, bar: row.querySelector('.prog i'), pct: row.querySelector('.pct') });
      }
      hydrateIcons(list);
    };
    return {
      update: () => {
        const n = achCount(s);
        if (n !== key) { key = n; build(); }
        setText(head, 'Rozetler ' + n + '/' + ACHIEVEMENTS.length + '  ·  Gelir bonusu +%' + Math.round(n * ACH_BONUS * 100));
        for (const R of rows) {
          if (R.have) continue;
          const f = achProgress(s, R.a) / R.a.target;
          R.bar.style.width = (f * 100).toFixed(1) + '%';
          setText(R.pct, Math.floor(f * 100) + '%');
        }
      },
    };
  }

  _buildStats(body) {
    const g = this.game, s = g.state, st = s.stats;
    const owned = () => s.machines.filter((m) => m.owned).length;
    const defs = [
      ['Oynama süresi', () => formatDuration(st.playSecs)],
      ['Fabrika seviyesi', () => String(factoryLevel(s).level)],
      ['Üretilen ürün', () => formatNum(st.produced)],
      ['Satılan ürün', () => formatNum(st.sold)],
      ['Toplam kazanç', () => formatNum(st.earned)],
      ['Bu koşudaki kazanç', () => formatNum(st.runEarned)],
      ['En yüksek gelir', () => formatRate(st.maxIncome) + '/sn'],
      ['Dokunuş', () => formatNum(st.taps)],
      ['Yükseltme', () => formatNum(st.upgrades)],
      ['Makineler', () => owned() + '/' + MACHINES.length],
      ['Bölgeler', () => s.zones.filter((z) => z.unlocked).length + '/' + ZONES.length],
      ['Altın Kasa', () => formatNum(st.golden)],
      ['Acil Sipariş', () => formatNum(st.rushDone)],
      ['Günlük görev', () => formatNum(st.missionsDone)],
      ['Rozetler', () => achCount(s) + '/' + ACHIEVEMENTS.length],
      ['Yenileme  /  Patent Yıldızı', () => s.meta.prestiges + '  /  ' + formatNum(s.meta.totalStars)],
      ['Çevrimdışı kazanç', () => formatNum(st.offlineEarned)],
      ['Başlangıç', () => new Date(s.createdAt).toLocaleDateString('tr-TR')],
    ];
    const cells = defs.map(([label, fn]) => {
      const row = el('div', 'stat-row', `<span>${label}</span><b></b>`);
      body.append(row);
      return { fn, v: row.querySelector('b') };
    });
    return { update: () => { for (const c of cells) setText(c.v, c.fn()); } };
  }

  // ----------------------------------------------------------- kayıt kodu
  showSaveCode() {
    this.hooks.save && this.hooks.save();
    const code = encodeSave(this.game.state);
    const c = this._modal(`<h3>Kayıt Kodu</h3><p>Bu kodu kopyala. Başka bir cihazda “Kodu Yükle” ile ilerlemeni aktarabilirsin.</p>
      <textarea class="code-box" readonly rows="4" spellcheck="false"></textarea>
      <div class="btns"><button class="btn btn-blue half" data-x="copy">Kopyala</button><button class="btn btn-purple half" data-x="load">Kodu Yükle</button></div>
      <button class="btn btn-green" data-x="ok">Kapat</button>`);
    const box = c.querySelector('textarea');
    box.value = code;
    c.querySelector('[data-x=ok]').onclick = () => this.closeModal();
    c.querySelector('[data-x=load]').onclick = () => this.showLoadCode();
    c.querySelector('[data-x=copy]').onclick = () => {
      const done = () => this.toast('Kopyalandı!');
      const fallback = () => { box.focus(); box.select(); try { document.execCommand('copy') ? done() : this.toast('Kodu elle seçip kopyala'); } catch (e) { this.toast('Kodu elle seçip kopyala'); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, fallback); else fallback();
    };
  }

  showLoadCode() {
    const c = this._modal(`<h3>Kodu Yükle</h3><p>Başka cihazdan aldığın kayıt kodunu yapıştır. Mevcut ilerlemenin üzerine yazılır.</p>
      <textarea class="code-box" rows="4" spellcheck="false" placeholder="MF1...."></textarea>
      <div class="btns"><button class="btn btn-blue half" data-x="no">Vazgeç</button><button class="btn btn-red half" data-x="ok">Yükle</button></div>`);
    const box = c.querySelector('textarea');
    c.querySelector('[data-x=no]').onclick = () => this.closeModal();
    c.querySelector('[data-x=ok]').onclick = () => {
      const res = decodeSave(box.value);
      if (!res.ok) { this.fb.deny(); this.toast(res.error === 'checksum' ? 'Kod eksik ya da bozuk' : 'Geçersiz kayıt kodu'); return; }
      this.confirm('İlerlemenin üzerine yazılsın?', 'Şu anki ilerlemen silinir ve koddaki kayıt yüklenir.', 'Yükle', () => this.hooks.importState && this.hooks.importState(res.state));
    };
  }

  // ------------------------------------------------------------ bildirimler
  /** Alt kısımda kayan kart (rozet, görev, sipariş). En fazla 2 kart görünür, fazlası sıraya girer. */
  notify(icon, title, sub, cls = '') {
    this.noticeQ.push({ icon, title, sub, cls });
    if (this.noticeQ.length > 5) this.noticeQ.shift();
    this._drainNotices();
  }

  _drainNotices() {
    while (this.noticeShown < 2 && this.noticeQ.length) {
      const n = this.noticeQ.shift();
      const item = el('div', 'notice-item ' + n.cls, `<div class="n-ico ${n.cls}" data-icon="${n.icon}"></div><div><div class="n-t"></div><div class="n-s"></div></div>`);
      item.querySelector('.n-t').textContent = n.title; item.querySelector('.n-s').textContent = n.sub;
      hydrateIcons(item);
      this.n.notice.append(item);
      this.noticeShown++;
      setTimeout(() => {
        item.classList.add('out');
        setTimeout(() => { item.remove(); this.noticeShown--; this._drainNotices(); }, 320);
      }, 2800);
    }
  }

  /** Banttaki Acil Sipariş makinesine git (bölgeyi değiştirir, makineyi seçer). */
  goToMachine(i) {
    this.closeSheet(true);
    const z = MACHINES[i].zone;
    if (this.game.state.zones[z].unlocked && z !== this.r.zone) this.r.setZone(z);
    this.game.select(i);
    this.update();
  }

  // ----------------------------------------------------------------- ipuçları
  /** İlk dakikalarda ilgili düğmenin üstünde küçük bir ipucu balonu gösterir. */
  _coach() {
    const g = this.game, s = g.state, c = this.n.coach;
    let cur = null;
    for (const st of TUTORIAL) {
      if (s.tut[st.id]) continue;
      if (st.done(g)) { s.tut[st.id] = true; continue; }
      if (!cur && st.show(g)) cur = st;
    }
    const target = cur && this.n[cur.target];
    const blocked = this.sheet || !this.n.modal.hidden || document.getElementById('splash');
    if (!cur || blocked || !target || target.hidden) { if (!c.hidden) { c.hidden = true; this.coachKey = ''; } return; }
    const app = this.n.app.getBoundingClientRect(), r = target.getBoundingClientRect();
    const tx = r.left + r.width / 2 - app.left;
    if (c.hidden) c.hidden = false;
    setText(this.n['coach-text'], cur.text);
    const half = Math.min(this.n['coach-text'].offsetWidth / 2, app.width / 2 - 8) || 90;
    const cx = Math.max(half + 8, Math.min(app.width - half - 8, tx));
    const key = cur.id + '|' + Math.round(cx) + '|' + Math.round(app.bottom - r.top);
    if (key === this.coachKey) return;
    this.coachKey = key;
    c.style.left = cx.toFixed(0) + 'px';
    c.style.bottom = (app.bottom - r.top + 12).toFixed(0) + 'px';
    c.style.setProperty('--ax', (half + tx - cx).toFixed(0) + 'px');
  }

  /** Dock'taki seçili makine portresi (canlı: ilerleme ve efektler oynar). */
  _drawPortrait() {
    const cv = this.n['mc-portrait'], ctx = cv.getContext('2d');
    const g = this.game, i = g.state.selected, m = g.state.machines[i], def = MACHINES[i], r = g.rt[i], o = this.po;
    o.color = def.color; o.tier = visualTier(m.level); o.p = r.progress > 1 ? 1 : r.progress; o.t = this.r.t;
    o.pulse = r.pulse; o.auto = m.auto; o.blocked = r.blocked; o.level = m.level;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.translate(cv.width / 2, cv.height - 12);
    drawMachine(ctx, def.kind, 78, 74, o);
  }

  /** Bugün alınabilir günlük hediye varsa gösterir. */
  maybeDaily() {
    if (this.game.state.stats.produced >= 10 && this.game.dailyStatus().available) this.showDaily(); // yeni oyuncuyu ilk dakikada bölme
  }

  showDaily() {
    const g = this.game, st = g.dailyStatus();
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => {
      const cls = (st.available ? d < st.day : d <= st.day) ? 'done' : (st.available && d === st.day ? 'now' : '');
      return `<b class="${cls}${d === 7 ? ' last' : ''}">${d}</b>`;
    }).join('');
    if (!st.available) {
      const c = this._modal(`<div class="gift" data-icon="gift"></div><h3>Günlük hediye alındı</h3><p>Yarın tekrar gel, seri devam etsin!</p><div class="days">${days}</div><button class="btn btn-blue" data-x="ok">Tamam</button>`);
      c.querySelector('[data-x=ok]').onclick = () => this.closeModal();
      return;
    }
    const amount = Math.max(DAILY.minMoney, g.income * st.secs);
    const c = this._modal(`<div class="gift" data-icon="gift"></div><h3>Günlük Hediye</h3><p>${st.day}. gün${st.day === 7 ? ' (süper ödül!)' : ''}</p>
      <div class="days">${days}</div>
      <div class="big-num"><span class="ico" data-icon="coin"></span><span>${formatNum(amount)}</span></div>${st.day === 7 ? '<p><b>+' + DAILY.starsOnLastDay + ' ★ Patent Yıldızı</b></p>' : ''}
      <button class="btn btn-green" data-x="ok">AL</button>`);
    c.querySelector('[data-x=ok]').onclick = () => {
      const r = g.claimDaily();
      this.closeModal();
      if (r) { this.fb.upgrade(); this.toast('+' + formatNum(r.money) + (r.stars ? '  +' + r.stars + ' ★' : '')); this._popMoney(); }
      this.update();
    };
  }

  /** Yeni bölge açıldığında hikaye penceresi. */
  showChapter(z) {
    const zone = ZONES[z];
    const c = this._modal(`<div class="chapter-tag">BÖLÜM ${z + 1}</div><h3>${zone.name}</h3><p class="story">${zone.story}</p><button class="btn btn-green" data-x="ok">Başla!</button>`);
    c.querySelector('[data-x=ok]').onclick = () => this.closeModal();
  }

  // ------------------------------------------------------------------ pencereler
  _modal(html) {
    const m = this.n.modal;
    m.innerHTML = '<div class="card">' + html + '</div>';
    m.hidden = false;
    hydrateIcons(m);
    return m.firstElementChild;
  }
  closeModal() { this.n.modal.hidden = true; this.n.modal.innerHTML = ''; }

  confirm(title, text, okLabel, onOk) {
    const c = this._modal(`<h3>${title}</h3><p>${text}</p><div class="btns"><button class="btn btn-blue half" data-x="no">Vazgeç</button><button class="btn btn-red half" data-x="ok">${okLabel}</button></div>`);
    c.querySelector('[data-x=no]').onclick = () => this.closeModal();
    c.querySelector('[data-x=ok]').onclick = () => { this.closeModal(); onOk(); };
  }

  showOffline(res) {
    this.fb.quest();
    const capped = res.capped ? `<p>(En fazla ${TUNING.offline.capHours} saatlik kazanç hesaplandı)</p>` : '';
    const c = this._modal(`<div class="gift" data-icon="gift"></div><h3>Fabrikan çalışmaya devam etti!</h3><p>${formatDuration(res.rawSeconds)} boyunca yoktun</p>
      <p>Çevrimdışı kazanç:</p><div class="big-num"><span class="ico" data-icon="coin"></span><span>${formatNum(res.earned)}</span></div>${capped}
      <button class="btn btn-green" data-x="ok">TOPLA</button>`);
    c.querySelector('[data-x=ok]').onclick = () => { this.fb.upgrade(); this.closeModal(); this._popMoney(); this.maybeDaily(); };
  }

  _popMoney() {
    const p = this.n['money-pill'];
    p.classList.add('pop'); setTimeout(() => p.classList.remove('pop'), 140);
  }

  // ------------------------------------------------------------- güncelleme
  /** Her karede çağrılır: para sayacı animasyonu + 5 Hz arayüz yenilemesi. */
  frame(dt) {
    const target = this.game.state.money;
    if (this.shownMoney !== target) {
      const diff = target - this.shownMoney;
      this.shownMoney = Math.abs(diff) < Math.max(1, target * 0.0005) ? target : this.shownMoney + diff * Math.min(1, dt * 12);
      if (diff > 0 && Math.random() < 0.08) this._popMoney();
    }
    setText(this.n.money, formatNum(this.shownMoney));
    this.accum += dt;
    this.portT += dt;
    if (this.portT >= 0.05) { this.portT = 0; this._drawPortrait(); }
    if (this.accum >= 0.2) { this.accum = 0; this.update(); }
  }

  update() {
    const g = this.game, s = g.state, n = this.n;
    const i = s.selected, m = s.machines[i], def = MACHINES[i];

    setText(n.income, formatRate(g.income));
    const fl = factoryLevel(s);
    setText(n.flevel, 'Fabrika Sv.' + fl.level);
    n['flevel-bar'].style.width = (fl.progress * 100).toFixed(1) + '%';

    setText(n['mc-name'], def.name);
    setText(n['mc-lv'], 'Sv.' + m.level);
    const ct = cycleTime(def, m);
    setText(n['mc-stats'], ct.toFixed(ct < 1 ? 2 : 1) + 'sn · ' + formatNum(itemValue(def, m, g.gm)) + '/ürün' + (m.auto ? ' · ' + formatRate(machineIncome(def, m, g.gm)) + '/sn' : ' · Elle'));

    // yükselt düğmesi
    const mult = MULTS[this.mult];
    let cost, label;
    if (m.level >= TUNING.maxLevel) { cost = Infinity; label = 'MAKS'; }
    else if (mult < 0) {
      const k = maxAffordableLevels(def, m.level, s.money);
      cost = levelUpCost(def, m.level, Math.max(1, k)); label = 'MAKS +' + Math.max(1, k);
    } else {
      const k = Math.min(mult, TUNING.maxLevel - m.level);
      cost = levelUpCost(def, m.level, k); label = k > 1 ? 'YÜKSELT x' + k : 'YÜKSELT';
    }
    setText(n['lvl-lbl'], label);
    setText(n['lvl-cost'], Number.isFinite(cost) ? formatNum(cost) : '-');
    n['btn-level'].classList.toggle('cant', !g.canAfford(cost));
    setText(n['btn-mult'], mult < 0 ? 'MAKS' : 'x' + mult);

    // makine al
    const ni = g.nextMachineIndex();
    if (ni >= 0) {
      setText(n['buy-cost'], formatNum(MACHINES[ni].baseCost));
      n['btn-buy'].classList.toggle('cant', !g.canAfford(MACHINES[ni].baseCost));
      n['btn-buy'].classList.toggle('glow', g.canAfford(MACHINES[ni].baseCost));
    } else {
      setText(n['buy-cost'], g.nextZoneIndex() >= 0 ? 'Bölge aç' : 'Tamam');
      n['btn-buy'].classList.add('cant'); n['btn-buy'].classList.remove('glow');
    }
    // otomasyon ipucu: otomatik değilse ve parası yetiyorsa Geliştir parlasın
    const canAuto = !m.auto && g.canAfford(def.autoCost);
    n['btn-up'].classList.toggle('glow', canAuto);
    setText(n['up-hint'], canAuto ? 'Otomasyon!' : '');

    // makine al: seviye şartı
    if (ni >= 0) {
      const blk = g.machineBlock(ni);
      if (blk && blk.type === 'level') { setText(n['buy-cost'], 'Sv.' + blk.need + ' gerek'); n['btn-buy'].classList.add('cant'); n['btn-buy'].classList.remove('glow'); }
      else setText(n['buy-cost'], formatNum(g.machineCost(ni)));
    }

    // yıldızlar, geçici bonus, günlük hediye, patent düğmesi
    const sc = n['stars-chip'];
    sc.hidden = !(s.meta.totalStars > 0);
    if (!sc.hidden) setText(sc, formatNum(s.meta.stars) + ' ★  x' + formatRate(permMult(s)));
    const frenzy = s.boosts.find((b) => b.until > Date.now());
    n['boost-chip'].hidden = !frenzy;
    if (frenzy) setText(n['boost-chip'], 'x' + formatRate(frenzy.mult) + ' · ' + Math.ceil((frenzy.until - Date.now()) / 1000) + 'sn');
    n['btn-daily'].hidden = !g.dailyStatus().available;
    const gain = prestigeGain(s), pOpen = prestigeUnlocked(s), pb = n['btn-patent'];
    pb.classList.toggle('locked', !pOpen);
    pb.classList.toggle('glow', pOpen && gain >= PRESTIGE.minGain && gain >= s.meta.totalStars * 0.5);
    setText(n['patent-hint'], pOpen ? (gain >= PRESTIGE.minGain ? '+' + formatNum(gain) + ' ★' : '') : '%' + Math.floor(prestigeProgress(s) * 100));
    const pIcon = pb.querySelector('[data-icon]');
    const want = pOpen ? 'star' : 'lock';
    if (pIcon.dataset.icon !== want) { pIcon.dataset.icon = want; pIcon.innerHTML = ICONS[want]; }

    const claimable = claimableCount(s) + g.missionClaimable();
    n['quest-badge'].hidden = claimable === 0; setText(n['quest-badge'], String(claimable));

    // Acil Sipariş bandı
    const rush = g.rush;
    n.rush.hidden = !rush;
    if (rush) {
      setText(n['rush-name'], MACHINES[rush.machine].name + '  ' + rush.got + '/' + rush.target);
      setText(n['rush-time'], Math.ceil(rush.ttl) + ' sn');
      n['rush-fill'].style.width = Math.min(100, rush.got / rush.target * 100).toFixed(1) + '%';
      n['rush-tbar'].style.width = Math.max(0, rush.ttl / rush.max * 100).toFixed(1) + '%';
      n.rush.classList.toggle('urgent', rush.ttl < 8);
    }
    this._coach();

    // bölge okları
    const un = this.zoneUnlocked(), z = this.r.zone;
    n['zone-prev'].hidden = !un.slice(0, z).some(Boolean);
    n['zone-next'].hidden = !un.slice(z + 1).some(Boolean);
    const nz = g.nextZoneIndex();
    n['btn-zones'].classList.toggle('glow', nz >= 0 && g.canUnlockZone(nz) && g.canAfford(ZONES[nz].unlockCost));

    if (this.sheet) this.sheet.update();
  }
}
