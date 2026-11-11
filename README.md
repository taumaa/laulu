# Guitar & Voice Trainer

A guitar and voice practice app that runs entirely in the browser. The interface is in Finnish and uses Nordic note names (H = B, B = B♭), as in Finnish songbooks. There is no backend: audio is analysed with the Web Audio API on your device, and settings and scores are kept in `localStorage`.

## Features

- **Detect**: names the note or chord you play. A chord's notes often have several names (D A B E is E7sus4, Asus2sus4, D6sus2 or Bm7add11), so every name that fits is listed, best first. Tap a name to see its diagram. Recent chords are listed too.
- **Tuner**, **Chord trainer** (with one-minute changes), **Fretboard** note game, **Rhythm** (metronome and strum timing)
- **Pitch trace**, **Sing** (pitch matching), **Vocal range**, **Ear training**
- **Voice workout**: vocal exercises in four levels (humming, lip trills, sirens, scales, arpeggios, staccato, agility, messa di voce). The piano gives each key and moves up and down your range, your pitch is drawn over the notes, and each key gets a score. Also a breathing exercise, where the mic checks the hiss, and a Daily warm-up program.

## Running it

Open `index.html` in a browser, or serve the folder with any static file server, for example:

```sh
python3 -m http.server 8000
```

Then go to <http://localhost:8000>. The microphone only works on `https://` or `localhost`, so a phone needs the site served over HTTPS (GitHub Pages works).

## Files

```
index.html            page markup
css/style.css         styles, including the phone layout
js/music.js           notes, chord types, tunings, chord shapes
js/util.js            helpers and settings constants
js/audio.js           microphone input and the synth
js/analysis.js        pitch, spectrum, chroma and chord matching
js/render.js          chord diagrams, keyboard, pitch trace, spectrum
js/settings.js        header controls
js/voice-exercises.js voice workout exercises and planning
js/tabs/*.js          one file per tab
js/main.js            tab switching and the main loop
```

The scripts are plain (non-module) scripts loaded in order with `defer`, so the app also works when `index.html` is opened straight from disk.
