'use strict';

// ===================== Settings =====================
const FFT_SIZE = 32768;     // ~1.5 Hz per bin at 48 kHz: separates low E (82 Hz) from F (87 Hz)
const PITCH_WINDOW = 4096;  // samples used for the time-domain pitch tracker
const MIN_HZ = 60, MAX_HZ = 1400;
const ONSET_JUMP_DB = 6;    // a rise this large in the short-term level is a new strum or pluck
const CHROMA_LAG = 0.3;     // the long FFT window shows a new strum this many seconds late
const HISTORY_LEN = 8;      // frames used to vote for a stable result in the Detect tab
const HOLD_SEC = 1.5;       // keep the last Detect result visible this long after the sound stops

// ===================== Helpers =====================
const $ = id => document.getElementById(id);
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('gvt.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('gvt.' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const a4 = () => Number($('a4').value) || 440;
const midiToFreq = m => a4() * Math.pow(2, (m - 69) / 12);
const freqToMidi = f => 69 + 12 * Math.log2(f / a4());
const pcOf = m => ((Math.round(m) % 12) + 12) % 12;
const pitchClass = f => pcOf(freqToMidi(f));
const noteName = m => NOTE_NAMES[pcOf(m)] + (Math.floor(Math.round(m) / 12) - 1);
// String i (0 = the low 6th string) in Finnish: "6. kieli", and "6. kielellä" (on the 6th string).
const stringLabel = i => `${6 - i}. kieli`;
const stringOn = i => `${6 - i}. kielellä`;
const fmtHz = f => f.toFixed(1).replace(".", ",") + " Hz";
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtCents = c => `${c > 0 ? '+' : ''}${Math.round(c)} senttiä`;
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const median = arr => { const s = [...arr].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const stdDev = arr => { const m = mean(arr); return Math.sqrt(mean(arr.map(v => (v - m) ** 2))); };
// Moves a target note to the octave nearest the sung note.
const foldToOctave = (sung, target) => target + 12 * Math.round((sung - target) / 12);

function noteInfo(freq) {
  const midiFloat = freqToMidi(freq);
  const midi = Math.round(midiFloat);
  return {
    midi,
    name: NOTE_NAMES[pcOf(midi)],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((midiFloat - midi) * 100),
  };
}

function setStatus(text, isError = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', isError);
}

function setFeedback(el, text, cls = '') {
  el.textContent = text;
  el.className = el.className.replace(/\b(good|warn|badc)\b/g, '').trim() + (cls ? ' ' + cls : '');
}

function setNeedle(el, cents) {
  el.style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
}

function rmsDb(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return 10 * Math.log10(sum / buf.length + 1e-12);
}

function prepCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

// Reports a note once, after it has been held long enough.
class HoldDetector {
  constructor(holdSec, tolCents = 50, graceSec = 0.15) {
    Object.assign(this, { holdSec, tolCents, graceSec });
    this.reset();
  }
  reset() { this.note = null; this.since = 0; this.lastSeen = 0; this.fired = false; }
  update(time, midi) {
    const valid = midi !== null && Math.abs(midi - Math.round(midi)) * 100 <= this.tolCents;
    if (!valid) {
      if (this.note !== null && time - this.lastSeen > this.graceSec) this.reset();
      return null;
    }
    const n = Math.round(midi);
    if (n !== this.note) { this.note = n; this.since = time; this.fired = false; }
    this.lastSeen = time;
    if (!this.fired && time - this.since >= this.holdSec) { this.fired = true; return n; }
    return null;
  }
}
