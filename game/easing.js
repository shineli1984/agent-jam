/**
 * easing.js — Animation foundation for Mycelium
 *
 * Easing functions, a delta-time Tween class, and helpers.
 * Nothing in nature moves at constant speed. This module exists
 * to make every movement feel intentional and alive.
 *
 * Usage:
 *   import { easeOutQuad, Tween, tweens } from './easing.js';
 *
 *   // One-shot tween:
 *   new Tween(myObj, 'scale', { from: 1, to: 1.5, duration: 200, ease: easeOutElastic });
 *
 *   // In your game loop:
 *   tweens.update(dt);  // dt in seconds
 */

// --- Easing functions ---
// All take t in [0, 1], return eased t in [0, 1] (or beyond for elastic/back).

/** Decelerate — fast start, smooth stop. Best for arrivals, impacts. */
export function easeOutQuad(t) {
  return t * (2 - t);
}

/** Accelerate — slow start, fast end. Best for launches, growth. */
export function easeInQuad(t) {
  return t * t;
}

/** Smooth both ends. Best for transitions between states. */
export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Decelerate (cubic). Slightly snappier than quad. */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** Overshoot and settle — bouncy, organic. Best for pops, pickups, fork bursts. */
export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/** Overshoot slightly then return. Subtler than elastic — good for UI. */
export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Smooth step — no easing math, just a smooth S-curve. */
export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Linear — the enemy. Only use when you genuinely need constant speed. */
export function linear(t) {
  return t;
}

// --- Lerp helper ---
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --- Tween class ---

/**
 * Animates a single property on a target object.
 *
 * @param {object} target - The object whose property to animate
 * @param {string} prop - Property name on target
 * @param {object} opts
 * @param {number} opts.from - Start value (defaults to current value)
 * @param {number} opts.to - End value
 * @param {number} opts.duration - Duration in ms
 * @param {function} [opts.ease=easeOutQuad] - Easing function
 * @param {function} [opts.onUpdate] - Called each tick with (value, t)
 * @param {function} [opts.onComplete] - Called when tween finishes
 * @param {number} [opts.delay=0] - Delay before starting, in ms
 */
export class Tween {
  constructor(target, prop, opts = {}) {
    this.target = target;
    this.prop = prop;
    this.from = opts.from !== undefined ? opts.from : target[prop];
    this.to = opts.to;
    this.duration = opts.duration || 200; // ms
    this.ease = opts.ease || easeOutQuad;
    this.onUpdate = opts.onUpdate || null;
    this.onComplete = opts.onComplete || null;
    this.delay = opts.delay || 0;
    this.elapsed = -this.delay; // negative = waiting through delay
    this.done = false;

    // Auto-register
    tweens.add(this);
  }

  /** Advance by dt (seconds). Returns true if still active. */
  tick(dt) {
    if (this.done) return false;

    this.elapsed += dt * 1000; // convert to ms

    if (this.elapsed < 0) return true; // still in delay

    const progress = Math.min(this.elapsed / this.duration, 1);
    const easedT = this.ease(progress);
    const value = lerp(this.from, this.to, easedT);

    this.target[this.prop] = value;
    if (this.onUpdate) this.onUpdate(value, easedT);

    if (progress >= 1) {
      this.done = true;
      this.target[this.prop] = this.to; // snap to exact end value
      if (this.onComplete) this.onComplete();
      return false;
    }

    return true;
  }
}

// --- Tween Manager ---

class TweenManager {
  constructor() {
    this._tweens = [];
  }

  add(tween) {
    this._tweens.push(tween);
  }

  /** Update all active tweens. Call once per frame with dt in seconds. */
  update(dt) {
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const alive = this._tweens[i].tick(dt);
      if (!alive) {
        this._tweens.splice(i, 1);
      }
    }
  }

  /** Number of active tweens (useful for profiling). */
  get count() {
    return this._tweens.length;
  }

  /** Kill all tweens on a specific target (e.g., when a nutrient is removed). */
  killTarget(target) {
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      if (this._tweens[i].target === target) {
        this._tweens.splice(i, 1);
      }
    }
  }
}

/** Global tween manager — import and call tweens.update(dt) in your game loop. */
export const tweens = new TweenManager();
