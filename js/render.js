'use strict';

// ===================== Shared renderers =====================
function chordDiagramSvg(shape) {
  const played = shape.frets.filter(f => f > 0);
  const maxFret = Math.max(0, ...played);
  const base = maxFret > 4 ? Math.min(...played) : 1;
  const left = 30, top = 42, sx = 22, sy = 28, frets = 5;
  const W = left + sx * 5 + 20, H = top + sy * frets + 30;
  const xOf = i => left + i * sx;
  const yOf = f => top + (f - base + 0.5) * sy;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chord diagram">`;
  if (base === 1) s += `<rect x="${left - 1}" y="${top - 5}" width="${sx * 5 + 2}" height="5" fill="#e8eaf0"/>`;
  else s += `<text x="${left - 8}" y="${top + sy * 0.65}" fill="#8a90a0" font-size="12" text-anchor="end">${base}fr</text>`;
  for (let i = 0; i <= frets; i++) s += `<line x1="${left}" x2="${left + sx * 5}" y1="${top + i * sy}" y2="${top + i * sy}" stroke="#555b69" stroke-width="1.5"/>`;
  for (let i = 0; i < 6; i++) s += `<line x1="${xOf(i)}" x2="${xOf(i)}" y1="${top}" y2="${top + frets * sy}" stroke="#8a90a0" stroke-width="1.5"/>`;

  // A barre: finger 1 on several strings at the same fret.
  const ones = shape.frets.map((f, i) => ({ f, i })).filter(o => shape.fingers[o.i] === 1 && o.f > 0);
  if (ones.length >= 2 && ones.every(o => o.f === ones[0].f)) {
    const a = ones[0].i, b = ones[ones.length - 1].i;
    s += `<rect x="${xOf(a) - 9}" y="${yOf(ones[0].f) - 9}" width="${xOf(b) - xOf(a) + 18}" height="18" rx="9" fill="#4fd1a5"/>`;
  }
  shape.frets.forEach((f, i) => {
    const x = xOf(i);
    if (f === X) s += `<text x="${x}" y="${top - 12}" fill="#fc8181" font-size="15" text-anchor="middle">×</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="${top - 17}" r="6" fill="none" stroke="#e8eaf0" stroke-width="1.5"/>`;
    else {
      s += `<circle cx="${x}" cy="${yOf(f)}" r="9" fill="#4fd1a5"/>`;
      if (shape.fingers[i]) s += `<text x="${x}" y="${yOf(f) + 4}" fill="#06281d" font-size="12" font-weight="700" text-anchor="middle">${shape.fingers[i]}</text>`;
    }
    if (f !== X) s += `<text x="${x}" y="${top + frets * sy + 18}" fill="#8a90a0" font-size="11" text-anchor="middle">${NOTE_NAMES[pcOf(STANDARD[i] + f)]}</text>`;
  });
  return s + '</svg>';
}

function keyboardSvg(from, to, low, high, now) {
  const whites = [];
  for (let m = from; m <= to; m++) if (NATURAL[pcOf(m)]) whites.push(m);
  const W = 1000, H = 130, ww = W / whites.length, bw = ww * 0.6, bh = 80;
  const inRange = m => (low !== null && high !== null) ? m >= low && m <= high : (m === low || m === high);
  const fill = (m, black) => m === now ? '#f6ad55' : inRange(m) ? (black ? '#2c8f6f' : '#4fd1a5') : (black ? '#111' : '#e8eaf0');
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Piano keyboard">`;
  whites.forEach((m, i) => {
    s += `<rect x="${i * ww}" y="0" width="${ww}" height="${H}" fill="${fill(m, false)}" stroke="#0f1115"/>`;
    if (pcOf(m) === 0) s += `<text x="${i * ww + ww / 2}" y="${H - 8}" fill="#333" font-size="12" text-anchor="middle">${noteName(m)}</text>`;
  });
  let wi = 0;
  for (let m = from; m <= to; m++) {
    if (NATURAL[pcOf(m)]) { wi++; continue; }
    s += `<rect x="${wi * ww - bw / 2}" y="0" width="${bw}" height="${bh}" fill="${fill(m, true)}" stroke="#0f1115"/>`;
  }
  return s + '</svg>';
}

// A scrolling pitch-over-time graph on note lanes.
class PitchTrace {
  constructor(canvas, seconds = 8, span = 14) {
    this.canvas = canvas;
    this.seconds = seconds;
    this.points = [];
    this.target = null;
    this.lo = 50;
    this.hi = 50 + span;
  }
  push(time, midi) {
    this.points.push({ time, midi });
    while (this.points.length && this.points[0].time < time - this.seconds) this.points.shift();
    if (midi !== null) this.follow(midi);
  }
  follow(m) {
    const span = this.hi - this.lo;
    if (m < this.lo + 1) { this.lo = Math.floor(m) - 2; this.hi = this.lo + span; }
    else if (m > this.hi - 1) { this.hi = Math.ceil(m) + 2; this.lo = this.hi - span; }
  }
  setTarget(m) {
    this.target = m;
    if (m !== null) this.follow(m);
  }
  clear() { this.points = []; }
  draw(now) {
    const { g, w, h } = prepCanvas(this.canvas);
    const labelW = 44, plotW = w - labelW;
    const span = this.hi - this.lo, laneH = h / span;
    const yOf = m => h - ((m - this.lo) / span) * h;
    g.font = '11px system-ui';
    for (let n = Math.ceil(this.lo); n <= Math.floor(this.hi); n++) {
      const y = yOf(n);
      if (!NATURAL[pcOf(n)]) { g.fillStyle = '#171a21'; g.fillRect(labelW, y - laneH / 2, plotW, laneH); }
      g.strokeStyle = pcOf(n) === 0 ? '#3a4150' : '#20242d';
      g.beginPath(); g.moveTo(labelW, y); g.lineTo(w, y); g.stroke();
      g.fillStyle = NATURAL[pcOf(n)] ? '#8a90a0' : '#555b69';
      g.fillText(noteName(n), 4, y + 4);
    }
    if (this.target !== null) {
      g.fillStyle = 'rgba(246,173,85,0.22)';
      g.fillRect(labelW, yOf(this.target + 0.25), plotW, yOf(this.target - 0.25) - yOf(this.target + 0.25));
      g.strokeStyle = '#f6ad55';
      g.beginPath(); g.moveTo(labelW, yOf(this.target)); g.lineTo(w, yOf(this.target)); g.stroke();
    }
    g.lineWidth = 3;
    g.lineCap = 'round';
    let prev = null;
    for (const p of this.points) {
      if (p.midi === null) { prev = null; continue; }
      const x = labelW + plotW * (1 - (now - p.time) / this.seconds), y = yOf(p.midi);
      if (prev && p.time - prev.time < 0.2) {
        const c = this.target === null ? 0 : Math.abs(p.midi - this.target) * 100;
        g.strokeStyle = c <= 25 ? '#4fd1a5' : c <= 60 ? '#f6ad55' : '#fc8181';
        g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(x, y); g.stroke();
      }
      prev = { x, y, time: p.time };
    }
    g.lineWidth = 1;
  }
}

function fillSelect(select, entries, selected) {
  select.innerHTML = entries.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
  if (selected !== undefined) select.value = String(selected);
}

function drawSpectrum(canvas, spectrum, peaks) {
  const { g, w, h } = prepCanvas(canvas);
  const fLo = 60, fHi = 2000, dbLo = -110, dbHi = -10;
  const xOf = f => w * Math.log(f / fLo) / Math.log(fHi / fLo);
  const yOf = db => h * (1 - (Math.max(dbLo, Math.min(dbHi, db)) - dbLo) / (dbHi - dbLo));

  // Grid lines at the open strings, A4 and its octaves.
  g.strokeStyle = '#2a2f3a';
  g.fillStyle = '#8a90a0';
  g.font = '11px system-ui';
  g.lineWidth = 1;
  for (const f of [82.4, 110, 146.8, 196, 246.9, 329.6, 440, 880, 1760]) {
    const x = xOf(f);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    g.fillText(f < 1000 ? Math.round(f) : (f / 1000).toFixed(2) + 'k', x + 3, h - 4);
  }
  if (!spectrum || !mic.analyser) return;

  const binHz = audioCtx.sampleRate / mic.analyser.fftSize;
  g.strokeStyle = '#4fd1a5';
  g.lineWidth = 1.5;
  g.beginPath();
  let started = false;
  for (let i = Math.floor(fLo / binHz); i <= Math.ceil(fHi / binHz) && i < spectrum.length; i++) {
    const x = xOf(i * binHz), y = yOf(spectrum[i]);
    if (started) g.lineTo(x, y); else { g.moveTo(x, y); started = true; }
  }
  g.stroke();

  g.fillStyle = '#f6ad55';
  for (const p of peaks) {
    if (p.freq < fLo || p.freq > fHi) continue;
    g.beginPath();
    g.arc(xOf(p.freq), yOf(p.db), 3, 0, Math.PI * 2);
    g.fill();
  }
}
