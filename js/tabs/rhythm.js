'use strict';

// ===================== Rhythm tab =====================
const metro = { running: false, timer: 0, nextTime: 0, beatCount: 0, anchor: 0, interval: 0.75, scheduled: [] };
const bpm = () => Number($('rhBpm').value);
const beatsPerBar = () => Number($('rhBeats').value);

function metroSchedule() {
  const ctx = getCtx();
  while (metro.nextTime < ctx.currentTime + 0.12) {
    const beat = metro.beatCount % beatsPerBar();
    playClick(metro.nextTime, $('rhAccent').checked && beat === 0);
    metro.scheduled.push({ time: metro.nextTime, beat });
    metro.nextTime += metro.interval;
    metro.beatCount++;
  }
  while (metro.scheduled.length > 16) metro.scheduled.shift();
}

function metroStart() {
  const ctx = getCtx();
  metro.interval = 60 / bpm();
  metro.nextTime = ctx.currentTime + 0.1;
  metro.anchor = metro.nextTime;
  metro.beatCount = 0;
  metro.scheduled = [];
  metro.running = true;
  metroSchedule();
  metro.timer = setInterval(metroSchedule, 25);
  $('rhToggle').textContent = 'Pysäytä metronomi';
  $('rhToggle').classList.add('stop');
}

function metroStop() {
  clearInterval(metro.timer);
  metro.running = false;
  $('rhToggle').textContent = 'Käynnistä metronomi';
  $('rhToggle').classList.remove('stop');
}

const rhythm = (() => {
  let hits = [];
  let calibration = null;   // array of raw offsets while calibrating
  let latency = store.get('latency', 0);
  let lastBeatShown = -1;

  function renderLatency() {
    $('rhLatency').textContent = `Mikrofonin viive: ${Math.round(latency * 1000)} ms`;
  }

  function nearestGrid(t) {
    const step = metro.interval / Number($('rhSub').value);
    return metro.anchor + Math.round((t - metro.anchor) / step) * step;
  }

  function renderDots(active, accent) {
    const n = beatsPerBar();
    $('rhBeatDots').innerHTML = Array.from({ length: n }, (_, i) =>
      `<span class="${i === active ? 'on' : ''}${i === active && accent ? ' accent' : ''}"></span>`).join('');
  }

  function drawStrip() {
    const { g, w, h } = prepCanvas($('rhStrip'));
    const range = 150;
    const xOf = ms => w / 2 + (Math.max(-range, Math.min(range, ms)) / range) * (w / 2 - 20);
    g.fillStyle = 'rgba(79,209,165,0.15)';
    g.fillRect(xOf(-40), 0, xOf(40) - xOf(-40), h);
    g.strokeStyle = '#e8eaf0';
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.fillStyle = '#8a90a0';
    g.font = '12px system-ui';
    g.fillText('aikaisin', 8, 16);
    g.textAlign = 'right';
    g.fillText('myöhässä', w - 8, 16);
    g.textAlign = 'left';
    g.fillText('tahdissa', w / 2 + 6, 16);
    hits.forEach((hit, idx) => {
      const age = hits.length - 1 - idx;
      const y = h - 14 - (age / 20) * (h - 34);
      const c = Math.abs(hit);
      g.globalAlpha = 1 - age / 24;
      g.fillStyle = c <= 40 ? '#4fd1a5' : c <= 80 ? '#f6ad55' : '#fc8181';
      g.beginPath(); g.arc(xOf(hit), y, age === 0 ? 8 : 5, 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;
  }

  function renderStats() {
    if (!hits.length) { $('rhStats').textContent = ''; return; }
    const onBeat = hits.filter(o => Math.abs(o) <= 40).length;
    const avg = mean(hits);
    let tendency = 'Pysyt hyvin tahdissa.';
    if (avg < -15) tendency = `Kiirehdit (soitat etuajassa) noin ${Math.round(-avg)} ms.`;
    else if (avg > 15) tendency = `Laahaat (soitat myöhässä) noin ${Math.round(avg)} ms.`;
    $('rhStats').textContent = `${onBeat}/${hits.length} viimeisimmästä lyönnistä tahdissa. ${tendency}`;
  }

  $('rhToggle').addEventListener('click', () => (metro.running ? metroStop() : metroStart()));
  $('rhBpm').addEventListener('input', () => {
    $('rhBpmVal').textContent = bpm();
    metro.interval = 60 / bpm();
    if (metro.running) metro.anchor = metro.nextTime;
    hits = [];
  });
  $('rhCalibrate').addEventListener('click', () => {
    if (!mic.analyser) { $('rhLatency').textContent = 'Paina ensin "Aloita kuuntelu".'; return; }
    if (!metro.running) metroStart();
    calibration = [];
    $('rhLatency').textContent = 'Kalibroidaan: lyö sointu tarkalleen seuraavan 8 naksun kohdalla…';
  });
  renderLatency();
  renderDots(-1, false);

  return {
    onShow() { drawStrip(); },
    onFrame(f) {
      if (metro.running && audioCtx) {
        const now = audioCtx.currentTime;
        const last = metro.scheduled.filter(b => b.time <= now).pop();
        const active = last && now - last.time < 0.12 ? last.beat : -1;
        if (active !== lastBeatShown) {
          lastBeatShown = active;
          renderDots(active, active === 0 && $('rhAccent').checked);
        }
      } else if (lastBeatShown !== -1) {
        lastBeatShown = -1;
        renderDots(-1, false);
      }
      drawStrip();
      if (!metro.running || f.onset === null) return;

      if (calibration) {
        calibration.push((f.onset - nearestGrid(f.onset)) * 1000);
        $('rhLatency').textContent = `Kalibroidaan: ${calibration.length}/8…`;
        if (calibration.length >= 8) {
          latency = Math.max(0, median(calibration) / 1000);
          store.set('latency', latency);
          calibration = null;
          hits = [];
          renderLatency();
        }
        return;
      }
      const t = f.onset - latency;
      const off = (t - nearestGrid(t)) * 1000;
      hits.push(off);
      if (hits.length > 20) hits.shift();
      const text = Math.abs(off) <= 40 ? 'Tahdissa' : off < 0 ? `${Math.round(-off)} ms aikaisin` : `${Math.round(off)} ms myöhässä`;
      setFeedback($('rhLast'), text, Math.abs(off) <= 40 ? 'good' : Math.abs(off) <= 80 ? 'warn' : 'badc');
      renderStats();
    },
  };
})();
