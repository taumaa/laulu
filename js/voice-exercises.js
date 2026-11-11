'use strict';

// ===================== Voice workout data =====================
const VOICE_LEVELS = ['Aloittelija 1', 'Aloittelija 2', 'Keskitaso', 'Edistynyt'];
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
  { id: 'breath-4-4-8', level: 0, title: 'Hengitys: sisään 4, pidätä 4, sihise 8', kind: 'breath', focus: 'Hengitystuki',
    how: 'Hengitä nenän kautta syvään niin, että vatsa ja kyljet laajenevat, eivät olkapäät. Pidätä sulkematta kurkkua ja päästä sitten ilma ulos tasaisena "sss"-äänenä niin tasaisesti kuin pystyt loppuun asti.',
    phases: [['Hengitä sisään', 4, 'in'], ['Pidätä', 4, 'hold'], ['Sihise "sss"', 8, 'hiss']], reps: 4 },
  { id: 'hum-sustain', level: 0, keys: 4, title: 'Hyräily yhdellä sävelellä', syllable: 'Mm', bpm: 60, focus: 'Resonanssi',
    pattern: vxPattern([1], { last: 4 }),
    how: 'Huulet kevyesti kiinni, hampaat erillään. Tunne surina huulissa ja nenässä. Pidä sävel tasaisena ja leuka rentona.' },
  { id: 'lip-trill-5', level: 0, title: 'Huulitrilli liukuen 1-5-1', syllable: 'Brr', bpm: 72, focus: 'Äänen rentoutus',
    pattern: [vxGlide(1, 5, 2), vxGlide(5, 1, 2)],
    how: 'Puhalla rentojen huulten läpi niin, että ne värisevät, ja liu\'u ylös ja takaisin alas. Paina sormilla kevyesti poskia, jos huulet pysähtyvät. Värinä pitää ilmavirran tasaisena ja kurkun rentona.' },
  { id: 'mum-5', level: 0, title: 'Viiden sävelen asteikko tavulla "Mum"', syllable: 'Mum', bpm: 90, focus: 'Puhtaus',
    pattern: vxPattern([1, 2, 3, 4, 5, 4, 3, 2, 1], { last: 2 }),
    how: 'Laula jokainen sävel puhtaasti, "m" auttaa löytämään sen. Pidä ääni samanlaisena alhaalta ylös: älä punnerra ylöspäin mennessä.' },
  { id: 'ng-siren', level: 0, keys: 5, title: 'Sireeni ng-äänellä', syllable: 'Ng', bpm: 60, focus: 'Rekisterien yhdistäminen',
    pattern: [vxGlide(1, 8, 3), vxGlide(8, 1, 3)],
    how: 'Kielen takaosa ylhäällä kuten sanan "kengät" ng-äänessä, liu\'u tasaisesti oktaavi ylös ja takaisin kuin sireeni. Anna äänen keventyä ylhäällä punnertamisen sijaan.' },
  { id: 'nay-135', level: 1, title: '"Nei" sävelillä 1-3-5-3-1', syllable: 'Nei', bpm: 96, focus: 'Eteen sijoittuva ääni',
    pattern: vxPattern([1, 3, 5, 3, 1], { last: 2 }),
    how: 'Kirkas, hieman nasaali "nei", kuin veikeä lapsi. Se tuo äänen eteen ja auttaa äänen keskialuetta. Pidä se kevyenä.' },
  { id: 'ah-arpeggio', level: 1, title: 'Duurimurtosointu tavulla "Aa"', syllable: 'Aa', bpm: 88, focus: 'Avoin ääni',
    pattern: vxPattern([1, 3, 5, 8, 5, 3, 1], { last: 2 }),
    how: 'Laske leuka alas korkeaa "aa"-vokaalia varten. Tähtää ylimpään säveleen ylhäältä päin äläkä kurkota sitä kohti.' },
  { id: 'wee-octave', level: 1, title: 'Oktaavihyppy tavulla "Vii"', syllable: 'Vii', bpm: 80, focus: 'Hypyt',
    pattern: vxPattern([1, 8, 1], { beats: 1.5, last: 2 }),
    how: 'Kuule ylin sävel mielessäsi ennen kuin laulat sen, ja osu siihen suoraan liukumatta alhaalta. "Ii" pitää äänen kapeana ja helppona.' },
  { id: 'long-135', level: 1, keys: 4, title: 'Pitkät sävelet 1-3-5', syllable: 'Maa', bpm: 60, focus: 'Vakaa sävelkorkeus',
    pattern: vxPattern([1, 3, 5], { beats: 2 }),
    how: 'Pidä jokainen sävel koko pituudeltaan ilman huojuntaa, laskemista tai nousemista. Hengitä tauon aikana.' },
  { id: 'ah-9', level: 2, title: 'Yhdeksän sävelen asteikko tavulla "Aa"', syllable: 'Aa', bpm: 104, focus: 'Ääniala',
    pattern: vxPattern([1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1], { beats: 0.5, last: 2 }),
    how: 'Koko kuvio yhdellä hengityksellä. Pidä vokaali samana äänen murroskohdan yli.' },
  { id: 'gee-staccato', level: 2, title: 'Staccato-murtosointu tavulla "Gii"', syllable: 'Gii', bpm: 100, focus: 'Puhtaat aloitukset',
    pattern: [1, 1, 3, 3, 5, 5, 8, 8, 5, 5, 3, 3, 1, 1].map((d, i) => (i % 2 === 0 ? [degree(d), degree(d), 0.5] : null)),
    how: 'Lyhyitä, joustavia säveliä, joista jokainen alkaa pienellä potkulla vatsasta, ei kurkusta.' },
  { id: 'intervals-up', level: 2, keys: 4, title: 'Intervallit perussävelestä', syllable: 'Laa', bpm: 84, focus: 'Intervallien kuuleminen',
    pattern: vxPattern([1, 3, 1, 4, 1, 5, 1, 6, 1], { last: 2 }),
    how: 'Joka kerta takaisin perussäveleen ja sitten vähän kauemmas: terssi, kvartti, kvintti, seksti. Kuule jokainen ensin mielessäsi.' },
  { id: 'minor-5', level: 2, title: 'Molliasteikko tavulla "Uu"', syllable: 'Uu', bpm: 90, focus: 'Puhtaus', minor: true,
    pattern: vxPattern([1, 2, 3, 4, 5, 4, 3, 2, 1], { steps: MINOR_STEPS, last: 2 }),
    how: 'Terssi on matalampi kuin duuriasteikossa. Pyöreä "uu" rennoin huulin.' },
  { id: 'agility-5', level: 3, title: 'Ketteryyskuvio 1-5-1 kahdesti', syllable: 'Aa', bpm: 120, focus: 'Ketteryys',
    pattern: vxPattern([1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1], { beats: 0.5, last: 2 }),
    how: 'Kevyesti ja nopeasti: anna sävelten rullata ilman h-ääntä niiden välissä. Hidasta tempoa, kunnes kuvio on puhdas, ja nosta sitä sitten takaisin.' },
  { id: 'octave-half', level: 3, title: 'Puolentoista oktaavin murtosointu', syllable: 'Aa', bpm: 104, focus: 'Ääniala',
    pattern: vxPattern([1, 3, 5, 8, 10, 12, 11, 9, 7, 5, 4, 2, 1], { beats: 0.5, last: 2 }),
    how: 'Ylös murtosointua ja alas asteikkoa yhdellä hengityksellä. Kevennä ääntä mitä korkeammalle menet.' },
  { id: 'chromatic', level: 3, title: 'Kromaattinen asteikko tavulla "Ii"', syllable: 'Ii', bpm: 96, focus: 'Puhtaus',
    pattern: [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0].map(s => [s, s, 0.5]),
    how: 'Jokainen puolisävelaskel, kvintti ylös ja takaisin. Pienet askeleet sumentuvat helposti: osu jokaiseen tarkasti.' },
  { id: 'messa-di-voce', level: 3, keys: 3, title: 'Messa di voce', syllable: 'Aa', bpm: 60, focus: 'Hallinta',
    pattern: vxPattern([1], { beats: 8 }),
    how: 'Yksi pitkä sävel: aloita hiljaa, voimista kovaksi ja palaa hiljaiseksi niin, että sävelkorkeus pysyy koko ajan samana.' },
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
      ex.phases.forEach(([label, secs, kind], i) => {
        phases.push({ start: t, end: t + secs, label, rep, kind, hiss: kind === 'hiss' });
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
