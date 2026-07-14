// audio.js — Web Audio 100% 합성 (외부 파일·저작권 없음)
// 신나는 칩튠 BGM 루프 + 마스터 뮤트.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._timer = null;
    this._next = 0;
    this._step = 0;
    this.vol = 0.22;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol;
    this.master.connect(this.ctx.destination);
  }

  // 첫 사용자 입력에서 호출(iOS 오디오 정책)
  start() {
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this._timer) return;
    this._next = this.ctx.currentTime + 0.15;
    this._step = 0;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.vol;
    return this.muted;
  }

  _schedule() {
    if (!this.ctx) return;
    const spb = 60 / 132;      // 132 BPM
    const stepDur = spb / 2;   // 8분음표
    while (this._next < this.ctx.currentTime + 0.2) {
      this._playStep(this._step, this._next, stepDur);
      this._next += stepDur;
      this._step = (this._step + 1) % 32; // 4마디 루프
    }
  }

  _playStep(step, t, dur) {
    // I–V–vi–IV (C–G–Am–F) 진행, 마디당 8스텝
    const bar = Math.floor(step / 8) % 4;
    const roots = [0, 7, 9, 5];
    const base = 48;
    const root = base + roots[bar];
    const inBar = step % 8;

    // 베이스 (각 박)
    if (inBar % 2 === 0) this._note('triangle', root - 12, t, dur * 1.7, 0.5);
    // 아르페지오 리드
    const arp = [0, 4, 7, 12, 7, 4, 7, 12];
    this._note('square', root + arp[inBar], t, dur * 0.85, 0.22);
    // 하이햇
    this._hat(t, inBar % 2 === 0 ? 0.05 : 0.028);
    // 킥 (다운비트)
    if (inBar === 0 || inBar === 4) this._kick(t);
    // 스네어(백비트)
    if (inBar === 2 || inBar === 6) this._snare(t);
  }

  _note(type, midi, t, dur, gain) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur) {
    const b = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    return s;
  }

  _hat(t, gain) {
    const n = this._noise(0.05);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.06);
  }

  _snare(t) {
    const n = this._noise(0.14);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.15);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }
}
