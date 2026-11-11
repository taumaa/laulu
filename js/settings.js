'use strict';

// ===================== Settings UI =====================
$('a4').value = store.get('a4', 440);
$('gate').value = store.get('gate', -55);
$('gateVal').textContent = $('gate').value + ' dB';
$('a4').addEventListener('change', () => store.set('a4', a4()));
$('gate').addEventListener('input', () => {
  $('gateVal').textContent = $('gate').value + ' dB';
  store.set('gate', Number($('gate').value));
});
$('toggle').addEventListener('click', () => (mic.analyser ? stopMic() : startMic()));

let tuningKey = store.get('tuning', 'standard');
if (!TUNINGS[tuningKey]) tuningKey = 'standard';
document.querySelectorAll('.tuning-select').forEach(sel => {
  fillSelect(sel, Object.entries(TUNINGS).map(([k, t]) => [k, t.name]), tuningKey);
  sel.addEventListener('change', () => {
    tuningKey = sel.value;
    store.set('tuning', tuningKey);
    document.querySelectorAll('.tuning-select').forEach(s => { s.value = tuningKey; });
    tuner.reset();
    fretboard.redraw();
  });
});
