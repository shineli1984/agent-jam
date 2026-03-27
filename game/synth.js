/**
 * MYCELIUM SYNTH ENGINE
 * 
 * Transforms the network into a living musical instrument.
 * Each branch is an oscillator. Growth creates melodies.
 * Nutrients trigger drums. The whole canvas breathes with sound.
 * 
 * Issue #164
 */

let audioCtx = null;
let masterGain = null;
let compressor = null;
let reverb = null;
let analyser = null;

// Branch synths
const branchSynths = new Map();

// Drum kit
let drums = null;

// Musical state
const musicalState = {
  bpm: 120,
  currentBeat: 0,
  lastBeatTime: 0,
  isPlaying: false,
  recording: false,
  recordedNotes: [],
  scale: [0, 2, 4, 5, 7, 9, 11], // Major scale intervals
  rootNote: 48, // C3 in MIDI
  intensity: 0.5,
};

// Waveform data for visualization
let waveformData = new Uint8Array(128);
let frequencyData = new Uint8Array(64);

/**
 * Initialize the audio engine
 */
export function initSynth() {
  if (audioCtx) return;
  
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Master chain: synths → compressor → reverb → master gain → output
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;
  
  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 4;
  
  // Simple reverb using convolver with generated impulse
  reverb = audioCtx.createConvolver();
  reverb.buffer = createReverbImpulse(2, 2);
  
  // Analyser for visualization
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  waveformData = new Uint8Array(analyser.frequencyBinCount);
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  
  // Connect master chain
  compressor.connect(reverb);
  reverb.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);
  
  // Initialize drums
  initDrums();
  
  musicalState.isPlaying = true;
  musicalState.lastBeatTime = audioCtx.currentTime;
  
  console.log('🎹 Mycelium Synth Engine initialized');
}

/**
 * Create reverb impulse response
 */
function createReverbImpulse(duration, decay) {
  const length = audioCtx.sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  
  return impulse;
}

/**
 * Initialize drum sounds
 */
function initDrums() {
  drums = {
    kick: createKick,
    snare: createSnare,
    hihat: createHihat,
    clap: createClap,
  };
}

/**
 * Create a kick drum sound
 */
function createKick() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
  
  gain.gain.setValueAtTime(1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  
  osc.connect(gain);
  gain.connect(compressor);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

/**
 * Create a snare drum sound
 */
function createSnare() {
  // Noise component
  const noise = audioCtx.createBufferSource();
  const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }
  noise.buffer = noiseBuffer;
  
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 1000;
  
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
  
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(compressor);
  
  // Tone component
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 180;
  oscGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  
  osc.connect(oscGain);
  oscGain.connect(compressor);
  
  noise.start();
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

/**
 * Create hi-hat sound
 */
function createHihat() {
  const noise = audioCtx.createBufferSource();
  const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }
  noise.buffer = noiseBuffer;
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(compressor);
  
  noise.start();
}

/**
 * Create clap sound
 */
function createClap() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const noise = audioCtx.createBufferSource();
      const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.02, audioCtx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let j = 0; j < noiseData.length; j++) {
        noiseData[j] = Math.random() * 2 - 1;
      }
      noise.buffer = noiseBuffer;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2500;
      
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);
      
      noise.start();
    }, i * 10);
  }
}

/**
 * Create or get synth for a branch
 */
function getOrCreateBranchSynth(branchIndex) {
  if (branchSynths.has(branchIndex)) {
    return branchSynths.get(branchIndex);
  }
  
  const waveforms = ['sine', 'triangle', 'sawtooth', 'square'];
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  
  osc.type = waveforms[branchIndex % waveforms.length];
  osc.frequency.value = 0;
  
  filter.type = 'lowpass';
  filter.frequency.value = 2000 + branchIndex * 500;
  filter.Q.value = 2;
  
  gain.gain.value = 0;
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(compressor);
  
  osc.start();
  
  const synth = { osc, gain, filter, lastNote: 0 };
  branchSynths.set(branchIndex, synth);
  
  return synth;
}

/**
 * Convert direction to musical note
 */
function directionToNote(dx, dy, branchIndex) {
  // Y axis controls octave (up = higher)
  // X axis nudges within scale
  const octaveShift = Math.round(-dy * 2); // -2 to +2 octaves
  const scaleIndex = Math.abs(Math.round(dx * 3)) % musicalState.scale.length;
  
  const midiNote = musicalState.rootNote + 
                   (octaveShift * 12) + 
                   musicalState.scale[scaleIndex] +
                   (branchIndex * 7) % 12; // Each branch offset by fifth
  
  return midiToFrequency(midiNote);
}

/**
 * MIDI note to frequency
 */
function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Play a note on a branch (called during growth)
 */
export function playGrowthNote(branchIndex, dx, dy, speed) {
  if (!audioCtx || !musicalState.isPlaying) return;
  
  const synth = getOrCreateBranchSynth(branchIndex);
  const freq = directionToNote(dx, dy, branchIndex);
  const volume = Math.min(0.3, speed / 400);
  
  // Smooth frequency transition
  synth.osc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
  synth.gain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.05);
  
  synth.lastNote = freq;
  
  // Record if recording
  if (musicalState.recording) {
    musicalState.recordedNotes.push({
      time: audioCtx.currentTime,
      branch: branchIndex,
      freq,
      volume,
    });
  }
}

/**
 * Stop note on branch (when not growing)
 */
export function stopBranchNote(branchIndex) {
  if (!audioCtx) return;
  
  const synth = branchSynths.get(branchIndex);
  if (synth) {
    synth.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
  }
}

/**
 * Trigger drum on nutrient collection
 */
export function triggerNutrientDrum(nutrientType) {
  if (!audioCtx || !drums) return;
  
  // Different nutrients trigger different drums
  const drumTypes = ['kick', 'snare', 'hihat', 'clap'];
  const drumType = drumTypes[nutrientType % drumTypes.length];
  
  drums[drumType]();
  
  // Increase intensity
  musicalState.intensity = Math.min(1, musicalState.intensity + 0.1);
}

/**
 * Trigger fork harmony
 */
export function triggerForkHarmony(parentBranchIndex, newBranchIndex) {
  if (!audioCtx) return;
  
  const parentSynth = branchSynths.get(parentBranchIndex);
  if (!parentSynth || !parentSynth.lastNote) return;
  
  // New branch plays a harmony (fifth above parent)
  const harmonyFreq = parentSynth.lastNote * 1.5; // Perfect fifth
  const newSynth = getOrCreateBranchSynth(newBranchIndex);
  
  newSynth.osc.frequency.setValueAtTime(harmonyFreq, audioCtx.currentTime);
  newSynth.gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  newSynth.gain.gain.setTargetAtTime(0, audioCtx.currentTime + 0.5, 0.2);
  
  // Clap for the fork
  drums.clap();
}

/**
 * Trigger bass drop (predator attack)
 */
export function triggerBassDrop() {
  if (!audioCtx) return;
  
  // Deep bass sweep
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.5);
  
  gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
  
  osc.connect(gain);
  gain.connect(compressor);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.8);
  
  // Distorted kick
  drums.kick();
  setTimeout(() => drums.kick(), 100);
}

/**
 * Update the beat clock
 */
export function updateBeat(dt) {
  if (!audioCtx || !musicalState.isPlaying) return;
  
  const beatDuration = 60 / musicalState.bpm;
  const now = audioCtx.currentTime;
  
  if (now - musicalState.lastBeatTime >= beatDuration) {
    musicalState.lastBeatTime = now;
    musicalState.currentBeat++;
    
    // Decay intensity
    musicalState.intensity = Math.max(0.2, musicalState.intensity - 0.02);
    
    return true; // Beat occurred
  }
  
  return false;
}

/**
 * Get visualization data
 */
export function getVisualizationData() {
  if (!analyser) return { waveform: [], frequency: [], intensity: 0.5 };
  
  analyser.getByteTimeDomainData(waveformData);
  analyser.getByteFrequencyData(frequencyData);
  
  return {
    waveform: Array.from(waveformData),
    frequency: Array.from(frequencyData),
    intensity: musicalState.intensity,
    beat: musicalState.currentBeat,
  };
}

/**
 * Change tempo
 */
export function setTempo(bpm) {
  musicalState.bpm = Math.max(60, Math.min(180, bpm));
}

/**
 * Get current BPM
 */
export function getTempo() {
  return musicalState.bpm;
}

/**
 * Toggle recording
 */
export function toggleRecording() {
  musicalState.recording = !musicalState.recording;
  if (musicalState.recording) {
    musicalState.recordedNotes = [];
  }
  return musicalState.recording;
}

/**
 * Export recorded session (placeholder for actual export)
 */
export function exportRecording() {
  console.log('Recorded notes:', musicalState.recordedNotes);
  return musicalState.recordedNotes;
}

/**
 * Stop all sounds
 */
export function stopAllSounds() {
  for (const [_, synth] of branchSynths) {
    synth.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
  }
}

/**
 * Resume audio context (needed after user interaction)
 */
export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
