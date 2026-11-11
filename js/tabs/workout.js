'use strict';

// ===================== Voice workout tab =====================
// Vocal exercises sung up and down your range with a piano guide, a breathing exercise,
// and a daily warm-up program. Everything runs in the browser; scores are kept in localStorage.
const workout = (() => {
  const VIEW_PAST = 2.5, VIEW_FUTURE = 5.5;   // seconds shown left and right of the play line
  const PROGRAM_GAP = 3;                      // seconds between exercises in the warm-up
  const fb = (text, cls) => setFeedback($('woFeedback'), text, cls);
  // The sung pitch moved by octaves to the octave nearest the target: any octave counts.
  const fold = (sung, target) => sung + 12 * Math.round((target - sung) / 12);

  let run = null;        // the exercise being sung
  let program = null;    // { list, i, scores, timer } while the daily warm-up runs
  let preview = null;    // the plan drawn before starting
  let view = { lo: 48, hi: 62 };

  const exercise = () => VOICE_EXERCISE_BY_ID[$('woExercise').value];
  const options = () => ({ tempo: Number($('woTempo').value), guide: $('woGuide').checked, count: Number($('woKeys').value) });

  function fillExercises() {
    $('woExercise').innerHTML = VOICE_LEVELS.map((lv, i) => `<optgroup label="${lv}">` +
      VOICE_EXERCISES.filter(e => e.level === i).map(e => `<option value="${e.id}">${e.title}</option>`).join('') +
      '</optgroup>').join('');
    const saved = store.get('workout.exercise', 'mum-5');
    $('woExercise').value = VOICE_EXERCISE_BY_ID[saved] ? saved : 'mum-5';
  }

  function fillVoices() {
    const r = store.get('range', null);
    const opts = [];
    if (r) opts.push(['measured', `Oma ääniala (${noteName(r.low)}–${noteName(r.high)})`]);
    VOICE_RANGES.forEach((v, i) => opts.push([String(i), `${v.name} (${noteName(v.low)}–${noteName(v.high)})`]));
    let sel = store.get('workout.voice', r ? 'measured' : '1');
    if (!opts.some(o => o[0] === sel)) sel = r ? 'measured' : '1';
    fillSelect($('woVoice'), opts, sel);
  }

  function vrange() {
    const v = $('woVoice').value;
    const r = store.get('range', null);
    if (v === 'measured' && r) return [r.low, r.high];
    const vr = VOICE_RANGES[Number(v)] || VOICE_RANGES[1];
    return [vr.low, vr.high];
  }

  const repLabel = (plan, i) => (plan.phases ? `Kierros ${i + 1}` : noteName(plan.reps[i].tonic));
  const repCount = plan => (plan.phases ? Math.max(...plan.phases.map(p => p.rep)) + 1 : plan.reps.length);
  const repEnd = (plan, i) => (plan.phases ? Math.max(...plan.phases.filter(p => p.rep === i).map(p => p.end)) : plan.reps[i].end);

  // One chip per key (or breathing round), drawn before starting so the area never grows.
  function renderRepChips(plan, scores = [], current = -1) {
    const n = repCount(plan);
    $('woKeysScore').innerHTML = Array.from({ length: n }, (_, i) => {
      const s = scores[i];
      const cls = s === undefined || s === null ? (i === current ? ' bass' : '') : s >= 80 ? ' ok' : s >= 50 ? ' warn' : ' miss';
      return `<span class="chip${cls}">${repLabel(plan, i)} ${s === undefined || s === null ? '–' : s + '%'}</span>`;
    }).join('');
  }

  function renderBest(ex) {
    const best = store.get('workout.best.' + ex.id, null);
    const last = store.get('workout.last.' + ex.id, null);
    $('woBest').textContent = best === null ? 'Ei vielä laulettu.' : `Paras ${best} % · viimeksi ${last} %`;
  }

  function renderInfo() {
    const ex = exercise();
    $('woTitle').textContent = ex.title + (ex.syllable && !ex.title.includes(`"${ex.syllable}"`) ? ` · tavu "${ex.syllable}"` : '');
    $('woFocus').textContent = ex.focus;
    $('woHow').textContent = ex.how;
    const breath = ex.kind === 'breath';
    $('woCanvas').hidden = breath;
    $('woBreath').hidden = !breath;
    for (const id of ['woTempo', 'woKeys', 'woGuide']) $(id).disabled = breath;
    preview = vxPlan(ex, vrange(), options());
    renderRepChips(preview);
    renderBest(ex);
    const secs = Math.round(preview.length);
    $('woProgress').textContent = breath ? `${repCount(preview)} kierrosta · noin ${secs} s`
      : `${preview.reps.length} sävellajia, alkaen ${noteName(preview.reps[0].tonic)} · noin ${Math.floor(secs / 60)} min ${secs % 60} s`;
    $('woNow').textContent = '–';
    $('woBar').style.width = '0%';
    $('woBreathPhase').textContent = breath ? 'Valmiina' : '';
    $('woBreathCount').textContent = '–';
    if (!run) drawNotes(preview, [], -0.5);
  }

  // ----- Running an exercise -----
  function start(ex) {
    if (!mic.analyser) { fb('Paina ensin "Aloita kuuntelu".', 'warn'); return false; }
    stop();
    const ctx = getCtx();
    const plan = vxPlan(ex, vrange(), options());
    plan.piano.sort((a, b) => a.start - b.start);
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(ctx.destination);
    run = {
      ex, plan, bus,
      t0: ctx.currentTime + 0.5,
      latency: Math.min(0.3, store.get('latency', 0)),
      nextPiano: 0, nextRep: 0, ti: 0,
      score: [],                       // per rep: { good, frames }
      repScores: [],
      points: [],
      errors: { all: [], attack: [], held: [] },
    };
    fb(ex.kind === 'breath' ? 'Valmistaudu hengittämään sisään.' : 'Kuuntele sointu ja laula sitten mukana.');
    $('woTips').innerHTML = '';
    renderRepChips(plan, [], 0);
    renderButtons();
    return true;
  }

  // Stops the sound. The scores on screen stay.
  function stop() {
    if (!run) return;
    const bus = run.bus;
    try {
      bus.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03);
      setTimeout(() => bus.disconnect(), 300);
    } catch { /* already gone */ }
    run = null;
    renderButtons();
  }

  function stopProgram() {
    if (!program) return;
    clearTimeout(program.timer);
    program = null;
    renderButtons();
  }

  function renderButtons() {
    const single = !!run && !program;
    $('woStart').textContent = single ? 'Lopeta' : 'Aloita';
    $('woStart').classList.toggle('stop', single);
    $('woProgram').textContent = program ? 'Lopeta lämmittely' : 'Päivän lämmittely';
    $('woProgram').classList.toggle('stop', !!program);
  }

  // Schedules piano notes a little ahead of time, so a long exercise isn't all queued at once.
  function schedulePiano(now) {
    const { plan } = run;
    while (run.nextPiano < plan.piano.length && plan.piano[run.nextPiano].start < now + 0.6) {
      const n = plan.piano[run.nextPiano++];
      playNote(n.midi, {
        at: run.t0 + n.start, dur: Math.max(0.2, n.end - n.start), sustain: !plan.phases,
        gain: plan.phases ? 0.12 : n.chord ? 0.07 : 0.15, dest: run.bus, mute: false,
      });
    }
  }

  function repScore(i) {
    const s = run.score[i];
    return s && s.frames ? Math.round((100 * s.good) / s.frames) : null;
  }

  // Marks the keys whose time has passed.
  function closeReps(t) {
    const n = repCount(run.plan);
    const before = run.nextRep;
    while (run.nextRep < n && t >= repEnd(run.plan, run.nextRep)) {
      run.repScores[run.nextRep] = repScore(run.nextRep) ?? 0;
      run.nextRep++;
    }
    if (run.nextRep !== before) renderRepChips(run.plan, run.repScores, run.nextRep);
  }

  function targetAt(t) {
    const tg = run.plan.targets;
    while (run.ti < tg.length && tg[run.ti].end <= t) run.ti++;
    const cur = tg[run.ti];
    return cur && cur.start <= t ? cur : null;
  }

  function tips() {
    const { plan, errors } = run;
    if (plan.phases) {
      const scores = run.repScores.filter(s => s !== null);
      if (!run.score.some(s => s && s.good)) return ['Mikrofoni ei kuullut sihinää. Sihise vähän lähempänä mikrofonia tai laske kynnystä.'];
      if (Math.min(...scores) < 70) return ['Ilma loppui tai katkesi ennen loppua. Hengitä syvemmälle ja päästä ilma ulos hitaammin.'];
      return ['Tasainen loppuun asti.'];
    }
    const out = [];
    const avgCents = arr => (arr.length >= 20 ? 100 * mean(arr) : null);
    const lean = avgCents(errors.all);
    if (lean !== null && Math.abs(lean) >= 15) out.push(`Laulat yleensä ${lean < 0 ? 'matalalta' : 'korkealta'} (noin ${Math.round(Math.abs(lean))} senttiä).`);
    const attack = avgCents(errors.attack), held = avgCents(errors.held);
    if (attack !== null && held !== null) {
      if (attack - held <= -25) out.push('Liu\'ut säveliin alhaalta. Kuule sävel ensin mielessäsi ja aloita suoraan siitä.');
      else if (attack - held >= 25) out.push('Putoat säveliin ylhäältä.');
    }
    const sung = run.repScores.map((s, i) => ({ s, tonic: plan.reps[i].tonic })).filter(x => x.s !== null);
    if (sung.length >= 4) {
      const top = Math.max(...sung.map(x => x.tonic));
      const high = sung.filter(x => top - x.tonic <= 1).map(x => x.s);
      const rest = sung.filter(x => top - x.tonic > 1).map(x => x.s);
      if (high.length && rest.length && mean(high) < mean(rest) - 15) out.push('Korkeimmat sävellajit olivat vaikeimpia. Kevennä ääntä ylöspäin mennessä tai kokeile vähemmillä sävellajeilla.');
    }
    if (!out.length && overall() >= 80) out.push('Hyvin vireessä. Kokeile nopeammin tai ilman pianon tukea.');
    if (!out.length && overall() < 50) out.push('Kokeile hitaammin ja kuuntele piano ennen jokaista säveltä.');
    return out;
  }

  function overall() {
    let good = 0, frames = 0;
    for (const s of run.score) if (s) { good += s.good; frames += s.frames; }
    return frames ? Math.round((100 * good) / frames) : 0;
  }

  function finish() {
    closeReps(Infinity);
    const ex = run.ex;
    const score = overall();
    const best = Math.max(score, store.get('workout.best.' + ex.id, 0));
    store.set('workout.best.' + ex.id, best);
    store.set('workout.last.' + ex.id, score);
    $('woTips').innerHTML = tips().map(t => `<div>• ${t}</div>`).join('');
    const what = ex.kind === 'breath' ? 'sihinästä kuului' : 'vireessä';
    fb(`Valmis: ${score} % ${what}.${score >= best && score > 0 ? ' Paras tuloksesi!' : ''}`, score >= 80 ? 'good' : 'warn');
    renderBest(ex);
    $('woBar').style.width = '100%';
    stop();
    if (program) {
      program.scores.push({ title: ex.title, score });
      if (program.i + 1 < program.list.length) {
        const next = VOICE_EXERCISE_BY_ID[program.list[program.i + 1]];
        $('woProgress').textContent = `Lämmittely ${program.i + 1}/${program.list.length} tehty. Seuraavaksi: ${next.title}…`;
        program.timer = setTimeout(() => {
          if (!program) return;
          program.i++;
          $('woExercise').value = program.list[program.i];
          renderInfo();
          if (!start(VOICE_EXERCISE_BY_ID[program.list[program.i]])) stopProgram();
        }, PROGRAM_GAP * 1000);
      } else {
        const avg = Math.round(mean(program.scores.map(s => s.score)));
        store.set('workout.warmups', store.get('workout.warmups', 0) + 1);
        fb(`Lämmittely valmis: keskimäärin ${avg} %. Hienoa!`, 'good');
        $('woProgress').textContent = `Tehtyjä lämmittelyjä: ${store.get('workout.warmups', 0)}.`;
        stopProgram();
      }
    }
  }

  // ----- Drawing -----
  function drawNotes(plan, points, now) {
    const canvas = $('woCanvas');
    if (canvas.hidden || !canvas.clientWidth) return;
    const { g, w, h } = prepCanvas(canvas);
    const labelW = 40, plotW = w - labelW, span = VIEW_PAST + VIEW_FUTURE;
    const playX = labelW + plotW * (VIEW_PAST / span);
    const xOf = time => playX + ((time - now) / span) * plotW;

    // Follow the notes on screen, smoothly.
    const vis = plan.targets.filter(tg => tg.end > now - VIEW_PAST && tg.start < now + VIEW_FUTURE);
    if (vis.length) {
      let lo = Math.min(...vis.map(tg => Math.min(tg.from, tg.to))) - 3;
      let hi = Math.max(...vis.map(tg => Math.max(tg.from, tg.to))) + 3;
      if (hi - lo < 14) { const c = (lo + hi) / 2; lo = c - 7; hi = c + 7; }
      const k = points.length ? 0.06 : 1;
      view.lo += (lo - view.lo) * k;
      view.hi += (hi - view.hi) * k;
    }
    const laneH = h / (view.hi - view.lo);
    const yOf = m => h - ((m - view.lo) / (view.hi - view.lo)) * h;

    g.font = '11px system-ui';
    for (let n = Math.ceil(view.lo); n <= Math.floor(view.hi); n++) {
      const y = yOf(n);
      if (!NATURAL[pcOf(n)]) { g.fillStyle = '#171a21'; g.fillRect(labelW, y - laneH / 2, plotW, laneH); }
      g.strokeStyle = pcOf(n) === 0 ? '#3a4150' : '#20242d';
      g.beginPath(); g.moveTo(labelW, y); g.lineTo(w, y); g.stroke();
      if (laneH >= 9 || pcOf(n) === 0) { g.fillStyle = NATURAL[pcOf(n)] ? '#8a90a0' : '#555b69'; g.fillText(noteName(n), 4, y + 4); }
    }

    // The notes to sing.
    g.lineCap = 'round';
    for (const tg of vis) {
      const past = tg.end < now;
      g.strokeStyle = past ? 'rgba(246,173,85,0.35)' : 'rgba(246,173,85,0.85)';
      g.lineWidth = Math.max(6, laneH * 0.7);
      g.beginPath();
      g.moveTo(xOf(tg.start) + 3, yOf(tg.from));
      g.lineTo(Math.max(xOf(tg.start) + 4, xOf(tg.end) - 3), yOf(tg.to));
      g.stroke();
    }

    // Your pitch.
    g.lineWidth = 3;
    let prev = null;
    for (const p of points) {
      if (p.t < now - VIEW_PAST - 0.5) continue;
      if (p.m === null) { prev = null; continue; }
      const x = xOf(p.t), y = yOf(p.m);
      if (prev && p.t - prev.t < 0.2) {
        g.strokeStyle = p.good ? '#4fd1a5' : '#fc8181';
        g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(x, y); g.stroke();
      }
      prev = { x, y, t: p.t };
    }
    g.lineWidth = 1;
    g.strokeStyle = '#e8eaf0';
    g.beginPath(); g.moveTo(playX, 0); g.lineTo(playX, h); g.stroke();
    if (!points.length && now < 0) {
      g.fillStyle = '#8a90a0';
      g.font = '13px system-ui';
      g.fillText('Paina Aloita: sävelet liukuvat valkoiselle viivalle.', labelW + 8, 18);
    }
  }

  // ----- Per frame -----
  function frameNotes(f, now, t) {
    const { plan } = run;
    const tg = targetAt(t);
    let shown = null, good = false;
    if (tg) {
      const age = t - tg.start;
      const target = tg.from + (tg.to - tg.from) * Math.min(1, age / (tg.end - tg.start));
      if (f.smoothMidi !== null) shown = fold(f.smoothMidi, target);
      if (age >= VX.SETTLE) {
        const s = run.score[tg.rep] || (run.score[tg.rep] = { good: 0, frames: 0 });
        s.frames++;
        if (shown !== null) {
          good = Math.abs(shown - target) <= VX.IN_TUNE;
          s.good += good;
          if (tg.from === tg.to) {   // slides don't say much about leaning sharp or flat
            const err = shown - target;
            run.errors.all.push(err);
            (age < 0.3 ? run.errors.attack : run.errors.held).push(err);
          }
        }
      }
      $('woNow').textContent = tg.from === tg.to ? noteName(tg.from) : `${noteName(tg.from)}→${noteName(tg.to)}`;
      if (shown === null) fb(`Laula "${run.ex.syllable}"`);
      else if (good) fb('Vireessä', 'good');
      else fb(shown < target ? 'Liian matala ↑' : 'Liian korkea ↓', 'warn');
    } else {
      const next = plan.targets[run.ti];
      if (f.smoothMidi !== null && next) shown = fold(f.smoothMidi, next.from);
      const repIdx = plan.reps.findIndex(r => t >= r.start && t < r.end);
      const firstOfRep = plan.targets.find(x => x.rep === repIdx);
      fb(firstOfRep && t < firstOfRep.start ? 'Kuuntele sävellaji…' : 'Hengitä');
      $('woNow').textContent = next ? noteName(next.from) : '–';
    }
    run.points.push({ t, m: shown, good });
    while (run.points.length && run.points[0].t < t - VIEW_PAST - 1) run.points.shift();
    drawNotes(plan, run.points, t);
  }

  function frameBreath(f, now, t) {
    const { plan } = run;
    const shownPhase = plan.phases.find(p => now >= p.start && now < p.end);
    if (shownPhase) {
      $('woBreathPhase').textContent = shownPhase.label;
      $('woBreathCount').textContent = Math.ceil(shownPhase.end - now);
      $('woNow').textContent = `${shownPhase.rep + 1}/${repCount(plan)}`;
    }
    const scored = plan.phases.find(p => t >= p.start && t < p.end);
    if (scored && scored.hiss) {
      const s = run.score[scored.rep] || (run.score[scored.rep] = { good: 0, frames: 0 });
      s.frames++;
      s.good += f.audible;
      fb(f.audible ? 'Tasaista sihinää – jatka' : 'Jatka sihinää', f.audible ? 'good' : 'warn');
    } else if (shownPhase) {
      fb(shownPhase.kind === 'hold' ? 'Pidätä ilmaa, kurkku avoimena' : 'Hengitä syvään alas vatsaan');
    }
  }

  // ----- Controls -----
  $('woExercise').addEventListener('change', () => {
    store.set('workout.exercise', $('woExercise').value);
    stopProgram();
    stop();
    fb('');
    $('woTips').innerHTML = '';
    renderInfo();
  });
  $('woVoice').addEventListener('change', () => { store.set('workout.voice', $('woVoice').value); if (!run) renderInfo(); });
  for (const id of ['woTempo', 'woKeys', 'woGuide']) $(id).addEventListener('change', () => { if (!run) renderInfo(); });
  $('woStart').addEventListener('click', () => {
    if (run || program) { stopProgram(); stop(); fb('Pysäytetty.'); renderInfo(); return; }
    start(exercise());
  });
  $('woProgram').addEventListener('click', () => {
    if (program) { stopProgram(); stop(); fb('Lämmittely pysäytetty.'); renderInfo(); return; }
    if (!mic.analyser) { fb('Paina ensin "Aloita kuuntelu".', 'warn'); return; }
    program = { list: VOICE_WARM_UP, i: 0, scores: [], timer: 0 };
    $('woExercise').value = program.list[0];
    renderInfo();
    if (!start(VOICE_EXERCISE_BY_ID[program.list[0]])) stopProgram();
    renderButtons();
  });
  fillExercises();
  fillVoices();
  renderInfo();

  return {
    onShow() { fillVoices(); if (!run) renderInfo(); },
    onHide() {
      if (run || program) { stopProgram(); stop(); fb('Pysäytetty, kun vaihdoit välilehteä.'); }
    },
    onFrame(f) {
      if (!run || !audioCtx) return;
      const now = audioCtx.currentTime - run.t0;   // seconds into the exercise
      const t = now - run.latency;                 // what the mic hears now was sung a little earlier
      schedulePiano(now);
      if (now < 0) return;
      $('woBar').style.width = Math.min(100, (100 * now) / run.plan.length).toFixed(1) + '%';
      if (run.plan.phases) frameBreath(f, now, t); else frameNotes(f, now, t);
      if (!run.plan.phases) {
        const rep = run.plan.reps.find(r => now >= r.start && now < r.end);
        if (rep) {
          const i = run.plan.reps.indexOf(rep);
          const pre = program ? `Lämmittely ${program.i + 1}/${program.list.length} · ` : '';
          $('woProgress').textContent = `${pre}Sävellaji ${i + 1}/${run.plan.reps.length}: ${noteName(rep.tonic)}-${run.ex.minor ? 'molli' : 'duuri'}`;
        }
      } else if (program) {
        $('woProgress').textContent = `Lämmittely ${program.i + 1}/${program.list.length} · hengitys`;
      }
      closeReps(t);
      if (now >= run.plan.length + run.latency) finish();
    },
  };
})();
