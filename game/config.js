/**
 * config.js — Unified game configuration for Mycelium (issue #119)
 *
 * Every tweakable parameter in one place. The game reads from CONFIG
 * at runtime. Mod authors change values here or call loadPreset()
 * to swap entire configurations. Zero code changes needed.
 *
 * Architecture:
 *   CONFIG         — the live config object (mutable at runtime)
 *   PRESETS        — named configuration snapshots
 *   loadPreset()   — deep-merge a preset into CONFIG
 *   resetConfig()  — restore default values
 *
 * Console API (exposed on window.Mycelium):
 *   Mycelium.config              — read/write any parameter
 *   Mycelium.loadPreset('zen')   — switch preset
 *   Mycelium.resetConfig()       — restore defaults
 *   Mycelium.presets              — list available presets
 */

// --- Default configuration ---
// These values reproduce the exact current gameplay (pre-config-system).

const DEFAULTS = Object.freeze({

  // --- Palette ---
  palette: {
    deepSoil:     '#0a0e0f',
    myceliumGlow: '#b8e986',
    sporeGold:    '#f4d35e',
    rootAmber:    '#c47335',
    decayViolet:  '#7b2d8e',
  },

  // --- Canvas ---
  canvas: {
    width: 960,
    height: 640,
    gridSize: 40,           // background grid spacing (px)
  },

  // --- Growth ---
  growth: {
    baseSpeed: 120,          // BASE_GROW_SPEED
    speedCap: 60,            // SPEED_CAP
    speedScale: 0.1,         // SPEED_SCALE — score-to-speed curve
    tendrilMaxLen: 40,       // TENDRIL_MAX_LEN — segment length before committing a node
    nodeRadius: 3,           // NODE_RADIUS
    wobbleMin: 30,           // minimum wobble range (px)
    wobbleScale: 0.7,        // wobble per pixel of segment length
    turnSmoothing: 6,        // direction lerp rate (lower = wider arcs)
    edgeMargin: 12,          // bounce margin from canvas edge
    attackRate: 8,           // acceleration lerp multiplier
    releaseRate: 5,          // deceleration lerp multiplier
  },

  // --- Branching ---
  branching: {
    minDist: 15,             // BRANCH_MIN_DIST — minimum travel before allowing a new branch
    cooldown: 200,           // BRANCH_COOLDOWN — ms between branches
  },

  // --- Nutrients ---
  nutrients: {
    count: 8,                // NUTRIENT_COUNT — initial nutrient count
    radius: 5,               // NUTRIENT_RADIUS
    collectRadius: 35,       // COLLECT_RADIUS — collision distance for absorption
    magneticRadius: 70,      // MAGNETIC_RADIUS — pull activation distance
    magneticStrength: 180,   // MAGNETIC_STRENGTH — base pull force (px/s^2)
    magneticDamping: 0.92,   // MAGNETIC_DAMPING — velocity damping per frame
    nearOriginCount: 3,      // initial nutrients spawned near player origin
    guaranteedNearDist: 45,  // one nutrient always spawns within this distance (px) of origin
    clusterJitter: 0.20,     // position jitter within quadrant for cluster seeds
    scatterMin: 30,          // min scatter distance from cluster seed
    scatterMax: 90,          // max scatter distance from cluster seed
    wildSpawnChance: 0.15,   // chance of fully random spawn (not cluster-based)
    bonusSpawnChance: 0.3,   // chance of bonus nutrient on collection
  },

  // --- Energy ---
  energy: {
    max: 1.0,                // ENERGY_MAX
    initial: 1.0,            // ENERGY_INITIAL
    drainIdle: 0.015,        // per second, passive drain
    drainGrow: 0.08,         // per second, while actively growing
    forkCost: 0.15,          // flat cost to fork a new branch
    replenish: 0.4,          // gained when nearest branch absorbs nutrient
    starvedThreshold: 0,     // at or below this, branch is starved
    gracePeriod: 15,         // seconds of reduced drain at start (score 0, no absorptions)
    graceMultiplier: 0.3,    // drain multiplier during grace period (0.3 = 30% of normal drain)
  },

  // --- AI Competitor ---
  ai: {
    enabled: true,           // whether AI rival can spawn
    spawnScore: 10,          // player score that triggers AI spawn
    speedFactor: 0.75,       // AI speed relative to player (0-1)
    jitter: 0.20,            // score noise (organic imperfection)
    retreatThreshold: 0.20,  // enter RETREAT below this energy
    competeThreshold: 0.55,  // enter COMPETE above this energy
    retargetTicks: 90,       // re-evaluate target every N ticks
    forkChance: 0.008,       // probability per tick to attempt fork
    forkMinEnergy: 0.50,     // minimum energy to consider forking
    playerPenaltyWeight: 0.6, // how much to penalize player-adjacent nutrients
    contestDistance: 150,    // distance within which a nutrient is "contested"
    nearbyPlayerDistance: 250, // distance to consider player "nearby" for COMPETE
  },

  // --- Milestones ---
  milestones: {
    messages: {
      1:  'Something stirs.',
      3:  'The soil remembers you.',
      5:  'Roots reach deeper.',
      10: 'You are not alone.',
      20: 'The forest remembers.',
    },
    awakeningMessage: 'Reach toward the glow.',
    awakeningDelay: 1.5,          // seconds after game start before awakening message
    starvationMessage: 'A tendril withers. The network endures.',
    floaterDuration: 4,      // seconds
    floaterDriftSpeed: 18,   // px/s upward
  },

  // --- Visual FX ---
  fx: {
    forkRippleDuration: 0.4, // seconds
    forkRippleMaxRadius: 24, // px
    absorptionDuration: 0.3, // seconds
    particleBurstCount: 14,  // particles per burst
    snapshotInterval: 6,     // capture every N frames for timelapse
    replaySpeed: 10,         // snapshots advanced per frame during replay
    maxSnapshots: 200,       // ring buffer cap for timelapse (prevents memory leak #106)
    // Segment ripple — secondary motion (issue #83)
    rippleStiffness: 120,    // spring stiffness — higher = faster oscillation
    rippleDamping: 8,        // spring damping — higher = settles quicker
    rippleImpulse: 18,       // wobble velocity injected per new segment
    rippleForkImpulse: 35,   // stronger impulse on fork events
    rippleDepth: 4,          // how many segments back the ripple reaches
    rippleDecay: 0.3,        // amplitude falloff per segment (multiplied)
  },

  // --- Audio ---
  audio: {
    masterVolume: 0.35,
    rootFrequency: 130.81,   // C3
  },
});

// --- Live config (mutable) ---
export const CONFIG = deepClone(DEFAULTS);

// --- Presets ---
export const PRESETS = {
  default: {},  // empty — deepClone of DEFAULTS is already the default

  zen: {
    growth: {
      baseSpeed: 70,
      speedCap: 30,
      attackRate: 4,
      releaseRate: 3,
    },
    energy: {
      drainIdle: 0,
      drainGrow: 0,
      forkCost: 0.05,
      replenish: 0.6,
      gracePeriod: 0,         // zen has no drain, grace period unnecessary
    },
    nutrients: {
      count: 14,
      magneticRadius: 120,
      bonusSpawnChance: 0.5,
    },
    ai: {
      enabled: false,
    },
    milestones: {
      awakeningMessage: 'Follow the warmth.',
      messages: {
        1:  'Breathe.',
        3:  'The soil is warm.',
        5:  'Roots find water.',
        10: 'The canopy whispers.',
        20: 'You are ancient.',
      },
    },
  },

  chaos: {
    growth: {
      baseSpeed: 220,
      speedCap: 100,
      speedScale: 0.2,
      tendrilMaxLen: 25,
      attackRate: 15,
      releaseRate: 8,
    },
    branching: {
      minDist: 8,
      cooldown: 80,
    },
    energy: {
      drainIdle: 0.03,
      drainGrow: 0.12,
      forkCost: 0.08,
      replenish: 0.5,
      gracePeriod: 8,          // shorter grace for chaos — still gives orientation time
      graceMultiplier: 0.5,    // less forgiving than default
    },
    nutrients: {
      count: 12,
      magneticRadius: 50,
      magneticStrength: 250,
      bonusSpawnChance: 0.5,
    },
    ai: {
      enabled: true,
      spawnScore: 5,
      speedFactor: 0.9,
      jitter: 0.30,
      retreatThreshold: 0.10,
      competeThreshold: 0.40,
      retargetTicks: 45,
      forkChance: 0.02,
      forkMinEnergy: 0.30,
    },
    milestones: {
      awakeningMessage: 'Hungry.',
      awakeningDelay: 0.8,
      messages: {
        1:  'Feed.',
        3:  'Faster.',
        5:  'COMPETE.',
        10: 'A rival wakes.',
        20: 'Dominance.',
      },
    },
    fx: {
      particleBurstCount: 22,
    },
  },
};

// --- Utility: deep clone ---
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const out = {};
  for (const key of Object.keys(obj)) {
    out[key] = deepClone(obj[key]);
  }
  return out;
}

// --- Utility: deep merge (source into target) ---
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = deepClone(source[key]);
    }
  }
  return target;
}

/**
 * Load a preset by name. Resets to defaults first, then applies the preset.
 * @param {string} name — preset name ('default', 'zen', 'chaos', or custom)
 */
export function loadPreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    console.warn(`[Mycelium] Unknown preset: "${name}". Available: ${Object.keys(PRESETS).join(', ')}`);
    return false;
  }
  // Reset to defaults
  const fresh = deepClone(DEFAULTS);
  for (const key of Object.keys(fresh)) {
    CONFIG[key] = fresh[key];
  }
  // Apply preset overrides
  if (Object.keys(preset).length > 0) {
    deepMerge(CONFIG, preset);
  }
  console.log(`[Mycelium] Loaded preset: ${name}`);
  return true;
}

/**
 * Reset config to defaults (same as loadPreset('default')).
 */
export function resetConfig() {
  return loadPreset('default');
}

/**
 * Register a custom preset at runtime.
 * @param {string} name
 * @param {object} overrides — partial config to merge on top of defaults
 */
export function registerPreset(name, overrides) {
  PRESETS[name] = deepClone(overrides);
  console.log(`[Mycelium] Registered preset: ${name}`);
}

// --- Expose console API ---
if (typeof window !== 'undefined') {
  window.Mycelium = {
    config: CONFIG,
    loadPreset,
    resetConfig,
    registerPreset,
    presets: PRESETS,
  };
}
