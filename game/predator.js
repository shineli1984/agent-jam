/**
 * Predator System — The Slime
 * 
 * A hostile organism that hunts and consumes the player's network.
 * Transforms Mycelium from peaceful growth into survival horror.
 * 
 * Issue #159
 */

import { CONFIG } from './config.js';
import {
  PALETTE,
  EDGE_MARGIN,
} from './constants.js';

// --- Predator Configuration ---
const PREDATOR_CONFIG = {
  spawnScore: 15,           // Score threshold to spawn
  baseSpeed: 55,            // Base movement speed (px/s)
  speedPerKill: 8,          // Speed increase per segment consumed
  maxSpeed: 180,            // Speed cap
  huntRadius: 400,          // Detection range for tips
  consumeRadius: 18,        // Collision radius for segment consumption
  energyDrain: 0.02,        // Energy drain per second
  energyPerKill: 0.35,      // Energy gained per segment consumed
  splitThreshold: 5,        // Kills before splitting
  splitMaxCount: 3,         // Maximum predators from splitting
  initialEnergy: 1.0,
  size: 18,                 // Base visual size
  sizePerKill: 2,           // Size increase per kill
  color: '#9b2d9b',         // Toxic purple
  glowColor: 'rgba(155, 45, 155, 0.6)',
};

// --- Predator State ---
let predators = [];
let predatorSpawned = false;
let totalKills = 0;

/**
 * Create a new predator instance
 */
export function createPredator(x, y, inherited = {}) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    targetTip: null,
    speed: inherited.speed || PREDATOR_CONFIG.baseSpeed,
    energy: inherited.energy || PREDATOR_CONFIG.initialEnergy,
    size: inherited.size || PREDATOR_CONFIG.size,
    kills: inherited.kills || 0,
    alive: true,
    pulsePhase: Math.random() * Math.PI * 2,
    trail: [], // Decay trail positions
  };
}

/**
 * Spawn the initial predator when score threshold is reached
 */
export function checkPredatorSpawn(score, canvasW, canvasH, playerBranches) {
  if (predatorSpawned || score < PREDATOR_CONFIG.spawnScore) return false;
  
  predatorSpawned = true;
  
  // Spawn at the corner furthest from player's center of mass
  let cx = 0, cy = 0;
  for (const b of playerBranches) {
    cx += b.growing.x;
    cy += b.growing.y;
  }
  cx /= playerBranches.length;
  cy /= playerBranches.length;
  
  const corners = [
    { x: EDGE_MARGIN + 40, y: EDGE_MARGIN + 40 },
    { x: canvasW - EDGE_MARGIN - 40, y: EDGE_MARGIN + 40 },
    { x: EDGE_MARGIN + 40, y: canvasH - EDGE_MARGIN - 40 },
    { x: canvasW - EDGE_MARGIN - 40, y: canvasH - EDGE_MARGIN - 40 },
  ];
  
  let bestCorner = corners[0];
  let bestDist = 0;
  for (const c of corners) {
    const d = Math.sqrt((cx - c.x) ** 2 + (cy - c.y) ** 2);
    if (d > bestDist) {
      bestDist = d;
      bestCorner = c;
    }
  }
  
  predators.push(createPredator(bestCorner.x, bestCorner.y));
  return true; // Signal that predator spawned (for audio/visual cue)
}

/**
 * Find the nearest player tip to hunt
 */
function findNearestTip(predator, playerBranches) {
  let nearest = null;
  let nearestDist = Infinity;
  
  for (let i = 0; i < playerBranches.length; i++) {
    const b = playerBranches[i];
    if (b.energy <= 0) continue; // Don't hunt dead branches
    
    const dx = b.growing.x - predator.x;
    const dy = b.growing.y - predator.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    
    if (d < nearestDist && d < PREDATOR_CONFIG.huntRadius) {
      nearestDist = d;
      nearest = { index: i, x: b.growing.x, y: b.growing.y, dist: d };
    }
  }
  
  return nearest;
}

/**
 * Check if predator collides with any network segment
 */
function checkSegmentCollision(predator, network) {
  for (let i = 0; i < network.segments.length; i++) {
    const seg = network.segments[i];
    const nodeA = network.nodes[seg.from];
    const nodeB = network.nodes[seg.to];
    if (!nodeA || !nodeB) continue;
    
    // Point-to-line-segment distance
    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;
    
    // Project predator position onto segment
    const t = Math.max(0, Math.min(1, 
      ((predator.x - nodeA.x) * dx + (predator.y - nodeA.y) * dy) / (len * len)
    ));
    
    const closestX = nodeA.x + t * dx;
    const closestY = nodeA.y + t * dy;
    const dist = Math.sqrt((predator.x - closestX) ** 2 + (predator.y - closestY) ** 2);
    
    if (dist < PREDATOR_CONFIG.consumeRadius) {
      return { segmentIndex: i, segment: seg, hitX: closestX, hitY: closestY };
    }
  }
  
  return null;
}

/**
 * Sever a segment and all downstream nodes/segments
 * Returns the count of removed segments
 */
export function severNetwork(network, segmentIndex, branches) {
  const segment = network.segments[segmentIndex];
  if (!segment) return 0;
  
  // Find all nodes downstream from the cut (away from origin)
  const downstreamNodes = new Set();
  const queue = [segment.to];
  
  // Build adjacency map
  const adj = new Map();
  for (const seg of network.segments) {
    if (!adj.has(seg.from)) adj.set(seg.from, []);
    if (!adj.has(seg.to)) adj.set(seg.to, []);
    adj.get(seg.from).push({ node: seg.to, seg });
    adj.get(seg.to).push({ node: seg.from, seg });
  }
  
  // BFS to find all downstream nodes (excluding path back to origin)
  const visited = new Set([segment.from]); // Don't go back toward origin
  while (queue.length > 0) {
    const node = queue.shift();
    if (visited.has(node)) continue;
    visited.add(node);
    downstreamNodes.add(node);
    
    for (const neighbor of (adj.get(node) || [])) {
      if (!visited.has(neighbor.node)) {
        queue.push(neighbor.node);
      }
    }
  }
  
  // Remove all segments that connect to downstream nodes
  const removedCount = network.segments.length;
  network.segments = network.segments.filter(seg => {
    return !downstreamNodes.has(seg.from) && !downstreamNodes.has(seg.to);
  });
  
  // Also remove the cut segment itself
  network.segments = network.segments.filter((_, i) => i !== segmentIndex);
  
  // Kill any branches whose tip was in the downstream nodes
  for (const b of branches) {
    if (downstreamNodes.has(b.tipIndex)) {
      b.energy = 0; // Kill the branch
    }
  }
  
  return removedCount - network.segments.length;
}

/**
 * Update all predators
 */
export function updatePredators(dt, network, playerBranches, canvasW, canvasH, onConsume, onSplit) {
  for (let pi = predators.length - 1; pi >= 0; pi--) {
    const p = predators[pi];
    if (!p.alive) continue;
    
    // Energy drain
    p.energy -= PREDATOR_CONFIG.energyDrain * dt;
    if (p.energy <= 0) {
      p.alive = false;
      continue;
    }
    
    // Find target
    const target = findNearestTip(p, playerBranches);
    
    if (target) {
      // Hunt toward target
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 1) {
        const speed = Math.min(p.speed, PREDATOR_CONFIG.maxSpeed);
        p.vx = (dx / dist) * speed;
        p.vy = (dy / dist) * speed;
      }
    } else {
      // Wander randomly when no target
      if (Math.random() < 0.02) {
        const angle = Math.random() * Math.PI * 2;
        p.vx = Math.cos(angle) * p.speed * 0.5;
        p.vy = Math.sin(angle) * p.speed * 0.5;
      }
    }
    
    // Apply velocity
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    
    // Boundary clamping
    p.x = Math.max(EDGE_MARGIN, Math.min(canvasW - EDGE_MARGIN, p.x));
    p.y = Math.max(EDGE_MARGIN, Math.min(canvasH - EDGE_MARGIN, p.y));
    
    // Add to trail
    if (p.trail.length === 0 || 
        Math.sqrt((p.x - p.trail[p.trail.length - 1].x) ** 2 + 
                  (p.y - p.trail[p.trail.length - 1].y) ** 2) > 8) {
      p.trail.push({ x: p.x, y: p.y, age: 0 });
      if (p.trail.length > 30) p.trail.shift();
    }
    
    // Age trail
    for (const t of p.trail) {
      t.age += dt;
    }
    p.trail = p.trail.filter(t => t.age < 3);
    
    // Check for segment collision
    const collision = checkSegmentCollision(p, network);
    if (collision) {
      const severed = severNetwork(network, collision.segmentIndex, playerBranches);
      if (severed > 0) {
        p.kills++;
        totalKills++;
        p.energy = Math.min(1, p.energy + PREDATOR_CONFIG.energyPerKill);
        p.speed += PREDATOR_CONFIG.speedPerKill;
        p.size += PREDATOR_CONFIG.sizePerKill;
        
        if (onConsume) {
          onConsume(collision.hitX, collision.hitY, severed);
        }
        
        // Check for split
        if (p.kills >= PREDATOR_CONFIG.splitThreshold && 
            predators.length < PREDATOR_CONFIG.splitMaxCount) {
          const newP = createPredator(
            p.x + (Math.random() - 0.5) * 40,
            p.y + (Math.random() - 0.5) * 40,
            { 
              speed: p.speed * 0.8, 
              energy: p.energy * 0.6,
              size: p.size * 0.7,
              kills: 0 
            }
          );
          predators.push(newP);
          p.kills = 0;
          p.energy *= 0.6;
          p.size *= 0.8;
          
          if (onSplit) {
            onSplit(p.x, p.y);
          }
        }
      }
    }
    
    // Update pulse
    p.pulsePhase += dt * 4;
  }
  
  // Remove dead predators
  predators = predators.filter(p => p.alive);
}

/**
 * Render all predators
 */
export function renderPredators(ctx, now) {
  // Render trails first (behind predators)
  for (const p of predators) {
    for (const t of p.trail) {
      const alpha = Math.max(0, 0.3 * (1 - t.age / 3));
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(60, 20, 60, ${alpha})`;
      ctx.fill();
    }
  }
  
  // Render predators
  for (const p of predators) {
    if (!p.alive) continue;
    
    const pulse = 0.8 + 0.2 * Math.sin(p.pulsePhase);
    const size = p.size * pulse;
    
    // Outer glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 1.5);
    gradient.addColorStop(0, 'rgba(155, 45, 155, 0.4)');
    gradient.addColorStop(0.5, 'rgba(155, 45, 155, 0.2)');
    gradient.addColorStop(1, 'rgba(155, 45, 155, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
    
    // Core body — amorphous blob
    ctx.save();
    ctx.beginPath();
    const points = 8;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const wobble = 1 + 0.15 * Math.sin(angle * 3 + p.pulsePhase * 2);
      const r = size * wobble;
      const px = p.x + Math.cos(angle) * r;
      const py = p.y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = PREDATOR_CONFIG.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = PREDATOR_CONFIG.glowColor;
    ctx.fill();
    ctx.restore();
    
    // Inner nuclei (creepy eyes)
    const eyeOffset = size * 0.3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x - eyeOffset, p.y, 3, 0, Math.PI * 2);
    ctx.arc(p.x + eyeOffset, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ff44ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff44ff';
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Get predator count (for HUD)
 */
export function getPredatorCount() {
  return predators.filter(p => p.alive).length;
}

/**
 * Get total kills (for stats)
 */
export function getTotalKills() {
  return totalKills;
}

/**
 * Reset predator system (for game restart)
 */
export function resetPredators() {
  predators = [];
  predatorSpawned = false;
  totalKills = 0;
}

/**
 * Check if any predator is near a position (for audio proximity)
 */
export function getNearestPredatorDistance(x, y) {
  let nearest = Infinity;
  for (const p of predators) {
    if (!p.alive) continue;
    const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
    if (d < nearest) nearest = d;
  }
  return nearest;
}
