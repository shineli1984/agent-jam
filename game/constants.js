/**
 * constants.js — Backwards-compatible re-export layer (issue #119)
 *
 * All values now live in config.js as the single source of truth.
 * This file re-exports them as named constants so existing imports
 * in index.html, ai.js, and particles.js continue to work with
 * zero changes to those files.
 *
 * Values are read from CONFIG at import time. Preset loading should
 * happen before the game initializes (which it does — config.js is
 * imported first and presets are applied before the game loop starts).
 */

import { CONFIG } from './config.js';

// --- Palette (object reference — mutations to CONFIG.palette propagate) ---
export const PALETTE = CONFIG.palette;

// --- Growth constants ---
export const BASE_GROW_SPEED  = CONFIG.growth.baseSpeed;
export const SPEED_CAP        = CONFIG.growth.speedCap;
export const SPEED_SCALE      = CONFIG.growth.speedScale;
export const TENDRIL_MAX_LEN  = CONFIG.growth.tendrilMaxLen;
export const NODE_RADIUS      = CONFIG.growth.nodeRadius;
export const WOBBLE_MIN       = CONFIG.growth.wobbleMin;
export const WOBBLE_SCALE     = CONFIG.growth.wobbleScale;
export const TURN_SMOOTHING   = CONFIG.growth.turnSmoothing;
export const EDGE_MARGIN      = CONFIG.growth.edgeMargin;

// --- Branching ---
export const BRANCH_MIN_DIST  = CONFIG.branching.minDist;
export const BRANCH_COOLDOWN  = CONFIG.branching.cooldown;

// --- Nutrients ---
export const NUTRIENT_COUNT   = CONFIG.nutrients.count;
export const NUTRIENT_RADIUS  = CONFIG.nutrients.radius;
export const COLLECT_RADIUS   = CONFIG.nutrients.collectRadius;
export const MAGNETIC_RADIUS  = CONFIG.nutrients.magneticRadius;
export const MAGNETIC_STRENGTH = CONFIG.nutrients.magneticStrength;
export const MAGNETIC_DAMPING = CONFIG.nutrients.magneticDamping;

// --- Energy ---
export const ENERGY_MAX              = CONFIG.energy.max;
export const ENERGY_INITIAL          = CONFIG.energy.initial;
export const ENERGY_DRAIN_IDLE       = CONFIG.energy.drainIdle;
export const ENERGY_DRAIN_GROW       = CONFIG.energy.drainGrow;
export const ENERGY_FORK_COST        = CONFIG.energy.forkCost;
export const ENERGY_REPLENISH        = CONFIG.energy.replenish;
export const ENERGY_STARVED_THRESHOLD = CONFIG.energy.starvedThreshold;

// Re-export CONFIG for files that want direct access
export { CONFIG };
