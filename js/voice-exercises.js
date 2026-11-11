'use strict';

// ===================== Voice workout data =====================
const VOICE_LEVELS = ['Beginner 1', 'Beginner 2', 'Intermediate', 'Advanced'];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

// Semitones above the tonic of scale degree d (1 is the tonic, 8 the octave).
function degree(d, steps = MAJOR_STEPS) {
  const octave = Math.floor((d - 1) / 7), i = (d - 1) % 7;
  return 12 * octave + steps[i];
}

// Notes as [from, to, beats] on these degrees; the last note is held for `last` beats.
function vxPattern(degrees, { beats = 1, steps = MAJOR_STEPS, last = null } = {}) {
  const out = degrees.map(d => [degree(d, steps), degree(d, steps), beats]);
  if (last) out[out.length - 1] = [out[out.length - 1][0], out[out.length - 1][1], last];
  return out;
}
// A slide from one degree to another.
const vxGlide = (a, b, beats) => [degree(a), degree(b), beats];

// Each exercise: what it's for, how to do it, the syllable, beats a minute, how many keys it goes up
// through, and the pattern as [semitones from, semitones to, beats]. from != to is a slide; null is a rest.
const VOICE_EXERCISES = [
  { id: 'breath-4-4-8', level: 0, title: 'Breathing: in 4, hold 4, hiss 8', kind: 'breath', focus: 'Breath support',
    how: 'Breathe in low through your nose so your belly and sides move out, not your shoulders. Hold without closing your throat, then let the air out on a steady "sss", as evenly as you can to the end.',
    phases: [['Breathe in', 4], ['Hold', 4], ['Hiss "sss"', 8]], reps: 4 },
  { id: 'hum-sustain', level: 0, keys: 4, title: 'Humming on one note', syllable: 'Mm', bpm: 60, focus: 'Resonance',
    pattern: vxPattern([1], { last: 4 }),
    how: 'Lips gently closed, teeth apart. Feel the buzz on your lips and nose. Keep the note steady and the jaw loose.' },
  { id: 'lip-trill-5', level: 0, title: 'Lip trill slide 1-5-1', syllable: 'Brr', bpm: 72, focus: 'Relaxing the voice',
    pattern: [vxGlide(1, 5, 2), vxGlide(5, 1, 2)],
    how: 'Blow through loose lips so they flutter, and slide up and back down. Press lightly on your cheeks if the lips stop. The flutter keeps the breath even and the throat relaxed.' },
  { id: 'mum-5', level: 0, title: 'Five-note scale on "Mum"', syllable: 'Mum', bpm: 90, focus: 'Pitch accuracy',
    pattern: vxPattern([1, 2, 3, 4, 5, 4, 3, 2, 1], { last: 2 }),
    how: 'Sing each note cleanly, with the "m" helping you find it. Keep the sound the same from bottom to top: don\'t push as you go up.' },
  { id: 'ng-siren', level: 0, keys: 5, title: 'Siren on "Ng"', syllable: 'Ng', bpm: 60, focus: 'Joining the registers',
    pattern: [vxGlide(1, 8, 3), vxGlide(8, 1, 3)],
    how: 'With the back of your tongue up as at the end of "sing", slide smoothly up an octave and back, like a siren. Let the voice get lighter at the top rather than pushing.' },
  { id: 'nay-135', level: 1, title: '"Nay" on 1-3-5-3-1', syllable: 'Nay', bpm: 96, focus: 'Forward placement',
    pattern: vxPattern([1, 3, 5, 3, 1], { last: 2 }),
    how: 'A bright, slightly nasal "nay", like a cheeky child. It brings the sound forward and helps the middle of your voice. Keep it light.' },
  { id: 'ah-arpeggio', level: 1, title: 'Major arpeggio on "Ah"', syllable: 'Ah', bpm: 88, focus: 'Open sound',
    pattern: vxPattern([1, 3, 5, 8, 5, 3, 1], { last: 2 }),
    how: 'Drop your jaw for a tall "ah". Aim for the top note from above rather than reaching up to it.' },
  { id: 'wee-octave', level: 1, title: 'Octave jump on "Wee"', syllable: 'Wee', bpm: 80, focus: 'Leaps',
    pattern: vxPattern([1, 8, 1], { beats: 1.5, last: 2 }),
    how: 'Hear the top note before you sing it, and land on it, without scooping up. The "ee" keeps it narrow and easy.' },
  { id: 'long-135', level: 1, keys: 4, title: 'Long notes 1-3-5', syllable: 'Mah', bpm: 60, focus: 'Steady pitch',
    pattern: vxPattern([1, 3, 5], { beats: 2 }),
    how: 'Hold each note for its full length without it wobbling, drooping or creeping sharp. Take your breath in the gap.' },
  { id: 'ah-9', level: 2, title: 'Nine-note scale on "Ah"', syllable: 'Ah', bpm: 104, focus: 'Range',
    pattern: vxPattern([1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1], { beats: 0.5, last: 2 }),
    how: 'One breath for the whole run. Keep the vowel the same through the break in your voice.' },
  { id: 'gee-staccato', level: 2, title: 'Staccato arpeggio on "Gee"', syllable: 'Gee', bpm: 100, focus: 'Clean onsets',
    pattern: [1, 1, 3, 3, 5, 5, 8, 8, 5, 5, 3, 3, 1, 1].map((d, i) => (i % 2 === 0 ? [degree(d), degree(d), 0.5] : null)),
    how: 'Short, bouncy notes, each one started by a little kick from your belly, not from the throat.' },
  { id: 'intervals-up', level: 2, keys: 4, title: 'Intervals from the tonic', syllable: 'Lah', bpm: 84, focus: 'Hearing intervals',
    pattern: vxPattern([1, 3, 1, 4, 1, 5, 1, 6, 1], { last: 2 }),
    how: 'Back to the tonic each time, then out a little further: a third, a fourth, a fifth, a sixth. Hear each one in your head first.' },
  { id: 'minor-5', level: 2, title: 'Minor scale on "Oo"', syllable: 'Oo', bpm: 90, focus: 'Pitch accuracy', minor: true,
    pattern: vxPattern([1, 2, 3, 4, 5, 4, 3, 2, 1], { steps: MINOR_STEPS, last: 2 }),
    how: 'The third is lower than in the major scale. A rounded "oo" with relaxed lips.' },
  { id: 'agility-5', level: 3, title: 'Agility run 1-5-1, twice', syllable: 'Ah', bpm: 120, focus: 'Agility',
    pattern: vxPattern([1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1], { beats: 0.5, last: 2 }),
    how: 'Light and quick: let the notes roll off without an "h" between them. Slow the tempo down until it\'s clean, then bring it back up.' },
  { id: 'octave-half', level: 3, title: 'Octave and a half arpeggio', syllable: 'Ah', bpm: 104, focus: 'Range',
    pattern: vxPattern([1, 3, 5, 8, 10, 12, 11, 9, 7, 5, 4, 2, 1], { beats: 0.5, last: 2 }),
    how: 'Up through the arpeggio and down the scale in one breath. Lighten the sound as you go higher.' },
  { id: 'chromatic', level: 3, title: 'Chromatic scale on "Ee"', syllable: 'Ee', bpm: 96, focus: 'Pitch accuracy',
    pattern: [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0].map(s => [s, s, 0.5]),
    how: 'Every semitone, up a fifth and back. Small steps are easy to blur: make each one land.' },
  { id: 'messa-di-voce', level: 3, keys: 3, title: 'Messa di voce', syllable: 'Ah', bpm: 60, focus: 'Control',
    pattern: vxPattern([1], { beats: 8 }),
    how: 'One long note: start soft, swell to loud, and come back to soft, with the pitch staying put the whole time.' },
];
const VOICE_EXERCISE_BY_ID = Object.fromEntries(VOICE_EXERCISES.map(e => [e.id, e]));
const VOICE_WARM_UP = ['breath-4-4-8', 'lip-trill-5', 'hum-sustain', 'mum-5', 'ng-siren', 'ah-arpeggio'];

const VX = {
  CUE_BEATS: 2,        // the chord that gives each key
  REST_BEATS: 2,       // the breath after the pattern
  COMFORT: 2,          // semitones in from the ends of your range, where there's room
  DEFAULT_KEYS: 6,
  IN_TUNE: 0.5,        // semitones
  SETTLE: 0.12,        // seconds into a note before it's scored
};

// The tonics an exercise is sung in: up by semitones from the bottom of your range, then back down.
function vxKeys(ex, [lo, hi], count) {
  count = count || ex.keys || VX.DEFAULT_KEYS;
  const pitches = ex.pattern.filter(Boolean).flatMap(p => [p[0], p[1]]);
  const loOff = Math.min(...pitches), hiOff = Math.max(...pitches);
  if (hi - lo - 2 * VX.COMFORT >= hiOff - loOff) { lo += VX.COMFORT; hi -= VX.COMFORT; }
  const first = lo - loOff, last = hi - hiOff;
  if (last < first) return [Math.round((lo + hi - loOff - hiOff) / 2)];   // wider than your range: one key
  const up = [];
  for (let k = first; k <= Math.min(last, first + count - 1); k++) up.push(k);
  return up.length > 1 ? [...up, ...up.slice(0, -1).reverse()] : up;
}

// A close chord for the key, kept in the middle of the piano.
function vxTonicChord(tonic, minor) {
  let root = tonic;
  while (root > 60) root -= 12;
  while (root < 48) root += 12;
  return [root - 12, root, root + (minor ? 3 : 4), root + 7];
}

// Everything to play and sing, in seconds from the start.
function vxPlan(ex, range, { tempo = 1, guide = true, count = 0 } = {}) {
  if (ex.kind === 'breath') {
    const phases = [], piano = [];
    let t = 0;
    for (let rep = 0; rep < ex.reps; rep++) {
      ex.phases.forEach(([label, secs], i) => {
        phases.push({ start: t, end: t + secs, label, rep, hiss: label.startsWith('Hiss') });
        piano.push({ start: t, end: t + 0.4, midi: i === 0 ? 84 : 79 });
        t += secs;
      });
    }
    return { phases, piano, targets: [], reps: [], length: t + 0.5 };
  }
  const beat = 60 / (ex.bpm * tempo);
  const targets = [], piano = [], reps = [];
  let t = 0;
  vxKeys(ex, range, count).forEach((tonic, rep) => {
    const start = t;
    const cue = VX.CUE_BEATS * beat;
    for (const m of vxTonicChord(tonic, ex.minor)) piano.push({ start: t, end: t + cue * 0.9, midi: m, chord: true });
    t += cue;
    for (const step of ex.pattern) {
      if (!step) { t += 0.5 * beat; continue; }
      const [a, b, beats] = step;
      const end = t + beats * beat;
      targets.push({ start: t, end, from: tonic + a, to: tonic + b, rep });
      if (guide) {   // the piano can't slide: it plays where a slide starts and where it ends
        piano.push({ start: t, end: a === b ? end - 0.02 : t + Math.min(beat, end - t), midi: tonic + a });
        if (a !== b) piano.push({ start: end - Math.min(beat, end - t) * 0.5, end, midi: tonic + b });
      }
      t = end;
    }
    t += VX.REST_BEATS * beat;
    reps.push({ start, end: t, tonic });
  });
  return { phases: null, piano, targets, reps, length: t };
}
