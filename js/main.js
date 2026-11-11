'use strict';

// ===================== Tabs and main loop =====================
const modules = { detect, tuner, chords, fretboard, rhythm, trace, sing, workout, range, ear };
let activeTab = store.get('tab', 'detect');
if (!modules[activeTab]) activeTab = 'detect';

function showTab(name) {
  modules[activeTab].onHide?.();
  activeTab = name;
  store.set('tab', name);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  modules[name].onShow?.();
}
$('tabs').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) showTab(btn.dataset.tab);
});
showTab(activeTab);

function loop() {
  requestAnimationFrame(loop);
  const mod = modules[activeTab];
  const wantSpectrum = typeof mod.needsSpectrum === 'function' ? mod.needsSpectrum() : !!mod.needsSpectrum;
  const frame = analyse(wantSpectrum);
  frame.smoothMidi = smoothMidi(frame.midi);
  $('level').style.width = Math.max(0, Math.min(100, (frame.levelDb + 80) * 1.4)) + '%';
  mod.onFrame(frame);
}
requestAnimationFrame(loop);
