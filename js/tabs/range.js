'use strict';

// ===================== Vocal range tab =====================
const range = (() => {
  const hold = new HoldDetector(0.5, 50);
  let listening = false;
  const saved = store.get('range', null);
  let low = saved ? saved.low : null;
  let high = saved ? saved.high : null;
  let now = null;

  function render() {
    $('rgLow').textContent = low === null ? '–' : noteName(low);
    $('rgHigh').textContent = high === null ? '–' : noteName(high);
    $('rgKeyboard').innerHTML = keyboardSvg(36, 84, low, high, now);
    const known = low !== null && high !== null && high > low;
    if (known) {
      const semis = high - low;
      $('rgSummary').textContent = `Your range: ${noteName(low)} – ${noteName(high)} (${semis} semitones, ${(semis / 12).toFixed(1)} octaves).`;
    } else {
      $('rgSummary').textContent = '';
    }
    $('rgVoices').innerHTML = VOICE_RANGES.map(v => {
      const overlap = known ? Math.max(0, Math.min(high, v.high) - Math.max(low, v.low)) : 0;
      const pct = Math.round((100 * overlap) / (v.high - v.low));
      return `<div class="vrow"><span>${v.name} <small class="sub">${noteName(v.low)}–${noteName(v.high)}</small></span><div class="vbar"><div style="width:${pct}%"></div></div><span>${known ? pct + '%' : '–'}</span></div>`;
    }).join('');
  }

  const nudge = (which, d) => () => {
    if (which === 'low' && low !== null) low += d;
    if (which === 'high' && high !== null) high += d;
    render();
  };
  $('rgLowDown').addEventListener('click', nudge('low', -1));
  $('rgLowUp').addEventListener('click', nudge('low', 1));
  $('rgHighDown').addEventListener('click', nudge('high', -1));
  $('rgHighUp').addEventListener('click', nudge('high', 1));
  $('rgStart').addEventListener('click', () => {
    if (!mic.analyser) { $('rgSummary').textContent = 'Press "Start listening" first.'; return; }
    listening = !listening;
    hold.reset();
    $('rgStart').textContent = listening ? 'Stop' : 'Start';
  });
  $('rgReset').addEventListener('click', () => { low = high = null; render(); });
  $('rgSave').addEventListener('click', () => {
    if (low === null || high === null || high <= low) { $('rgSummary').textContent = 'Sing a low note and a high note first.'; return; }
    store.set('range', { low, high });
    $('rgSummary').textContent += ' Saved.';
  });
  render();

  return {
    onFrame(f) {
      const rounded = f.smoothMidi === null ? null : Math.round(f.smoothMidi);
      if (rounded !== now) {
        now = rounded;
        $('rgNow').textContent = now === null ? '–' : noteName(now);
        render();
      }
      if (!listening) return;
      const held = hold.update(f.time, f.smoothMidi);
      if (held === null) return;
      if (low === null || held < low) low = held;
      if (high === null || held > high) high = held;
      render();
    },
  };
})();
