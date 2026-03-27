/**
 * CompetingFungus AI — issue #78
 *
 * A simple behavioral AI for rival fungal networks. Three states:
 *   EXPLORE — seek the highest-scoring unclaimed nutrient
 *   COMPETE — grow toward contested nutrients when energy is high
 *   RETREAT — grow away from the player when energy is low
 *
 * Each nutrient is scored: value / distance - playerProximity + jitter.
 * The jitter (±20%) makes the AI feel organic — it doesn't always pick optimally.
 *
 * The AI uses the same energy system as the player: idle drain, growth drain,
 * fork cost. It grows at ~75% of player speed (worse decisions, not slower animation).
 */

import { CONFIG } from './config.js';
import {
  PALETTE,
  BASE_GROW_SPEED,
  SPEED_CAP,
  SPEED_SCALE,
  TENDRIL_MAX_LEN,
  NODE_RADIUS,
  EDGE_MARGIN,
  ENERGY_MAX,
  ENERGY_INITIAL,
  ENERGY_DRAIN_IDLE,
  ENERGY_DRAIN_GROW,
  ENERGY_REPLENISH,
  ENERGY_STARVED_THRESHOLD,
  COLLECT_RADIUS,
  NUTRIENT_RADIUS,
  WOBBLE_MIN,
  WOBBLE_SCALE,
} from './constants.js';

// --- AI states ---
const STATE_EXPLORE = 'EXPLORE';
const STATE_COMPETE = 'COMPETE';
const STATE_RETREAT = 'RETREAT';

// --- AI tuning (now configurable via CONFIG.ai — issue #119) ---
const AI_SPEED_FACTOR = CONFIG.ai.speedFactor;
const AI_JITTER = CONFIG.ai.jitter;
const AI_RETREAT_THRESHOLD = CONFIG.ai.retreatThreshold;
const AI_COMPETE_THRESHOLD = CONFIG.ai.competeThreshold;
const AI_RETARGET_TICKS = CONFIG.ai.retargetTicks;
const AI_FORK_CHANCE = CONFIG.ai.forkChance;
const AI_FORK_MIN_ENERGY = CONFIG.ai.forkMinEnergy;
const AI_PLAYER_PENALTY_WEIGHT = CONFIG.ai.playerPenaltyWeight;
const AI_COLOR = PALETTE.rootAmber;    // distinct from player's green

// Issue #63: wobble scaled to segment length (mirrors player genWobble)
function genWobble(segLen) {
  const range = Math.max(WOBBLE_MIN, (segLen || TENDRIL_MAX_LEN) * WOBBLE_SCALE);
  return (Math.random() - 0.5) * range;
}

/**
 * Create a new competing fungus AI instance.
 * @param {number} x - spawn x
 * @param {number} y - spawn y
 * @param {number} canvasW - canvas width
 * @param {number} canvasH - canvas height
 * @returns {object} fungus instance
 */
export function createCompetingFungus(x, y, canvasW, canvasH) {
  const originNode = { x, y, radius: 5 };
  return {
    color: AI_COLOR,
    nodes: [originNode],
    segments: [],    // {from, to, wobble}
    branches: [{
      tipIndex: 0,
      growing: { x, y, dist: 0 },
      wobble: genWobble(),
      energy: ENERGY_INITIAL,
    }],
    activeBranch: 0,
    state: STATE_EXPLORE,
    targetNutrient: null,  // reference to the nutrient object (not index — #108)
    targetPos: null,       // {x, y} cached position
    ticksSinceRetarget: 0,
    score: 0,
    canvasW,
    canvasH,
    alive: true,
  };
}

// --- Helpers ---
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function jitter(value) {
  return value * (1 + (Math.random() - 0.5) * 2 * AI_JITTER);
}

/**
 * Score a nutrient for the AI. Higher = more attractive.
 *   score = 1 / distance - playerProximityPenalty + noise
 */
function scoreNutrient(nutrient, tipX, tipY, playerBranches) {
  const d = dist(nutrient.x, nutrient.y, tipX, tipY);
  if (d < 1) return 999; // on top of it

  // Base score: inverse distance (closer = better)
  let s = 100 / d;

  // Player proximity penalty: nutrients near the player are less attractive
  let minPlayerDist = Infinity;
  for (const pb of playerBranches) {
    const pd = dist(nutrient.x, nutrient.y, pb.growing.x, pb.growing.y);
    if (pd < minPlayerDist) minPlayerDist = pd;
  }
  // Penalty falls off with distance — nearby player branches are a strong deterrent
  if (minPlayerDist < 200) {
    s -= AI_PLAYER_PENALTY_WEIGHT * (200 - minPlayerDist) / 200;
  }

  // Jitter: ±20% makes the AI imperfect and organic
  return jitter(s);
}

/**
 * Choose a target nutrient based on current state.
 */
function pickTarget(fungus, nutrients, playerBranches) {
  const branch = fungus.branches[fungus.activeBranch];
  const tipX = branch.growing.x;
  const tipY = branch.growing.y;

  if (fungus.state === STATE_RETREAT) {
    // Retreat: move away from the nearest player branch
    let closestPlayer = null;
    let closestDist = Infinity;
    for (const pb of playerBranches) {
      const d = dist(tipX, tipY, pb.growing.x, pb.growing.y);
      if (d < closestDist) {
        closestDist = d;
        closestPlayer = pb;
      }
    }
    if (closestPlayer) {
      // Target is directly away from the player
      const dx = tipX - closestPlayer.growing.x;
      const dy = tipY - closestPlayer.growing.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      fungus.targetPos = {
        x: Math.max(EDGE_MARGIN, Math.min(fungus.canvasW - EDGE_MARGIN, tipX + (dx / len) * 100)),
        y: Math.max(EDGE_MARGIN, Math.min(fungus.canvasH - EDGE_MARGIN, tipY + (dy / len) * 100)),
      };
      fungus.targetNutrient = null;
    }
    return;
  }

  // EXPLORE or COMPETE: score all nutrients and pick the best
  let bestScore = -Infinity;
  let bestIndex = -1;

  for (let i = 0; i < nutrients.length; i++) {
    let s = scoreNutrient(nutrients[i], tipX, tipY, playerBranches);

    // In COMPETE state, boost score for contested nutrients (near both player and AI)
    if (fungus.state === STATE_COMPETE) {
      let minPlayerDist = Infinity;
      for (const pb of playerBranches) {
        const pd = dist(nutrients[i].x, nutrients[i].y, pb.growing.x, pb.growing.y);
        if (pd < minPlayerDist) minPlayerDist = pd;
      }
      // Contested: both AI and player are within contest distance (issue #119)
      const aiDist = dist(nutrients[i].x, nutrients[i].y, tipX, tipY);
      if (minPlayerDist < CONFIG.ai.contestDistance && aiDist < CONFIG.ai.contestDistance) {
        s *= 1.5; // bonus for contested nutrients when we're strong
      }
    }

    if (s > bestScore) {
      bestScore = s;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    fungus.targetNutrient = nutrients[bestIndex]; // object reference, not index (#108)
    fungus.targetPos = { x: nutrients[bestIndex].x, y: nutrients[bestIndex].y };
  }
}

/**
 * Determine AI state based on energy level.
 */
function updateState(fungus, playerBranches) {
  const branch = fungus.branches[fungus.activeBranch];
  const e = branch.energy;

  if (e <= AI_RETREAT_THRESHOLD) {
    fungus.state = STATE_RETREAT;
  } else if (e >= AI_COMPETE_THRESHOLD) {
    // Only compete if there are player branches nearby
    let hasNearbyPlayer = false;
    for (const pb of playerBranches) {
      if (dist(branch.growing.x, branch.growing.y, pb.growing.x, pb.growing.y) < CONFIG.ai.nearbyPlayerDistance) {
        hasNearbyPlayer = true;
        break;
      }
    }
    fungus.state = hasNearbyPlayer ? STATE_COMPETE : STATE_EXPLORE;
  } else {
    fungus.state = STATE_EXPLORE;
  }
}

/**
 * Update one AI fungus for one frame.
 * @param {object} fungus - the AI instance
 * @param {number} dt - delta time in seconds
 * @param {Array} nutrients - game nutrients array (shared, mutable)
 * @param {Array} playerBranches - player's branches array
 * @param {number} playerScore - player's current score
 * @param {function} onCollect - callback(nutrientIndex, x, y) when AI collects a nutrient
 */
export function updateCompetingFungus(fungus, dt, nutrients, playerBranches, playerScore, onCollect) {
  if (!fungus.alive) return;

  // Check if all branches are starved
  const allStarved = fungus.branches.every(b => b.energy <= ENERGY_STARVED_THRESHOLD);
  if (allStarved) {
    fungus.alive = false;
    return;
  }

  // Energy drain for all AI branches (same rules as player)
  for (const b of fungus.branches) {
    b.energy -= ENERGY_DRAIN_IDLE * dt;
    b.energy = Math.max(0, Math.min(ENERGY_MAX, b.energy));
  }

  // Pick the best alive branch to control
  let bestBranch = 0;
  let bestEnergy = -1;
  for (let i = 0; i < fungus.branches.length; i++) {
    if (fungus.branches[i].energy > bestEnergy) {
      bestEnergy = fungus.branches[i].energy;
      bestBranch = i;
    }
  }
  fungus.activeBranch = bestBranch;

  const branch = fungus.branches[fungus.activeBranch];
  if (branch.energy <= ENERGY_STARVED_THRESHOLD) return;

  // State transition
  updateState(fungus, playerBranches);

  // Retarget periodically (hysteresis prevents oscillation)
  fungus.ticksSinceRetarget++;
  if (!fungus.targetPos || fungus.ticksSinceRetarget >= AI_RETARGET_TICKS) {
    pickTarget(fungus, nutrients, playerBranches);
    fungus.ticksSinceRetarget = 0;
  }

  // If target nutrient was collected (removed from array), retarget immediately (#108)
  // Using object reference instead of index avoids stale-index bugs after splice()
  if (fungus.targetNutrient !== null && !nutrients.includes(fungus.targetNutrient)) {
    pickTarget(fungus, nutrients, playerBranches);
    fungus.ticksSinceRetarget = 0;
  }

  if (!fungus.targetPos) return;

  // --- Growth toward target ---
  const tipX = branch.growing.x;
  const tipY = branch.growing.y;
  let dx = fungus.targetPos.x - tipX;
  let dy = fungus.targetPos.y - tipY;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 2) {
    // Reached target, retarget next tick
    fungus.ticksSinceRetarget = AI_RETARGET_TICKS;
    return;
  }

  dx /= len;
  dy /= len;

  // Growth speed: same formula as player but scaled down
  const growSpeed = (BASE_GROW_SPEED + SPEED_CAP * (1 - Math.exp(-fungus.score * SPEED_SCALE))) * AI_SPEED_FACTOR;
  const step = growSpeed * dt;

  // Active growth drains energy
  branch.energy -= ENERGY_DRAIN_GROW * dt;
  branch.energy = Math.max(0, branch.energy);

  branch.growing.x += dx * step;
  branch.growing.y += dy * step;

  // Edge handling: clamp position and force immediate retarget (#111)
  // The AI lacks smooth direction blending (smoothDx/smoothDy), so instead
  // of implementing full smooth redirection we force a retarget when the AI
  // hits an edge. This makes it recover quickly instead of oscillating.
  const W = fungus.canvasW;
  const H = fungus.canvasH;
  let hitEdge = false;
  if (branch.growing.x < EDGE_MARGIN) { branch.growing.x = EDGE_MARGIN; hitEdge = true; }
  else if (branch.growing.x > W - EDGE_MARGIN) { branch.growing.x = W - EDGE_MARGIN; hitEdge = true; }
  if (branch.growing.y < EDGE_MARGIN) { branch.growing.y = EDGE_MARGIN; hitEdge = true; }
  else if (branch.growing.y > H - EDGE_MARGIN) { branch.growing.y = H - EDGE_MARGIN; hitEdge = true; }
  if (hitEdge) {
    fungus.ticksSinceRetarget = AI_RETARGET_TICKS; // force retarget next tick
  }

  branch.growing.dist += step;

  // Segment creation (same as player)
  if (branch.growing.dist >= TENDRIL_MAX_LEN) {
    const newNode = { x: branch.growing.x, y: branch.growing.y, radius: NODE_RADIUS };
    fungus.nodes.push(newNode);
    const newIndex = fungus.nodes.length - 1;
    fungus.segments.push({
      from: branch.tipIndex,
      to: newIndex,
      wobble: genWobble(branch.growing.dist),
    });
    branch.tipIndex = newIndex;
    branch.wobble = genWobble(branch.growing.dist);
    branch.growing.dist = 0;
  }

  // --- Occasional forking (simple probabilistic, not every tick) ---
  if (Math.random() < AI_FORK_CHANCE && branch.energy > AI_FORK_MIN_ENERGY && branch.growing.dist > 15) {
    const childEnergy = (branch.energy - 0.15) * 0.5; // same fork cost logic as player (#70 fix)
    if (childEnergy > 0.05) {
      branch.energy -= 0.15; // fork cost
      branch.energy -= childEnergy; // give half to child
      const forkNode = fungus.nodes[branch.tipIndex];
      fungus.branches.push({
        tipIndex: branch.tipIndex,
        growing: { x: forkNode.x, y: forkNode.y, dist: 0 },
        wobble: genWobble(),
        energy: childEnergy,
      });
    }
  }

  // --- Nutrient collection (all AI tips) ---
  for (let bi = 0; bi < fungus.branches.length; bi++) {
    const b = fungus.branches[bi];
    for (let ni = nutrients.length - 1; ni >= 0; ni--) {
      const n = nutrients[ni];
      if (dist(b.growing.x, b.growing.y, n.x, n.y) < COLLECT_RADIUS) {
        // AI collected this nutrient
        b.energy = Math.min(ENERGY_MAX, b.energy + ENERGY_REPLENISH);
        fungus.score++;
        onCollect(ni, n.x, n.y);
        break; // one per branch per tick to avoid double-collect
      }
    }
  }
}

/**
 * Render an AI fungus network.
 * Deliberately similar to the player render — same bezier curves, same glow —
 * but in rootAmber color to distinguish it.
 */
export function renderCompetingFungus(fungus, ctx, now) {
  if (!fungus.alive && fungus.nodes.length === 0) return;

  const color = fungus.color;
  const glowBoost = Math.min(fungus.score * 0.04, 0.6);

  // Segments — bezier curves
  ctx.save();
  ctx.shadowColor = color;
  for (const seg of fungus.segments) {
    const a = fungus.nodes[seg.from];
    const b = fungus.nodes[seg.to];
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const sdx = b.x - a.x;
    const sdy = b.y - a.y;
    const slen = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
    const px = -sdy / slen;
    const py = sdx / slen;
    const w = seg.wobble || 0;

    ctx.lineWidth = 2;
    ctx.shadowBlur = 6 + glowBoost * 8;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35 + glowBoost * 0.2;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx + px * w, my + py * w, b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Growing segments from tip to current position
  for (const b of fungus.branches) {
    if (b.growing.dist > 0 && b.energy > ENERGY_STARVED_THRESHOLD) {
      const tipNode = fungus.nodes[b.tipIndex];
      if (!tipNode) continue;
      const tipX = b.growing.x;
      const tipY = b.growing.y;
      const gmx = (tipNode.x + tipX) / 2;
      const gmy = (tipNode.y + tipY) / 2;
      const gdx = tipX - tipNode.x;
      const gdy = tipY - tipNode.y;
      const glen = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
      const gpx = -gdy / glen;
      const gpy = gdx / glen;
      const gw = b.wobble || 0;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tipNode.x, tipNode.y);
      ctx.quadraticCurveTo(gmx + gpx * gw, gmy + gpy * gw, tipX, tipY);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Nodes
  for (const n of fungus.nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(196, 115, 53, ' + (0.1 + glowBoost * 0.05) + ')';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(196, 115, 53, ' + (0.5 + glowBoost * 0.2) + ')';
    ctx.fill();
  }

  // Tips
  const pulseT = now / 1000;
  for (const b of fungus.branches) {
    if (b.energy <= ENERGY_STARVED_THRESHOLD) continue;
    const tipX = b.growing.x;
    const tipY = b.growing.y;
    const pulse = 0.5 + 0.5 * Math.sin(pulseT * 3);

    ctx.save();
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4 + pulse * 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.shadowBlur = 8 + pulse * 6;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.restore();
  }

  // "State" indicator for debug (small text near active tip) — only in dev
  // Uncomment for debugging:
  // const ab = fungus.branches[fungus.activeBranch];
  // ctx.save();
  // ctx.font = '10px monospace';
  // ctx.fillStyle = color;
  // ctx.globalAlpha = 0.5;
  // ctx.fillText(fungus.state, ab.growing.x + 10, ab.growing.y - 10);
  // ctx.restore();
}
