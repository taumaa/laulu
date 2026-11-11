'use strict';

// ===================== Music data =====================
// Nordic note names, as in Finnish songbooks: H is B natural and B is B flat.
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'B', 'H'];
const NATURAL = [true, false, true, false, true, true, false, true, false, true, false, true];
const INTERVALS = ['Priimi', 'Pieni sekunti', 'Suuri sekunti', 'Pieni terssi', 'Suuri terssi', 'Puhdas kvartti', 'Tritonus',
  'Puhdas kvintti', 'Pieni seksti', 'Suuri seksti', 'Pieni septimi', 'Suuri septimi', 'Oktaavi'];

// Order matters on equal score: earlier (more common) entries win.
// `rare` adds a small penalty so a common name beats an unusual name for the same notes.
const CHORD_TYPES = [
  { suffix: '',         name: 'duuri',                   intervals: [0, 4, 7] },
  { suffix: 'm',        name: 'molli',                   intervals: [0, 3, 7] },
  { suffix: '7',        name: 'septimisointu',           intervals: [0, 4, 7, 10] },
  { suffix: 'maj7',     name: 'suuri septimisointu',     intervals: [0, 4, 7, 11] },
  { suffix: 'm7',       name: 'molliseptimisointu',      intervals: [0, 3, 7, 10] },
  { suffix: '6',        name: 'duuri + seksti',          intervals: [0, 4, 7, 9] },
  { suffix: 'm6',       name: 'molli + seksti',          intervals: [0, 3, 7, 9] },
  { suffix: 'add9',     name: 'duuri + nooni',           intervals: [0, 2, 4, 7] },
  { suffix: 'sus2',     name: 'pidätetty sekunti',       intervals: [0, 2, 7] },
  { suffix: 'sus4',     name: 'pidätetty kvartti',       intervals: [0, 5, 7] },
  { suffix: '7sus4',    name: 'septimisointu, pidätetty kvartti', intervals: [0, 5, 7, 10] },
  { suffix: 'dim',      name: 'vähennetty',              intervals: [0, 3, 6] },
  { suffix: 'dim7',     name: 'vähennetty septimisointu', intervals: [0, 3, 6, 9] },
  { suffix: 'm7b5',     name: 'puolivähennetty',         intervals: [0, 3, 6, 10] },
  { suffix: 'aug',      name: 'ylinouseva',              intervals: [0, 4, 8] },
  { suffix: '5',        name: 'voimasointu',             intervals: [0, 7] },
  { suffix: 'madd9',    name: 'molli + nooni',           intervals: [0, 2, 3, 7],         rare: 0.05 },
  { suffix: '7sus2',    name: 'septimisointu, pidätetty sekunti', intervals: [0, 2, 7, 10],        rare: 0.05 },
  { suffix: '9',        name: 'noonisointu',             intervals: [0, 2, 4, 7, 10],     rare: 0.05 },
  { suffix: 'maj9',     name: 'suuri noonisointu',       intervals: [0, 2, 4, 7, 11],     rare: 0.05 },
  { suffix: 'm9',       name: 'mollinoonisointu',        intervals: [0, 2, 3, 7, 10],     rare: 0.05 },
  { suffix: '6/9',      name: 'duuri + seksti ja nooni', intervals: [0, 2, 4, 7, 9],      rare: 0.05 },
  { suffix: 'add11',    name: 'duuri + undesimi',        intervals: [0, 4, 5, 7],         rare: 0.1 },
  { suffix: 'madd11',   name: 'molli + undesimi',        intervals: [0, 3, 5, 7],         rare: 0.1 },
  { suffix: 'mMaj7',    name: 'molli + suuri septimi',   intervals: [0, 3, 7, 11],        rare: 0.1 },
  { suffix: '7#5',      name: 'ylinouseva septimisointu', intervals: [0, 4, 8, 10],        rare: 0.1 },
  { suffix: 'm7add11',  name: 'molliseptimisointu + undesimi', intervals: [0, 3, 5, 7, 10],     rare: 0.1 },
  { suffix: '9sus4',    name: 'noonisointu, pidätetty kvartti', intervals: [0, 2, 5, 7, 10],     rare: 0.1 },
  { suffix: 'sus2sus4', name: 'pidätetty sekunti ja kvartti', intervals: [0, 2, 5, 7],         rare: 0.15 },
  { suffix: '6sus2',    name: 'seksti, pidätetty sekunti', intervals: [0, 2, 7, 9],         rare: 0.15 },
  { suffix: '6sus4',    name: 'seksti, pidätetty kvartti', intervals: [0, 5, 7, 9],         rare: 0.15 },
];

// MIDI notes from the 6th (low) string to the 1st (high) string.
const TUNINGS = {
  standard: { name: 'Vakioviritys (E A D G H E)', midis: [40, 45, 50, 55, 59, 64] },
  dropD:    { name: 'Drop D (D A D G H E)', midis: [38, 45, 50, 55, 59, 64] },
  halfDown: { name: 'Puoli sävelaskelta alas (Eb Ab C# F# B Eb)', midis: [39, 44, 49, 54, 58, 63] },
  dadgad:   { name: 'DADGAD', midis: [38, 45, 50, 55, 57, 62] },
  openG:    { name: 'Avoin G (D G D G H D)', midis: [38, 43, 50, 55, 59, 62] },
};
const STANDARD = TUNINGS.standard.midis;

// Shapes use standard tuning. Arrays run from the 6th string to the 1st. X = do not play.
const X = -1;
const CHORD_SHAPES = {
  C:     { frets: [X, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  A:     { frets: [X, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  G:     { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  E:     { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  D:     { frets: [X, X, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Am:    { frets: [X, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Em:    { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Dm:    { frets: [X, X, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  A7:    { frets: [X, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  D7:    { frets: [X, X, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  E7:    { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  G7:    { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  C7:    { frets: [X, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  H7:    { frets: [X, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Am7:   { frets: [X, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Em7:   { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  Dm7:   { frets: [X, X, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  Cmaj7: { frets: [X, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  Fmaj7: { frets: [X, X, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  Asus2: { frets: [X, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  Asus4: { frets: [X, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Dsus2: { frets: [X, X, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  Dsus4: { frets: [X, X, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
  Cadd9: { frets: [X, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
  Esus4: { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
  E7sus4: { frets: [0, 2, 0, 2, 0, 0], fingers: [0, 2, 0, 3, 0, 0] },
  E5:    { frets: [0, 2, 2, X, X, X], fingers: [0, 1, 2, 0, 0, 0] },
  A5:    { frets: [X, 0, 2, 2, X, X], fingers: [0, 0, 1, 2, 0, 0] },
  G5:    { frets: [3, 5, 5, X, X, X], fingers: [1, 3, 4, 0, 0, 0] },
  F:     { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
  Hm:    { frets: [X, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
};
const CHORD_SETS = {
  beginner: { name: 'Aloittelijan avoimet soinnut', chords: ['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm'] },
  seventh:  { name: 'Septimisoinnut', chords: ['A7', 'D7', 'E7', 'G7', 'C7', 'H7', 'Am7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7'] },
  sus:      { name: 'Sus- ja add-soinnut', chords: ['Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'E7sus4', 'Cadd9'] },
  power:    { name: 'Voimasoinnut', chords: ['E5', 'A5', 'G5'] },
  barre:    { name: 'Barre-soinnut', chords: ['F', 'Hm'] },
  all:      { name: 'Kaikki soinnut', chords: Object.keys(CHORD_SHAPES) },
};
// Approximate choir ranges, used only as a reference.
const VOICE_RANGES = [
  { name: 'Basso', low: 40, high: 64 },
  { name: 'Baritoni', low: 43, high: 67 },
  { name: 'Tenori', low: 48, high: 72 },
  { name: 'Altto', low: 53, high: 77 },
  { name: 'Mezzosopraano', low: 57, high: 81 },
  { name: 'Sopraano', low: 60, high: 84 },
];
