// DOM arayüzü: HUD, alt dock, paneller (sheet) ve pencereler. Oyun mantığına yalnızca Game API'si üzerinden dokunur.
import { MACHINES, ZONES, QUESTS, UPGRADES, TUNING, PATENTS, PRESTIGE, DAILY } from '../core/config.js';
import {
  cycleTime, itemValue, storageCap, levelUpCost, maxAffordableLevels, factoryLevel, machineIncome,
  prestigeGain, patentLvl, patentCost, permMult,
} from '../core/economy.js';
import { formatNum, formatRate, formatDuration } from '../core/format.js';
import { questProgress, questDone, questClaimed, questReward, claimableCount, visibleQuests, completedCount } from '../core/quests.js';
import { ICONS, hydrateIcons } from './icons.js';

const $ = (id) => document.getElementById(id);
const MULTS = [1, 10, -1];

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
      'sheet-body', 'sheet-close', 'backdrop', 'modal', 'zone-prev', 'zone-next', 'btn-daily', 'btn-patent', 'patent-hint', 'stars-chip', 'boost-chip']) this.n[id] = $(id);
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
    };
    const titles = { upgrades: 'Geliştir', quests: 'Görevler', zones: 'Fabrika Bölgeleri', settings: 'Ayarlar', patent: 'Patent Laboratuvarı' };
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

  _buildQuests(body) {
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
      this._press(t, () => { s[key] = !s[key]; sync(); if (key === 'haptics' && s.haptics) this.fb.vibrate(30); this.fb.button(); this.hooks.save && this.hooks.save(); });
      sync();
    };
    mk('Ses efektleri', 'sound');
    mk('Titreşim', 'haptics');
    const st = this.game.state.stats;
    body.append(el('div', 'note', 'Toplam üretilen ürün: ' + formatNum(st.produced) + '<br>Toplam satılan ürün: ' + formatNum(st.sold) + '<br>Çevrimdışı kazanç toplamı: ' + formatNum(st.offlineEarned) +
      '<br>Çevrimdışı kazanç: en fazla ' + TUNING.offline.capHours + ' saat, %' + Math.round(TUNING.offline.efficiency * 100) + ' verimle.'));
    const reset = el('button', 'btn btn-red wide', 'İlerlemeyi Sıfırla');
    body.append(reset);
    this._press(reset, () => this.confirm('Her şey silinecek!', 'Tüm ilerlemen kalıcı olarak silinir. Emin misin?', 'Evet, sıfırla', () => this.hooks.reset && this.hooks.reset()));
    return { update() {} };
  }

  _buildPatent(body) {
    const g = this.game, s = g.state;
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
    body.append(el('div', 'divider', 'Patentler (Yıldızla alınır)'));
    const rows = new Map();
    for (const p of PATENTS) {
      const row = el('div', 'row');
      row.innerHTML = `<div class="ri sm" data-icon="star"></div><div class="rm"><div class="rt"></div><div class="rs">${p.desc}</div></div>`;
      const b = el('button', 'btn btn-gold', '<span class="lbl">AL</span><span class="cost"><span class="ico sm" data-icon="star"></span><i></i></span>');
      row.append(b); body.append(row);
      this._press(b, () => { if (!this._guard()) return; this._after(g.buyPatent(p.id), b); });
      rows.set(p.id, { p, b, rt: row.querySelector('.rt'), cost: b.querySelector('.cost i'), costBox: b.querySelector('.cost'), lbl: b.querySelector('.lbl') });
    }
    body.append(el('div', 'note', 'Her Patent Yıldızı kalıcı olarak +%' + Math.round(PRESTIGE.starBonus * 100) + ' gelir verir. Yenilemeden önce daha fazla kazanırsan daha fazla yıldız alırsın.'));
    return {
      update: () => {
        const gain = prestigeGain(s);
        setText(card.querySelector('.v1'), formatNum(s.meta.stars) + ' Yıldız');
        setText(card.querySelector('.s1'), 'Gelir çarpanı: x' + formatRate(permMult(s)) + '  ·  Toplam ' + formatNum(s.meta.totalStars) + ' ★  ·  ' + s.meta.prestiges + ' yenileme');
        setText(card.querySelector('.s2'), 'Bu koşuda kazanç: ' + formatNum(s.stats.runEarned));
        btn.querySelector('.lbl').textContent = gain >= PRESTIGE.minGain ? 'FABRİKAYI YENİLE  +' + formatNum(gain) + ' ★' : 'Fabrikayı yenile (kilitli)';
        btn.querySelector('small').textContent = gain >= PRESTIGE.minGain ? 'İlerleme sıfırlanır, kalıcı bonus kazanırsın' : formatNum(PRESTIGE.base) + ' kazanınca açılır';
        btn.classList.toggle('cant', gain < PRESTIGE.minGain);
        for (const R of rows.values()) {
          const lvl = patentLvl(s, R.p.id), maxed = lvl >= R.p.max, cost = patentCost(R.p, lvl);
          setText(R.rt, R.p.name + '  ' + lvl + '/' + R.p.max);
          R.costBox.hidden = maxed; setText(R.lbl, maxed ? 'MAKS' : 'AL');
          if (!maxed) setText(R.cost, formatNum(cost));
          R.b.classList.toggle('cant', !maxed && s.meta.stars < cost);
          R.b.classList.toggle('max', maxed);
        }
      },
    };
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
    const gain = prestigeGain(s);
    n['btn-patent'].hidden = !(s.meta.totalStars > 0 || s.meta.prestiges > 0 || gain >= PRESTIGE.minGain || s.zones[2].unlocked);
    n['btn-patent'].classList.toggle('glow', gain >= PRESTIGE.minGain && gain >= s.meta.totalStars * 0.5);
    setText(n['patent-hint'], gain >= PRESTIGE.minGain ? '+' + formatNum(gain) + ' ★' : '');

    const claimable = claimableCount(s);
    n['quest-badge'].hidden = claimable === 0; setText(n['quest-badge'], String(claimable));

    // bölge okları
    const un = this.zoneUnlocked(), z = this.r.zone;
    n['zone-prev'].hidden = !un.slice(0, z).some(Boolean);
    n['zone-next'].hidden = !un.slice(z + 1).some(Boolean);
    const nz = g.nextZoneIndex();
    n['btn-zones'].classList.toggle('glow', nz >= 0 && g.canUnlockZone(nz) && g.canAfford(ZONES[nz].unlockCost));

    if (this.sheet) this.sheet.update();
  }
}
