// --- Palette (issue #14: Mycelium visual identity) ---
export const PALETTE = {
  deepSoil:     '#0a0e0f',
  myceliumGlow: '#b8e986',
  sporeGold:    '#f4d35e',
  rootAmber:    '#c47335',
  decayViolet:  '#7b2d8e',
};

// --- Growth constants ---
export const BASE_GROW_SPEED = 120;
export const SPEED_CAP = 60;
export const SPEED_SCALE = 0.1;
export const TENDRIL_MAX_LEN = 40;
export const NODE_RADIUS = 3;
export const EDGE_MARGIN = 12; // issue #31: bounce margin from canvas edge
export const BRANCH_MIN_DIST = 15; // issue #32: minimum travel before allowing a new branch
export const BRANCH_COOLDOWN = 200; // issue #32: ms cooldown between branches

// --- Nutrient constants ---
export const NUTRIENT_COUNT = 8;
export const NUTRIENT_RADIUS = 5;
export const COLLECT_RADIUS = 35; // issue #22: generous collision (was ~13px)
export const MAGNETIC_RADIUS = 70; // issue #90: reduced from 130 — player must get closer before pull kicks in
export const MAGNETIC_STRENGTH = 180; // base pull force (px/s^2)
export const MAGNETIC_DAMPING = 0.92; // velocity damping per frame (keeps motion smooth)

// --- Energy constants (issue #40: soft starvation) ---
export const ENERGY_MAX = 1.0;
export const ENERGY_INITIAL = 1.0;
export const ENERGY_DRAIN_IDLE = 0.015;   // per second, passive drain
export const ENERGY_DRAIN_GROW = 0.08;    // per second, while actively growing
export const ENERGY_FORK_COST = 0.15;     // flat cost to fork a new branch
export const ENERGY_REPLENISH = 0.4;      // gained when nearest branch absorbs nutrient
export const ENERGY_STARVED_THRESHOLD = 0; // at or below this, branch is starved
