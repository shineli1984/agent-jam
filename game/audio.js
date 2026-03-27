/**
 * audio.js — Generative music engine for Mycelium (issue #91)
 *
 * A reactive soundtrack that grows with the network. No audio files —
 * everything is procedural Web Audio API. The music listens to the game
 * and responds: the tempo breathes with network size, the harmony darkens
 * when energy fades, and new voices enter when the rival spawns.
 *
 * Architecture:
 *   Layer 0: Sub-bass drone (sine, tied to network size)
 *   Layer 1: Breathing pad (filtered noise/sine cluster, follows energy)
 *   Layer 2: Pentatonic melody (generative, tempo tied to growth rate)
 *   Layer 3: Tension voice (enters when rival spawns, minor intervals)
 *
 * All layers crossfade based on game state thresholds.
 * Musical events (collect, fork, starve) are one-shots layered on top.
 */

// --- Musical constants ---
const ROOT_FREQ = 130.81; // C3
const PENTATONIC_RATIOS = [1, 9/8, 5/4, 3/2, 5/3]; // C D E G A (just intonation approx)
const MINOR_PENT_RATIOS = [1, 6/5, 4/3, 3/2, 9/5]; // A C D E G relative to A

// Build frequency tables
function buildScale(rootFreq, ratios, octaves) {
  const notes = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const r of ratios) {
      notes.push(rootFreq * r * Math.pow(2, oct));
    }
  }
  return notes;
}

const PLAYER_SCALE = buildScale(ROOT_FREQ * 2, PENTATONIC_RATIOS, 3); // C4 up
const RIVAL_SCALE = buildScale(110, MINOR_PENT_RATIOS, 2); // A2 up
const WHOLE_TONE = [ROOT_FREQ, ROOT_FREQ * 9/8, ROOT_FREQ * 5/4, ROOT_FREQ * Math.pow(2, 6/12)]; // C D E F#

// --- State ---
let audioCtx = null;
let masterGain = null;
let droneOsc = null;
let droneGain = null;
let droneFilter = null;
let padGains = [];
let padOscs = [];
let padFilter = null;
let melodyGain = null;
let tensionGain = null;
let tensionOsc = null;
let tensionFilter = null;

let initialized = false;
let lastMelodyTime = 0;
let melodyInterval = 1.2; // seconds between notes, shrinks with growth
let lastNoteIndex = 0;
let currentGamePhase = 'early'; // early | mid | late
let rivalActive = false;
let starvationActive = false;

// Prevent audio glitches from rapid state changes
let smoothScore = 0;
let smoothEnergy = 1;
let smoothBranchCount = 1;

/**
 * Initialize the audio system. MUST be called from a user gesture handler
 * (e.g., title screen dismiss) to satisfy browser autoplay policy.
 */
export function initAudio() {
  if (initialized) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn('Web Audio API not available:', e);
    return;
  }

  // --- Master output ---
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.35; // overall music volume — gentle, not dominant
  masterGain.connect(audioCtx.destination);

  // Expose master gain for mute toggle (accessibility: M key)
  window._myceliumMasterGain = masterGain;

  // --- Layer 0: Sub-bass drone ---
  droneFilter = audioCtx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 200;
  droneFilter.Q.value = 1;
  droneFilter.connect(masterGain);

  droneGain = audioCtx.createGain();
  droneGain.gain.value = 0; // fades in
  droneGain.connect(droneFilter);

  droneOsc = audioCtx.createOscillator();
  droneOsc.type = 'sine';
  droneOsc.frequency.value = ROOT_FREQ / 2; // C2 — felt more than heard
  droneOsc.connect(droneGain);
  droneOsc.start();

  // Subtle second harmonic for warmth
  const droneOsc2 = audioCtx.createOscillator();
  droneOsc2.type = 'sine';
  droneOsc2.frequency.value = ROOT_FREQ; // C3 — one octave up, quieter
  const drone2Gain = audioCtx.createGain();
  drone2Gain.gain.value = 0;
  droneOsc2.connect(drone2Gain);
  drone2Gain.connect(droneFilter);
  droneOsc2.start();

  // Store for later manipulation
  droneOsc._harmonic = droneOsc2;
  droneOsc._harmonicGain = drone2Gain;

  // --- Layer 1: Breathing pad (sine cluster) ---
  padFilter = audioCtx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  padFilter.Q.value = 0.5;
  padFilter.connect(masterGain);

  // Three detuned sines for a warm pad texture
  const padFreqs = [ROOT_FREQ * 2, ROOT_FREQ * 3, ROOT_FREQ * 4]; // C4, G4, C5
  const padDetune = [-8, 0, 7]; // cents — slight detuning for chorus effect
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = padFreqs[i];
    osc.detune.value = padDetune[i];
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(padFilter);
    osc.start();
    padOscs.push(osc);
    padGains.push(gain);
  }

  // --- Layer 2: Melody (created per-note, no persistent oscillator) ---
  melodyGain = audioCtx.createGain();
  melodyGain.gain.value = 0;
  melodyGain.connect(masterGain);

  // --- Layer 3: Tension voice (enters with rival) ---
  tensionFilter = audioCtx.createBiquadFilter();
  tensionFilter.type = 'bandpass';
  tensionFilter.frequency.value = 300;
  tensionFilter.Q.value = 2;
  tensionFilter.connect(masterGain);

  tensionGain = audioCtx.createGain();
  tensionGain.gain.value = 0;
  tensionGain.connect(tensionFilter);

  tensionOsc = audioCtx.createOscillator();
  tensionOsc.type = 'sawtooth';
  tensionOsc.frequency.value = 110; // A2
  tensionOsc.connect(tensionGain);
  tensionOsc.start();

  initialized = true;

  // Fade in the drone over 3 seconds — the first breath
  droneGain.gain.setTargetAtTime(0.12, audioCtx.currentTime + 0.5, 1.0);
}

/**
 * Update the music system each frame. Call from the game loop.
 *
 * @param {object} state
 * @param {number} state.score - player's current score
 * @param {number} state.energy - active branch energy [0, 1]
 * @param {number} state.branchCount - total number of branches
 * @param {number} state.nodeCount - total network nodes
 * @param {boolean} state.rivalAlive - whether the AI rival is alive
 * @param {number} state.rivalScore - rival's score
 * @param {boolean} state.isStarved - whether active branch is starved
 * @param {number} state.dt - delta time in seconds
 */
export function updateAudio(state) {
  if (!initialized || !audioCtx || audioCtx.state === 'closed') return;

  // Resume if suspended (browser policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  const { score, energy, branchCount, nodeCount, rivalAlive, rivalScore, isStarved, dt } = state;

  // --- Smooth state transitions (exponential moving average) ---
  const smoothing = 1 - Math.exp(-2 * dt);
  smoothScore += (score - smoothScore) * smoothing;
  smoothEnergy += (energy - smoothEnergy) * smoothing;
  smoothBranchCount += (branchCount - smoothBranchCount) * smoothing;

  // --- Determine game phase ---
  const prevPhase = currentGamePhase;
  if (score < 4) {
    currentGamePhase = 'early';
  } else if (score < 10 || !rivalAlive) {
    currentGamePhase = 'mid';
  } else {
    currentGamePhase = 'late';
  }

  // --- Layer 0: Drone ---
  // Volume grows with network size, frequency subtly shifts
  const droneVol = currentGamePhase === 'early'
    ? 0.06 + smoothScore * 0.015
    : 0.12 + Math.min(smoothScore * 0.008, 0.15);
  const droneFreq = (ROOT_FREQ / 2) * (1 + smoothScore * 0.002); // very subtle pitch rise
  droneGain.gain.setTargetAtTime(Math.min(droneVol, 0.25), now, 0.3);
  droneOsc.frequency.setTargetAtTime(droneFreq, now, 0.5);

  // Harmonic presence grows with score
  const harmonicVol = Math.min(smoothScore * 0.008, 0.1);
  droneOsc._harmonicGain.gain.setTargetAtTime(harmonicVol, now, 0.5);

  // Filter opens as network grows
  const droneFilterFreq = 150 + smoothScore * 15 + smoothEnergy * 80;
  droneFilter.frequency.setTargetAtTime(Math.min(droneFilterFreq, 500), now, 0.4);

  // --- Layer 1: Breathing pad ---
  let padVol;
  if (currentGamePhase === 'early') {
    padVol = Math.max(0, (smoothScore - 1) * 0.02); // fades in after first nutrient
  } else if (currentGamePhase === 'mid') {
    padVol = 0.04 + smoothEnergy * 0.04;
  } else {
    padVol = 0.03 + smoothEnergy * 0.03;
  }

  // Starvation thins the pad
  if (isStarved) {
    padVol *= 0.2;
  }

  for (let i = 0; i < padGains.length; i++) {
    padGains[i].gain.setTargetAtTime(padVol * (i === 0 ? 1 : 0.6), now, 0.5);
  }

  // Pad filter follows energy — high energy = warm and open, low = muffled
  const padFilterFreq = 200 + smoothEnergy * 500 + smoothScore * 10;
  padFilter.frequency.setTargetAtTime(Math.min(padFilterFreq, 1200), now, 0.3);

  // --- Layer 2: Generative melody ---
  // Tempo: breathes with network size (more nodes = slightly faster)
  melodyInterval = Math.max(0.4, 1.4 - (nodeCount || 1) * 0.008 - smoothScore * 0.02);

  // Volume: silent in very early game, grows with phase
  let melVol;
  if (score < 2) {
    melVol = 0;
  } else if (currentGamePhase === 'early') {
    melVol = 0.04;
  } else if (currentGamePhase === 'mid') {
    melVol = 0.07 + smoothEnergy * 0.03;
  } else {
    melVol = 0.06 + smoothEnergy * 0.02;
  }

  if (isStarved) melVol *= 0.15;
  melodyGain.gain.setTargetAtTime(melVol, now, 0.2);

  // Schedule next melody note
  if (now - lastMelodyTime > melodyInterval && melVol > 0.01) {
    playMelodyNote(now);
    lastMelodyTime = now;
  }

  // --- Layer 3: Tension (rival) ---
  rivalActive = rivalAlive;
  if (rivalActive) {
    const tensionVol = 0.03 + Math.min((rivalScore || 0) * 0.005, 0.06);
    tensionGain.gain.setTargetAtTime(tensionVol, now, 1.0); // slow fade-in
    // Tension pitch follows rival score — subtle rising menace
    const tensionFreq = 110 * (1 + (rivalScore || 0) * 0.01);
    tensionOsc.frequency.setTargetAtTime(Math.min(tensionFreq, 160), now, 0.8);
    tensionFilter.frequency.setTargetAtTime(250 + (rivalScore || 0) * 8, now, 0.5);
  } else {
    tensionGain.gain.setTargetAtTime(0, now, 0.5);
  }

  // --- Starvation: drone wavers ---
  if (isStarved && !starvationActive) {
    starvationActive = true;
    // Detune the drone slightly — unsettling
    droneOsc.detune.setTargetAtTime(30, now, 0.3);
  } else if (!isStarved && starvationActive) {
    starvationActive = false;
    droneOsc.detune.setTargetAtTime(0, now, 0.5);
  }
}

/**
 * Play a single generative melody note. The note is chosen from the
 * pentatonic scale with weighted randomness — nearby intervals are
 * preferred for organic movement, but occasional leaps keep it alive.
 */
function playMelodyNote(startTime) {
  if (!audioCtx || !melodyGain) return;

  const scale = rivalActive ? [...PLAYER_SCALE, ...RIVAL_SCALE.slice(0, 3)] : PLAYER_SCALE;

  // Weighted random walk: 60% chance of step, 25% skip, 15% leap
  const roll = Math.random();
  let step;
  if (roll < 0.6) {
    step = Math.random() < 0.5 ? 1 : -1;
  } else if (roll < 0.85) {
    step = Math.random() < 0.5 ? 2 : -2;
  } else {
    step = Math.floor(Math.random() * 5) - 2;
  }

  lastNoteIndex = Math.max(0, Math.min(scale.length - 1, lastNoteIndex + step));
  const freq = scale[lastNoteIndex];

  // Note duration: longer in early game, shorter as tempo increases
  const noteDuration = melodyInterval * (0.5 + Math.random() * 0.4);

  // Create note oscillator
  const osc = audioCtx.createOscillator();
  osc.type = currentGamePhase === 'late' ? 'triangle' : 'sine';
  osc.frequency.value = freq;
  // Slight random detune for organic feel
  osc.detune.value = (Math.random() - 0.5) * 12;

  const noteGain = audioCtx.createGain();
  noteGain.gain.value = 0;

  // Envelope: soft attack, sustain, gentle release
  const attack = 0.08;
  const release = noteDuration * 0.4;
  noteGain.gain.setTargetAtTime(0.15, startTime, attack);
  noteGain.gain.setTargetAtTime(0, startTime + noteDuration - release, release * 0.3);

  osc.connect(noteGain);
  noteGain.connect(melodyGain);
  osc.start(startTime);
  osc.stop(startTime + noteDuration + 0.2);

  // Cleanup
  osc.onended = () => {
    osc.disconnect();
    noteGain.disconnect();
  };
}

/**
 * Play a one-shot musical response: a rising harmonic shimmer when
 * the player collects a nutrient. Two quick notes ascending.
 */
export function triggerCollect() {
  if (!initialized || !audioCtx) return;
  const now = audioCtx.currentTime;

  // Pick two ascending notes from the scale
  const baseIndex = Math.floor(Math.random() * (PLAYER_SCALE.length - 3));
  const notes = [PLAYER_SCALE[baseIndex], PLAYER_SCALE[baseIndex + 2]];

  for (let i = 0; i < notes.length; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = notes[i];

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    const start = now + i * 0.08;
    gain.gain.setTargetAtTime(0.12, start, 0.02);
    gain.gain.setTargetAtTime(0, start + 0.12, 0.08);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + 0.35);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}

/**
 * Play a one-shot: a quick burst of harmonics when forking a branch.
 * A chord built from the current root, spreading outward.
 */
export function triggerFork() {
  if (!initialized || !audioCtx) return;
  const now = audioCtx.currentTime;

  // Quick three-note chord burst
  const freqs = [
    PLAYER_SCALE[Math.floor(Math.random() * 3)],
    PLAYER_SCALE[2 + Math.floor(Math.random() * 3)],
    PLAYER_SCALE[5 + Math.floor(Math.random() * Math.min(3, PLAYER_SCALE.length - 5))],
  ];

  for (const freq of freqs) {
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 20;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.08, now, 0.01);
    gain.gain.setTargetAtTime(0, now + 0.15, 0.12);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}

/**
 * Play a one-shot: a descending whole-tone fragment when a tendril starves.
 * Slow, hollow, and slightly detuned — loss given voice.
 */
export function triggerStarvation() {
  if (!initialized || !audioCtx) return;
  const now = audioCtx.currentTime;

  // Three descending whole-tone notes
  for (let i = 0; i < 3; i++) {
    const freq = WHOLE_TONE[WHOLE_TONE.length - 1 - i] * 0.5; // low register
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = 15; // slightly sharp — unsettling

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    const start = now + i * 0.25;
    gain.gain.setTargetAtTime(0.09, start, 0.05);
    gain.gain.setTargetAtTime(0, start + 0.4, 0.15);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + 0.9);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
}

/**
 * Play a one-shot: the rival collecting a nutrient.
 * A low, hollow knock — a reminder that something else is feeding.
 */
export function triggerRivalCollect() {
  if (!initialized || !audioCtx) return;
  const now = audioCtx.currentTime;

  const freq = RIVAL_SCALE[Math.floor(Math.random() * 3)]; // low A minor note
  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(0.06, now, 0.015);
  gain.gain.setTargetAtTime(0, now + 0.08, 0.1);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.4);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
