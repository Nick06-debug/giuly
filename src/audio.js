const NOTE = (semitones) => 440 * 2 ** ((semitones - 69) / 12);
const CHORDS = [
  [48, 55, 59, 62, 64],
  [45, 52, 55, 59, 60],
  [41, 48, 52, 55, 57],
  [43, 50, 55, 57, 59],
];
const MELODY = [76, 79, 74, 71, 72, 79, 76, 74, 67, 71, 74, 72];

/** A small, entirely procedural soundtrack, unlocked by the start button. */
export class Soundscape {
  constructor() {
    this._enabled = true;
    this._started = false;
    this._disposed = false;
    this._context = null;
    this._master = null;
    this._timer = null;
    this._voices = new Set();
    this._ocean = null;
    this._noiseBuffer = null;
    this._chordIndex = 0;
    this._melodyIndex = 0;
    this._nextPad = 0;
    this._nextNote = 0;
    this._location = { x: 0, z: 0 };
  }

  get enabled() {
    return this._enabled;
  }

  async start() {
    if (this._disposed) return;
    this._started = true;
    try {
      if (!this._context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return;
        this._context = new AudioContext();
        this._master = this._context.createGain();
        this._master.gain.value = 0;
        this._master.connect(this._context.destination);
      }
      if (this._enabled) await this._activate();
    } catch {
      // Audio must never prevent the game from starting.
    }
  }

  toggle() {
    if (this._disposed) return false;
    this._enabled = !this._enabled;
    if (this._enabled && this._started) {
      if (this._context) void this._activate();
      else void this.start();
    } else if (!this._enabled) {
      this._stopMusic();
      this._fadeMaster(0, 0.08);
    }
    return this._enabled;
  }

  async _activate() {
    const context = this._context;
    if (!context || this._disposed || !this._enabled) return;
    try {
      if (context.state === 'suspended') await context.resume();
      if (this._disposed || !this._enabled || context.state !== 'running') return;
      this._fadeMaster(0.32, 0.8);
      // Multiple start/resume calls share this one scheduler.
      if (this._timer !== null) return;
      this._nextPad = context.currentTime + 0.08;
      this._nextNote = context.currentTime + 2.2;
      this._startOcean();
      this._schedule();
      this._timer = globalThis.setInterval(() => this._schedule(), 400);
    } catch {
      // Browser autoplay restrictions and closed contexts are harmless here.
    }
  }

  _fadeMaster(value, duration) {
    if (!this._context || !this._master || this._context.state === 'closed') return;
    try {
      const now = this._context.currentTime;
      const gain = this._master.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(value, now + duration);
    } catch {
      // Closing an AudioContext can race a last UI event.
    }
  }

  _schedule() {
    const context = this._context;
    if (!context || !this._enabled || this._disposed || context.state !== 'running') return;
    const now = context.currentTime;
    // After a background-tab pause, resume here rather than replaying old notes.
    if (this._nextPad < now - 1) this._nextPad = now + 0.05;
    if (this._nextNote < now - 1) this._nextNote = now + 1;
    if (this._nextPad < now + 1) {
      this._pad(CHORDS[this._chordIndex % CHORDS.length], this._nextPad, 12, 0.8);
      this._chordIndex += 1;
      this._nextPad += 8.8;
    }
    if (this._nextNote < now + 1) {
      const note = MELODY[this._melodyIndex % MELODY.length];
      this._bell(NOTE(note), this._nextNote, 2.8, 0.048);
      this._melodyIndex += 1;
      this._nextNote += [2.7, 3.8, 3.2, 4.1][this._melodyIndex % 4];
    }
  }

  _voice(nodes, gain, end, extraNodes = []) {
    const voice = { nodes, gain, end };
    this._voices.add(voice);
    let remaining = nodes.length;
    for (const node of nodes) {
      node.onended = () => {
        try { node.disconnect(); } catch { /* Already disconnected. */ }
        remaining -= 1;
        if (remaining === 0) {
          this._voices.delete(voice);
          try { gain.disconnect(); } catch { /* Already disconnected. */ }
          for (const extra of extraNodes) {
            try { extra.disconnect(); } catch { /* Already disconnected. */ }
          }
        }
      };
    }
    return voice;
  }

  _pad(notes, time, duration, level = 1) {
    const context = this._context;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.028 * level, time + 2.8);
    gain.gain.setValueAtTime(0.028 * level, time + duration * 0.55);
    gain.gain.linearRampToValueAtTime(0, time + duration);
    gain.connect(this._master);
    const oscillators = notes.map((note, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = NOTE(note);
      oscillator.detune.value = index % 2 ? 3 : -3;
      oscillator.connect(gain);
      return oscillator;
    });
    this._voice(oscillators, gain, time + duration);
    for (const oscillator of oscillators) {
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
    }
  }

  _bell(frequency, time, duration, level = 0.1) {
    const context = this._context;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.gain.setValueAtTime(0, time + duration + 0.01);
    gain.connect(this._master);
    const fundamental = context.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.value = frequency;
    fundamental.connect(gain);
    const overtone = context.createOscillator();
    const overtoneGain = context.createGain();
    overtone.type = 'sine';
    overtone.frequency.value = frequency * 2;
    overtoneGain.gain.value = 0.12;
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    this._voice([fundamental, overtone], gain, time + duration + 0.02, [overtoneGain]);
    fundamental.start(time);
    overtone.start(time);
    fundamental.stop(time + duration + 0.02);
    overtone.stop(time + duration + 0.02);
  }

  _tone(frequency, target, time, duration, level, waveform = 'sine') {
    const context = this._context;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.gain.setValueAtTime(0, time + duration + 0.01);
    gain.connect(this._master);
    const oscillator = context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(target, time + duration * 0.65);
    oscillator.connect(gain);
    this._voice([oscillator], gain, time + duration);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  _startOcean() {
    if (this._ocean) return;
    const context = this._context;
    if (!this._noiseBuffer) {
      this._noiseBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const channel = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 540;
    filter.Q.value = 0.2;
    const gain = context.createGain();
    gain.gain.value = 0.025;
    const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
    source.connect(filter);
    filter.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(this._master);
    } else gain.connect(this._master);
    this._ocean = { source, filter, gain, panner };
    source.start();
    this.setLocation(this._location.x, this._location.z);
  }

  setLocation(x, z) {
    this._location.x = Number.isFinite(x) ? x : 0;
    this._location.z = Number.isFinite(z) ? z : 0;
    if (!this._ocean || !this._context || this._disposed) return;
    try {
      const now = this._context.currentTime;
      this._ocean.filter.frequency.setTargetAtTime(500 + Math.tanh(this._location.z / 35) * 160, now, 1.4);
      if (this._ocean.panner) this._ocean.panner.pan.setTargetAtTime(Math.tanh(this._location.x / 30) * 0.22, now, 1.4);
    } catch { /* Audio may have been closed by navigation. */ }
  }

  play(type) {
    const context = this._context;
    if (!this._enabled || !context || context.state !== 'running' || this._disposed) return;
    try {
      const time = context.currentTime + 0.012;
      const arpeggio = (notes, gap, duration, level) => notes.forEach((note, index) => {
        this._bell(NOTE(note), time + index * gap, duration, level);
      });
      switch (type) {
        case 'collect': arpeggio([72, 76, 79], 0.095, 0.75, 0.15); break;
        case 'success': arpeggio([60, 64, 67, 71, 74], 0.12, 1.3, 0.13); break;
        case 'wrong': this._tone(NOTE(52), NOTE(50), time, 0.22, 0.12, 'triangle'); break;
        case 'click': this._tone(NOTE(79), NOTE(76), time, 0.07, 0.07); break;
        case 'jump': this._tone(NOTE(64), NOTE(72), time, 0.2, 0.085); break;
        case 'finale':
          arpeggio([60, 64, 67, 71, 74, 76, 79], 0.23, 3.6, 0.13);
          this._pad([48, 55, 59, 64, 67], time, 9, 0.95);
          break;
        default: break;
      }
    } catch { /* Effects are optional when audio is unavailable. */ }
  }

  _stopMusic() {
    if (this._timer !== null) {
      globalThis.clearInterval(this._timer);
      this._timer = null;
    }
    const context = this._context;
    if (!context) return;
    const now = context.currentTime;
    for (const voice of this._voices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.06);
        for (const node of voice.nodes) node.stop(now + 0.07);
      } catch { /* Already ended sources need no further work. */ }
    }
    if (this._ocean) {
      const ocean = this._ocean;
      try {
        ocean.gain.gain.setTargetAtTime(0, now, 0.02);
        ocean.source.onended = () => {
          for (const node of [ocean.source, ocean.filter, ocean.gain, ocean.panner]) {
            if (node) { try { node.disconnect(); } catch { /* Already disconnected. */ } }
          }
        };
        ocean.source.stop(now + 0.08);
      } catch { /* Already stopped. */ }
      this._ocean = null;
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._enabled = false;
    this._stopMusic();
    const context = this._context;
    this._context = null;
    this._master = null;
    this._noiseBuffer = null;
    this._voices.clear();
    if (context && context.state !== 'closed') {
      try { void Promise.resolve(context.close()).catch(() => {}); } catch { /* Already closed. */ }
    }
  }
}
