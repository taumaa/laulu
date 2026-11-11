'use strict';

// ===================== Fretboard tab =====================
const fretboard = (() => {
  const FB = { frets: 15, w: 1000, h: 240, left: 72, right: 16, top: 24, gap: 36 };
  FB.fretW = (FB.w - FB.left - FB.right) / FB.frets;
  const fx = fret => (fret === 0 ? FB.left - 24 : FB.left + (fret - 0.5) * FB.fretW);
  const fy = i => FB.top + (5 - i) * FB.gap;   // i = 0 is the 6th (low) string, drawn at the bottom
  const tuning = () => TUNINGS[tuningKey].midis;

  const game = { running: false, target: null, score: 0, streak: 0, best: store.get('fretBest', 0) };
  const hold = new HoldDetector(0.3, 40);
  let nowNote = null;
  let revealUntil = 0;
  const fb = (text, cls) => setFeedback($('fbFeedback'), text, cls);

  function redraw() {
    const t = tuning();
    let s = `<svg viewBox="0 0 ${FB.w} ${FB.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kitaran otelauta">`;
    const midY = (a, b) => (fy(a) + fy(b)) / 2;
    for (const f of [3, 5, 7, 9, 15]) s += `<circle cx="${fx(f)}" cy="${midY(2, 3)}" r="7" fill="#2a2f3a"/>`;
    s += `<circle cx="${fx(12)}" cy="${midY(1, 2)}" r="7" fill="#2a2f3a"/><circle cx="${fx(12)}" cy="${midY(3, 4)}" r="7" fill="#2a2f3a"/>`;
    for (let f = 0; f <= FB.frets; f++) {
      const x = FB.left + f * FB.fretW;
      s += `<line x1="${x}" x2="${x}" y1="${fy(5)}" y2="${fy(0)}" stroke="${f === 0 ? '#e8eaf0' : '#555b69'}" stroke-width="${f === 0 ? 6 : 2}"/>`;
    }
    for (let i = 0; i < 6; i++) {
      s += `<line x1="${FB.left}" x2="${FB.w - FB.right}" y1="${fy(i)}" y2="${fy(i)}" stroke="#b8bcc8" stroke-width="${1 + (5 - i) * 0.35}"/>`;
      s += `<text x="4" y="${fy(i) + 4}" fill="#8a90a0" font-size="13">${NOTE_NAMES[pcOf(t[i])]}</text>`;
    }
    for (const f of [3, 5, 7, 9, 12, 15]) s += `<text x="${fx(f)}" y="${fy(0) + 30}" fill="#8a90a0" font-size="12" text-anchor="middle">${f}</text>`;
    s += '<g class="fb-all">';
    for (let i = 0; i < 6; i++) {
      for (let f = 0; f <= FB.frets; f++) {
        const pc = pcOf(t[i] + f);
        s += `<text x="${fx(f)}" y="${fy(i) - 6}" fill="${NATURAL[pc] ? '#8a90a0' : '#555b69'}" font-size="10" text-anchor="middle">${NOTE_NAMES[pc]}</text>`;
      }
    }
    s += '</g><g id="fbMarks"></g></svg>';
    $('fbBoard').innerHTML = s;
    marks();
  }

  function dot(i, f, color, label) {
    return `<circle cx="${fx(f)}" cy="${fy(i)}" r="13" fill="${color}"/>` +
      `<text x="${fx(f)}" y="${fy(i) + 4}" fill="#06281d" font-size="11" font-weight="700" text-anchor="middle">${label}</text>`;
  }

  function marks() {
    const t = tuning();
    let s = '';
    if (nowNote !== null) {
      for (let i = 0; i < 6; i++) {
        const f = nowNote - t[i];
        if (f >= 0 && f <= FB.frets) s += dot(i, f, '#4fd1a5', NOTE_NAMES[pcOf(nowNote)]);
      }
    }
    if (game.target && performance.now() / 1000 < revealUntil) {
      s += dot(game.target.string, game.target.fret, '#f6ad55', NOTE_NAMES[pcOf(game.target.midi)]);
    }
    const g = $('fbMarks');
    if (g) g.innerHTML = s;
  }

  function renderStringChecks() {
    $('fbStrings').innerHTML = [0, 1, 2, 3, 4, 5].map(i =>
      `<label><input type="checkbox" data-string="${i}" checked> ${6 - i}</label>`).join('');
  }

  function newTarget() {
    const strings = [...document.querySelectorAll('#fbStrings input:checked')].map(el => Number(el.dataset.string));
    if (!strings.length) { fb('Valitse ainakin yksi kieli.', 'warn'); return; }
    const t = tuning();
    const options = [];
    for (const i of strings) {
      for (let f = 0; f <= 12; f++) {
        if (!$('fbNaturals').checked || NATURAL[pcOf(t[i] + f)]) options.push({ string: i, fret: f, midi: t[i] + f });
      }
    }
    let target = pick(options);
    if (game.target && options.length > 1) {
      while (target.midi === game.target.midi && target.string === game.target.string) target = pick(options);
    }
    game.target = target;
    hold.reset();
    $('fbPrompt').textContent = `Soita ${NOTE_NAMES[pcOf(target.midi)]} ${stringOn(target.string)}`;
    fb('');
    renderScore();
  }

  function renderScore() {
    $('fbScore').textContent = `Pisteet: ${game.score} · putki: ${game.streak} · paras putki: ${game.best}`;
  }

  $('fbShowAll').addEventListener('change', () => $('fbBoard').classList.toggle('show-all', $('fbShowAll').checked));
  $('fbStart').addEventListener('click', () => {
    if (game.running) {
      game.running = false;
      game.target = null;
      $('fbStart').textContent = 'Aloita peli';
      $('fbPrompt').textContent = '';
      fb('');
      return;
    }
    if (!mic.analyser) { fb('Paina ensin "Aloita kuuntelu".', 'warn'); return; }
    game.running = true;
    game.score = 0;
    game.streak = 0;
    $('fbStart').textContent = 'Lopeta peli';
    newTarget();
  });
  $('fbSkip').addEventListener('click', () => {
    if (!game.running) return;
    game.streak = 0;
    revealUntil = performance.now() / 1000 + 2;
    fb(`Tässä: ${stringLabel(game.target.string)}, ${game.target.fret === 0 ? 'avoin' : game.target.fret + '. nauha'}.`, 'warn');
    marks();
    setTimeout(() => game.running && newTarget(), 2000);
  });
  renderStringChecks();
  redraw();

  return {
    redraw,
    onFrame(f) {
      const rounded = f.smoothMidi === null ? null : Math.round(f.smoothMidi);
      if (rounded !== nowNote) {
        nowNote = rounded;
        $('fbNow').textContent = rounded === null ? '–' : noteName(rounded);
        marks();
      }
      if (!game.running || !game.target) return;
      const held = hold.update(f.time, f.smoothMidi);
      if (held === null) return;
      if (held === game.target.midi) {
        game.score++;
        game.streak++;
        if (game.streak > game.best) { game.best = game.streak; store.set('fretBest', game.best); }
        revealUntil = f.time + 0.8;
        fb('Oikein!', 'good');
        renderScore();
        marks();
        const t = game.target;
        setTimeout(() => { if (game.running && game.target === t) newTarget(); }, 800);
      } else if (pcOf(held) === pcOf(game.target.midi)) {
        game.streak = 0;
        fb(`Oikea sävel, väärä paikka. Etsi se ${stringOn(game.target.string)}.`, 'warn');
        renderScore();
      } else {
        game.streak = 0;
        fb(`Tuo oli ${noteName(held)}. Yritä uudelleen.`, 'badc');
        renderScore();
      }
    },
  };
})();
