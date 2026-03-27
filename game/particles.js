import { CONFIG } from './config.js';
import { PALETTE } from './constants.js';

// --- Particle System ---
const particles = [];

export function spawnBurst(x, y, color) {
  const c = color || PALETTE.sporeGold;
  const count = CONFIG.fx.particleBurstCount;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;
    const speed = 60 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 1.8 + Math.random() * 1.2,
      radius: 1.5 + Math.random() * 2.5,
      color: c,
    });
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // Framerate-independent damping (#122): pow(rate, dt * 60) gives the
    // same visual decay at any refresh rate. At 60fps dt≈0.0167 → 0.95.
    const damp = Math.pow(0.95, dt * 60);
    p.vx *= damp;
    p.vy *= damp;
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function renderParticles(ctx) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}
