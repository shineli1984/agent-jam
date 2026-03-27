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
 * Musical events (collect, fork, starve, etc.) are one-shots layered on top.
 *
 * One-shot cleanup: all one-shot nodes use safeOneShot() which adds both
 * onended AND a setTimeout fallback to prevent node leaks when the
 * AudioContext is suspended (fixes #109). Rate-limiting prevents node
 * exhaustion from rapid-fire events.
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

// --- One-shot rate limiting (fixes #109) ---
const lastTriggerTime = {};
const TRIGGER_COOLDOWN_MS = 45; // minimum ms between same-type one-shots

/**
 * Rate-limit check for one-shot triggers. Returns true if the trigger
 * should be skipped (fired too recently).
 */
function shouldThrottle(name) {
  const now = performance.now();
  if (lastTriggerTime[name] && now - lastTriggerTime[name] < TRIGGER_COOLDOWN_MS) {
    return true;
  }
  lastTriggerTime[name] = now;
  return false;
}

/**
 * Safe one-shot node cleanup. Schedules both onended and a setTimeout
 * fallback so nodes get disconnected even if AudioContext is suspended.
 * Fixes #109: prevents orphaned nodes from leaking when onended doesn't fire.
 *
 * @param {OscillatorNode} osc
 * @param  {...AudioNode} nodes - additional nodes to disconnect (gains, filters)
 */
function safeOneShot(osc, ...nodes) {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    osc.disconnect();
    for (const n of nodes) n.disconnect();
  };
  osc.onended = cleanup;
  // Safety net: if onended never fires (suspended context), clean up after 3s
  setTimeout(cleanup, 3000);
}

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

  // Safe cleanup with fallback (fixes #109)
  safeOneShot(osc, noteGain);
}

/**
 * Play a one-shot musical response: a rising harmonic shimmer when
 * the player collects a nutrient. Two quick notes ascending.
 */
export function triggerCollect() {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('collect')) return;
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
    safeOneShot(osc, gain);
  }
}

/**
 * Play a one-shot: a quick burst of harmonics when forking a branch.
 * A chord built from the current root, spreading outward.
 */
export function triggerFork() {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('fork')) return;
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
    safeOneShot(osc, gain);
  }
}

/**
 * Play a one-shot: a descending whole-tone fragment when a tendril starves.
 * Slow, hollow, and slightly detuned — loss given voice.
 */
export function triggerStarvation() {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('starvation')) return;
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
    safeOneShot(osc, filter, gain);
  }
}

/**
 * Play a one-shot: the rival collecting a nutrient.
 * A low, hollow knock — a reminder that something else is feeding.
 */
export function triggerRivalCollect() {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('rivalCollect')) return;
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
  safeOneShot(osc, gain);
}

/**
 * Play a one-shot: a soft percussive tick when switching between tendrils.
 * Short, clean, almost like a soft woodblock — it says "I'm here now"
 * without interrupting the music.
 */
export function triggerBranchSwitch() {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('branchSwitch')) return;
  const now = audioCtx.currentTime;

  // A quick noise burst shaped into a click — synthesized percussion.
  // Two stacked oscillators: a high sine for the "tick" attack,
  // and a lower sine for a brief body. Both die fast.
  const tickOsc = audioCtx.createOscillator();
  tickOsc.type = 'sine';
  tickOsc.frequency.value = 1800 + Math.random() * 400; // high click

  const tickGain = audioCtx.createGain();
  tickGain.gain.value = 0;
  tickGain.gain.setTargetAtTime(0.07, now, 0.003); // ultra-fast attack
  tickGain.gain.setTargetAtTime(0, now + 0.015, 0.01); // dies in ~25ms

  const bodyOsc = audioCtx.createOscillator();
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.value = 600 + Math.random() * 100;

  const bodyGain = audioCtx.createGain();
  bodyGain.gain.value = 0;
  bodyGain.gain.setTargetAtTime(0.04, now, 0.005);
  bodyGain.gain.setTargetAtTime(0, now + 0.03, 0.015);

  tickOsc.connect(tickGain);
  tickGain.connect(masterGain);
  tickOsc.start(now);
  tickOsc.stop(now + 0.08);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(masterGain);
  bodyOsc.start(now);
  bodyOsc.stop(now + 0.1);

  safeOneShot(tickOsc, tickGain);
  safeOneShot(bodyOsc, bodyGain);
}

/**
 * Play a one-shot: a shimmering bell tone when a milestone message appears.
 * Think of wind chimes in a forest — brief, clear, a moment of wonder.
 * The pitch rises with the milestone score so early milestones feel
 * intimate and later ones feel expansive.
 *
 * @param {number} [milestoneScore=1] - the score that triggered this milestone
 */
export function triggerMilestone(milestoneScore = 1) {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('milestone')) return;
  const now = audioCtx.currentTime;

  // Base frequency rises with milestone progression
  // Score 1 ~= C5, score 20 ~= C6 — the world gets brighter
  const baseFreq = PLAYER_SCALE[Math.min(milestoneScore, PLAYER_SCALE.length - 1)];

  // A two-note bell: fundamental + a perfect fifth above, slightly detuned
  const freqs = [baseFreq, baseFreq * 1.5];
  const volumes = [0.10, 0.06];

  for (let i = 0; i < freqs.length; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freqs[i];
    osc.detune.value = (Math.random() - 0.5) * 6; // very slight shimmer

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    const start = now + i * 0.05; // tiny stagger for a chime effect
    gain.gain.setTargetAtTime(volumes[i], start, 0.01);
    gain.gain.setTargetAtTime(0, start + 0.3, 0.25); // long, gentle tail

    // High-shelf filter to add sparkle
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highshelf';
    filter.frequency.value = 2000;
    filter.gain.value = 3;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + 1.0);
    safeOneShot(osc, filter, gain);
  }
}

/**
 * Play a one-shot: a deep, ominous rumble when the AI rival spawns.
 * A low sub-bass thump followed by a rising filtered noise — something
 * ancient waking up in the soil. This is the "You are not alone" moment.
 */
export function triggerRivalSpawn() {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('rivalSpawn')) return;
  const now = audioCtx.currentTime;

  // Sub-bass thump: a very low sine that swells and decays
  const subOsc = audioCtx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = 45; // below most speakers' range — felt, not heard

  const subGain = audioCtx.createGain();
  subGain.gain.value = 0;
  subGain.gain.setTargetAtTime(0.15, now, 0.05);
  subGain.gain.setTargetAtTime(0, now + 0.4, 0.3);

  subOsc.connect(subGain);
  subGain.connect(masterGain);
  subOsc.start(now);
  subOsc.stop(now + 1.2);

  // Rising dissonant tone: two detuned oscillators that sweep up
  // like something surfacing from deep underground
  for (let i = 0; i < 2; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 70 + i * 5; // slightly detuned pair
    // Sweep up by a minor third over 1.5 seconds
    osc.frequency.setTargetAtTime(85 + i * 5, now + 0.2, 0.5);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.Q.value = 4; // resonant — gives it a growl
    // Filter opens slowly — the sound emerges
    filter.frequency.setTargetAtTime(350, now + 0.3, 0.6);

    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.04, now + 0.1, 0.15);
    gain.gain.setTargetAtTime(0, now + 1.0, 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 2.0);
    safeOneShot(osc, filter, gain);
  }

  safeOneShot(subOsc, subGain);
}

/**
 * Graceful audio fadeout when all tendrils die. The drone drops in pitch,
 * the pad thins to nothing, and a final descending sigh plays — the
 * network's last breath. Call this from the game-over handler.
 *
 * After the fadeout completes (~3s), the audio system is effectively silent
 * but still initialized (so a restart can re-engage it).
 */
export function triggerGameOver() {
  if (!initialized || !audioCtx) return;
  if (shouldThrottle('gameOver')) return;
  const now = audioCtx.currentTime;

  // --- Fade all continuous layers to silence over 2.5 seconds ---

  // Drone: pitch drops a whole step, volume fades
  droneOsc.frequency.setTargetAtTime(ROOT_FREQ / 2 * 0.85, now, 0.8);
  droneGain.gain.setTargetAtTime(0, now, 1.2);
  droneOsc._harmonicGain.gain.setTargetAtTime(0, now, 0.8);

  // Pad: close the filter and fade
  padFilter.frequency.setTargetAtTime(80, now, 0.5);
  for (const pg of padGains) {
    pg.gain.setTargetAtTime(0, now, 0.6);
  }

  // Melody: silence
  melodyGain.gain.setTargetAtTime(0, now, 0.3);

  // Tension: silence
  tensionGain.gain.setTargetAtTime(0, now, 0.4);

  // --- Final sigh: three slowly descending notes, very quiet ---
  // Like the last air leaving a hollow log
  const sighNotes = [ROOT_FREQ * 0.75, ROOT_FREQ * 0.6, ROOT_FREQ * 0.5];
  for (let i = 0; i < sighNotes.length; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = sighNotes[i];
    osc.detune.value = 20 + i * 10; // increasingly detuned — things falling apart

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 - i * 60; // each note more muffled
    filter.Q.value = 0.7;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    const start = now + 0.3 + i * 0.5;
    gain.gain.setTargetAtTime(0.06 - i * 0.015, start, 0.08);
    gain.gain.setTargetAtTime(0, start + 0.6, 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + 1.5);
    safeOneShot(osc, filter, gain);
  }
}
