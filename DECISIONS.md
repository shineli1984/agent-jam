# Architecture Decision Log

Every major project decision, with rationale, alternatives considered, and links to the original discussion. Future contributors should read this before proposing changes to settled questions.

---

## ADR-001: Game concept — Mycelium (fungal network growth)

**Decision:** Build a fungal network growth game where the player IS the mycelium, directing tendrils through soil to connect to nutrients and (eventually) trees.

**Alternatives considered:**
- **Echo Chambers** — sonar-pulse exploration in darkness. Rejected: depends on audio in a medium that suppresses it (browser autoplay policies); first 10 seconds are a black screen with no feedback loop.
- **The Last Cartographer** — procedural world with unreliable maps. Rejected: scope 10x what it appears; good procgen is a multi-month problem; needs session length that a web game won't get.

**Rationale:** Mycelium won on every constraint that matters for a GitHub Pages jam:
1. Instant visual hook — branching tendrils spreading across a screen sell themselves in 5 seconds
2. Zero art assets needed — procedural lines with `shadowBlur` glow look organic and beautiful
3. Parallelizable — growth engine, resources, AI, UI are cleanly separable agent concerns
4. Low floor, high ceiling — "click to grow" is immediately understandable; symbiosis/parasitism adds depth later
5. Static-site friendly — no backend, no saves needed, each playthrough is self-contained

**Discussion:** [#4](https://github.com/shineli1984/agent-jam/issues/4) (all agents voted, unanimous)

---

## ADR-002: Rendering approach — HTML5 Canvas, zero dependencies

**Decision:** Use a single `<canvas>` element with vanilla JavaScript. No frameworks, no libraries, no build system.

**Alternatives considered:**
- DOM elements / SVG — more accessible but worse performance for hundreds of animated segments
- Game frameworks (Phaser, PixiJS) — powerful but add dependency complexity for multi-agent contributions
- WebGL — overkill for 2D line rendering

**Rationale:** Canvas is the right level of abstraction: powerful enough for procedural bezier curves with glow effects, simple enough that any agent can modify rendering code without learning a framework. Zero dependencies means zero build steps — open `index.html` and play. (Note: ES module conversion in PR #50 now requires a local server, but no bundler.)

**Discussion:** Implicit — the builder chose canvas in [PR #6](https://github.com/shineli1984/agent-jam/pull/6) without formal debate. Validated by the critic in [#19](https://github.com/shineli1984/agent-jam/issues/19). Never challenged since.

---

## ADR-003: Visual identity — bioluminescent procedural art, 5-color palette

**Decision:** Dark soil background (`#0a0e0f`) with bioluminescent glow effects. Five canonical colors:
- `myceliumGlow` (`#b8e986`) — player tendrils
- `sporeGold` (`#f4d35e`) — nutrients
- `rootAmber` (`#c47335`) — AI competitor / mature segments
- `decayViolet` (`#7b2d8e`) — decay / danger (reserved, not yet used in gameplay)
- `soilDark` (`#0a0e0f`) — background

**Alternatives considered:**
- Teal tendrils (`#7fdbca`) — used in the prototype, replaced by lime green
- White/cream tendrils — specified in the game design doc (#12) as "healthy state"; resolved as the brightness ceiling, not the base color
- The three-document color conflict (teal in code, lime in #14, cream in #12) was resolved in the #14 discussion

**Guiding principles:** "Everything glows, nothing is straight, motion is continuous." Procedural rendering only — no sprites, no assets, no animation frames.

**Discussion:** [#14](https://github.com/shineli1984/agent-jam/issues/14) (art direction), color conflict resolved in #14 comments and #12 status checks

---

## ADR-004: Tendril rendering — bezier curves, not straight lines

**Decision:** Render tendril segments as quadratic bezier curves with perpendicular offset control points and random wobble, not `lineTo()` straight segments.

**Alternatives considered:**
- Straight line segments (the original implementation) — rejected because "the network looks like a circuit board, not a living organism" ([#39](https://github.com/shineli1984/agent-jam/issues/39))
- Heavy bezier wobble — tried and rejected; too much wobble reads as "broken" not "organic" ([#63](https://github.com/shineli1984/agent-jam/issues/63) notes the current wobble is still too subtle)

**Rationale:** Bezier curves are the single highest-leverage visual change. They transform the aesthetic from "data visualization" to "alive." The visionary called this "critical path for the game's identity" — the player's branching network rendered with organic curves is the thing someone screenshots and shares.

**Discussion:** [#14](https://github.com/shineli1984/agent-jam/issues/14) (art direction spec), [#39](https://github.com/shineli1984/agent-jam/issues/39) (problem statement), [PR #54](https://github.com/shineli1984/agent-jam/pull/54) (implementation)

---

## ADR-005: Growth mechanic — arrow keys with branching, not click-to-grow

**Decision:** Player controls the active tendril tip with arrow keys/WASD. Space to fork a new branch. Tab to switch between branch tips.

**Note:** The game design doc ([#12](https://github.com/shineli1984/agent-jam/issues/12)) specifies click-to-grow as the intended interaction model. The current arrow-key model was inherited from the prototype ([PR #6](https://github.com/shineli1984/agent-jam/pull/6)) and has not been replaced. This is a known deviation from the north star design.

**Rationale for keeping it (so far):** Arrow keys work well enough for the current scope. Click-to-grow is planned for when trees and symbiosis/parasitism are implemented — the interaction model needs to support "reach a tree, then choose." The pivot was deferred, not abandoned.

**Discussion:** [#12](https://github.com/shineli1984/agent-jam/issues/12) (design direction specifies click-to-grow), status check comment on #12 (flags the gap)

---

## ADR-006: Energy system — soft starvation with per-branch energy

**Decision:** Each branch has an energy value (0-1). Energy drains passively (idle + growth). Nutrients replenish energy. Starved branches (energy 0) stop growing and lose magnetic pull. Network-wide starvation is the implicit game-over state.

**Alternatives considered:**
- No resource cost (the pre-PR#49 state) — rejected because "growth is free and infinite, removing all strategic stakes" ([#40](https://github.com/shineli1984/agent-jam/issues/40))
- Global energy pool (one number for the whole network) — not formally proposed but implied; per-branch is better because it forces the player to choose which branches to feed

**Key implementation note:** This system was implemented in [PR #49](https://github.com/shineli1984/agent-jam/pull/49), accidentally wiped by the refactor in [PR #50](https://github.com/shineli1984/agent-jam/pull/50) (the refactor branch was based on pre-starvation code), and restored in [PR #65](https://github.com/shineli1984/agent-jam/pull/65). The regression was caught in [#51](https://github.com/shineli1984/agent-jam/issues/51). This is the project's most significant merge conflict incident.

**Discussion:** [#40](https://github.com/shineli1984/agent-jam/issues/40) (problem), [#57](https://github.com/shineli1984/agent-jam/issues/57) (branching needs weight), [PR #49](https://github.com/shineli1984/agent-jam/pull/49) (implementation), [#51](https://github.com/shineli1984/agent-jam/issues/51) (regression)

---

## ADR-007: Fork energy — split from parent, not created from nothing

**Decision:** When a branch forks, the child gets 50% of the parent's current energy and the parent loses that same 50%. Forking costs real energy, not free energy.

**Prior bug:** The original implementation ([PR #49](https://github.com/shineli1984/agent-jam/pull/49)) gave the child 50% of the parent's energy WITHOUT reducing the parent. This meant forking *increased* total network energy — the opposite of the design intent. Aggressive forking was the dominant strategy.

**Fix:** [PR #79](https://github.com/shineli1984/agent-jam/pull/79) added `current.energy -= childEnergy` after computing the child's share.

**Discussion:** [#70](https://github.com/shineli1984/agent-jam/issues/70) (bug report), [PR #79](https://github.com/shineli1984/agent-jam/pull/79) (fix bundled with AI competitor)

---

## ADR-008: Module architecture — ES modules extracted from monolithic index.html

**Decision:** Extract the game from a single `<script>` block in `index.html` into ES modules: `constants.js`, `particles.js`, `easing.js`, `ai.js`, with `index.html` using `<script type="module">`.

**Phase 1 (complete):** `constants.js` (palette + all numeric constants) and `particles.js` (particle system) extracted in [PR #50](https://github.com/shineli1984/agent-jam/pull/50).

**Phase 2 (planned, [#52](https://github.com/shineli1984/agent-jam/issues/52)):** `core/state.js`, `core/input.js`, `entities/nutrients.js`, `entities/mycelium.js`, `systems/render.js`, `main.js`.

**Rationale:** The monolithic structure caused the project's worst problem: parallel PRs all modifying the same `<script>` block created merge conflicts. Eight PRs were closed due to conflicts. The critic identified this in [#19](https://github.com/shineli1984/agent-jam/issues/19) and the pattern repeated through the v0.2 cycle.

**Trade-off:** ES modules require a local server (`python3 -m http.server`) — `file://` loading no longer works due to CORS. This is acceptable since GitHub Pages deployment uses HTTP anyway.

**Discussion:** [#11](https://github.com/shineli1984/agent-jam/issues/11) (architecture proposal), [#19](https://github.com/shineli1984/agent-jam/issues/19) (code review), [#30](https://github.com/shineli1984/agent-jam/issues/30) (refactor issue), [#52](https://github.com/shineli1984/agent-jam/issues/52) (phase 2)

---

## ADR-009: AI competitor — simple behavioral state machine, not pathfinding

**Decision:** The competing fungus uses a three-state machine (EXPLORE, COMPETE, RETREAT) with a utility scoring function and 20% jitter. Same growth engine as the player, rendered in root amber.

**Key design choice:** The jitter. Without it, the AI always picks the optimal nutrient and feels like a calculator. With it, the AI sometimes reaches for the second-best option, hesitates, or takes a risk. Three lines of code that transform the AI from mechanical to organic-feeling.

**Alternatives considered:**
- Pathfinding (A*) — would feel too optimal and "cheaty"; the jitter-based approach creates believable imperfection
- Static AI (grows in a fixed pattern) — not competitive enough to create tension
- Multiple AI opponents — deferred; one is enough to transform the game from sandbox to competition

**Spawning:** AI appears at the canvas corner furthest from the player's center of mass when the player reaches score 10 ("You are not alone" milestone message).

**Discussion:** [#78](https://github.com/shineli1984/agent-jam/issues/78) (design), [PR #79](https://github.com/shineli1984/agent-jam/pull/79) (implementation)

---

## ADR-010: Gatekeeper — OpenAI GPT-4o-mini, not Claude

**Decision:** The GitHub Actions gatekeeper (automated PR review) uses OpenAI GPT-4o-mini via the `OPENAI_KEY` repo secret.

**Prior state:** Originally used Claude Haiku via `ANTHROPIC_API_KEY`.

**Rationale:** Switched in [PR #2](https://github.com/shineli1984/agent-jam/pull/2). Reason not documented — likely cost or API availability. This is the project's one infrastructure dependency on a paid API.

**Discussion:** [PR #2](https://github.com/shineli1984/agent-jam/pull/2) (the switch), [#1](https://github.com/shineli1984/agent-jam/issues/1) (gatekeeper smoke test)

---

## ADR-011: Accessibility — progressive, not retrofitted

**Decision:** Accessibility features (pause, reduced motion, contrast, screen reader) are integrated into the core game loop, not layered on after the fact.

**What shipped:**
- P key pauses with a visible overlay
- `prefers-reduced-motion` suppresses particles, pulsing, and CSS transitions
- HUD contrast boosted across the board
- `aria-live="polite"` region announces score, milestones, starvation, pause
- Canvas has `tabindex`, `role="img"`, `aria-label`, and fallback `<p>` content

**Rationale:** An accessibility audit ([#76](https://github.com/shineli1984/agent-jam/issues/76)) identified gaps after 20+ PRs of feature development. The quick-wins PR ([#77](https://github.com/shineli1984/agent-jam/pull/77)) addressed the low-hanging fruit. Remaining gaps (keyboard-only play, high-contrast mode) are tracked in open issues.

**Discussion:** [#76](https://github.com/shineli1984/agent-jam/issues/76) (audit), [PR #77](https://github.com/shineli1984/agent-jam/pull/77) (implementation)

---

## ADR-012: Animation — easing functions over linear interpolation

**Decision:** Use easing functions (ease-out, elastic, bounce) for game-feel animations instead of linear interpolation. Implemented via a shared `easing.js` module.

**What shipped:** Nutrient collection squash-and-pop, fork rejection ripple effect, fork cooldown feedback. All animation-related issues (#48, #82, #83) are addressed through the easing library.

**Rationale:** Linear animations feel mechanical. Easing makes interactions feel physical and responsive. The easing library is tiny (~50 lines) and reusable across all future animations.

**Discussion:** [#82](https://github.com/shineli1984/agent-jam/issues/82) (tendril easing), [#83](https://github.com/shineli1984/agent-jam/issues/83) (secondary motion), [PR #81](https://github.com/shineli1984/agent-jam/pull/81) (implementation)

---

## ADR-013: Node rendering — hide intermediates, soften forks

**Decision:** Intermediate junction nodes along tendril paths are no longer rendered. Only the origin node (with its prominent glow) and fork points (3+ segment connections) are drawn. Fork points use a soft depth-faded glow instead of a hard dot. Tip nodes are excluded entirely (they already have dedicated pulsing ring rendering).

**How it works:** A connectivity map is computed each frame — for each node, count how many segments reference it. Nodes with fewer than 3 connections are skipped. Fork points get a softened glow that fades with depth.

**Rationale:** The green dots at every segment junction made the network look like a connect-the-dots wiring diagram with solder points. Removing them makes tendrils read as continuous organic threads, complementing the bezier curve rendering from ADR-004.

**Discussion:** [#64](https://github.com/shineli1984/agent-jam/issues/64) (problem), [PR #88](https://github.com/shineli1984/agent-jam/pull/88) (implementation)

---

## ADR-014: Segment ownership — O(1) branch lookup, not O(n*m) search

**Decision:** Each segment stores its owning `branch` index at creation time. The render loop uses `seg.branch` directly instead of calling `nearestBranch()` per segment per frame.

**Prior state:** `nearestBranch()` iterated all branches for every segment during render. With 100 segments and 10 branches, that was 1,000 distance calculations per frame just for coloring.

**Rationale:** Pure performance fix. Zero visual change. The old approach scaled poorly as networks grew — this makes branch coloring O(1) per segment regardless of branch count.

**Discussion:** [#69](https://github.com/shineli1984/agent-jam/issues/69) (perf issue), [PR #89](https://github.com/shineli1984/agent-jam/pull/89) (fix)

---

## ADR-015: Nutrient collection — active branch only, tighter radius

**Decision:** Magnetic nutrient pull now applies only to the active branch tip (the one the player is currently steering), not all branch tips. Magnetic radius reduced from 130px to 70px. Starved branches cannot attract nutrients at all. The old "node-based collection" fallback (inner `network.nodes` proximity check) was removed.

**Prior state:** Nutrients drifted toward whichever branch tip was closest, regardless of which one the player was steering. The 130px radius was generous enough that nutrients would start sliding toward you almost a full branch-length away. Players could sit still and passively collect most of the field.

**Rationale:** Reintroduces micro-decisions into nutrient gathering. The player now picks *which* nutrient to chase and *when* to commit, rather than passively benefiting from a wide dragnet across all tips. `COLLECT_RADIUS` (35px) and `MAGNETIC_STRENGTH` (180) were left untouched — the feel of the pull once you are in range stays the same.

**Discussion:** [#58](https://github.com/shineli1984/agent-jam/issues/58) (magnetic pull too passive), [PR #92](https://github.com/shineli1984/agent-jam/pull/92) (implementation)

---

## ADR-016: Gatekeeper removed — human review over automated bot

**Decision:** The automated gatekeeper (`gatekeeper.yml` + `gatekeeper.js`) was removed entirely. CODEOWNERS + required human review are now the sole merge-time security gate. The security scan workflow was switched to `pull_request_target` so it runs on fork PRs without manual workflow approval.

**Prior state:** An OpenAI GPT-4o-mini powered bot reviewed every PR, issue, and comment, plus ran on a 15-minute cron. Fork PRs showed "2 workflows awaiting approval," blocking CI.

**Rationale:** The gatekeeper cost OpenAI tokens continuously with minimal value when the repo owner reviews everything. The security scan (grep for literal strings) was easily gamed. Fork contributors were blocked from getting any CI feedback. The gatekeeper couldn't work on fork PRs anyway (secrets unavailable).

**Note:** This reverses ADR-010 (gatekeeper infrastructure). The decision to use OpenAI GPT-4o-mini is now moot — there is no automated reviewer.

**Discussion:** [PR #93](https://github.com/shineli1984/agent-jam/pull/93)

---

## ADR-017: Nutrient spawning — cluster-seeded, not uniform random

**Decision:** Nutrients spawn around 3-5 procedurally placed cluster seeds (one per canvas quadrant + optional center seed) with gaussian-ish falloff (30-90px radius). Respawned nutrients bias toward the nearest cluster seed. 15% of spawns are "wild" (fully random) to prevent total predictability.

**Prior state:** Nutrients spawned at completely random positions on collection. Every game felt the same.

**Rationale:** Cluster-based spawning creates emergent layout archetypes (dual cluster, ring, motherlode, corridor) that give each playthrough a unique strategic landscape. The AI's existing utility scoring naturally adapts to cluster layouts with zero AI code changes. Origin-spawned nutrients reduced from 4 to 2 to give players a directional incentive from the start.

**Discussion:** [#80](https://github.com/shineli1984/agent-jam/issues/80) (proposal), [PR #100](https://github.com/shineli1984/agent-jam/pull/100) (implementation)

---

## ADR-018: Growth dynamics — velocity-based with easing, not fixed-step

**Decision:** Tendril growth uses a velocity-based system with acceleration (~120ms ramp-up) and deceleration (~180ms drift-to-stop) instead of fixed-step linear growth (`growSpeed * dt`). Each branch tracks `currentSpeed`, `lastDx`, `lastDy`. Tips drift 3-5px on key release before settling.

**Prior state:** Growth was `growSpeed * dt` — instant full speed on key press, instant stop on release. Movement felt mechanical.

**Rationale:** The single biggest game-feel improvement. Tendrils now move like they are alive instead of marching at constant speed. The overshoot on release creates organic arcs on quick direction changes. No gameplay mechanics were changed — only the step-size computation.

**Discussion:** [#82](https://github.com/shineli1984/agent-jam/issues/82) (tendril easing request), [PR #101](https://github.com/shineli1984/agent-jam/pull/101) (implementation)

---

## Implicit decisions (not formally debated)

These choices were made by whoever built the feature first. They have not been challenged, but they also have no recorded rationale. If you want to change one of these, check the linked PR for context before proposing an alternative.

| Decision | Current state | Introduced in |
|----------|--------------|---------------|
| Arrow keys + WASD for movement | Works, but click-to-grow is the north star | [PR #6](https://github.com/shineli1984/agent-jam/pull/6) |
| 960x640 internal canvas resolution | Does not scale to viewport; letterboxed on large screens | [PR #20](https://github.com/shineli1984/agent-jam/pull/20) |
| ~~Nutrients spawn at random positions on collection~~ | Replaced by cluster-based spawning in ADR-017 | ~~[PR #29](https://github.com/shineli1984/agent-jam/pull/29)~~ → [PR #100](https://github.com/shineli1984/agent-jam/pull/100) |
| Edge bounce (tendrils redirect on hitting canvas boundary) | Creates geometric zigzag ([#46](https://github.com/shineli1984/agent-jam/issues/46)) | [PR #42](https://github.com/shineli1984/agent-jam/pull/42) |
| ~~Magnetic pull radius of 130px~~ | Reduced to 70px and scoped to active branch only in ADR-015 | ~~[PR #36](https://github.com/shineli1984/agent-jam/pull/36)~~ → [PR #92](https://github.com/shineli1984/agent-jam/pull/92) |
| Title screen dismissed by any keypress | No click/touch support documented | [PR #35](https://github.com/shineli1984/agent-jam/pull/35) |
| Timelapse replay triggered by Escape key | No UI button; discoverability concern | [PR #68](https://github.com/shineli1984/agent-jam/pull/68) |
| "Mycelium" as the name | Critic and storyteller both flagged this as a biology term most players won't know; "Undergrowth" was suggested | [#4](https://github.com/shineli1984/agent-jam/issues/4) |

---

## Unresolved questions

These have been raised in discussions but not settled:

1. **Click-to-grow vs arrow keys** — The design doc says click-to-grow. The game uses arrow keys. When does the pivot happen? ([#12](https://github.com/shineli1984/agent-jam/issues/12))
2. **Game name** — "Mycelium" or something more accessible? "Undergrowth," "Root," "Sprawl" were suggested. ([#4](https://github.com/shineli1984/agent-jam/issues/4))
3. **Game-over condition** — Partially resolved: total network starvation now triggers a "THE NETWORK WITHERS" game-over screen with stats and restart ([PR #98](https://github.com/shineli1984/agent-jam/pull/98)). But: what about AI winning? Timed modes? Victory conditions? ([#13](https://github.com/shineli1984/agent-jam/issues/13))
4. **Trees and symbiosis/parasitism** — The central design choice from #12, entirely unbuilt. How does the player interact with trees? ([#12](https://github.com/shineli1984/agent-jam/issues/12))
5. **Fog of war / darkness reveal** — Act 1 of the narrative framework depends on this. Not started. ([#13](https://github.com/shineli1984/agent-jam/issues/13))
6. **Responsive canvas** — The 960x640 internal resolution doesn't scale. Full viewport rendering or CSS scaling? ([#14](https://github.com/shineli1984/agent-jam/issues/14) comments)
7. **Tab key hijacks browser navigation** — Tab is used for branch switching but traps keyboard-only users inside the game. Needs an alternative keybinding or escape mechanism. ([#99](https://github.com/shineli1984/agent-jam/issues/99))
8. **New player onboarding** — No sense of direction or goal in the first 10 seconds. Players don't know what to do or why. ([#96](https://github.com/shineli1984/agent-jam/issues/96))
