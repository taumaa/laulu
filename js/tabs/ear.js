'use strict';

// ===================== Ear training tab =====================
const ear = (() => {
  const hold = new HoldDetector(0.4, 50);
  let q = null;
  let stage = 0;
  let firstSung = null;
  let okFrames = 0;
  let pendingOnset = null;
  const score = { right: 0, total: 0, streak: 0 };
  const fb = (text, cls) => setFeedback($('erFeedback'), text, cls);
  const level = () => $('erLevel').value;
  const echo = () => $('erAnswer').value === 'echo';
  const easy = () => $('erDifficulty').value === 'easy';

  function noteRange() {
    const r = store.get('range', null);
    return r ? [r.low + 1, r.high - 1] : [48, 67];
  }

  function play() {
    if (!q) return;
    if (q.level === 'chord') playChord(q.notes, { dur: 2 });
    else if (q.level === 'interval') { playNote(q.notes[0], { dur: 0.9 }); playNote(q.notes[1], { dur: 0.9, when: 1 }); }
    else if (!echo()) { playNote(q.ref, { dur: 0.8 }); playNote(q.notes[0], { dur: 1, when: 1 }); }
    else playNote(q.notes[0], { dur: 1.2, sustain: true });
    hold.reset();
    stage = 0;
    okFrames = 0;
    pendingOnset = null;
  }

  const INTERVAL_SETS = { easy: [2, 4, 5, 7, 12], all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
  const CHORD_SETS_EAR = { easy: ['', 'm'], all: ['', 'm', '7', 'maj7', 'm7', 'dim', 'aug', 'sus4'] };
  const chordType = suffix => CHORD_TYPES.find(t => t.suffix === suffix);

  // The answer buttons for the current settings.
  function optionsFor(lv) {
    const diff = easy() ? 'easy' : 'all';
    if (lv === 'note') return NOTE_NAMES.filter((_, pc) => !easy() || NATURAL[pc]);
    if (lv === 'interval') return INTERVAL_SETS[diff].map(i => INTERVALS[i]);
    return CHORD_SETS_EAR[diff].map(n => capitalize(chordType(n).name));
  }

  // The buttons are drawn as soon as the settings change, disabled until there is a question,
  // so the page does not grow when the first question appears.
  function renderAnswers() {
    if (echo()) { $('erAnswers').innerHTML = ''; return; }
    const open = q && !q.solved;
    $('erAnswers').innerHTML = optionsFor(level()).map(o =>
      `<button class="secondary" data-answer="${o}"${open ? '' : ' disabled'}>${o}</button>`).join('');
  }

  function newQuestion() {
    const [lo, hi] = noteRange();
    const lv = level();
    if (lv === 'note') {
      let m = randInt(lo, hi);
      while (easy() && !NATURAL[pcOf(m)]) m = randInt(lo, hi);
      q = { level: lv, notes: [m], ref: m - pcOf(m), answer: NOTE_NAMES[pcOf(m)] };
      $('erPrompt').textContent = echo() ? 'Laula tai soita sävel takaisin.' : 'Ensin kuulet C:n, sitten arvoitussävelen. Mikä sävel se on?';
    } else if (lv === 'interval') {
      const set = INTERVAL_SETS[easy() ? 'easy' : 'all'];
      const semis = pick(set);
      const root = randInt(lo, Math.max(lo, hi - semis));
      q = { level: lv, notes: [root, root + semis], semis, answer: INTERVALS[semis] };
      $('erPrompt').textContent = echo() ? 'Laula tai soita molemmat sävelet takaisin: ensin matala, sitten korkea.' : 'Mikä intervalli se on?';
    } else {
      const type = chordType(pick(CHORD_SETS_EAR[easy() ? 'easy' : 'all']));
      const root = randInt(48, 57);
      q = {
        level: lv, notes: [...type.intervals.map(i => root + i), root + 12], pcs: new Set(type.intervals.map(i => (root + i) % 12)),
        answer: capitalize(type.name), label: NOTE_NAMES[pcOf(root)] + type.suffix,
      };
      $('erPrompt').textContent = echo() ? 'Soita sama sointu kitaralla.' : 'Minkä tyyppinen sointu se on?';
    }
    q.firstTry = true;
    q.solved = false;
    renderAnswers();
    fb('');
    play();
  }

  function grade(correct, text) {
    if (!q || q.solved) return;
    if (q.firstTry) {
      score.total++;
      if (correct) { score.right++; score.streak++; } else score.streak = 0;
      const key = 'earBest.' + q.level;
      if (score.streak > store.get(key, 0)) store.set(key, score.streak);
      q.firstTry = false;
    }
    if (correct) { q.solved = true; renderAnswers(); }
    fb(text, correct ? 'good' : 'badc');
    renderScore();
  }

  function answerText() {
    if (q.level === 'note') return noteName(q.notes[0]);
    if (q.level === 'interval') return `${q.answer} (${noteName(q.notes[0])} → ${noteName(q.notes[1])})`;
    return `${q.answer} (${q.label})`;
  }

  function renderScore() {
    $('erScore').textContent = `Pisteet: ${score.right}/${score.total} · putki: ${score.streak} · paras putki: ${store.get('earBest.' + level(), 0)}`;
  }

  $('erNew').addEventListener('click', () => {
    if (echo() && !mic.analyser) { fb('Paina ensin "Aloita kuuntelu" tai vastaa valitsemalla nimi.', 'warn'); return; }
    newQuestion();
  });
  $('erReplay').addEventListener('click', play);
  $('erReveal').addEventListener('click', () => {
    if (!q) return;
    grade(false, `Vastaus: ${answerText()}.`);
    q.solved = true;
    renderAnswers();
  });
  $('erAnswers').addEventListener('click', e => {
    const btn = e.target.closest('button[data-answer]');
    if (!btn || !q) return;
    const correct = btn.dataset.answer === q.answer;
    grade(correct, correct ? `Oikein! ${answerText()}.` : 'Ei ihan. Yritä uudelleen tai paina "Näytä vastaus".');
  });
  ['erLevel', 'erDifficulty', 'erAnswer'].forEach(id => $(id).addEventListener('change', () => { q = null; renderAnswers(); $('erPrompt').textContent = 'Paina "Uusi kysymys".'; renderScore(); }));
  $('erPrompt').textContent = 'Paina "Uusi kysymys".';
  renderAnswers();
  renderScore();

  return {
    needsSpectrum: () => level() === 'chord' && echo(),
    onFrame(f) {
      if (!q || q.solved || !echo()) return;
      if (q.level === 'chord') {
        if (f.onset !== null) { pendingOnset = f.time; okFrames = 0; }
        if (pendingOnset === null || f.time - pendingOnset < CHROMA_LAG || !f.audible) return;
        const check = checkPitchClasses(chroma, q.pcs);
        okFrames = check.ok ? okFrames + 1 : 0;
        if (okFrames >= 8) grade(true, `Oikein! ${answerText()}.`);
        else if (f.time - pendingOnset > 1.2) {
          const heard = matchChord(chroma, f.bassPc);
          grade(false, heard ? `Soitit ${heard.label}. Kuuntele uudelleen ja yritä vielä.` : 'Tuo ei ollut sama sointu. Kuuntele uudelleen ja yritä vielä.');
          pendingOnset = null;
        }
        return;
      }
      const held = hold.update(f.time, f.smoothMidi);
      if (held === null) return;
      if (q.level === 'note') {
        if (pcOf(held) === pcOf(q.notes[0])) grade(true, `Oikein! Se oli ${NOTE_NAMES[pcOf(held)]}.`);
        else grade(false, `Lauloit ${NOTE_NAMES[pcOf(held)]}. Kuuntele uudelleen ja yritä vielä.`);
        return;
      }
      if (stage === 0) {
        if (pcOf(held) === pcOf(q.notes[0])) { stage = 1; firstSung = held; fb('Hyvä. Nyt toinen sävel.', 'good'); }
        else grade(false, `Ensimmäinen sävel ei ollut ${NOTE_NAMES[pcOf(held)]}. Kuuntele uudelleen.`);
        return;
      }
      const sungInterval = held - firstSung;
      if (sungInterval === q.semis) grade(true, `Oikein! ${answerText()}.`);
      else {
        const name = Math.abs(sungInterval) <= 12 ? INTERVALS[Math.abs(sungInterval)].toLowerCase() : 'suurempi intervalli';
        grade(false, `Lauloit: ${name}${sungInterval < 0 ? ' alaspäin' : ''}. Yritä uudelleen ensimmäisestä sävelestä.`);
        stage = 0;
      }
    },
  };
})();
