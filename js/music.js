'use strict';

// ===================== Music data =====================
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NATURAL = [true, false, true, false, true, true, false, true, false, true, false, true];
const INTERVALS = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone',
  'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];

// Order matters on equal score: earlier (more common) entries win.
// `rare` adds a small penalty so a common name beats an unusual name for the same notes.
const CHORD_TYPES = [
  { suffix: '',         name: 'major',                   intervals: [0, 4, 7] },
  { suffix: 'm',        name: 'minor',                   intervals: [0, 3, 7] },
  { suffix: '7',        name: 'dominant 7th',            intervals: [0, 4, 7, 10] },
  { suffix: 'maj7',     name: 'major 7th',               intervals: [0, 4, 7, 11] },
  { suffix: 'm7',       name: 'minor 7th',               intervals: [0, 3, 7, 10] },
  { suffix: '6',        name: 'major 6th',               intervals: [0, 4, 7, 9] },
  { suffix: 'm6',       name: 'minor 6th',               intervals: [0, 3, 7, 9] },
  { suffix: 'add9',     name: 'add 9',                   intervals: [0, 2, 4, 7] },
  { suffix: 'sus2',     name: 'suspended 2nd',           intervals: [0, 2, 7] },
  { suffix: 'sus4',     name: 'suspended 4th',           intervals: [0, 5, 7] },
  { suffix: '7sus4',    name: '7th suspended 4th',       intervals: [0, 5, 7, 10] },
  { suffix: 'dim',      name: 'diminished',              intervals: [0, 3, 6] },
  { suffix: 'dim7',     name: 'diminished 7th',          intervals: [0, 3, 6, 9] },
  { suffix: 'm7b5',     name: 'half-diminished',         intervals: [0, 3, 6, 10] },
  { suffix: 'aug',      name: 'augmented',               intervals: [0, 4, 8] },
  { suffix: '5',        name: 'power chord',             intervals: [0, 7] },
  { suffix: 'madd9',    name: 'minor add 9',             intervals: [0, 2, 3, 7],         rare: 0.05 },
  { suffix: '7sus2',    name: '7th suspended 2nd',       intervals: [0, 2, 7, 10],        rare: 0.05 },
  { suffix: '9',        name: 'dominant 9th',            intervals: [0, 2, 4, 7, 10],     rare: 0.05 },
  { suffix: 'maj9',     name: 'major 9th',               intervals: [0, 2, 4, 7, 11],     rare: 0.05 },
  { suffix: 'm9',       name: 'minor 9th',               intervals: [0, 2, 3, 7, 10],     rare: 0.05 },
  { suffix: '6/9',      name: '6 add 9',                 intervals: [0, 2, 4, 7, 9],      rare: 0.05 },
  { suffix: 'add11',    name: 'add 11',                  intervals: [0, 4, 5, 7],         rare: 0.1 },
  { suffix: 'madd11',   name: 'minor add 11',            intervals: [0, 3, 5, 7],         rare: 0.1 },
  { suffix: 'mMaj7',    name: 'minor-major 7th',         intervals: [0, 3, 7, 11],        rare: 0.1 },
  { suffix: '7#5',      name: 'augmented 7th',           intervals: [0, 4, 8, 10],        rare: 0.1 },
  { suffix: 'm7add11',  name: 'minor 7th add 11',        intervals: [0, 3, 5, 7, 10],     rare: 0.1 },
  { suffix: '9sus4',    name: '9th suspended 4th',       intervals: [0, 2, 5, 7, 10],     rare: 0.1 },
  { suffix: 'sus2sus4', name: 'suspended 2nd and 4th',   intervals: [0, 2, 5, 7],         rare: 0.15 },
  { suffix: '6sus2',    name: '6th suspended 2nd',       intervals: [0, 2, 7, 9],         rare: 0.15 },
  { suffix: '6sus4',    name: '6th suspended 4th',       intervals: [0, 5, 7, 9],         rare: 0.15 },
];

// MIDI notes from the 6th (low) string to the 1st (high) string.
const TUNINGS = {
  standard: { name: 'Standard (E A D G B E)', midis: [40, 45, 50, 55, 59, 64] },
  dropD:    { name: 'Drop D (D A D G B E)', midis: [38, 45, 50, 55, 59, 64] },
  halfDown: { name: 'Half step down (Eb Ab Db Gb Bb Eb)', midis: [39, 44, 49, 54, 58, 63] },
  dadgad:   { name: 'DADGAD', midis: [38, 45, 50, 55, 57, 62] },
  openG:    { name: 'Open G (D G D G B D)', midis: [38, 43, 50, 55, 59, 62] },
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
  B7:    { frets: [X, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
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
  Bm:    { frets: [X, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
};
const CHORD_SETS = {
  beginner: { name: 'Beginner open chords', chords: ['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm'] },
  seventh:  { name: '7th chords', chords: ['A7', 'D7', 'E7', 'G7', 'C7', 'B7', 'Am7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7'] },
  sus:      { name: 'Sus and add chords', chords: ['Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'E7sus4', 'Cadd9'] },
  power:    { name: 'Power chords', chords: ['E5', 'A5', 'G5'] },
  barre:    { name: 'Barre chords', chords: ['F', 'Bm'] },
  all:      { name: 'All chords', chords: Object.keys(CHORD_SHAPES) },
};
// Approximate choir ranges, used only as a reference.
const VOICE_RANGES = [
  { name: 'Bass', low: 40, high: 64 },
  { name: 'Baritone', low: 43, high: 67 },
  { name: 'Tenor', low: 48, high: 72 },
  { name: 'Alto', low: 53, high: 77 },
  { name: 'Mezzo-soprano', low: 57, high: 81 },
  { name: 'Soprano', low: 60, high: 84 },
];
