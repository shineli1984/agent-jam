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
export const TENDRIL_MAX_LEN = 40;
export const NODE_RADIUS = 3;
export const EDGE_MARGIN = 12; // issue #31: bounce margin from canvas edge
export const BRANCH_MIN_DIST = 15; // issue #32: minimum travel before allowing a new branch
export const BRANCH_COOLDOWN = 200; // issue #32: ms cooldown between branches

// --- Nutrient constants ---
export const NUTRIENT_COUNT = 8;
export const NUTRIENT_RADIUS = 5;
export const COLLECT_RADIUS = 35; // issue #22: generous collision (was ~13px)
export const MAGNETIC_RADIUS = 130; // chemical gradient range — nutrients start drifting
export const MAGNETIC_STRENGTH = 180; // base pull force (px/s^2)
export const MAGNETIC_DAMPING = 0.92; // velocity damping per frame (keeps motion smooth)
