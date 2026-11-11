'use strict';

// ===================== Chord trainer tab =====================
const chords = (() => {
  let current = null;
  let okFrames = 0;
  let armed = false;
  let solved = false;
  let lastOnset = 0;
  let nextTimer = 0;
  const drill = { running: false, endTime: 0, count: 0, pair: ['C', 'G'], idx: 0 };
  const fb = (text, cls) => setFeedback($('chFeedback'), text, cls);

  fillSelect($('chSet'), Object.entries(CHORD_SETS).map(([k, s]) => [k, s.name]), store.get('chordSet', 'beginner'));
  const all = Object.keys(CHORD_SHAPES).map(k => [k, k]);
  fillSelect($('chA'), all, 'C');
  fillSelect($('chB'), all, 'G');

  function setChord(name) {
    clearTimeout(nextTimer);
    current = name;
    okFrames = 0;
    solved = false;
    armed = false;
    $('chName').textContent = name;
    $('chDiagram').innerHTML = chordDiagramSvg(CHORD_SHAPES[name]);
    fb('Strum the chord.');
    renderNotes(null);
    $('chHints').innerHTML = '';
  }

  function next() {
    const list = CHORD_SETS[$('chSet').value].chords.filter(c => c !== current);
    setChord(pick(list));
  }

  function renderNotes(check) {
    const pcs = [...shapePcs(CHORD_SHAPES[current])];
    $('chNotes').innerHTML = pcs.map(pc => {
      const cls = !check ? '' : check.missing.includes(pc) ? ' miss' : ' ok';
      return `<span class="chip${cls}">${NOTE_NAMES[pc]}</span>`;
    }).join('');
  }

  function hintsFor(check) {
    const shape = CHORD_SHAPES[current];
    const lines = [];
    for (const pc of check.missing) {
      const where = shape.frets
        .map((f, i) => (f !== X && pcOf(STANDARD[i] + f) === pc ? `${stringLabel(i)}, ${f === 0 ? 'open' : 'fret ' + f}` : null))
        .filter(Boolean);
      lines.push(`Missing ${NOTE_NAMES[pc]}: check the ${where.join(' and the ')}. Press firmly just behind the fret and keep other fingers off this string.`);
    }
    for (const pc of check.extra) {
      const muted = shape.frets.map((f, i) => (f === X && pcOf(STANDARD[i]) === pc ? i : -1)).filter(i => i >= 0);
      if (muted.length) lines.push(`Extra ${NOTE_NAMES[pc]}: do not play the ${muted.map(stringLabel).join(' or the ')}.`);
      else lines.push(`Extra ${NOTE_NAMES[pc]}: a finger may be on the wrong fret or string.`);
    }
    return lines.map(l => `<div>• ${l}</div>`).join('');
  }

  function success() {
    solved = true;
    armed = false;
    fb('Correct!', 'good');
    renderNotes({ missing: [] });
    $('chHints').innerHTML = '';
    if (drill.running) {
      drill.count++;
      drill.idx ^= 1;
      setChord(drill.pair[drill.idx]);
      fb(`Correct! Changes: ${drill.count}. Now ${current}.`, 'good');
    } else if ($('chAuto').checked) {
      nextTimer = setTimeout(next, 1000);
    }
  }

  function finishDrill() {
    drill.running = false;
    const key = 'changes.' + drill.pair.join('-');
    const best = Math.max(store.get(key, 0), drill.count);
    store.set(key, best);
    $('chTimer').textContent = '';
    fb(`Time is up: ${drill.count} changes in 60 seconds. Your best for ${drill.pair.join(' ↔ ')} is ${best}.`, 'good');
    $('chStart').textContent = 'Start 60 s';
  }

  $('chSet').addEventListener('change', () => { store.set('chordSet', $('chSet').value); next(); });
  $('chNext').addEventListener('click', next);
  $('chHear').addEventListener('click', () => playChord(shapeNotes(CHORD_SHAPES[current]).filter(m => m !== null)));
  $('chMode').addEventListener('change', () => {
    const changes = $('chMode').value === 'changes';
    $('chPractice').hidden = changes;
    $('chChanges').hidden = !changes;
    if (drill.running) finishDrill();
  });
  $('chStart').addEventListener('click', () => {
    if (drill.running) { finishDrill(); return; }
    if (!mic.analyser) { fb('Press "Start listening" first.', 'warn'); return; }
    drill.pair = [$('chA').value, $('chB').value];
    drill.count = 0;
    drill.idx = 0;
    drill.endTime = performance.now() / 1000 + 60;
    drill.running = true;
    $('chStart').textContent = 'Stop';
    setChord(drill.pair[0]);
  });
  setChord('C');

  return {
    needsSpectrum: true,
    onFrame(f) {
      if (drill.running) {
        const left = drill.endTime - f.time;
        $('chTimer').textContent = `${Math.ceil(left)} s left · changes: ${drill.count} · best: ${store.get('changes.' + drill.pair.join('-'), 0)}`;
        if (left <= 0) finishDrill();
      }
      if (f.onset !== null) { armed = true; lastOnset = f.time; }
      if (solved || !armed) return;
      if (!f.audible || !f.peaks.length) { okFrames = 0; return; }
      // Wait until the long FFT window shows the new strum.
      if (f.time - lastOnset < CHROMA_LAG) return;

      const check = checkPitchClasses(chroma, shapePcs(CHORD_SHAPES[current]));
      renderNotes(check);
      okFrames = check.ok ? okFrames + 1 : 0;
      if (okFrames >= 8) { success(); return; }
      if (!check.ok && f.time - lastOnset > 0.6) {
        fb('Not quite yet.', 'warn');
        $('chHints').innerHTML = hintsFor(check);
      }
    },
  };
})();
