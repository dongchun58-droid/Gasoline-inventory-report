// audio.js — Web Audio 100% 합성 (외부 파일·저작권 없음)
// 신나는 신스웨이브 BGM: 슈퍼소우 코드 + 리드 멜로디(딜레이) + 4-on-the-floor 드럼.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._timer = null;
    this._next = 0;
    this._step = 0;
    this.vol = 0.45;      // BGM (더 크게)
    this.sfxVol = 0.85;   // 효과음 (더 크게)
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();

    // (BGM master + SFX) → out 공용 컴프레서
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 20; comp.ratio.value = 5;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol;
    this.master.connect(comp);

    // 효과음 버스 (뮤트 공유)
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.muted ? 0 : this.sfxVol;
    this.sfx.connect(comp);

    // 리드용 피드백 딜레이 send
    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.32; // 딜레이 타임
    this.fb = this.ctx.createGain(); this.fb.gain.value = 0.34;
    const dwet = this.ctx.createGain(); dwet.gain.value = 0.5;
    this.delay.connect(this.fb).connect(this.delay);
    this.delay.connect(dwet).connect(this.master);
    this.delaySend = this.ctx.createGain(); this.delaySend.gain.value = 0.35;
    this.delaySend.connect(this.delay);
  }

  start() {
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this._timer) return;
    this._next = this.ctx.currentTime + 0.12;
    this._step = 0;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.vol;
    if (this.sfx) this.sfx.gain.value = this.muted ? 0 : this.sfxVol;
    return this.muted;
  }

  // ---------- 효과음 (SFX) ----------
  _tone(type, f0, f1, t, dur, gain) {
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _burst(t, dur, gain) {
    const n = this._noise(dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(g).connect(this.sfx);
    n.start(t); n.stop(t + dur);
  }
  sfxBeep(hi) { if (!this.ctx) return; const t = this.ctx.currentTime; this._tone('square', hi ? 900 : 520, null, t, 0.2, 0.6); }
  sfxBoost() { if (!this.ctx) return; const t = this.ctx.currentTime; this._tone('sawtooth', 200, 950, t, 0.35, 0.6); this._burst(t, 0.22, 0.4); }
  sfxItem() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, 4, 7].forEach((n, i) => this._tone('square', 523 * Math.pow(2, n / 12), null, t + i * 0.08, 0.16, 0.5)); }
  sfxJump() { if (!this.ctx) return; const t = this.ctx.currentTime; this._tone('sine', 300, 1050, t, 0.32, 0.6); }
  sfxHit() { if (!this.ctx) return; const t = this.ctx.currentTime; this._tone('sawtooth', 420, 60, t, 0.32, 0.6); this._burst(t, 0.2, 0.5); }
  sfxMoo() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this._tone('sawtooth', 175, 105, t, 0.55, 0.7);
    this._tone('sawtooth', 88, 66, t + 0.05, 0.6, 0.5);
  }
  sfxFanfare() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    // 승리 팡파레: G G G C - E - G↑ + 마지막 화음
    const seq = [[67, 0.0, 0.14], [67, 0.16, 0.14], [67, 0.32, 0.14], [72, 0.5, 0.45], [76, 1.0, 0.45], [79, 1.5, 0.9]];
    for (const [m, off, dur] of seq) {
      this._tone('square', this._hz(m), null, t + off, dur, 0.55);
      this._tone('sawtooth', this._hz(m - 12), null, t + off, dur, 0.32);
    }
    for (const m of [72, 76, 79, 84]) this._tone('square', this._hz(m), null, t + 1.5, 0.95, 0.32);
    // 드럼 롤 느낌
    for (let i = 0; i < 4; i++) this._burst(t + i * 0.12, 0.08, 0.25);
  }

  _schedule() {
    if (!this.ctx) return;
    const step16 = 60 / 140 / 4; // 140 BPM, 16분음표
    while (this._next < this.ctx.currentTime + 0.18) {
      this._playStep(this._step, this._next, step16);
      this._next += step16;
      this._step = (this._step + 1) % 64; // 4마디
    }
  }

  _playStep(step, t, sd) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    // i–VI–III–VII (Am–F–C–G) 루트 (A2=45)
    const roots = [45, 41, 48, 43];
    const isMinor = [true, false, false, false];
    const root = roots[bar];

    // --- 드럼 ---
    if (s % 4 === 0) this._kick(t);                    // 4-on-the-floor
    if (s === 4 || s === 12) this._snare(t);           // 백비트
    if (s % 2 === 0) this._hat(t, 0.05, false);        // 클로즈 하이햇
    if (s === 2 || s === 6 || s === 10 || s === 14) this._hat(t, 0.06, true); // 오픈 하이햇(엇박)

    // --- 베이스 (신스, 옥타브 펌핑) ---
    if (s % 2 === 0) {
      const bn = (s % 8 === 4) ? root + 12 : root;
      this._bass(bn, t, sd * 1.9);
    }

    // --- 슈퍼소우 코드 (마디 시작, 길게) ---
    if (s === 0) {
      const third = isMinor[bar] ? 3 : 4;
      this._chord([root + 12, root + 12 + third, root + 12 + 7], t, sd * 15);
    }

    // --- 리드 멜로디 (펜타토닉 모티프, 코드루트 이조) ---
    // 16스텝 모티프(코드 3/5/8도 위주), null=쉼표
    const motif = [12, null, 15, null, 19, null, 15, 17, 19, null, 22, null, 19, null, 15, null];
    const off = motif[s];
    if (off !== null && off !== undefined) {
      // 단조 마디에선 장3도(4)→단3도(3) 보정
      let n = root + off;
      if (isMinor[bar] && (off % 12 === 4)) n -= 1;
      this._lead(n, t, sd * 1.6);
    }
  }

  // 슈퍼소우 코드: 디튠 saw 3개 → lowpass
  _chord(notes, t, dur) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(2600, t + 0.15);
    lp.frequency.setTargetAtTime(1200, t + 0.2, 0.4);
    lp.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.02);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.7, 0.25);
    lp.connect(g).connect(this.master);
    for (const midi of notes) {
      for (const det of [-8, 0, 8]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = this._hz(midi);
        o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur);
      }
    }
  }

  _bass(midi, t, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = this._hz(midi);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.34, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _lead(midi, t, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = this._hz(midi);
    const o2 = this.ctx.createOscillator();
    o2.type = 'sawtooth'; o2.frequency.value = this._hz(midi); o2.detune.value = 6;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp); o2.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    g.connect(this.delaySend);
    o.start(t); o.stop(t + dur + 0.02);
    o2.start(t); o2.stop(t + dur + 0.02);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.18);
  }

  _snare(t) {
    const n = this._noise(0.16);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.17);
  }

  _hat(t, gain, open) {
    const n = this._noise(open ? 0.12 : 0.045);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 8000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.12 : 0.045));
    n.connect(hp).connect(g).connect(this.master);
    n.start(t); n.stop(t + (open ? 0.13 : 0.05));
  }

  _noise(dur) {
    const b = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    return s;
  }

  _hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
}
