// Prosedürel ses (WebAudio) + titreşim + arka plan müziği. Dosya gerektirmez; ayarlardan kapatılabilir.

// Müzik: 4 akorluk bir döngü (pad + bas + hafif arpej). Bölgeye göre ton, tempo ve armoni değişir.
const QUAL = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], sus: [0, 5, 7] };
const PROG_A = [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']];        // parlak
const PROG_B = [[9, 'min'], [5, 'maj7'], [0, 'maj'], [7, 'sus']];       // uzay
const PROG_C = [[2, 'min'], [10, 'maj'], [5, 'maj'], [0, 'maj7']];      // gizemli
const MOODS = [
  { root: 0,  bpm: 88,  prog: PROG_A, lead: 'triangle' },   // Atölye
  { root: 2,  bpm: 94,  prog: PROG_A, lead: 'triangle' },   // Elektronik
  { root: 3,  bpm: 100, prog: PROG_A, lead: 'square' },     // Robot
  { root: 0,  bpm: 76,  prog: PROG_B, lead: 'sine' },       // Ay
  { root: 5,  bpm: 82,  prog: PROG_C, lead: 'sine' },       // Kristal
  { root: 7,  bpm: 90,  prog: PROG_B, lead: 'triangle' },   // Zaman
  { root: 10, bpm: 108, prog: PROG_C, lead: 'square' },     // Kuantum
  { root: 1,  bpm: 72,  prog: PROG_B, lead: 'sine' },       // Galaksi
];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Feedback {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.last = {};
    this.active = false;   // tarayıcılar titreşimi/sesi ancak ilk dokunuştan sonra kabul eder
    this.mood = 0; this.wantMood = 0;
    this._timer = null; this._step = 0; this._nextT = 0;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this._onVisibility());
      // iOS Safari ses bağlamını yalnızca click/touchend ile açar (pointerdown yetmez): her gerçek dokunuşta tekrar dene.
      for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, () => this.unlock(), { passive: true });
    }
  }

  /** Tarayıcılar sesi ancak kullanıcı etkileşiminden sonra başlatır. */
  unlock() {
    this.active = true;
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); this.startMusic(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.8;
      this.musicBus.connect(this.master);
    } catch (e) { this.ctx = null; }
    this.startMusic();
  }

  _tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.settings.sound || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _throttle(name, ms) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < ms) return false;
    this.last[name] = now;
    return true;
  }

  vibrate(pattern) {
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // dokunuş olmadan tarayıcı reddeder
    if (this.active && this.settings.haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* desteklenmiyor */ }
    }
  }

  tap()      { if (this._throttle('tap', 40)) { this._tone(220, 0.07, { type: 'square', vol: 0.12, slide: 120 }); this.vibrate(8); } }
  produce()  { if (this._throttle('produce', 90)) this._tone(520, 0.08, { type: 'triangle', vol: 0.12, slide: 200 }); }
  sell()     { if (this._throttle('sell', 70)) { this._tone(880, 0.09, { type: 'sine', vol: 0.16 }); this._tone(1320, 0.12, { type: 'sine', vol: 0.12, delay: 0.06 }); } }
  button()   { if (this._throttle('btn', 30)) this._tone(330, 0.05, { type: 'triangle', vol: 0.1 }); }
  upgrade()  { [523, 659, 784].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', vol: 0.2, delay: i * 0.07 })); this.vibrate(20); }
  fanfare()  { [392, 523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.2, { type: 'square', vol: 0.14, delay: i * 0.08 })); this.vibrate([20, 30, 40]); }
  quest()    { [659, 880, 1175].forEach((f, i) => this._tone(f, 0.18, { type: 'sine', vol: 0.2, delay: i * 0.09 })); this.vibrate([15, 25, 15]); }
  deny()     { if (this._throttle('deny', 150)) { this._tone(160, 0.16, { type: 'sawtooth', vol: 0.14, slide: -50 }); this.vibrate(30); } }
  medal()    { [784, 988, 1175, 1568].forEach((f, i) => this._tone(f, 0.22, { type: 'sine', vol: 0.18, delay: i * 0.08 })); this.vibrate([10, 20, 10, 20, 30]); }
  alarm()    { [740, 988, 740, 988].forEach((f, i) => this._tone(f, 0.1, { type: 'square', vol: 0.1, delay: i * 0.12 })); this.vibrate([40, 40, 40]); }

  // ------------------------------------------------------------------ müzik
  /** Ayar açıksa ve ses bağlamı hazırsa müziği başlatır (tekrar çağrılması zararsız). */
  startMusic() {
    if (!this.ctx || !this.settings.music || this._timer || !this.active) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this._step = 0;
    this._nextT = this.ctx.currentTime + 0.15;
    this.mood = this.wantMood;
    this._timer = setInterval(() => this._schedule(), 120);
  }

  stopMusic() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /** Ayar değişince çağrılır. */
  applyMusicSetting() {
    if (this.settings.music) this.startMusic(); else this.stopMusic();
  }

  /** Bölgeye göre müzik havası; değişiklik bir sonraki ölçüde uygulanır. */
  setMood(zone) {
    this.wantMood = Math.max(0, Math.min(MOODS.length - 1, zone | 0));
  }

  _onVisibility() {
    if (!this.ctx) return;
    if (document.hidden) { this.stopMusic(); try { this.ctx.suspend(); } catch (e) { /* yok say */ } }
    else { try { this.ctx.resume(); } catch (e) { /* yok say */ } this.startMusic(); }
  }

  _schedule() {
    const c = this.ctx;
    if (!c || !this.settings.music) { this.stopMusic(); return; }
    while (this._nextT < c.currentTime + 0.5) {
      if ((this._step & 7) === 0) this.mood = this.wantMood;     // armoni/ton yalnızca ölçü başında değişir
      const mood = MOODS[this.mood];
      this._musicStep(this._step, this._nextT, mood);
      this._nextT += 60 / mood.bpm / 2;                          // sekizlik nota
      this._step = (this._step + 1) % 32;
    }
  }

  _note(freq, t, dur, type, vol, attack = 0.012) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _musicStep(step, t, mood) {
    const bar = (step >> 3) & 3, pos = step & 7;
    const [off, q] = mood.prog[bar], tones = QUAL[q];
    const root = 48 + mood.root + off, beat = 60 / mood.bpm / 2;
    if (pos === 0) for (const iv of tones) this._note(midi(root + 12 + iv), t, beat * 8, 'sine', 0.022, 0.5);   // pad
    if (pos === 0 || pos === 4) this._note(midi(root - 12), t, beat * 3.5, 'sine', 0.06, 0.02);               // bas
    if (pos !== 1 && pos !== 5 && pos !== 7) {                                                                 // arpej
      const iv = tones[(pos * 2 + bar) % tones.length];
      this._note(midi(root + 24 + iv), t, beat * 1.6, mood.lead, 0.04);
    }
  }
}
