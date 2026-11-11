'use strict';

// ===================== Analysis =====================
// Finds local maxima in the dB spectrum. Searches above MAX_HZ too, so overtones of high notes are seen.
function findPeaks() {
  const freqData = mic.freqData;
  const binHz = audioCtx.sampleRate / mic.analyser.fftSize;
  const lo = Math.max(2, Math.floor(MIN_HZ / binHz));
  const hi = Math.min(freqData.length - 3, Math.ceil(MAX_HZ * 1.5 / binHz));
  let maxDb = -Infinity;
  for (let i = lo; i <= hi; i++) if (freqData[i] > maxDb) maxDb = freqData[i];
  const threshold = maxDb - 30;

  const peaks = [];
  for (let i = lo; i <= hi; i++) {
    const v = freqData[i];
    if (v < threshold) continue;
    if (v > freqData[i - 1] && v >= freqData[i + 1] && v > freqData[i - 2] && v >= freqData[i + 2]) {
      const a = freqData[i - 1], c = freqData[i + 1];
      const denom = a - 2 * v + c;
      const shift = denom ? 0.5 * (a - c) / denom : 0;   // parabolic interpolation
      const db = v - 0.25 * (a - c) * shift;
      peaks.push({ freq: (i + shift) * binHz, db, amp: Math.pow(10, db / 20) });
    }
  }
  peaks.sort((x, y) => y.amp - x.amp);
  peaks.length = Math.min(peaks.length, 24);
  peaks.sort((x, y) => x.freq - y.freq);
  return peaks;
}

// Groups peaks into notes: a peak near an integer multiple of a lower note is its overtone.
function findFundamentals(peaks) {
  const notes = [];
  for (const p of peaks) {
    let owner = null;
    for (const n of notes) {
      const ratio = p.freq / n.freq;
      const h = Math.round(ratio);
      if (h >= 2 && h <= 10 && Math.abs(ratio - h) / h < 0.03) { owner = n; break; }
    }
    if (owner) owner.energy += p.amp;
    else if (p.freq <= MAX_HZ) notes.push({ freq: p.freq, amp: p.amp, energy: p.amp });
  }
  const maxEnergy = Math.max(0, ...notes.map(n => n.energy));
  return notes.filter(n => n.energy >= 0.15 * maxEnergy);
}

// McLeod Pitch Method.
function detectPitch(buf, sampleRate) {
  const n = buf.length;
  const maxLag = Math.min(n >> 1, Math.floor(sampleRate / MIN_HZ));
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0, m = 0;
    for (let j = 0, end = n - tau; j < end; j++) {
      const a = buf[j], b = buf[j + tau];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? 2 * acf / m : 0;
  }

  const maxima = [];
  let tau = 0;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let best = -1, bestTau = -1;
    while (tau < maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > best) { best = nsdf[tau]; bestTau = tau; }
      tau++;
    }
    if (bestTau >= minLag) maxima.push(bestTau);
  }
  if (!maxima.length) return null;

  const highest = Math.max(...maxima.map(t => nsdf[t]));
  const chosen = maxima.find(t => nsdf[t] >= 0.9 * highest);
  const a = nsdf[chosen - 1], b = nsdf[chosen], c = nsdf[chosen + 1];
  const denom = a - 2 * b + c;
  const shift = denom ? 0.5 * (a - c) / denom : 0;
  return { freq: sampleRate / (chosen + shift), clarity: b };
}

const CHORD_MIN_SCORE = 1.2;     // weaker matches are not reported at all
const CHORD_ALT_MARGIN = 0.9;    // other names within this score of the best are listed as alternatives
const CHORD_MAX_RESULTS = 6;

// Returns every chord name that fits the heard pitch classes, best first.
// The same notes often have several names: D A B E is E7sus4, Asus2sus4, D6sus2 or Bm7add11.
function matchChords(chromaVec, bassPc) {
  const max = Math.max(...chromaVec);
  if (max <= 0) return [];
  const c = Array.from(chromaVec, v => (v / max < 0.1 ? 0 : v / max));

  const found = [];
  CHORD_TYPES.forEach((type, typeIndex) => {
    for (let root = 0; root < 12; root++) {
      if (c[root] < 0.2) continue;
      const members = new Set(type.intervals.map(i => (root + i) % 12));
      let inside = 0, outside = 0;
      const missing = [];
      for (let pc = 0; pc < 12; pc++) {
        if (members.has(pc)) {
          inside += c[pc];
          if (c[pc] < 0.15) missing.push((pc - root + 12) % 12);
        } else {
          outside += c[pc];
        }
      }
      // Only a chord with 4 or more notes and a 3rd may drop its perfect fifth.
      const noFifth = missing.length === 1 && missing[0] === 7;
      const hasThird = type.intervals.includes(3) || type.intervals.includes(4);
      const allowed = missing.length === 0 || (type.intervals.length >= 4 && hasThird && noFifth);
      if (!allowed) continue;

      let score = inside - 1.2 * outside - 0.6 * missing.length - 0.08 * type.intervals.length - (type.rare || 0);
      if (bassPc === root) score += 0.35;
      else if (bassPc !== null && members.has(bassPc)) score += 0.1;
      else if (bassPc !== null) score -= 0.2;
      if (score < CHORD_MIN_SCORE) continue;

      const slash = bassPc !== null && bassPc !== root && members.has(bassPc);
      const heard = new Set([...members].filter(pc => !missing.includes((pc - root + 12) % 12)));
      found.push({
        root, type, typeIndex, score, members, heard, noFifth,
        label: NOTE_NAMES[root] + type.suffix + (slash ? '/' + NOTE_NAMES[bassPc] : ''),
        description: `${NOTE_NAMES[root]} ${type.name}` + (noFifth ? ', no 5th' : '') + (slash ? `, ${NOTE_NAMES[bassPc]} in the bass` : ''),
      });
    }
  });
  if (!found.length) return [];

  found.sort((a, b) => b.score - a.score || a.typeIndex - b.typeIndex);
  const cutoff = found[0].score - CHORD_ALT_MARGIN;
  const result = [];
  const seen = new Set();   // "root|heard notes": one name per root for the same notes
  for (const cand of found) {
    if (cand.score < cutoff || result.length >= CHORD_MAX_RESULTS) break;
    // A smaller chord whose notes all belong to a better match is a partial reading, not another name,
    // unless the notes it leaves out are weak (they may be noise or overtones).
    const partOf = r => r.heard.size > cand.heard.size && [...cand.heard].every(pc => r.heard.has(pc)) &&
      [...r.heard].every(pc => cand.heard.has(pc) || c[pc] >= 0.5);
    if (result.some(partOf)) continue;
    const key = cand.root + '|' + [...cand.heard].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cand);
  }
  return result;
}

// The single best chord name, or null.
function matchChord(chromaVec, bassPc) {
  return matchChords(chromaVec, bassPc)[0] || null;
}

// Compares heard pitch classes with the expected set.
function checkPitchClasses(chromaVec, expected) {
  const max = Math.max(...chromaVec);
  if (max <= 0) return { ok: false, missing: [...expected], extra: [] };
  const norm = Array.from(chromaVec, v => v / max);
  const missing = [...expected].filter(pc => norm[pc] < 0.2);
  const extra = [];
  for (let pc = 0; pc < 12; pc++) if (!expected.has(pc) && norm[pc] > 0.35) extra.push(pc);
  return { ok: !missing.length && !extra.length, missing, extra };
}

const shapeNotes = shape => shape.frets.map((f, i) => (f === X ? null : STANDARD[i] + f));
const shapePcs = shape => new Set(shapeNotes(shape).filter(m => m !== null).map(pcOf));

// ----- Per-frame state -----
const chroma = new Float32Array(12);
const onsetState = { baseDb: -120, last: -1 };
let chromaResetAt = null;
const midiHistory = [];

// Finds a sudden rise in the low-passed level. Returns the onset time in audioCtx seconds, or null.
function detectOnset(ctxTime, gateDb) {
  const buf = mic.lpData;
  mic.lpAnalyser.getFloatTimeDomainData(buf);
  const envDb = rmsDb(buf.subarray(buf.length - 512));
  const st = onsetState;
  const threshold = st.baseDb + ONSET_JUMP_DB;
  let onset = null;
  if (envDb > threshold && envDb > gateDb) {
    // Find where the rise starts inside the buffer, for better timing.
    let start = buf.length - 64;
    for (let i = 0; i + 64 <= buf.length; i += 64) {
      if (rmsDb(buf.subarray(i, i + 64)) > threshold) { start = i; break; }
    }
    const t = ctxTime - (buf.length - start) / audioCtx.sampleRate;
    if (t - st.last > 0.1) { onset = t; st.last = t; }
    st.baseDb = envDb;
  } else {
    st.baseDb = envDb < st.baseDb ? envDb : st.baseDb + 0.3 * (envDb - st.baseDb);
  }
  return onset;
}

function updateChroma(notes, time) {
  const frame = new Float32Array(12);
  for (const n of notes) frame[pitchClass(n.freq)] += n.energy;
  const max = Math.max(...frame) || 1;
  for (let i = 0; i < 12; i++) frame[i] /= max;
  if (chromaResetAt !== null && time >= chromaResetAt) {
    chroma.set(frame);
    chromaResetAt = null;
    return true;
  }
  for (let i = 0; i < 12; i++) chroma[i] = 0.6 * chroma[i] + 0.4 * frame[i];
  return false;
}

function smoothMidi(m) {
  if (m === null) { midiHistory.length = 0; return null; }
  midiHistory.push(m);
  if (midiHistory.length > 5) midiHistory.shift();
  return median(midiHistory);
}

function analyse(wantSpectrum) {
  const frame = {
    time: performance.now() / 1000, levelDb: -120, audible: false, muted: false,
    pitch: null, midi: null, peaks: [], notes: [], bassPc: null, onset: null, chromaReset: false, spectrum: null,
  };
  if (!mic.analyser) return frame;
  const ctx = audioCtx;
  mic.analyser.getFloatTimeDomainData(mic.timeData);
  const pitchBuf = mic.timeData.subarray(mic.timeData.length - PITCH_WINDOW);
  frame.levelDb = rmsDb(pitchBuf);
  if (wantSpectrum) {
    mic.analyser.getFloatFrequencyData(mic.freqData);
    frame.spectrum = mic.freqData;
  }
  const gate = Number($('gate').value);
  const onset = detectOnset(ctx.currentTime, gate);
  if (ctx.currentTime < muteInputUntil) {
    frame.muted = true;
    for (let i = 0; i < 12; i++) chroma[i] *= 0.9;
    return frame;
  }
  frame.onset = onset;
  if (onset !== null) chromaResetAt = frame.time + CHROMA_LAG;
  frame.audible = frame.levelDb >= gate;
  if (!frame.audible) {
    for (let i = 0; i < 12; i++) chroma[i] *= 0.9;
    return frame;
  }
  frame.pitch = detectPitch(pitchBuf, ctx.sampleRate);
  if (frame.pitch && frame.pitch.clarity >= 0.8) frame.midi = freqToMidi(frame.pitch.freq);
  if (wantSpectrum) {
    frame.peaks = findPeaks();
    frame.notes = findFundamentals(frame.peaks);
    frame.chromaReset = updateChroma(frame.notes, frame.time);
    frame.bassPc = frame.notes.length ? pitchClass(frame.notes[0].freq) : null;
  }
  return frame;
}
