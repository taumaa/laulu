'use strict';

// ===================== Audio engine =====================
let audioCtx = null;
const mic = { stream: null, source: null, analyser: null, lpAnalyser: null, freqData: null, timeData: null, lpData: null };
let muteInputUntil = 0;   // in audioCtx time; the app ignores the microphone while it plays a sound

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

async function startMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('This browser does not support microphone access.', true);
    return;
  }
  const ctx = getCtx();   // inside the tap: iOS only lets audio start from a user gesture
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    setStatus('Microphone access failed: ' + err.message + (window.isSecureContext ? '' : ' (the page must be opened over https or from localhost).'), true);
    return;
  }
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  // A low-passed copy for onset (strum) detection, so metronome clicks count less.
  const lp1 = ctx.createBiquadFilter();
  const lp2 = ctx.createBiquadFilter();
  lp1.type = lp2.type = 'lowpass';
  lp1.frequency.value = lp2.frequency.value = 1200;
  const lpAnalyser = ctx.createAnalyser();
  lpAnalyser.fftSize = 2048;
  source.connect(lp1).connect(lp2).connect(lpAnalyser);

  Object.assign(mic, {
    stream, source, analyser, lpAnalyser,
    freqData: new Float32Array(analyser.frequencyBinCount),
    timeData: new Float32Array(analyser.fftSize),
    lpData: new Float32Array(lpAnalyser.fftSize),
  });
  $('toggle').textContent = 'Stop listening';
  $('toggle').classList.add('stop');
  setStatus(`Listening (${ctx.sampleRate} Hz).`);
}

function stopMic() {
  mic.stream?.getTracks().forEach(t => t.stop());
  mic.source?.disconnect();
  Object.assign(mic, { stream: null, source: null, analyser: null, lpAnalyser: null });
  $('toggle').textContent = 'Start listening';
  $('toggle').classList.remove('stop');
  setStatus('Stopped.');
}

// Plays a note with a few harmonics. Returns the seconds until it ends.
// `at` is an absolute audioCtx time (instead of `when` from now); `dest` is the node to play into;
// `mute: false` keeps the microphone on, for exercises that listen while the piano plays.
function playNote(midi, { dur = 1, when = 0, at = null, gain = 0.2, sustain = false, dest = null, mute = true } = {}) {
  const ctx = getCtx();
  const t0 = at !== null ? at : ctx.currentTime + 0.03 + when;
  const freq = midiToFreq(midi);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  if (sustain) out.gain.setValueAtTime(gain, t0 + dur - 0.15);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out.connect(dest || ctx.destination);
  [1, 0.45, 0.22, 0.1, 0.05].forEach((amp, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * (i + 1);
    const g = ctx.createGain();
    g.gain.value = amp;
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
  if (mute) muteInputUntil = Math.max(muteInputUntil, t0 + dur + 0.3);
  return t0 + dur - ctx.currentTime;
}

// Plays the notes with a short delay between them, like a strum.
function playChord(midis, { dur = 2, when = 0 } = {}) {
  let end = 0;
  midis.forEach((m, i) => {
    end = Math.max(end, playNote(m, { dur, when: when + i * 0.03, gain: 0.3 / Math.sqrt(midis.length) }));
  });
  return end;
}

function playClick(time, accent) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  osc.frequency.value = accent ? 3200 : 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
  osc.connect(g).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.05);
}
