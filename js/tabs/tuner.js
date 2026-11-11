'use strict';

// ===================== Tuner tab =====================
const tuner = (() => {
  let current = 0;
  let done = new Set();
  let inTuneSince = null;
  const strings = () => TUNINGS[tuningKey].midis;
  const guided = () => document.querySelector('input[name=tunMode]:checked').value === 'guided';
  const hint = (text, cls) => setFeedback($('tunHint'), text, cls);

  function renderStrings() {
    const box = $('tunStrings');
    box.innerHTML = '';
    strings().forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'secondary string-btn' + (done.has(i) ? ' done' : '') + (i === current ? ' current' : '');
      b.textContent = `${6 - i}: ${noteName(m)}`;
      b.title = stringLabel(i);
      b.addEventListener('click', () => {
        current = i;
        inTuneSince = null;
        document.querySelector('input[name=tunMode][value=guided]').checked = true;
        renderStrings();
      });
      box.appendChild(b);
    });
  }

  function reset() {
    current = 0;
    done = new Set();
    inTuneSince = null;
    renderStrings();
    hint('');
  }

  $('tunReset').addEventListener('click', reset);
  $('tunRef').addEventListener('click', () => playNote(strings()[current], { dur: 2.5 }));
  renderStrings();

  return {
    reset,
    onFrame(f) {
      const ms = strings();
      const m = f.smoothMidi;
      if (done.size === ms.length) { hint('Kaikki kielet ovat vireessä.', 'good'); return; }
      if (m === null) {
        inTuneSince = null;
        if (!f.muted) hint(guided() ? `Soita pelkkä ${stringLabel(current)} (${noteName(ms[current])}).` : 'Soita mikä tahansa avoin kieli.');
        return;
      }
      if (!guided()) {
        let best = 0;
        ms.forEach((sm, i) => { if (Math.abs(m - sm) < Math.abs(m - ms[best])) best = i; });
        if (best !== current) { current = best; renderStrings(); }
      }
      const target = ms[current];
      let cents = (m - target) * 100;
      if (Math.abs(cents) > 600) cents = ((cents % 1200) + 1800) % 1200 - 600;   // octave error from the pitch tracker
      $('tunNote').textContent = noteName(target);
      setNeedle($('tunNeedle'), cents);
      $('tunInfo').textContent = `${stringLabel(current)} · soitat ${fmtHz(f.pitch.freq)} · tavoite ${fmtHz(midiToFreq(target))} · ${fmtCents(cents)}`;

      if (guided() && Math.abs(cents) > 300) {
        inTuneSince = null;
        hint(`Tuo kuulostaa toiselta kieleltä. Soita ${stringLabel(current)} (${noteName(target)}).`, 'warn');
        return;
      }
      if (Math.abs(cents) <= 5) {
        if (inTuneSince === null) inTuneSince = f.time;
        hint('Vireessä – anna soida…', 'good');
        if (f.time - inTuneSince >= 1 && !done.has(current)) {
          done.add(current);
          inTuneSince = null;
          if (guided()) {
            const next = ms.findIndex((_, i) => !done.has(i));
            if (next >= 0) current = next;
          }
          renderStrings();
        }
        return;
      }
      inTuneSince = null;
      const semis = Math.round(Math.abs(cents) / 100);
      const far = semis >= 1 ? ` (noin ${semis} puolisävelaskel${semis > 1 ? 'ta' : ''})` : '';
      if (cents < 0) hint(`Liian matala ↑ Kiristä kieltä${far}`, 'warn');
      else hint(`Liian korkea ↓ Löysää kieltä${far}`, 'warn');
    },
  };
})();
