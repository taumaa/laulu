'use strict';

// ===================== Pitch trace tab =====================
const trace = (() => {
  const pt = new PitchTrace($('trCanvas'), 10, 18);
  let paused = false;
  let pausedAt = 0;
  const recent = [];

  $('trPause').addEventListener('click', () => {
    paused = !paused;
    pausedAt = performance.now() / 1000;
    $('trPause').textContent = paused ? 'Resume' : 'Pause';
  });

  return {
    onFrame(f) {
      if (paused) { pt.draw(pausedAt); return; }
      pt.push(f.time, f.smoothMidi);
      pt.draw(f.time);
      const m = f.smoothMidi;
      if (m === null) { recent.length = 0; return; }
      const n = Math.round(m);
      const cents = (m - n) * 100;
      $('trNote').textContent = noteName(n);
      $('trInfo').textContent = `${f.pitch.freq.toFixed(1)} Hz · ${fmtCents(cents)}`;
      if (recent.length && recent[0].note !== n) recent.length = 0;
      recent.push({ note: n, cents });
      if (recent.length > 60) recent.shift();
      if (recent.length >= 20) {
        const sd = stdDev(recent.map(r => r.cents));
        const word = sd < 8 ? 'very steady' : sd < 20 ? 'fairly steady' : 'wobbly';
        $('trStats').textContent = `Steadiness on ${noteName(n)}: ±${Math.round(sd)} cents (${word}).`;
      }
    },
  };
})();
