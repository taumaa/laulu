'use strict';

// ===================== Sing tab =====================
const sing = (() => {
  const pt = new PitchTrace($('sgCanvas'), 8, 14);
  const HOLD_TARGET = 2;
  const s = { phase: 'idle', targets: [], i: 0, refEnds: 0, listenStart: 0, inZoneSince: null, lastInZone: 0, errors: [], firstHit: null, pauseUntil: 0, results: [] };
  const fb = (text, cls) => setFeedback($('sgFeedback'), text, cls);
  const savedRange = () => store.get('range', null);

  function fillRoots() {
    const r = savedRange();
    const def = r ? Math.min(r.high - 12, r.low + 2) : 57;
    fillSelect($('sgRoot'), Array.from({ length: 37 }, (_, k) => [40 + k, noteName(40 + k)]), Math.max(40, Math.min(76, def)));
  }

  function buildTargets() {
    const root = Number($('sgRoot').value);
    const ex = $('sgExercise').value;
    if (ex === 'scale') return [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0].map(i => root + i);
    if (ex === 'arpeggio') return [0, 4, 7, 12, 7, 4, 0].map(i => root + i);
    const r = savedRange();
    const lo = r ? r.low + 1 : root, hi = r ? r.high - 1 : root + 12;
    return Array.from({ length: 8 }, () => randInt(lo, Math.max(lo, hi)));
  }

  function resetZone() { s.inZoneSince = null; s.errors = []; $('sgHold').style.width = '0%'; }

  function playRef() {
    const target = s.targets[s.i];
    const secs = playNote(target, { dur: 1.5, sustain: true });
    s.phase = 'reference';
    s.refEnds = performance.now() / 1000 + secs + 0.3;
    $('sgTarget').textContent = noteName(target);
    $('sgProgress').textContent = `Note ${s.i + 1} of ${s.targets.length}`;
    fb('Listen…');
    resetZone();
  }

  function finishNote(time, skipped) {
    const target = s.targets[s.i];
    if (skipped) {
      s.results.push({ target, skipped: true });
      fb('Skipped.', 'warn');
    } else {
      const avg = mean(s.errors.map(Math.abs));
      const sd = stdDev(s.errors);
      const score = Math.max(0, Math.min(100, Math.round(100 - avg * 1.5 - sd - Math.max(0, s.firstHit - 1) * 5)));
      s.results.push({ target, avg, sd, found: s.firstHit, score });
      fb(`Well done! ${Math.round(avg)} cents off on average.`, 'good');
    }
    renderResults();
    s.phase = 'pause';
    s.pauseUntil = time + 1;
  }

  function nextNote() {
    s.i++;
    if (s.i >= s.targets.length) {
      s.phase = 'done';
      const scored = s.results.filter(r => !r.skipped);
      const overall = scored.length ? Math.round(mean(scored.map(r => r.score))) : 0;
      fb(`Finished! Overall score: ${overall} / 100.`, 'good');
      $('sgTarget').textContent = '–';
      $('sgStart').textContent = 'Start';
      return;
    }
    playRef();
  }

  function renderResults() {
    const rows = !s.results.length ? '<tr><td class="placeholder" colspan="5">Your results for each note appear here.</td></tr>' : s.results.map(r => r.skipped
      ? `<tr><td>${noteName(r.target)}</td><td colspan="4">skipped</td></tr>`
      : `<tr><td>${noteName(r.target)}</td><td>${Math.round(r.avg)} cents</td><td>±${Math.round(r.sd)} cents</td><td>${r.found.toFixed(1)} s</td><td>${r.score}</td></tr>`).join('');
    $('sgResults').innerHTML = `<table class="results"><thead><tr><th>Note</th><th>Average error</th><th>Steadiness</th><th>Time to find</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`;
    const box = $('sgResults');
    box.scrollTop = box.scrollHeight;
  }

  $('sgStart').addEventListener('click', () => {
    if (s.phase !== 'idle' && s.phase !== 'done') {
      s.phase = 'idle';
      $('sgStart').textContent = 'Start';
      fb('Stopped.');
      return;
    }
    if (!mic.analyser) { fb('Press "Start listening" first.', 'warn'); return; }
    s.targets = buildTargets();
    s.i = 0;
    s.results = [];
    renderResults();
    $('sgStart').textContent = 'Stop';
    playRef();
  });
  $('sgReplay').addEventListener('click', () => { if (s.phase === 'listening' || s.phase === 'reference') playRef(); });
  $('sgSkip').addEventListener('click', () => { if (s.phase === 'listening' || s.phase === 'reference') finishNote(performance.now() / 1000, true); });
  fillRoots();
  renderResults();

  return {
    onShow: fillRoots,
    onFrame(f) {
      const active = ['reference', 'listening', 'pause'].includes(s.phase);
      const target = active ? s.targets[s.i] : null;
      const m = f.smoothMidi;
      const shown = target !== null && m !== null && $('sgAnyOctave').checked ? foldToOctave(m, target) : target;
      pt.setTarget(shown);
      pt.push(f.time, m);
      pt.draw(f.time);

      if (s.phase === 'pause' && f.time >= s.pauseUntil) { nextNote(); return; }
      if (s.phase === 'reference' && f.time >= s.refEnds) {
        s.phase = 'listening';
        s.listenStart = f.time;
        s.firstHit = null;
        resetZone();
        fb('Your turn: sing the note.');
      }
      if (s.phase !== 'listening') return;
      if (f.time - s.listenStart > 15) { finishNote(f.time, true); return; }
      if (m === null) {
        if (s.inZoneSince !== null && f.time - s.lastInZone > 0.25) resetZone();
        return;
      }
      const cents = (m - shown) * 100;
      if (Math.abs(cents) <= 25) {
        if (s.inZoneSince === null) {
          s.inZoneSince = f.time;
          if (s.firstHit === null) s.firstHit = f.time - s.listenStart;
        }
        s.lastInZone = f.time;
        s.errors.push(cents);
        const held = f.time - s.inZoneSince;
        $('sgHold').style.width = Math.min(100, (100 * held) / HOLD_TARGET) + '%';
        fb('Good – hold it…', 'good');
        if (held >= HOLD_TARGET) finishNote(f.time, false);
      } else {
        if (s.inZoneSince !== null && f.time - s.lastInZone > 0.25) resetZone();
        const semis = Math.round(Math.abs(cents) / 100);
        const far = semis >= 2 ? ` (about ${semis} semitones)` : '';
        fb(cents < 0 ? `Too low ↑ Go up${far}` : `Too high ↓ Go down${far}`, 'warn');
      }
    },
  };
})();
