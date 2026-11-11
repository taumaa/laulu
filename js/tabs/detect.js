'use strict';

// ===================== Detect tab =====================
const detect = (() => {
  const RECENT_MAX = 12;
  const fills = NOTE_NAMES.map(name => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `<div class="fill"></div><div class="lbl">${name}</div>`;
    $('detChroma').appendChild(bar);
    return bar.firstChild;
  });

  // Fixed slots for chord names, created once so the panel never changes height.
  const slots = Array.from({ length: CHORD_MAX_RESULTS }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cand empty';
    b.dataset.index = i;
    b.innerHTML = '<span class="cand-label"></span><span class="cand-desc"></span><span class="cand-fit"><span></span></span>';
    $('detCands').appendChild(b);
    return b;
  });

  let history = [];
  let lastSoundAt = 0;
  let shown = null;        // the result on screen: { kind, label, sub, candidates }
  let focusLabel = null;   // the chord name the user picked from the list
  let renderedKey = '';
  let recent = [];

  function clear() {
    history = [];
    shown = null;
    focusLabel = null;
    $('detKind').textContent = '';
    $('detResult').textContent = '–';
    $('detResult').classList.remove('stale', 'long', 'longer');
    $('detSub').textContent = '';
    $('detTunerNote').textContent = '–';
    $('detTunerInfo').textContent = '';
    setNeedle($('detNeedle'), 0);
    $('detChips').innerHTML = '';
    renderResult();
  }

  function focused() {
    if (!shown) return null;
    return shown.candidates.find(c => c.label === focusLabel) || shown.candidates[0] || null;
  }

  // Chord names get smaller as they get longer, so they never wrap or push the layout.
  function setBig(el, text) {
    el.textContent = text;
    el.classList.toggle('long', text.length > 5 && text.length <= 8);
    el.classList.toggle('longer', text.length > 8);
  }

  function renderResult() {
    const cands = shown ? shown.candidates : [];
    const focus = focused();
    const key = (shown ? shown.label : '') + '|' + (focus ? focus.label : '') + '|' + cands.map(c => c.label).join(',');
    if (key === renderedKey) return;
    renderedKey = key;

    if (shown) {
      $('detKind').textContent = shown.kind;
      setBig($('detResult'), focus ? focus.label : shown.label);
      $('detSub').textContent = focus ? focus.description : shown.sub;
    }
    const top = cands.length ? cands[0].score : 1;
    slots.forEach((slot, i) => {
      const c = cands[i];
      slot.classList.toggle('empty', !c);
      slot.classList.toggle('best', i === 0 && !!c);
      slot.classList.toggle('focus', !!c && c === focus);
      slot.disabled = !c;
      slot.querySelector('.cand-label').textContent = c ? c.label : '';
      slot.querySelector('.cand-desc').textContent = c ? c.description : '';
      slot.querySelector('.cand-fit > span').style.width = c ? Math.max(8, Math.min(100, 100 * c.score / top)).toFixed(0) + '%' : '0%';
      slot.title = c ? `${c.label}: ${c.description}` : '';
    });
    $('detCandsNote').textContent = !shown
      ? 'Soita sointu. Kaikki sävelille sopivat sointunimet näkyvät tässä, paras ensin.'
      : cands.length > 1 ? 'Kaikki nämä nimet sopivat soittamiisi säveliin. Napauta nimeä nähdäksesi sointukaavion.'
        : cands.length === 1 ? 'Näille sävelille sopii vain yksi sointunimi.'
          : shown.kind === 'Yksittäinen sävel' ? 'Tuo on yksittäinen sävel. Soita sointu nähdäksesi sen nimet.' : 'Sointua ei tunnistettu.';

    const shape = focus ? CHORD_SHAPES[focus.label.split('/')[0]] : null;
    if (shape) $('detDiagram').innerHTML = chordDiagramSvg(shape);
    else $('detDiagram').innerHTML = focus ? `<div class="diagram-empty">Soinnulle ${focus.label.split('/')[0]} ei ole vielä kaaviota</div>` : '';
  }

  function renderRecent() {
    $('detRecent').innerHTML = recent.map((label, i) =>
      `<span class="chip${i === 0 ? ' ok' : ''}">${label}</span>`).join('') ||
      '<span class="placeholder">Soittamasi soinnut näkyvät tässä.</span>';
  }

  function addRecent(label) {
    if (recent[0] === label) return;
    recent.unshift(label);
    if (recent.length > RECENT_MAX) recent.length = RECENT_MAX;
    renderRecent();
  }

  function renderChroma(members) {
    const max = Math.max(...chroma) || 1;
    fills.forEach((fill, pc) => {
      fill.style.height = (100 * chroma[pc] / max).toFixed(1) + '%';
      fill.classList.toggle('in-chord', !!members && members.has(pc));
    });
  }

  function renderTuner(pitch) {
    if (!pitch || pitch.clarity < 0.8) return;
    const info = noteInfo(pitch.freq);
    $('detTunerNote').textContent = info.name + info.octave;
    setNeedle($('detNeedle'), info.cents);
    const stringIdx = STANDARD.indexOf(info.midi);
    const stringName = stringIdx >= 0 ? ' · avoin ' + stringLabel(stringIdx) : '';
    $('detTunerInfo').textContent = `${fmtHz(pitch.freq)} · ${fmtCents(info.cents)}${stringName}`;
  }

  function renderChips(notes) {
    $('detChips').innerHTML = notes.map((n, i) =>
      `<span class="chip${i === 0 ? ' bass' : ''}" title="${fmtHz(n.freq)}">${noteName(freqToMidi(n.freq))}</span>`).join('');
  }

  // Shows a result only after it wins most of the recent frames.
  function vote(candidate) {
    history.push(candidate);
    if (history.length > HISTORY_LEN) history.shift();
    const counts = new Map();
    for (const c of history) if (c) counts.set(c.label, (counts.get(c.label) || 0) + 1);
    let winner = null, winnerCount = 0;
    for (const [label, count] of counts) if (count > winnerCount) { winner = label; winnerCount = count; }
    if (!winner || winnerCount < Math.min(3, history.length)) return;
    const latest = history.findLast(c => c && c.label === winner);
    if (!shown || shown.label !== latest.label) focusLabel = null;
    shown = latest;
    if (latest.kind === 'Sointu') addRecent(latest.label);
    renderResult();
  }

  $('detCands').addEventListener('click', e => {
    const slot = e.target.closest('.cand');
    if (!slot || !shown) return;
    const c = shown.candidates[Number(slot.dataset.index)];
    if (!c) return;
    focusLabel = c.label;
    renderResult();
  });
  $('detRecentClear').addEventListener('click', () => { recent = []; renderRecent(); });
  renderRecent();
  renderResult();

  return {
    needsSpectrum: true,
    onFrame(f) {
      drawSpectrum($('detSpectrum'), f.spectrum, f.peaks);
      if (!f.audible || !f.peaks.length) {
        renderChroma(null);
        if (f.time - lastSoundAt > HOLD_SEC) { if (shown || history.length) clear(); }
        else $('detResult').classList.add('stale');
        return;
      }
      lastSoundAt = f.time;
      $('detResult').classList.remove('stale');
      if (f.chromaReset) history = [];
      renderTuner(f.pitch);
      renderChips(f.notes);

      const chromaMax = Math.max(...chroma) || 1;
      const activeCount = chroma.filter(v => v / chromaMax > 0.25).length;
      const mode = $('detMode').value;
      const names = mode === 'note' ? [] : matchChords(chroma, f.bassPc);
      const chord = names[0] || null;
      const isClearNote = f.pitch && f.pitch.clarity >= 0.95 && activeCount <= 2;

      let candidate = null;
      if (chord && (mode === 'chord' || !isClearNote)) {
        candidate = { kind: 'Sointu', label: chord.label, sub: chord.description, candidates: names };
      } else if (mode !== 'chord') {
        const freq = f.pitch && f.pitch.clarity > 0.8 ? f.pitch.freq : f.notes[0]?.freq;
        if (freq) {
          const info = noteInfo(freq);
          candidate = { kind: 'Yksittäinen sävel', label: info.name + info.octave, sub: `${fmtHz(freq)}`, candidates: [] };
        }
      }
      const focus = focused();
      renderChroma(focus ? focus.members : null);
      vote(candidate);
    },
  };
})();
