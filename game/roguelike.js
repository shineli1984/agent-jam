/**
 * SPORECRAWL - A Roguelike Dungeon Crawler
 * 
 * Completely replaces Mycelium's gameplay.
 * Turn-based dungeon exploration with procedural generation.
 * 
 * Issue #166
 */

// --- Constants ---
const TILE_SIZE = 20;
const MAP_WIDTH = 48;
const MAP_HEIGHT = 32;

const TILES = {
  WALL: '#',
  FLOOR: '.',
  DOOR: '+',
  STAIRS: '>',
  PLAYER: '@',
};

const COLORS = {
  wall: '#1a2a1a',
  wallGlow: '#2a3a2a',
  floor: '#0a1a0a',
  floorExplored: '#0d1d0d',
  player: '#b8e986',
  playerGlow: 'rgba(184, 233, 134, 0.6)',
  enemy: '#9b2d9b',
  enemyGlow: 'rgba(155, 45, 155, 0.5)',
  item: '#f4d35e',
  itemGlow: 'rgba(244, 211, 94, 0.5)',
  stairs: '#4a9eff',
  door: '#c47335',
  fog: '#050a05',
  hp: '#ff4444',
  hpBg: '#442222',
};

// --- Game State ---
let gameState = {
  map: [],
  explored: [],
  visible: [],
  player: null,
  enemies: [],
  items: [],
  floor: 1,
  turns: 0,
  messages: [],
  gameOver: false,
  victory: false,
};

// --- Player ---
function createPlayer(x, y) {
  return {
    x, y,
    hp: 100,
    maxHp: 100,
    atk: 5,
    def: 2,
    inventory: {
      potions: 3,
      spores: 2,
      keys: 0,
    },
    xp: 0,
    level: 1,
  };
}

// --- Enemies ---
const ENEMY_TYPES = {
  rat: { char: 'r', name: 'Rat', hp: 8, atk: 2, def: 0, xp: 5, color: '#888888' },
  bat: { char: 'b', name: 'Bat', hp: 12, atk: 3, def: 0, xp: 8, color: '#aa88ff' },
  spider: { char: 's', name: 'Spider', hp: 15, atk: 4, def: 1, xp: 12, color: '#444444' },
  skeleton: { char: 'S', name: 'Skeleton', hp: 25, atk: 5, def: 2, xp: 20, color: '#dddddd' },
  zombie: { char: 'Z', name: 'Zombie', hp: 40, atk: 3, def: 3, xp: 25, color: '#55aa55' },
  demon: { char: 'D', name: 'Demon', hp: 80, atk: 8, def: 4, xp: 100, color: '#ff4444' },
};

function createEnemy(x, y, type) {
  const template = ENEMY_TYPES[type];
  return {
    x, y,
    type,
    ...template,
    currentHp: template.hp,
  };
}

// --- Items ---
const ITEM_TYPES = {
  potion: { char: '!', name: 'Health Potion', color: '#ff6666', effect: 'heal' },
  sword: { char: '/', name: 'Sword', color: '#aaaaaa', effect: 'atk', value: 2 },
  shield: { char: '[', name: 'Shield', color: '#6666ff', effect: 'def', value: 1 },
  spore: { char: '*', name: 'Spore', color: '#88ff88', effect: 'spore' },
  key: { char: 'k', name: 'Key', color: '#ffff00', effect: 'key' },
};

function createItem(x, y, type) {
  const template = ITEM_TYPES[type];
  return { x, y, type, ...template };
}

// --- Dungeon Generation (BSP) ---
function generateDungeon(floor) {
  // Initialize map with walls
  const map = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      map[y][x] = TILES.WALL;
    }
  }
  
  // BSP room generation
  const rooms = [];
  const MIN_ROOM_SIZE = 5;
  const MAX_ROOM_SIZE = 10;
  const NUM_ROOMS = 8 + floor * 2;
  
  for (let i = 0; i < NUM_ROOMS * 3; i++) {
    const w = MIN_ROOM_SIZE + Math.floor(Math.random() * (MAX_ROOM_SIZE - MIN_ROOM_SIZE));
    const h = MIN_ROOM_SIZE + Math.floor(Math.random() * (MAX_ROOM_SIZE - MIN_ROOM_SIZE));
    const x = 1 + Math.floor(Math.random() * (MAP_WIDTH - w - 2));
    const y = 1 + Math.floor(Math.random() * (MAP_HEIGHT - h - 2));
    
    // Check overlap
    let overlaps = false;
    for (const room of rooms) {
      if (x < room.x + room.w + 1 && x + w + 1 > room.x &&
          y < room.y + room.h + 1 && y + h + 1 > room.y) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      rooms.push({ x, y, w, h, cx: Math.floor(x + w/2), cy: Math.floor(y + h/2) });
      
      // Carve room
      for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
          map[ry][rx] = TILES.FLOOR;
        }
      }
      
      if (rooms.length >= NUM_ROOMS) break;
    }
  }
  
  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    
    // L-shaped corridor
    if (Math.random() < 0.5) {
      carveHorizontalCorridor(map, prev.cx, curr.cx, prev.cy);
      carveVerticalCorridor(map, prev.cy, curr.cy, curr.cx);
    } else {
      carveVerticalCorridor(map, prev.cy, curr.cy, prev.cx);
      carveHorizontalCorridor(map, prev.cx, curr.cx, curr.cy);
    }
  }
  
  // Place stairs in last room
  const lastRoom = rooms[rooms.length - 1];
  map[lastRoom.cy][lastRoom.cx] = TILES.STAIRS;
  
  // Initialize explored/visible
  const explored = [];
  const visible = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    explored[y] = [];
    visible[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      explored[y][x] = false;
      visible[y][x] = false;
    }
  }
  
  return { map, explored, visible, rooms, stairs: { x: lastRoom.cx, y: lastRoom.cy } };
}

function carveHorizontalCorridor(map, x1, x2, y) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
      map[y][x] = TILES.FLOOR;
    }
  }
}

function carveVerticalCorridor(map, y1, y2, x) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
      map[y][x] = TILES.FLOOR;
    }
  }
}

// --- Field of View ---
function computeFOV(px, py, radius) {
  // Reset visible
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      gameState.visible[y][x] = false;
    }
  }
  
  // Simple raycasting FOV
  for (let angle = 0; angle < 360; angle += 2) {
    const rad = angle * Math.PI / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    
    let x = px + 0.5;
    let y = py + 0.5;
    
    for (let i = 0; i < radius; i++) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) break;
      
      gameState.visible[ty][tx] = true;
      gameState.explored[ty][tx] = true;
      
      if (gameState.map[ty][tx] === TILES.WALL) break;
      
      x += dx;
      y += dy;
    }
  }
}

// --- Spawn Entities ---
function spawnEnemies(rooms, floor) {
  const enemies = [];
  const enemyTypes = ['rat', 'bat'];
  if (floor >= 2) enemyTypes.push('spider');
  if (floor >= 3) enemyTypes.push('skeleton');
  if (floor >= 4) enemyTypes.push('zombie');
  
  // Skip first room (player spawn)
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const numEnemies = 1 + Math.floor(Math.random() * (1 + floor * 0.5));
    
    for (let j = 0; j < numEnemies; j++) {
      const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      enemies.push(createEnemy(ex, ey, type));
    }
  }
  
  // Boss on floor 5+
  if (floor >= 5) {
    const lastRoom = rooms[rooms.length - 1];
    enemies.push(createEnemy(lastRoom.cx - 1, lastRoom.cy, 'demon'));
  }
  
  return enemies;
}

function spawnItems(rooms, floor) {
  const items = [];
  const itemTypes = ['potion', 'spore'];
  if (floor >= 2) itemTypes.push('sword', 'shield');
  if (floor >= 3) itemTypes.push('key');
  
  for (let i = 1; i < rooms.length - 1; i++) {
    if (Math.random() < 0.4) {
      const room = rooms[i];
      const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
      items.push(createItem(ix, iy, type));
    }
  }
  
  return items;
}

// --- Game Logic ---
export function initGame() {
  const dungeon = generateDungeon(1);
  gameState.map = dungeon.map;
  gameState.explored = dungeon.explored;
  gameState.visible = dungeon.visible;
  gameState.floor = 1;
  gameState.turns = 0;
  gameState.gameOver = false;
  gameState.victory = false;
  gameState.messages = ['You descend into the SPORECRAWL...', 'Find the stairs (>) to go deeper.'];
  
  // Spawn player in first room
  const firstRoom = dungeon.rooms[0];
  gameState.player = createPlayer(firstRoom.cx, firstRoom.cy);
  
  // Spawn enemies and items
  gameState.enemies = spawnEnemies(dungeon.rooms, 1);
  gameState.items = spawnItems(dungeon.rooms, 1);
  
  // Initial FOV
  computeFOV(gameState.player.x, gameState.player.y, 8);
  
  return gameState;
}

export function movePlayer(dx, dy) {
  if (gameState.gameOver) return { moved: false };
  
  const player = gameState.player;
  const newX = player.x + dx;
  const newY = player.y + dy;
  
  // Bounds check
  if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) {
    return { moved: false };
  }
  
  // Wall check
  if (gameState.map[newY][newX] === TILES.WALL) {
    return { moved: false };
  }
  
  // Enemy check (combat)
  const enemy = gameState.enemies.find(e => e.x === newX && e.y === newY);
  if (enemy) {
    return attackEnemy(enemy);
  }
  
  // Move player
  player.x = newX;
  player.y = newY;
  gameState.turns++;
  
  // Pick up items
  const itemIndex = gameState.items.findIndex(i => i.x === newX && i.y === newY);
  if (itemIndex >= 0) {
    pickupItem(itemIndex);
  }
  
  // Check stairs
  if (gameState.map[newY][newX] === TILES.STAIRS) {
    descendStairs();
  }
  
  // Enemy turns
  moveEnemies();
  
  // Update FOV
  computeFOV(player.x, player.y, 8);
  
  // Check death
  if (player.hp <= 0) {
    gameState.gameOver = true;
    addMessage('You have died on floor ' + gameState.floor + '!');
  }
  
  return { moved: true };
}

function attackEnemy(enemy) {
  const player = gameState.player;
  const damage = Math.max(1, player.atk - enemy.def);
  enemy.currentHp -= damage;
  
  addMessage('You hit ' + enemy.name + ' for ' + damage + ' damage!');
  
  if (enemy.currentHp <= 0) {
    // Enemy dies
    gameState.enemies = gameState.enemies.filter(e => e !== enemy);
    addMessage(enemy.name + ' is destroyed! +' + enemy.xp + ' XP');
    player.xp += enemy.xp;
    checkLevelUp();
  }
  
  gameState.turns++;
  moveEnemies();
  computeFOV(player.x, player.y, 8);
  
  return { moved: true, combat: true };
}

function moveEnemies() {
  const player = gameState.player;
  
  for (const enemy of gameState.enemies) {
    // Simple AI: move toward player if visible
    const dist = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
    
    if (dist <= 10) {
      // Adjacent? Attack!
      if (dist === 1) {
        const damage = Math.max(1, enemy.atk - player.def);
        player.hp -= damage;
        addMessage(enemy.name + ' hits you for ' + damage + '!');
      } else {
        // Move toward player
        let dx = 0, dy = 0;
        if (enemy.x < player.x) dx = 1;
        else if (enemy.x > player.x) dx = -1;
        if (enemy.y < player.y) dy = 1;
        else if (enemy.y > player.y) dy = -1;
        
        // Try horizontal first, then vertical
        const newX = enemy.x + dx;
        const newY = enemy.y + dy;
        
        if (canMoveTo(newX, enemy.y)) {
          enemy.x = newX;
        } else if (canMoveTo(enemy.x, newY)) {
          enemy.y = newY;
        }
      }
    }
  }
}

function canMoveTo(x, y) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
  if (gameState.map[y][x] === TILES.WALL) return false;
  if (gameState.player.x === x && gameState.player.y === y) return false;
  if (gameState.enemies.some(e => e.x === x && e.y === y)) return false;
  return true;
}

function pickupItem(index) {
  const item = gameState.items[index];
  const player = gameState.player;
  
  switch (item.effect) {
    case 'heal':
      player.inventory.potions++;
      addMessage('Picked up ' + item.name + '!');
      break;
    case 'atk':
      player.atk += item.value;
      addMessage('Equipped ' + item.name + '! ATK +' + item.value);
      break;
    case 'def':
      player.def += item.value;
      addMessage('Equipped ' + item.name + '! DEF +' + item.value);
      break;
    case 'spore':
      player.inventory.spores++;
      addMessage('Picked up ' + item.name + '!');
      break;
    case 'key':
      player.inventory.keys++;
      addMessage('Picked up ' + item.name + '!');
      break;
  }
  
  gameState.items.splice(index, 1);
}

function descendStairs() {
  gameState.floor++;
  addMessage('You descend to floor ' + gameState.floor + '...');
  
  // Check victory
  if (gameState.floor > 10) {
    gameState.victory = true;
    gameState.gameOver = true;
    addMessage('🎉 VICTORY! You escaped the SPORECRAWL!');
    return;
  }
  
  // Generate new floor
  const dungeon = generateDungeon(gameState.floor);
  gameState.map = dungeon.map;
  gameState.explored = dungeon.explored;
  gameState.visible = dungeon.visible;
  
  const firstRoom = dungeon.rooms[0];
  gameState.player.x = firstRoom.cx;
  gameState.player.y = firstRoom.cy;
  
  gameState.enemies = spawnEnemies(dungeon.rooms, gameState.floor);
  gameState.items = spawnItems(dungeon.rooms, gameState.floor);
  
  computeFOV(gameState.player.x, gameState.player.y, 8);
}

function checkLevelUp() {
  const player = gameState.player;
  const xpNeeded = player.level * 50;
  
  if (player.xp >= xpNeeded) {
    player.level++;
    player.xp -= xpNeeded;
    player.maxHp += 10;
    player.hp = Math.min(player.hp + 20, player.maxHp);
    player.atk += 1;
    addMessage('⬆️ LEVEL UP! You are now level ' + player.level);
  }
}

export function usePotion() {
  const player = gameState.player;
  if (player.inventory.potions > 0 && player.hp < player.maxHp) {
    player.inventory.potions--;
    const heal = 30;
    player.hp = Math.min(player.maxHp, player.hp + heal);
    addMessage('You drink a potion. +' + heal + ' HP');
    gameState.turns++;
    moveEnemies();
    return true;
  }
  return false;
}

export function useSpore() {
  const player = gameState.player;
  if (player.inventory.spores > 0) {
    player.inventory.spores--;
    // Damage all adjacent enemies
    let hit = 0;
    for (const enemy of gameState.enemies) {
      const dist = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
      if (dist <= 2) {
        const damage = 15;
        enemy.currentHp -= damage;
        hit++;
        if (enemy.currentHp <= 0) {
          gameState.enemies = gameState.enemies.filter(e => e !== enemy);
          player.xp += enemy.xp;
        }
      }
    }
    addMessage('Spore burst! Hit ' + hit + ' enemies for 15 damage each!');
    checkLevelUp();
    gameState.turns++;
    moveEnemies();
    computeFOV(player.x, player.y, 8);
    return true;
  }
  return false;
}

function addMessage(msg) {
  gameState.messages.unshift(msg);
  if (gameState.messages.length > 5) {
    gameState.messages.pop();
  }
}

// --- Rendering ---
export function renderGame(ctx, W, H) {
  // Calculate offset to center map
  const offsetX = (W - MAP_WIDTH * TILE_SIZE) / 2;
  const offsetY = (H - MAP_HEIGHT * TILE_SIZE) / 2 - 20;
  
  // Clear
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  
  // Render map
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = gameState.map[y][x];
      const visible = gameState.visible[y][x];
      const explored = gameState.explored[y][x];
      
      const px = offsetX + x * TILE_SIZE;
      const py = offsetY + y * TILE_SIZE;
      
      if (!explored) {
        ctx.fillStyle = COLORS.fog;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        continue;
      }
      
      // Tile color
      let color = visible ? COLORS.floor : COLORS.floorExplored;
      if (tile === TILES.WALL) color = visible ? COLORS.wallGlow : COLORS.wall;
      else if (tile === TILES.STAIRS) color = COLORS.stairs;
      else if (tile === TILES.DOOR) color = COLORS.door;
      
      ctx.fillStyle = color;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      
      // Grid lines (subtle)
      if (visible && tile !== TILES.WALL) {
        ctx.strokeStyle = 'rgba(184, 233, 134, 0.1)';
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  
  // Render items (only visible)
  for (const item of gameState.items) {
    if (gameState.visible[item.y][item.x]) {
      const px = offsetX + item.x * TILE_SIZE + TILE_SIZE/2;
      const py = offsetY + item.y * TILE_SIZE + TILE_SIZE/2;
      
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = COLORS.itemGlow;
      ctx.fillStyle = item.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.char, px, py);
      ctx.restore();
    }
  }
  
  // Render enemies (only visible)
  for (const enemy of gameState.enemies) {
    if (gameState.visible[enemy.y][enemy.x]) {
      const px = offsetX + enemy.x * TILE_SIZE + TILE_SIZE/2;
      const py = offsetY + enemy.y * TILE_SIZE + TILE_SIZE/2;
      
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.enemyGlow;
      ctx.fillStyle = enemy.color;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(enemy.char, px, py);
      ctx.restore();
    }
  }
  
  // Render player
  const player = gameState.player;
  const ppx = offsetX + player.x * TILE_SIZE + TILE_SIZE/2;
  const ppy = offsetY + player.y * TILE_SIZE + TILE_SIZE/2;
  
  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = COLORS.playerGlow;
  ctx.fillStyle = COLORS.player;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('@', ppx, ppy);
  ctx.restore();
  
  // Render HUD
  renderHUD(ctx, W, H);
  
  // Render messages
  renderMessages(ctx, W, H);
  
  // Game over overlay
  if (gameState.gameOver) {
    renderGameOver(ctx, W, H);
  }
}

function renderHUD(ctx, W, H) {
  const player = gameState.player;
  const hudY = 10;
  
  ctx.save();
  ctx.font = '14px monospace';
  
  // HP bar
  ctx.fillStyle = COLORS.hpBg;
  ctx.fillRect(10, hudY, 150, 16);
  ctx.fillStyle = COLORS.hp;
  ctx.fillRect(10, hudY, 150 * (player.hp / player.maxHp), 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HP: ' + player.hp + '/' + player.maxHp, 15, hudY + 12);
  
  // Stats
  ctx.fillStyle = COLORS.player;
  ctx.fillText('ATK: ' + player.atk + '  DEF: ' + player.def + '  LVL: ' + player.level, 170, hudY + 12);
  
  // Floor
  ctx.fillText('Floor: ' + gameState.floor + '/10', W - 100, hudY + 12);
  
  // Inventory
  ctx.fillText('💚' + player.inventory.potions + ' 🍄' + player.inventory.spores + ' 🔑' + player.inventory.keys, 10, hudY + 30);
  
  // Controls hint
  ctx.fillStyle = 'rgba(184, 233, 134, 0.5)';
  ctx.font = '12px monospace';
  ctx.fillText('WASD: Move | H: Potion | J: Spore | R: Restart', 10, H - 10);
  
  ctx.restore();
}

function renderMessages(ctx, W, H) {
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(184, 233, 134, 0.8)';
  
  for (let i = 0; i < gameState.messages.length; i++) {
    const alpha = 1 - (i * 0.15);
    ctx.globalAlpha = alpha;
    ctx.fillText(gameState.messages[i], 10, H - 30 - i * 14);
  }
  
  ctx.restore();
}

function renderGameOver(ctx, W, H) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, W, H);
  
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (gameState.victory) {
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#b8e986';
    ctx.fillText('🎉 VICTORY! 🎉', W/2, H/2 - 40);
    ctx.font = '18px monospace';
    ctx.fillText('You escaped the SPORECRAWL!', W/2, H/2);
  } else {
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('💀 YOU DIED 💀', W/2, H/2 - 40);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText('Reached floor ' + gameState.floor + ' | Level ' + gameState.player.level, W/2, H/2);
  }
  
  ctx.font = '14px monospace';
  ctx.fillStyle = '#666666';
  ctx.fillText('Press R to restart', W/2, H/2 + 40);
  
  ctx.restore();
}

export function getGameState() {
  return gameState;
}

export function isGameOver() {
  return gameState.gameOver;
}
