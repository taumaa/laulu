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
    $('trPause').textContent = paused ? 'Jatka' : 'Tauko';
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
      $('trInfo').textContent = `${fmtHz(f.pitch.freq)} · ${fmtCents(cents)}`;
      if (recent.length && recent[0].note !== n) recent.length = 0;
      recent.push({ note: n, cents });
      if (recent.length > 60) recent.shift();
      if (recent.length >= 20) {
        const sd = stdDev(recent.map(r => r.cents));
        const word = sd < 8 ? 'hyvin vakaa' : sd < 20 ? 'melko vakaa' : 'huojuva';
        $('trStats').textContent = `Vakaus sävelessä ${noteName(n)}: ±${Math.round(sd)} senttiä (${word}).`;
      }
    },
  };
})();
