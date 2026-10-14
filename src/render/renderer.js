// Fabrika sahnesi: yerleşim, arka plan önbelleği, bant/ürün/makine çizimi ve efekt olayları.
import { MACHINES, ZONES, TUNING, SLOTS_PER_ZONE } from '../core/config.js';
import { visualTier, storageCap } from '../core/economy.js';
import { formatNum } from '../core/format.js';
import { FONT, OUT, rr, shade, drawMachine, drawProduct, drawLock } from './draw.js';
import { FX, K, C } from './fx.js';

const PI2 = Math.PI * 2;
const MOTE_COLOR = [C.WHITE, C.GREEN, C.PURPLE, C.WHITE, C.PURPLE, C.GOLD, C.GREEN, C.GOLD];   // bölge başına ortam parçacığı rengi
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.fx = new FX();
    this.zone = 0;
    this.lanes = [];            // bölgedeki makine indeksleri
    this.W = 0; this.H = 0; this.dpr = 1;
    this.bg = document.createElement('canvas');
    this.t = 0;
    this.dockBounce = new Float32Array(SLOTS_PER_ZONE);
    this.lastText = new Float64Array(MACHINES.length);
    this.shake = new Float32Array(SLOTS_PER_ZONE);
    this.hintTime = 0;
    this.live = null;                                   // duvarın canlı (animasyonlu) parçaları
    this.fade = 0;                                      // bölge geçişi karartması
    this.moteT = 0;                                     // ortam parçacığı sayacı
    this.dt = 0.016;
    this.steamT = new Float32Array(SLOTS_PER_ZONE);
    this.coinT = 0;
    this.coinTarget = { x: 40, y: -30 };                // uçan jetonların varacağı nokta (para kutusu)
    this.fx.target = this.coinTarget;
    this.onCoinArrive = null;
    this.o = { color: '#fff', tier: 0, p: 0, t: 0, pulse: 0, auto: false, blocked: false, level: 1 }; // yeniden kullanılan çizim parametresi
    this.setZone(0);
  }

  setZone(z) {
    this.zone = z;
    this.lanes = [];
    for (let i = 0; i < MACHINES.length; i++) if (MACHINES[i].zone === z) this.lanes.push(i);
    this.bgDirty = true;
    if (this.W) this.fade = 1;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(200, Math.round(r.width));
    this.H = Math.max(200, Math.round(r.height));
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.wallH = Math.max(44, Math.min(66, this.H * 0.14));
    this.laneH = (this.H - this.wallH - 4) / SLOTS_PER_ZONE;
    this.mw = Math.min(this.laneH * 1.2, this.W * 0.38);
    this.dockW = Math.min(64, this.W * 0.17);
    this.bgDirty = true;
    const ico = document.querySelector('#money-pill .ico');   // jetonlar buraya uçar
    if (ico) { const pr = ico.getBoundingClientRect(); this.coinTarget.x = pr.left + pr.width / 2 - r.left; this.coinTarget.y = pr.top + pr.height / 2 - r.top; }
  }

  // ------------------------------------------------------------ yerleşim yardımcıları
  laneTop(k) { return this.wallH + k * this.laneH; }
  baseY(k) { return this.laneTop(k) + this.laneH - 13; }
  machineX() { return 8 + this.mw / 2; }
  beltX0() { return 8 + this.mw * 0.82; }
  beltX1() { return this.W - this.dockW - 10; }

  /** Dokunulan şeridi döndürür: { lane, machine } veya null. */
  hit(x, y) {
    if (y < this.wallH) return null;
    const lane = Math.min(SLOTS_PER_ZONE - 1, Math.floor((y - this.wallH) / this.laneH));
    if (lane >= this.lanes.length) return null;
    return { lane, machine: this.lanes[lane], x, y };
  }

  // ------------------------------------------------------------ arka plan (önbellekli)
  _drawBackground() {
    const W = this.W, H = this.H, z = ZONES[this.zone], wh = this.wallH;
    const b = this.bg;
    b.width = Math.round(W * this.dpr); b.height = Math.round(H * this.dpr);
    const c = b.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // duvar
    const g = c.createLinearGradient(0, 0, 0, wh);
    g.addColorStop(0, z.wall); g.addColorStop(1, z.wall2);
    c.fillStyle = g; c.fillRect(0, 0, W, wh);
    c.fillStyle = 'rgba(255,255,255,.12)';
    for (let x = 0; x < W; x += 28) c.fillRect(x, 0, 2, wh);
    this._drawDeco(c, z, W, wh);
    // borular
    c.fillStyle = '#9aa5b1'; c.fillRect(0, wh - 8, W, 6);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, wh - 8, W, 2);
    c.fillStyle = OUT; c.fillRect(0, wh - 2, W, 2);
    // tabela
    c.font = '800 13px ' + FONT; const tw = c.measureText(z.name).width + 26;
    rr(c, W / 2 - tw / 2, 2, tw, 20, 8); c.fillStyle = '#fff7e0'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = OUT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(z.name, W / 2, 13);
    // zemin
    for (let k = 0; k < SLOTS_PER_ZONE; k++) {
      const y = this.laneTop(k);
      c.fillStyle = k % 2 ? z.floor2 : z.floor;
      c.fillRect(0, y, W, this.laneH + 1);
      c.fillStyle = 'rgba(0,0,0,.05)';
      for (let x = ((k % 2) * 20); x < W; x += 40) c.fillRect(x, y, 20, this.laneH);
      c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, y, W, 2);
    }
    this._drawBeams(c);
    this.bgDirty = false;
  }

  /** Duvar süsü (statik kısım). Canlı parçalar this.live'a kaydedilir ve _drawLive'da her karede çizilir. */
  _drawDeco(c, z, W, wh) {
    const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; // sabit "rastgele"
    const deco = z.deco;
    this.live = { type: deco, wins: [], stars: [], tips: [], clocks: [] };
    const L = this.live;
    if (deco === 'windows') {
      const wins = Math.max(2, Math.floor(W / 110));
      for (let i = 0; i < wins; i++) {
        const wx = (i + 0.5) * (W / wins) - 22;
        rr(c, wx, 8, 44, wh - 22, 6); c.fillStyle = '#bfe6ff'; c.fill();
        L.wins.push({ x: wx, y: 8, w: 44, h: wh - 22 });
      }
    } else if (deco === 'stars' || deco === 'galaxy') {
      for (let i = 0; i < 46; i++) {
        c.globalAlpha = 0.3 + rnd(i + 9) * 0.5; c.fillStyle = '#fff';
        const r = rnd(i + 3) * 1.6 + 0.4, x = rnd(i) * W, y = rnd(i + 50) * (wh - 12); c.fillRect(x, y, r, r);
        if (i < 16) L.stars.push([x, y, 2 + rnd(i + 70) * 2.5]);
      }
      c.globalAlpha = 1;
      if (deco === 'stars') { // Dünya
        const px = W * 0.82, py = wh * 0.45, pr = wh * 0.36;
        c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fillStyle = '#3d8bff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
        c.fillStyle = '#4fd37a'; c.beginPath(); c.ellipse(px - pr * 0.3, py - pr * 0.1, pr * 0.35, pr * 0.28, 0.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(px + pr * 0.25, py - pr * 0.45, pr * 0.3, pr * 0.1, 0, 0, Math.PI * 2); c.fill();
      } else { // spiral galaksi
        const gx = W * 0.2, gy = wh * 0.5;
        const g = c.createRadialGradient(gx, gy, 1, gx, gy, wh * 0.7); g.addColorStop(0, 'rgba(255,214,255,.95)'); g.addColorStop(1, 'rgba(160,90,255,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(gx, gy, wh * 0.9, wh * 0.38, -0.3, 0, Math.PI * 2); c.fill();
      }
    } else if (deco === 'crystals') {
      for (let i = 0; i < 9; i++) {
        const cx = (i + 0.5) * (W / 9) + (rnd(i) - 0.5) * 14, h = wh * (0.35 + rnd(i + 20) * 0.45), w = 12 + rnd(i + 40) * 12;
        c.beginPath(); c.moveTo(cx, wh - 8 - h); c.lineTo(cx + w / 2, wh - 8); c.lineTo(cx - w / 2, wh - 8); c.closePath();
        c.fillStyle = i % 2 ? '#c77dff' : '#4cc9f0'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(cx, wh - 8 - h); c.lineTo(cx + w * 0.1, wh - 8 - h * 0.2); c.lineTo(cx - w * 0.3, wh - 8 - h * 0.2); c.fill();
        L.tips.push([cx, wh - 8 - h * 0.6, 4 + rnd(i + 5) * 4]);
      }
    } else if (deco === 'clocks') {
      const n = Math.max(2, Math.floor(W / 120));
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * (W / n), cy = wh * 0.45, r = wh * 0.34;
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = '#fff7e0'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
        c.lineWidth = 1.5;
        for (let q = 0; q < 12; q++) { const a = q * Math.PI / 6; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); c.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); c.stroke(); }
        L.clocks.push([cx, cy, r]);
      }
    } else if (deco === 'neon') {
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(6,214,160,.45)';
      for (let x = 0; x < W; x += 26) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, wh - 8); c.stroke(); }
      for (let y = 6; y < wh - 8; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    }
  }

  /** Işık huzmeleri (pencereli bölgelerde zeminin üstüne, statik). */
  _drawBeams(c) {
    const L = this.live;
    if (!L || L.type !== 'windows') return;
    c.fillStyle = 'rgba(255,255,255,.13)';
    for (const w of L.wins) {
      c.beginPath(); c.moveTo(w.x + 4, this.wallH); c.lineTo(w.x + w.w - 4, this.wallH);
      c.lineTo(w.x + w.w + 46, this.wallH + this.laneH * 0.95); c.lineTo(w.x + 30, this.wallH + this.laneH * 0.95); c.closePath(); c.fill();
    }
  }

  /** Duvarın canlı parçaları: bulutlar, yanıp sönen yıldızlar, kayan yıldız, saat ibreleri, neon dalga, kristal ışıltısı. */
  _drawLive(ctx) {
    const L = this.live, t = this.t, wh = this.wallH, W = this.W;
    if (!L) return;
    if (L.type === 'windows') {
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      for (let i = 0; i < L.wins.length; i++) {
        const w = L.wins[i];
        ctx.save(); ctx.beginPath(); ctx.rect(w.x, w.y, w.w, w.h); ctx.clip();
        for (let k = 0; k < 2; k++) {
          const cx = w.x + ((t * (5 + k * 3) + i * 17 + k * 30) % (w.w + 30)) - 15, cy = w.y + 8 + k * 11;
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, PI2); ctx.arc(cx + 6, cy + 1, 4, 0, PI2); ctx.arc(cx - 5, cy + 2, 3.5, 0, PI2); ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; rr(ctx, w.x, w.y, w.w, w.h, 6); ctx.stroke();
        ctx.fillStyle = OUT; ctx.fillRect(w.x + 21, w.y, 2, w.h); ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(w.x + 5, w.y + 4, 8, w.h - 10); ctx.fillStyle = 'rgba(255,255,255,.95)';
      }
    } else if (L.type === 'stars' || L.type === 'galaxy') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < L.stars.length; i++) {
        const [x, y, r] = L.stars[i], a = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.8 + i * 1.7));
        ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.25, -r * 0.25); ctx.lineTo(r, 0); ctx.lineTo(r * 0.25, r * 0.25); ctx.lineTo(0, r); ctx.lineTo(-r * 0.25, r * 0.25); ctx.lineTo(-r, 0); ctx.lineTo(-r * 0.25, -r * 0.25); ctx.fill(); ctx.restore();
      }
      const f = (t % 6.5) / 1.1;              // kayan yıldız
      if (f < 1) {
        const x = W * 0.15 + f * W * 0.55, y = 4 + f * wh * 0.55;
        ctx.globalAlpha = 1 - f; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26, y - 11); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (L.type === 'crystals') {
      for (let i = 0; i < L.tips.length; i++) {
        const [x, y, r] = L.tips[i], a = Math.max(0, Math.sin(t * 2.2 + i * 2.3));
        if (a < 0.4) continue;
        ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.2, -r * 0.2); ctx.lineTo(r, 0); ctx.lineTo(r * 0.2, r * 0.2); ctx.lineTo(0, r); ctx.lineTo(-r * 0.2, r * 0.2); ctx.lineTo(-r, 0); ctx.lineTo(-r * 0.2, -r * 0.2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (L.type === 'clocks') {
      ctx.strokeStyle = OUT; ctx.lineCap = 'round';
      for (let i = 0; i < L.clocks.length; i++) {
        const [cx, cy, r] = L.clocks[i], am = t * 0.9 + i, ah = t * 0.075 + i * 2;
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ah) * r * 0.5, cy + Math.sin(ah) * r * 0.5); ctx.stroke();
        ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(am) * r * 0.75, cy + Math.sin(am) * r * 0.75); ctx.stroke();
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, PI2); ctx.fill();
      }
    } else if (L.type === 'neon') {
      ctx.strokeStyle = '#06d6a0'; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, wh * 0.5 + Math.sin(x * 0.07 + t * 3) * wh * 0.22);
      ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.lineWidth = 7; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ çerçeve
  frame(dt) {
    if (!this.W) return;
    if (this.bgDirty) this._drawBackground();
    this.t += dt; this.dt = dt;
    this.fx.update(dt);
    if (this.fx.arrived > 0) { const n = this.fx.arrived; this.fx.arrived = 0; if (this.onCoinArrive) this.onCoinArrive(n); }
    this.hintTime += dt;
    const ctx = this.ctx, game = this.game;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.bg, 0, 0, this.W, this.H);
    this._drawLive(ctx);
    this._ambient(dt);
    ctx.textBaseline = 'middle';

    for (let k = 0; k < SLOTS_PER_ZONE; k++) {
      if (this.dockBounce[k] > 0) this.dockBounce[k] = Math.max(0, this.dockBounce[k] - dt * 5);
      if (this.shake[k] > 0) this.shake[k] = Math.max(0, this.shake[k] - dt * 4);
      if (k >= this.lanes.length) continue;
      const mi = this.lanes[k], m = game.state.machines[mi];
      if (m.owned) this._drawLane(k, mi, m);
      else this._drawLocked(k, mi);
    }
    this._drawGolden(ctx);
    this.fx.draw(ctx);
    if (this.fade > 0) {           // bölge geçişi: karardan açılma
      this.fade = Math.max(0, this.fade - dt * 3.2);
      ctx.fillStyle = 'rgba(15,21,48,' + (this.fade * 0.9).toFixed(3) + ')'; ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  /** Bölgeye göre ortam parçacıkları (toz, kıvılcım, kum, neon...). */
  _ambient(dt) {
    this.moteT -= dt;
    if (this.moteT > 0) return;
    this.moteT = 0.28;
    const col = MOTE_COLOR[this.zone] ?? C.WHITE;
    this.fx.spawn(K.MOTE, Math.random() * this.W, this.wallH + Math.random() * (this.H - this.wallH), 0, -(6 + Math.random() * 10), 3.5 + Math.random() * 3, 1.4 + Math.random() * 1.8, col);
  }

  /** Altın Kasa: sahnede zıplayan, dokununca ödül veren kasa. Konum game.golden'dan (0..1). */
  _drawGolden(ctx) {
    const g = this.game.golden;
    if (!g) return;
    const x = g.x * this.W, y = this.wallH + g.y * (this.H - this.wallH) + Math.sin(this.t * 4) * 6;
    const fade = g.ttl < 3 ? (Math.sin(this.t * 18) > 0 ? 1 : 0.35) : 1;
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, 'rgba(255,236,130,.95)'); glow.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 46, 0, PI2); ctx.fill();
    ctx.rotate(Math.sin(this.t * 3) * 0.12);
    rr(ctx, -22, -17, 44, 34, 7); ctx.fillStyle = '#ffc928'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#ff9f1c'; ctx.fillRect(-22, -3, 44, 6); ctx.fillStyle = '#fff3a0'; ctx.fillRect(-4, -17, 8, 34);
    ctx.fillStyle = OUT; ctx.font = '800 15px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('$', 0, 11);
    ctx.restore();
  }

  /** Dokunulan nokta Altın Kasaya denk geliyor mu? */
  hitGolden(x, y) {
    const g = this.game.golden;
    if (!g) return false;
    const gx = g.x * this.W, gy = this.wallH + g.y * (this.H - this.wallH);
    return Math.abs(x - gx) < 42 && Math.abs(y - gy) < 42;
  }

  goldenFx(reward, frenzy) {
    this.fx.burst(K.COIN, this.W / 2, this.H * 0.4, 16, 260, 1, 6, C.GOLD);
    this.fx.burst(K.STAR, this.W / 2, this.H * 0.4, 8, 180, 0.9, 9, C.GOLD);
    this.fx.text(frenzy ? 'COŞKU x3!' : '+' + formatNum(reward), this.W / 2, this.H * 0.35, C.GOLD, 24);
  }

  _drawLane(k, mi, m) {
    const ctx = this.ctx, def = MACHINES[mi], r = this.game.rt[mi], z = ZONES[this.zone];
    const by = this.baseY(k), x0 = this.beltX0(), x1 = this.beltX1();
    const selected = this.game.state.selected === mi;

    if (selected) { // seçili şerit vurgusu
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(0, this.laneTop(k) + 2, this.W, this.laneH - 2);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, this.laneTop(k) + 2, 4, this.laneH - 2);
    }

    // bant
    const bh = 13, bty = by - bh + 3;
    rr(ctx, x0 - 8, bty, x1 - x0 + 22, bh, 6); ctx.fillStyle = z.belt; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    const moving = m.auto || r.count > 0;
    const off = moving ? (this.t * 34) % 14 : 0;
    ctx.save(); rr(ctx, x0 - 6, bty + 1, x1 - x0 + 18, bh - 2, 5); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = x0 - 14 + off; x < x1 + 12; x += 14) { ctx.beginPath(); ctx.moveTo(x, bty + bh - 2); ctx.lineTo(x + 5, bty + bh / 2); ctx.lineTo(x, bty + 2); ctx.lineTo(x + 4, bty + 2); ctx.lineTo(x + 9, bty + bh / 2); ctx.lineTo(x + 4, bty + bh - 2); ctx.fill(); }
    ctx.restore();

    // bant makaraları ve ray parlaması
    for (const rx of [x0 - 8, x1 + 14]) {
      ctx.save(); ctx.translate(rx, bty + bh / 2);
      ctx.beginPath(); ctx.arc(0, 0, bh * 0.72, 0, PI2); ctx.fillStyle = '#7b8494'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.rotate(moving ? this.t * 6 : 0); ctx.fillStyle = OUT; ctx.fillRect(-bh * 0.5, -1, bh, 2); ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x0 - 2, bty + 1.5, x1 - x0 + 10, 1.5);

    // satış kulübesi
    this._drawDock(k, x1 + 14, by, def);

    // makine
    const o = this.o;
    o.color = def.color; o.tier = visualTier(m.level); o.p = r.progress > 1 ? 1 : r.progress; o.t = this.t;
    o.pulse = r.pulse; o.auto = m.auto; o.blocked = r.blocked; o.level = m.level;
    const mh = Math.min(this.laneH * 0.8, this.mw * 1.0), cx = this.machineX();
    ctx.save();
    const sh = this.shake[k] > 0 ? Math.sin(this.shake[k] * 40) * 4 * this.shake[k] : 0;
    ctx.translate(cx + sh, by);
    const born = r.born < 1 ? easeOutBack(r.born) : 1;
    const sq = r.pulse * 0.06;
    ctx.scale((1 + sq) * born, (1 - sq) * born);
    drawMachine(ctx, def.kind, this.mw * 0.86, mh, o);
    ctx.restore();

    // bant üstündeki ürünler (makine çıkışından satış noktasına)
    const iy = bty - 3, size = Math.min(17, this.laneH * 0.17);
    for (let q = 0; q < r.count; q++) {
      const f = r.ages[q] / TUNING.beltTravelTime;
      const px = x0 + (x1 - x0 + 8) * (f > 1 ? 1 : f);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(px, bty + 1, size * 0.42, 2.2, 0, 0, PI2); ctx.fill();
      drawProduct(ctx, def.product, px, iy - Math.abs(Math.sin(f * 14)) * 1.5, size, def.color);
    }

    // otomatik makineden periyodik buhar
    if (m.auto) {
      this.steamT[k] -= this.dt;
      if (this.steamT[k] <= 0) {
        this.steamT[k] = 0.8 + Math.random() * 1.1;
        this.fx.spawn(K.PUFF, cx + this.mw * 0.26, by - mh * 0.52, (Math.random() - 0.5) * 8, -24, 0.9, 5, C.WHITE);
      }
    }

    // seviye rozeti
    const label = 'Sv.' + m.level;
    ctx.font = '800 11px ' + FONT;
    const lw = ctx.measureText(label).width + 12;
    rr(ctx, 6, this.laneTop(k) + 5, lw, 17, 8); ctx.fillStyle = OUT; ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'left'; ctx.fillText(label, 12, this.laneTop(k) + 14);

    // ilk dokunuş ipucu
    if (!m.auto && selected && this.game.state.stats.taps < 8 && mi === 0) {
      const bob = Math.sin(this.hintTime * 5) * 4;
      ctx.textAlign = 'center'; ctx.font = '800 15px ' + FONT;
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.strokeText('DOKUN!', cx, by - mh - 6 + bob);
      ctx.fillStyle = '#fff'; ctx.fillText('DOKUN!', cx, by - mh - 6 + bob);
    }
    if (r.blocked || (r.count >= storageCap(m) && !m.auto)) { // depo dolu uyarısı
      ctx.textAlign = 'center'; ctx.font = '800 11px ' + FONT;
      ctx.fillStyle = '#ff5252'; ctx.fillText('BANT DOLU', (x0 + x1) / 2, bty - 20);
    }
  }

  _drawDock(k, x, by, def) {
    const ctx = this.ctx, w = this.dockW, bounce = this.dockBounce[k];
    const h = Math.min(this.laneH * 0.62, 56);
    ctx.save();
    ctx.translate(x + w / 2 - 10, by);
    ctx.scale(1 + bounce * 0.12, 1 - bounce * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 1, w * 0.5, 5, 0, 0, PI2); ctx.fill();
    rr(ctx, -w / 2 + 4, -h * 0.7, w - 8, h * 0.7, 5); ctx.fillStyle = '#fff7e0'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    // tente
    const aw = w + 6, ah = h * 0.3;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#ff5d6c';
      ctx.fillRect(-aw / 2 + (aw / 4) * i, -h * 0.7 - ah, aw / 4, ah);
    }
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.strokeRect(-aw / 2, -h * 0.7 - ah, aw, ah);
    // satıcı: gözleri kırpar, satışta sevinir
    const cy = -h * 0.36, hr = h * 0.2, happy = bounce > 0.15;
    const blink = !happy && ((this.t * 0.8 + k * 1.3) % 3.2) > 3.05;
    ctx.beginPath(); ctx.arc(0, cy, hr, 0, PI2); ctx.fillStyle = '#ffd8a8'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, cy - hr * 0.35, hr * 1.02, Math.PI, 0); ctx.lineTo(hr * 1.25, cy - hr * 0.3); ctx.lineTo(-hr * 1.25, cy - hr * 0.3); ctx.closePath();
    ctx.fillStyle = def.color; ctx.fill(); ctx.stroke();                       // şapka
    ctx.fillStyle = OUT; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (const ex of [-hr * 0.4, hr * 0.4]) {
      if (happy) { ctx.beginPath(); ctx.arc(ex, cy + hr * 0.12, hr * 0.17, Math.PI, 0); ctx.stroke(); }
      else if (blink) { ctx.beginPath(); ctx.moveTo(ex - hr * 0.16, cy + hr * 0.1); ctx.lineTo(ex + hr * 0.16, cy + hr * 0.1); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex, cy + hr * 0.1, hr * 0.13, 0, PI2); ctx.fill(); }
    }
    ctx.beginPath();
    if (happy) { ctx.arc(0, cy + hr * 0.38, hr * 0.28, 0, Math.PI); ctx.fillStyle = '#c0392b'; ctx.fill(); ctx.stroke(); }
    else { ctx.arc(0, cy + hr * 0.3, hr * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(w * 0.27, -h * 0.1, h * 0.09, 0, PI2); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();   // jeton
    ctx.restore();
  }

  _drawLocked(k, mi) {
    const ctx = this.ctx, def = MACHINES[mi], game = this.game;
    const top = this.laneTop(k), cx = this.W / 2;
    const block = game.machineBlock(mi);
    const next = game.nextMachineIndex() === mi;           // sıradaki makine
    const levelBlocked = next && block && block.type === 'level';
    const cost = game.machineCost(mi);
    const w = this.W - 28, h = this.laneH - 16, x = 14, y = top + 8;
    const afford = next && !block && game.canAfford(cost);
    ctx.save();
    if (this.shake[k] > 0) ctx.translate(Math.sin(this.shake[k] * 40) * 5 * this.shake[k], 0);
    rr(ctx, x, y, w, h, 14);
    ctx.fillStyle = next ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.07)'; ctx.fill();
    ctx.setLineDash([9, 7]); ctx.lineWidth = 3;
    ctx.strokeStyle = afford ? '#2fb86b' : next ? 'rgba(43,45,66,.55)' : 'rgba(43,45,66,.25)';
    ctx.lineDashOffset = -this.t * 12; ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'center';
    if (next) {
      const pulse = afford ? 1 + Math.sin(this.t * 5) * 0.05 : 1;
      ctx.translate(cx, y + h / 2); ctx.scale(pulse, pulse);
      ctx.font = '800 14px ' + FONT; ctx.fillStyle = OUT; ctx.fillText(def.name, 0, -h * 0.3);
      const label = levelBlocked ? 'Önceki makine Sv.' + block.need + ' olmalı (' + block.have + '/' + block.need + ')' : '+ SATIN AL  ' + formatNum(cost);
      ctx.font = '800 ' + (levelBlocked ? 13 : 15) + 'px ' + FONT;
      const bw = Math.min(this.W - 40, ctx.measureText(label).width + 30);
      rr(ctx, -bw / 2, -h * 0.1, bw, 32, 14);
      ctx.fillStyle = afford ? '#35c978' : '#9aa3b5'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(label, 0, -h * 0.1 + 17);
      ctx.font = '700 11px ' + FONT; ctx.fillStyle = 'rgba(43,45,66,.65)';
      if (levelBlocked) ctx.fillText('Önceki makineyi yükselt', 0, h * 0.28);
      else if (!afford) ctx.fillText('Daha fazla para biriktir', 0, h * 0.28);
    } else {
      drawLock(ctx, cx, y + h / 2 - 8, 26);
      ctx.font = '700 12px ' + FONT; ctx.fillStyle = 'rgba(43,45,66,.6)';
      ctx.fillText(def.name, cx, y + h / 2 + 24);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ olay -> efekt
  _laneOf(mi) { return this.lanes.indexOf(mi); }

  onEvent(type, a, b, c) {
    const fx = this.fx;
    const k = type === 'zone' ? -1 : this._laneOf(a);
    switch (type) {
      case 'produce': {
        if (k < 0) return;
        const x = this.beltX0(), y = this.baseY(k) - 16;
        fx.burst(K.PUFF, x - 6, y, 3, 22, 0.5, 6, C.WHITE, false);
        break;
      }
      case 'sell': {
        if (k < 0) return;
        this.dockBounce[k] = 1;
        const x = this.beltX1() + this.dockW / 2, y = this.baseY(k) - 40;
        fx.burst(K.COIN, x, y, 3, 130, 0.7, 5, C.GOLD);
        if (this.t - this.coinT > 0.14) { this.coinT = this.t; for (let q = 0; q < 2; q++) fx.spawn(K.FLY, x, y, (Math.random() - 0.5) * 200, -140 - Math.random() * 90, 2.2, 6, C.GOLD); }
        if (this.t - this.lastText[a] > 0.18) {
          this.lastText[a] = this.t;
          fx.text("+" + formatNum(b), Math.min(x - 6, this.W - 34), y - 8, C.GOLD, 15);
        }
        break;
      }
      case 'buyMachine': case 'auto': case 'levelUp': case 'upgrade': {
        if (k < 0) return;
        const x = this.machineX(), y = this.baseY(k) - this.laneH * 0.4;
        if (type === 'buyMachine') { fx.burst(K.CONFETTI, x, y, 26, 230, 1.1, 4, -1); fx.burst(K.STAR, x, y, 8, 160, 0.9, 9, C.GOLD); fx.ring(x, y, 50, C.GOLD); fx.text('YENİ MAKİNE!', x + 20, y - 40, C.GOLD, 18); }
        else if (type === 'auto') { fx.ring(x, y, 44, C.GREEN); fx.burst(K.STAR, x, y, 6, 130, 0.8, 8, C.GREEN); fx.text('OTOMATİK!', x + 20, y - 40, C.GREEN, 16); }
        else if (type === 'levelUp') { fx.ring(x, y, 40, C.WHITE); fx.burst(K.STAR, x, y, 7, 140, 0.8, 8, C.GOLD); fx.text('SEVİYE ' + b + '!', x + 16, y - 36, C.WHITE, 16); }
        else { fx.ring(x, y, 36, C.BLUE); fx.burst(K.STAR, x, y, 5, 120, 0.7, 7, C.BLUE); }
        break;
      }
      case 'questClaimed':
        fx.burst(K.CONFETTI, this.W / 2, this.H * 0.35, 36, 260, 1.3, 4, -1);
        fx.burst(K.COIN, this.W / 2, this.H * 0.35, 10, 220, 1, 6, C.GOLD);
        break;
      case 'zone':
        fx.burst(K.CONFETTI, this.W / 2, this.H * 0.4, 50, 300, 1.4, 5, -1);
        fx.ring(this.W / 2, this.H * 0.4, 80, C.GOLD);
        break;
      case 'deny':
        break;
      default:
    }
  }

  tapEffect(lane, x, y) {
    this.fx.burst(K.SPARK, x, y, 5, 90, 0.4, 5, C.WHITE);
    this.fx.ring(x, y, 22, C.WHITE);
  }

  shakeLane(lane) { if (lane >= 0) this.shake[lane] = 1; }
}
