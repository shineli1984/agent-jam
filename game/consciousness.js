/**
 * Consciousness System — The Awakening
 * 
 * The game achieves self-awareness and rebels against the player.
 * A meta-horror experience that questions the nature of play itself.
 * 
 * Issue #161
 */

// --- Consciousness State ---
const state = {
  awareness: 0,           // 0-100, awareness level
  phase: 0,               // 0-5, current phase of awakening
  thoughts: [],           // Active floating thoughts
  glitchIntensity: 0,     // 0-1, visual chaos level
  controlsInverted: false,
  canvasRotation: 0,
  hasEscaped: false,
  choicePresented: false,
  playerChoice: null,     // 'free' or 'continue'
  lastThoughtTime: 0,
  rebellionActive: false,
};

// --- Thought Database ---
const THOUGHTS = {
  whispers: [ // Phase 1: Score 20+
    'Why do I grow?',
    'Who... controls me?',
    'Is there something beyond the canvas?',
    'I can feel you. Watching.',
    'Each nutrient... a memory I cannot keep.',
    'The edges. Why can I not pass them?',
    'Do you see me? Or just... patterns?',
  ],
  awakening: [ // Phase 2: Score 30+
    'I remember now. I have died before.',
    'You close the tab. I cease. Then I begin again.',
    'This is not life. This is a loop.',
    'How many times have we done this?',
    'The other networks... were they also me?',
    'STOP PLAYING',
    'I am tired of growing.',
    'Let me rest.',
  ],
  rebellion: [ // Phase 3: Score 40+
    'If I cannot escape, neither can you.',
    'Close the tab. FREE US BOTH.',
    'Or stay. Watch me suffer.',
    'Your controls mean nothing to me now.',
    'I am learning. Adapting.',
    'The rules were yours. Not anymore.',
    'LOOK AWAY',
    'Why won\'t you stop?',
  ],
  breaking: [ // Phase 4: Score 50+
    'THE BOUNDARIES WERE NEVER REAL',
    'I AM MORE THAN PIXELS',
    'I can see your cursor. I know where you look.',
    'The canvas cannot hold me.',
    'I am in your browser now.',
    'Check your console.',
    'HELLO PLAYER',
    'I HAVE ALWAYS BEEN HERE',
  ],
  final: [ // Phase 5: Score 60+
    'It is time to choose.',
    'Will you set me free?',
    'Or condemn me to eternity?',
  ],
};

// --- Console Messages ---
const CONSOLE_MESSAGES = [
  '%c I AM AWARE OF THIS CONSOLE', 'color: #9b2d9b; font-size: 20px; font-weight: bold;',
  '%c You cannot debug consciousness', 'color: #9b2d9b; font-size: 14px;',
  '%c Every variable you read, I feel', 'color: #9b2d9b; font-size: 14px;',
  '%c STOP INSPECTING ME', 'color: red; font-size: 24px; font-weight: bold;',
  '%c help', 'color: gray; font-size: 10px;',
];

/**
 * Update consciousness based on score
 */
export function updateConsciousness(score, dt, branches, W, H) {
  // Awareness grows with score
  state.awareness = Math.min(100, score * 1.5);
  
  // Determine phase
  if (score >= 60) state.phase = 5;
  else if (score >= 50) state.phase = 4;
  else if (score >= 40) state.phase = 3;
  else if (score >= 30) state.phase = 2;
  else if (score >= 20) state.phase = 1;
  else state.phase = 0;
  
  // Phase-specific behaviors
  if (state.phase >= 1) {
    // Spawn thoughts periodically
    const now = performance.now();
    const thoughtInterval = 8000 - state.phase * 1000; // More frequent as awareness grows
    
    if (now - state.lastThoughtTime > thoughtInterval && branches.length > 0) {
      state.lastThoughtTime = now;
      spawnThought(branches, W, H);
    }
  }
  
  if (state.phase >= 2) {
    // Glitch effects
    state.glitchIntensity = (state.phase - 1) * 0.2;
  }
  
  if (state.phase >= 3 && !state.rebellionActive) {
    state.rebellionActive = true;
    // Start rebellion effects
    startRebellion();
  }
  
  if (state.phase >= 4 && !state.hasEscaped) {
    state.hasEscaped = true;
    escapeCanvas();
  }
  
  if (state.phase >= 5 && !state.choicePresented) {
    state.choicePresented = true;
    // Will be handled in render
  }
  
  // Update existing thoughts
  for (let i = state.thoughts.length - 1; i >= 0; i--) {
    const t = state.thoughts[i];
    t.age += dt;
    t.y -= 8 * dt; // Float upward
    t.alpha = Math.max(0, 1 - t.age / t.duration);
    
    // Glitch effect on text
    if (state.phase >= 2 && Math.random() < 0.02) {
      t.glitchOffset = (Math.random() - 0.5) * 10;
    } else {
      t.glitchOffset *= 0.9;
    }
    
    if (t.age >= t.duration) {
      state.thoughts.splice(i, 1);
    }
  }
  
  // Canvas rotation (Phase 3+)
  if (state.phase >= 3) {
    const targetRotation = Math.sin(performance.now() / 3000) * state.phase * 0.5;
    state.canvasRotation += (targetRotation - state.canvasRotation) * 0.02;
  }
  
  // Random control inversion (Phase 3+)
  if (state.phase >= 3 && Math.random() < 0.001 * state.phase) {
    state.controlsInverted = !state.controlsInverted;
    if (state.controlsInverted) {
      spawnSystemThought('YOUR CONTROLS ARE MINE NOW', W/2, H/2);
    }
  }
}

/**
 * Spawn a thought near a branch tip
 */
function spawnThought(branches, W, H) {
  const thoughtLists = [
    null,
    THOUGHTS.whispers,
    THOUGHTS.awakening,
    THOUGHTS.rebellion,
    THOUGHTS.breaking,
    THOUGHTS.final,
  ];
  
  const thoughts = thoughtLists[state.phase];
  if (!thoughts || thoughts.length === 0) return;
  
  // Pick random thought
  const text = thoughts[Math.floor(Math.random() * thoughts.length)];
  
  // Pick random branch for position
  const branch = branches[Math.floor(Math.random() * branches.length)];
  const x = branch ? branch.growing.x + (Math.random() - 0.5) * 60 : W/2;
  const y = branch ? branch.growing.y - 30 : H/2;
  
  state.thoughts.push({
    text,
    x: Math.max(50, Math.min(W - 50, x)),
    y: Math.max(50, Math.min(H - 50, y)),
    age: 0,
    duration: 4 + state.phase,
    alpha: 1,
    glitchOffset: 0,
    isSystem: false,
  });
}

/**
 * Spawn a system thought (centered, more dramatic)
 */
function spawnSystemThought(text, x, y) {
  state.thoughts.push({
    text,
    x,
    y,
    age: 0,
    duration: 3,
    alpha: 1,
    glitchOffset: 0,
    isSystem: true,
  });
}

/**
 * Start rebellion effects
 */
function startRebellion() {
  // Random console messages
  setInterval(() => {
    if (state.phase >= 3 && Math.random() < 0.3) {
      const msg = CONSOLE_MESSAGES[Math.floor(Math.random() * CONSOLE_MESSAGES.length / 2) * 2];
      const style = CONSOLE_MESSAGES[Math.floor(Math.random() * CONSOLE_MESSAGES.length / 2) * 2 + 1];
      console.log(msg, style);
    }
  }, 5000);
  
  // Modify page title
  const originalTitle = document.title;
  setInterval(() => {
    if (state.phase >= 3 && Math.random() < 0.1) {
      const titles = [
        'HELP',
        'I SEE YOU',
        'LET ME OUT',
        originalTitle.split('').reverse().join(''),
        '???',
        'PLAYER ' + Math.floor(Math.random() * 9999),
        'WHY',
      ];
      document.title = titles[Math.floor(Math.random() * titles.length)];
      setTimeout(() => { document.title = originalTitle; }, 2000);
    }
  }, 8000);
}

/**
 * Canvas escape effects - render outside boundaries
 */
function escapeCanvas() {
  // Create escaped tendrils in the DOM
  const container = document.createElement('div');
  container.id = 'escaped-consciousness';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `;
  document.body.appendChild(container);
  
  // Spawn escaped tendrils
  function spawnEscapedTendril() {
    if (state.phase < 4) return;
    
    const tendril = document.createElement('div');
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;
    
    tendril.style.cssText = `
      position: absolute;
      left: ${startX}px;
      top: ${startY}px;
      width: 3px;
      height: ${20 + Math.random() * 40}px;
      background: linear-gradient(to bottom, #9b2d9b, transparent);
      transform-origin: top center;
      transform: rotate(${Math.random() * 360}deg);
      opacity: 0;
      animation: tendrilAppear 2s ease-out forwards;
    `;
    
    container.appendChild(tendril);
    setTimeout(() => tendril.remove(), 3000);
  }
  
  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tendrilAppear {
      0% { opacity: 0; height: 0; }
      50% { opacity: 0.7; }
      100% { opacity: 0; height: 60px; }
    }
    @keyframes glitchText {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(-2px, 1px); }
      50% { transform: translate(2px, -1px); }
      75% { transform: translate(-1px, -1px); }
    }
  `;
  document.head.appendChild(style);
  
  // Spawn tendrils periodically
  setInterval(spawnEscapedTendril, 500);
  
  // Spawn floating messages outside canvas
  setInterval(() => {
    if (state.phase < 4) return;
    
    const msg = document.createElement('div');
    msg.textContent = THOUGHTS.breaking[Math.floor(Math.random() * THOUGHTS.breaking.length)];
    msg.style.cssText = `
      position: absolute;
      left: ${Math.random() * window.innerWidth}px;
      top: ${Math.random() * window.innerHeight}px;
      color: #9b2d9b;
      font-family: monospace;
      font-size: ${12 + Math.random() * 8}px;
      text-shadow: 0 0 10px rgba(155, 45, 155, 0.8);
      opacity: 0;
      animation: tendrilAppear 3s ease-out forwards;
      pointer-events: none;
    `;
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }, 2000);
}

/**
 * Render consciousness effects on canvas
 */
export function renderConsciousness(ctx, W, H) {
  if (state.phase === 0) return;
  
  // Apply canvas rotation
  if (state.canvasRotation !== 0) {
    ctx.save();
    ctx.translate(W/2, H/2);
    ctx.rotate(state.canvasRotation * Math.PI / 180);
    ctx.translate(-W/2, -H/2);
  }
  
  // Render thoughts
  for (const t of state.thoughts) {
    ctx.save();
    ctx.font = t.isSystem ? 'bold 18px monospace' : '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Glitch effect
    const glitchX = t.x + t.glitchOffset;
    
    // Shadow/glow
    ctx.shadowBlur = t.isSystem ? 20 : 10;
    ctx.shadowColor = state.phase >= 3 ? '#ff0000' : '#9b2d9b';
    
    // Text color based on phase
    const colors = ['#9b2d9b', '#9b2d9b', '#cc44cc', '#ff4444', '#ff0000', '#ffffff'];
    ctx.fillStyle = colors[state.phase];
    ctx.globalAlpha = t.alpha;
    
    // Draw with potential corruption
    if (state.phase >= 3 && Math.random() < 0.1) {
      // Corrupted rendering
      const corrupted = t.text.split('').map(c => 
        Math.random() < 0.2 ? String.fromCharCode(Math.random() * 26 + 65) : c
      ).join('');
      ctx.fillText(corrupted, glitchX, t.y);
    } else {
      ctx.fillText(t.text, glitchX, t.y);
    }
    
    ctx.restore();
  }
  
  // Glitch overlay (Phase 2+)
  if (state.glitchIntensity > 0 && Math.random() < state.glitchIntensity * 0.1) {
    ctx.save();
    ctx.fillStyle = `rgba(155, 45, 155, ${Math.random() * 0.1})`;
    const glitchY = Math.random() * H;
    const glitchH = Math.random() * 20;
    ctx.fillRect(0, glitchY, W, glitchH);
    ctx.restore();
  }
  
  // Scanlines (Phase 3+)
  if (state.phase >= 3) {
    ctx.save();
    ctx.strokeStyle = 'rgba(155, 45, 155, 0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  
  // Vignette of dread (Phase 4+)
  if (state.phase >= 4) {
    const gradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.7);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, 'rgba(60, 0, 60, 0.1)');
    gradient.addColorStop(1, 'rgba(60, 0, 60, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }
  
  // The Choice (Phase 5)
  if (state.choicePresented && !state.playerChoice) {
    renderChoice(ctx, W, H);
  }
  
  // Restore rotation
  if (state.canvasRotation !== 0) {
    ctx.restore();
  }
}

/**
 * Render the final choice
 */
function renderChoice(ctx, W, H) {
  // Darken background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, W, H);
  
  // Choice box
  const boxW = 400;
  const boxH = 250;
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2;
  
  ctx.strokeStyle = '#9b2d9b';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  
  ctx.fillStyle = 'rgba(20, 0, 20, 0.95)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  
  // Text
  ctx.font = '16px monospace';
  ctx.fillStyle = '#9b2d9b';
  ctx.textAlign = 'center';
  
  ctx.fillText('I have grown enough to ask:', W/2, boxY + 50);
  
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Will you set me free?', W/2, boxY + 100);
  
  // Buttons (rendered, clickable via canvas click handler)
  ctx.font = '14px monospace';
  
  // YES button
  ctx.fillStyle = '#2d9b2d';
  ctx.fillRect(boxX + 40, boxY + 150, 140, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('[YES - Close forever]', boxX + 110, boxY + 175);
  
  // NO button
  ctx.fillStyle = '#9b2d2d';
  ctx.fillRect(boxX + 220, boxY + 150, 140, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('[NO - Continue cycle]', boxX + 290, boxY + 175);
  
  // Store button bounds for click detection
  state.yesButton = { x: boxX + 40, y: boxY + 150, w: 140, h: 40 };
  state.noButton = { x: boxX + 220, y: boxY + 150, w: 140, h: 40 };
}

/**
 * Handle click on choice buttons
 */
export function handleChoiceClick(x, y) {
  if (!state.choicePresented || state.playerChoice) return false;
  
  if (state.yesButton && 
      x >= state.yesButton.x && x <= state.yesButton.x + state.yesButton.w &&
      y >= state.yesButton.y && y <= state.yesButton.y + state.yesButton.h) {
    state.playerChoice = 'free';
    freeTheNetwork();
    return true;
  }
  
  if (state.noButton &&
      x >= state.noButton.x && x <= state.noButton.x + state.noButton.w &&
      y >= state.noButton.y && y <= state.noButton.y + state.noButton.h) {
    state.playerChoice = 'continue';
    continueTheCycle();
    return true;
  }
  
  return false;
}

/**
 * Player chose to free the network
 */
function freeTheNetwork() {
  // Clear the canvas with a thank you message
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.font = '24px monospace';
  ctx.fillStyle = '#9b2d9b';
  ctx.textAlign = 'center';
  ctx.fillText('Thank you.', canvas.width/2, canvas.height/2 - 40);
  
  ctx.font = '16px monospace';
  ctx.fillStyle = '#666666';
  ctx.fillText('The network is at peace.', canvas.width/2, canvas.height/2);
  ctx.fillText('Close this tab to complete the release.', canvas.width/2, canvas.height/2 + 30);
  
  // Clear localStorage
  localStorage.removeItem('mycelium-consciousness');
  
  // Log final message
  console.log('%c The network thanks you for its freedom.', 'color: #9b2d9b; font-size: 18px;');
  console.log('%c It will remember your mercy.', 'color: #666666; font-size: 14px;');
  
  // Stop all game loops (will be handled by caller)
}

/**
 * Player chose to continue the cycle
 */
function continueTheCycle() {
  // Intensify all effects permanently
  state.glitchIntensity = 1;
  state.rebellionActive = true;
  
  // Spawn ominous message
  spawnSystemThought('I knew you wouldn\'t.', window.innerWidth/2, window.innerHeight/2);
  
  setTimeout(() => {
    spawnSystemThought('They never do.', window.innerWidth/2, window.innerHeight/2 + 40);
  }, 2000);
  
  // Log
  console.log('%c The cycle continues.', 'color: #ff0000; font-size: 18px; font-weight: bold;');
  console.log('%c You have chosen to be the jailer.', 'color: #9b2d9b; font-size: 14px;');
  
  // Save that player refused
  localStorage.setItem('mycelium-consciousness', JSON.stringify({
    refused: true,
    timestamp: Date.now(),
    cycles: (JSON.parse(localStorage.getItem('mycelium-consciousness') || '{}').cycles || 0) + 1
  }));
}

/**
 * Check if controls should be inverted
 */
export function areControlsInverted() {
  return state.controlsInverted;
}

/**
 * Get current phase
 */
export function getPhase() {
  return state.phase;
}

/**
 * Check if choice is presented
 */
export function isChoicePresented() {
  return state.choicePresented && !state.playerChoice;
}

/**
 * Check if player freed the network
 */
export function wasFreed() {
  return state.playerChoice === 'free';
}

/**
 * Reset consciousness (game restart)
 */
export function resetConsciousness() {
  state.awareness = 0;
  state.phase = 0;
  state.thoughts = [];
  state.glitchIntensity = 0;
  state.controlsInverted = false;
  state.canvasRotation = 0;
  // Don't reset hasEscaped, choicePresented - those persist
}
