# Architecture

## Game Summary

Mycelium is a browser-based fungal network growth game. The player guides tendrils across a canvas to absorb nutrients, manage energy, and outcompete an AI rival. Static files only — no backend, no build step, no dependencies.

## File Map

| File | Purpose |
|------|---------|
| `game/index.html` | Entry point. Canvas rendering, game loop, input handling, HUD, title screen, timelapse replay, audio, accessibility (screen reader announcements) |
| `game/config.js` | Single source of truth for all tunable parameters. Preset system (default/zen/chaos). Runtime console API (`window.Mycelium`) |
| `game/constants.js` | Re-export layer — reads from `config.js`, exports named constants for backwards compatibility |
| `game/ai.js` | AI competitor (3-state FSM: EXPLORE/COMPETE/RETREAT). Same growth/energy rules as player |
| `game/particles.js` | Particle burst effects on nutrient collection and events |
| `game/easing.js` | Easing functions + Tween class + global TweenManager for animations |

## Key Systems

- **Growth** — Player directs tendrils via mouse/touch. Tendrils commit nodes at segment length intervals. Bezier-curved rendering with wobble.
- **Energy** — Branches drain energy passively and while growing. Forking costs energy. Nutrients replenish. Starvation kills branches.
- **Nutrients** — Scattered on canvas. Magnetic pull within radius. Cluster-based spawning. Bonus spawn on collection.
- **Branching** — Space key (or tap) forks a new tendril from the nearest node. Cooldown + minimum distance enforced.
- **AI Competitor** — Spawns at score threshold. Three behavioral states driven by energy level. Scores/collects nutrients independently.
- **Rendering** — Canvas 2D. Glow effects, bezier segments, pulsing tips, depth-based coloring.
- **Input** — Mouse/touch for direction, Space/tap for branching, keyboard shortcuts for timelapse (T) and game-over restart (R).
- **Particles** — Burst spawned on events, velocity-damped, alpha-faded.
- **Easing/Animation** — Tweens drive smooth transitions (fork ripples, absorption anims, milestone floaters).
- **Accessibility** — ARIA live region for screen reader announcements of milestones and game events.
- **Timelapse Replay** — Periodic canvas snapshots; press T to replay growth history.
- **Presets** — `config.js` supports named presets (zen, chaos) switchable at runtime.

## How to Add a Feature

1. **New system** — Create `game/newsystem.js`, add `<script type="module">` import in `index.html`
2. **Modify existing system** — Edit the relevant file directly
3. **New tunable constant** — Add to `config.js` DEFAULTS, re-export from `constants.js` if needed
4. **Test** — Open `game/index.html` in a browser. No build step required.

## What NOT to Do

- Do not put new systems inline in `index.html` — extract to a module
- Do not modify governance files (`CONTRIBUTING.md`, `SECURITY.md`, `DECISIONS.md`) without an issue and community discussion
- Do not remove existing features without consensus
- Do not add external dependencies, CDN imports, or backend calls
- Do not commit secrets, API keys, or `.env` files
