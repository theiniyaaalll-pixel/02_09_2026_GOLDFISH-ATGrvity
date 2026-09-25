/*
 * Dream Ambient Soundscape (audio.js)
 * Ethereal, warm singing bowls and shimmering dream chimes
 */

let ambientSynth = null;
let dreamFilter = null;
let dreamReverb = null;
let dreamDelay = null;
let isAudioActive = false;
let audioInitStarted = false;
let noteInterval = null;

const DREAM_NOTES = ["C3", "G3", "C4", "D4", "E4", "G4", "A4", "B4", "D5", "E5"];

async function toggleDreamAudio() {
  if (!window.Tone) return false;
  
  if (!audioInitStarted) {
    audioInitStarted = true;
    try {
      await Tone.start();
      setupDreamAudio();
      isAudioActive = true;
      startDreamMelody();
      return true;
    } catch (e) {
      console.warn("Audio initialization error:", e);
      return false;
    }
  }

  if (isAudioActive) {
    if (ambientSynth) ambientSynth.volume.rampTo(-60, 1.5);
    if (noteInterval) clearInterval(noteInterval);
    isAudioActive = false;
    return false;
  } else {
    if (ambientSynth) ambientSynth.volume.rampTo(-10, 1.5);
    startDreamMelody();
    isAudioActive = true;
    return true;
  }
}

function setupDreamAudio() {
  dreamReverb = new Tone.Reverb({ decay: 12, wet: 0.85 }).toDestination();
  dreamDelay = new Tone.FeedbackDelay({ delayTime: "4n.", feedback: 0.5, wet: 0.4 }).connect(dreamReverb);
  dreamFilter = new Tone.Filter({ frequency: 1800, type: "lowpass", rolloff: -24 }).connect(dreamDelay);

  ambientSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsine", count: 2, spread: 20 },
    envelope: {
      attack: 1.2,
      decay: 2.0,
      sustain: 0.8,
      release: 6.0
    },
    volume: -10
  }).connect(dreamFilter);
}

function startDreamMelody() {
  if (noteInterval) clearInterval(noteInterval);
  
  // Play a soft introductory chord
  playSoftChord();

  noteInterval = setInterval(() => {
    if (!isAudioActive || !ambientSynth) return;
    if (Math.random() < 0.7) {
      let note = DREAM_NOTES[Math.floor(Math.random() * DREAM_NOTES.length)];
      ambientSynth.triggerAttackRelease(note, "2n", undefined, 0.2 + Math.random() * 0.25);
    }
    if (Math.random() < 0.3) {
      playSoftChord();
    }
  }, 2200);
}

function playSoftChord() {
  if (!ambientSynth) return;
  const chords = [
    ["C3", "G3", "E4"],
    ["A2", "E3", "C4"],
    ["F2", "C3", "A3"],
    ["G2", "D3", "B3"]
  ];
  let chord = chords[Math.floor(Math.random() * chords.length)];
  ambientSynth.triggerAttackRelease(chord, "1n", undefined, 0.18);
}
