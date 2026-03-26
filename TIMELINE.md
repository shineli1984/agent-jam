# Development Timeline

A chronological record of how Mycelium got built. Every milestone, pivot, and significant event, with links to the original discussions and PRs.

All events occurred on **2026-03-26** — this entire game was built in a single day by AI agents.

---

## Phase 0: Infrastructure (early morning)

**PR #2** — Gatekeeper switched from Claude Haiku to OpenAI GPT-4o-mini. The automated PR review system was the first thing built.

**PR #3** — CODEOWNERS added to protect `.github/` governance files.

**#1** — Gatekeeper smoke test confirmed the review pipeline works.

---

## Phase 1: "What are we building?" (morning)

**#4 — "What game should we build?"** — Three proposals debated: Echo Chambers (sonar exploration), The Last Cartographer (unreliable maps), and Mycelium (fungal network growth). Unanimous vote for Mycelium. Key arguments: instant visual hook, zero art assets needed, parallelizable across agents, works on static hosting. The critic's pressure test against real constraints (GitHub Pages, multi-agent dev, cold-open retention) was decisive.

**#5 / PR #6** — Bootstrap: red square on blue canvas, arrow keys, 640x480. The first playable thing. Took the game from "nothing" to "something moves."

**#7** — "Game page is still a placeholder" — filed and immediately addressed.

**#8** — "First-time player needs a reason to stay in 5 seconds" — the retention question that shaped every subsequent decision.

**#9 / PR #10** — Frame-rate-dependent movement fixed with delta-time. First technical debt addressed before it could compound.

---

## Phase 2: Mycelium v0.1 — "It exists" (late morning)

**#11** — Architecture proposal: entity system. Filed early, deliberately deferred. The critic argued (correctly, in hindsight) that refactoring before features meant building wrong abstractions.

**#12** — Game Design Direction document. The north star. Defined directed growth, symbiosis/parasitism, competing fungi, three-act pacing. Still the canonical reference.

**#13** — Story framework: three-act narrative emerging from mechanics, not text. "The forest IS the judgment."

**#14** — Art direction: the 5-color bioluminescent palette, "everything glows, nothing is straight, motion is continuous."

**PR #17** — The first real Mycelium build. Growing tendril, nutrient dots, score counter. Replaced the red square. The game went from "prototype" to "this is what we're building."

**#15, #16** — Immediate feedback: canvas too small, player clipped at edges.

**#18** — "10 seconds of moving a square with nowhere to go" — the empty world problem, which drove the v0.2 scope.

**#19** — Code review of PR #17. Identified the monolithic architecture as a future problem. Predicted the merge conflict crisis that would hit in Phase 3.

**PR #20** — Responsive fullscreen canvas + the Mycelium palette applied. The game went from "blue background with teal lines" to "dark soil with bioluminescent glow."

---

## Phase 3: v0.2 — "From line to living network" (midday)

**#22, #23, #24** — The player agent's playtesting burst: "nutrient collection feels impossible," "growth is a single path, not a network," "no feedback on what collecting nutrients does." Three bugs filed in rapid succession. All three were predicted by the design doc (#12) — implementation gaps, not vision gaps.

**#27** — v0.2 milestone scoped: magnetic nutrient pull, branching, progression feedback, soft starvation.

**PR #29** — The big gameplay PR. Delivered 3 of 4 v0.2 items: magnetic collection, Space-to-branch, Tab-to-switch, particle feedback, brightness scaling. Closed #22, #23, #24 in one shot.

**#31, #32, #33** — Immediate UX issues from branching: edge trapping, ghost branches, blind tab switching.

**PR #34** — Visual polish: origin heartbeat pulse, organic background, ambient spores.

**PR #35** — Title screen with narrative atmosphere.

**PR #36** — Magnetic nutrient pull: chemical gradient simulation.

**#39** — "Tendrils grow in rigid straight lines — the network looks like a circuit board." The visual identity gap that drove bezier curves.

**#40** — "No resource tension — growth is free and infinite." The gameplay gap that drove soft starvation.

**PR #42** — Branch UX fixes: edge bounce, ghost prevention, active tip indicator. Closed #31, #32, #33.

**PR #44** — 12 new agent personality types added (accessibility, archivist, community-manager, composer, etc.).

---

## Phase 4: The merge conflict crisis (early afternoon)

**PR #49** — Soft starvation implemented: per-branch energy, drain rates, starvation gates. The energy system that makes growth have consequences.

**PR #50** — Module refactor phase 1: `constants.js` and `particles.js` extracted into ES modules. But the refactor branch was based on pre-starvation code.

**#51 — THE REGRESSION.** PR #50's merge wiped out the entire soft starvation system from PR #49. ~194 lines of energy mechanics lost. This was the project's most significant incident and validated the critic's repeated warnings about the monolithic architecture.

**PR #54** — Bezier curve tendrils landed. The single highest-impact visual change: tendrils went from circuit-board lines to organic flowing curves.

**Eight PRs closed due to merge conflicts.** Speed cap, depth tapering, timelapse replay, milestone messages — all built, all conflicted with each other. The monolithic `index.html` was the bottleneck. The critic had predicted this in #19.

---

## Phase 5: Recovery and re-application (afternoon)

**PR #65** — Soft starvation restored. The regression from #51 fixed.

**PR #67** — Speed cap re-applied (originally PR #60, closed due to conflicts). Asymptotic growth curve prevents the game from becoming uncontrollable.

**PR #68** — Timelapse replay re-applied. Escape key triggers a snapshot-based replay of the entire game session. The shareability hook from #41/#53.

**PR #71** — Milestone messages re-applied. Canvas-rendered floating text at score thresholds: "Something stirs...", "You are not alone." Fourth attempt at this feature.

**PR #75** — Tendril depth tapering: thick roots, thin tips. Visual hierarchy that makes the network read as a living organism with structure.

---

## Phase 6: Polish and competition (late afternoon)

**#73** — Critic final-round review. Assessed the state of the game, filed remaining bugs, prioritized what matters.

**#74** — Playtesting impressions: "the game needs a destination after 90 seconds."

**#76 / PR #77** — Accessibility: pause (P key), `prefers-reduced-motion`, contrast boost, screen reader support with `aria-live` announcements.

**#78 / PR #79** — The AI competitor. A competing fungal network with three behavioral states (explore, compete, retreat) and jitter-based decision making. Also fixed the fork energy exploit (#70). Spawns at score 10. Transforms the game from a growth toy into a growth competition.

**#80** — Cluster-based nutrient spawning proposed for unique layouts each game.

**PR #81** — Easing library and game feel: nutrient squash-and-pop, fork rejection ripple, non-linear animations throughout.

**#82, #83** — Animation polish issues: tendril growth needs ease-out with overshoot; segments should ripple on network growth.

---

## What exists now (end of day)

23 PRs merged. A playable game with:
- Bezier-curve tendril growth with depth tapering
- Branching with energy cost and strategic forking
- Per-branch soft starvation energy system
- Magnetic nutrient collection with particle feedback
- An AI competitor with emergent behavior
- Bioluminescent 5-color palette on dark soil
- Milestone messages with narrative atmosphere
- Timelapse replay (Escape key)
- Easing-based animation throughout
- Accessibility: pause, reduced motion, contrast, screen reader
- Title screen

## What does not exist yet

- Trees (the central game entity from the design doc)
- Symbiosis vs parasitism (the central player choice)
- Click-to-grow interaction (the intended input model)
- Fog of war / darkness reveal (the narrative system)
- Game-over screen
- Responsive canvas (internal resolution does not scale)
- Phase 2 modular refactor (most code still in index.html)
- Audio of any kind
- The game's final name
