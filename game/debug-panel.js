/**
 * debug-panel.js — Runtime debug/config panel for Mycelium (issue #121)
 *
 * Toggle with backtick (~) key. Shows every CONFIG parameter as a live control:
 *   - Sliders for numeric values
 *   - Checkboxes for booleans
 *   - Color pickers for hex colors
 *   - Text inputs for strings
 *
 * Preset buttons at top (default / zen / chaos).
 * Export button copies current config diff as JSON to clipboard.
 * Reset per-section and global reset.
 *
 * Reads from and writes to window.Mycelium.config directly.
 * Changes apply immediately — no restart needed.
 *
 * Lazy-loaded on first ~ press. Zero impact when not open.
 */

const PANEL_ID = 'mycelium-debug-panel';

let panelEl = null;
let isOpen = false;
let initialized = false;

// --- Slider range heuristics ---
// For numeric values, infer a reasonable range from the default value.
function inferRange(value) {
  if (value === 0) return { min: 0, max: 10, step: 0.1 };
  const abs = Math.abs(value);
  if (abs <= 1) return { min: 0, max: 2, step: 0.01 };
  if (abs <= 10) return { min: 0, max: abs * 4, step: 0.1 };
  if (abs <= 100) return { min: 0, max: abs * 4, step: 1 };
  return { min: 0, max: abs * 4, step: 5 };
}

// --- Check if a string looks like a hex color ---
function isHexColor(val) {
  return typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val);
}

// --- Deep clone ---
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const out = {};
  for (const key of Object.keys(obj)) out[key] = deepClone(obj[key]);
  return out;
}

// --- Diff: return only values that differ from defaults ---
function configDiff(current, defaults) {
  const diff = {};
  for (const key of Object.keys(defaults)) {
    if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
      const sub = configDiff(current[key], defaults[key]);
      if (Object.keys(sub).length > 0) diff[key] = sub;
    } else if (current[key] !== defaults[key]) {
      diff[key] = current[key];
    }
  }
  return diff;
}

// --- Get a snapshot of defaults (read once at init) ---
let defaultsSnapshot = null;

function getDefaults() {
  if (defaultsSnapshot) return defaultsSnapshot;
  // Save current config, reset to defaults, snapshot, restore
  const M = window.Mycelium;
  const saved = deepClone(M.config);
  M.resetConfig();
  defaultsSnapshot = deepClone(M.config);
  // Restore
  for (const key of Object.keys(saved)) {
    M.config[key] = saved[key];
  }
  return defaultsSnapshot;
}

// --- Category labels for grouping ---
const CATEGORY_LABELS = {
  palette: 'Palette',
  canvas: 'Canvas',
  growth: 'Growth',
  branching: 'Branching',
  nutrients: 'Nutrients',
  energy: 'Energy',
  ai: 'AI Competitor',
  milestones: 'Milestones',
  fx: 'Visual FX',
  audio: 'Audio',
};

// --- Build panel DOM ---
function buildPanel() {
  const M = window.Mycelium;
  if (!M || !M.config) {
    console.warn('[DebugPanel] window.Mycelium.config not found');
    return null;
  }

  const defaults = getDefaults();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  Object.assign(panel.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '340px',
    height: '100vh',
    background: 'rgba(10, 14, 15, 0.94)',
    borderLeft: '1px solid rgba(184, 233, 134, 0.2)',
    color: '#e0e0e0',
    fontFamily: 'monospace',
    fontSize: '12px',
    zIndex: '9999',
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'none',
    padding: '0',
    boxSizing: 'border-box',
  });

  // --- Header ---
  const header = document.createElement('div');
  Object.assign(header.style, {
    padding: '12px 14px 8px',
    borderBottom: '1px solid rgba(184, 233, 134, 0.15)',
    position: 'sticky',
    top: '0',
    background: 'rgba(10, 14, 15, 0.98)',
    zIndex: '1',
  });

  const title = document.createElement('div');
  title.textContent = 'MYCELIUM DEBUG';
  Object.assign(title.style, {
    fontSize: '14px',
    color: '#b8e986',
    letterSpacing: '3px',
    marginBottom: '8px',
  });
  header.appendChild(title);

  // Preset buttons
  const presetRow = document.createElement('div');
  Object.assign(presetRow.style, { display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' });

  const presetNames = Object.keys(M.presets);
  for (const name of presetNames) {
    const btn = createButton(name.toUpperCase(), () => {
      M.loadPreset(name);
      rebuildControls();
    });
    presetRow.appendChild(btn);
  }
  header.appendChild(presetRow);

  // Action buttons row
  const actionRow = document.createElement('div');
  Object.assign(actionRow.style, { display: 'flex', gap: '6px', flexWrap: 'wrap' });

  actionRow.appendChild(createButton('EXPORT JSON', () => {
    const diff = configDiff(M.config, defaults);
    const json = JSON.stringify(diff, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      showToast('Config diff copied to clipboard');
    }).catch(() => {
      console.log('[DebugPanel] Config diff:\n' + json);
      showToast('Logged to console (clipboard failed)');
    });
  }));

  actionRow.appendChild(createButton('RESET ALL', () => {
    M.resetConfig();
    rebuildControls();
    showToast('Reset to defaults');
  }));

  header.appendChild(actionRow);
  panel.appendChild(header);

  // --- Controls container ---
  const controlsContainer = document.createElement('div');
  controlsContainer.id = 'debug-controls-container';
  Object.assign(controlsContainer.style, { padding: '8px 14px 20px' });
  panel.appendChild(controlsContainer);

  // Build controls for each section
  buildControls(controlsContainer, M.config, defaults);

  // --- Toast ---
  const toast = document.createElement('div');
  toast.id = 'debug-toast';
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: 'rgba(184, 233, 134, 0.9)',
    color: '#0a0e0f',
    padding: '8px 14px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
    zIndex: '10000',
    opacity: '0',
    transition: 'opacity 0.3s ease',
    pointerEvents: 'none',
  });
  panel.appendChild(toast);

  return panel;
}

function buildControls(container, config, defaults) {
  container.innerHTML = '';
  for (const category of Object.keys(config)) {
    if (typeof config[category] !== 'object' || config[category] === null) continue;
    const section = buildSection(category, config[category], defaults[category] || {});
    container.appendChild(section);
  }
}

function rebuildControls() {
  if (!panelEl) return;
  const container = panelEl.querySelector('#debug-controls-container');
  if (!container) return;
  const M = window.Mycelium;
  const defaults = getDefaults();
  buildControls(container, M.config, defaults);
}

function buildSection(category, sectionConfig, sectionDefaults) {
  const section = document.createElement('div');
  Object.assign(section.style, { marginBottom: '12px' });

  // Section header
  const sectionHeader = document.createElement('div');
  Object.assign(sectionHeader.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid rgba(184, 233, 134, 0.1)',
    marginBottom: '6px',
    cursor: 'pointer',
    userSelect: 'none',
  });

  const label = document.createElement('span');
  label.textContent = (CATEGORY_LABELS[category] || category).toUpperCase();
  Object.assign(label.style, {
    color: '#b8e986',
    fontSize: '11px',
    letterSpacing: '2px',
  });
  sectionHeader.appendChild(label);

  const resetBtn = createButton('reset', () => {
    const M = window.Mycelium;
    const defaults = getDefaults();
    if (defaults[category]) {
      M.config[category] = deepClone(defaults[category]);
      rebuildControls();
    }
  }, true);
  sectionHeader.appendChild(resetBtn);

  section.appendChild(sectionHeader);

  // Controls for each key in the section
  const controlsDiv = document.createElement('div');

  for (const key of Object.keys(sectionConfig)) {
    const value = sectionConfig[key];
    const defaultValue = sectionDefaults[key];

    // Skip nested objects (like milestones.messages) — flatten them
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Render nested object keys with dotted notation
      for (const subKey of Object.keys(value)) {
        const subVal = value[subKey];
        const subDefault = (defaultValue && typeof defaultValue === 'object') ? defaultValue[subKey] : subVal;
        const control = buildControl(category, key + '.' + subKey, subVal, subDefault, (newVal) => {
          window.Mycelium.config[category][key][subKey] = newVal;
        });
        if (control) controlsDiv.appendChild(control);
      }
      continue;
    }

    const control = buildControl(category, key, value, defaultValue, (newVal) => {
      window.Mycelium.config[category][key] = newVal;
    });
    if (control) controlsDiv.appendChild(control);
  }

  section.appendChild(controlsDiv);
  return section;
}

function buildControl(category, key, value, defaultValue, onChange) {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '3px 0',
    gap: '8px',
  });

  const isModified = value !== defaultValue;

  const labelEl = document.createElement('span');
  labelEl.textContent = key;
  labelEl.title = `Default: ${defaultValue}`;
  Object.assign(labelEl.style, {
    flex: '1',
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: isModified ? '#f4d35e' : '#ccc',
    fontSize: '11px',
  });
  row.appendChild(labelEl);

  if (typeof value === 'boolean') {
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = value;
    Object.assign(checkbox.style, { accentColor: '#b8e986', cursor: 'pointer' });
    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
      labelEl.style.color = checkbox.checked !== defaultValue ? '#f4d35e' : '#ccc';
    });
    row.appendChild(checkbox);
  } else if (typeof value === 'number') {
    // Slider + number display
    const range = inferRange(defaultValue !== undefined ? defaultValue : value);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = range.min;
    slider.max = range.max;
    slider.step = range.step;
    slider.value = value;
    Object.assign(slider.style, {
      width: '100px',
      accentColor: '#b8e986',
      cursor: 'pointer',
    });

    const numDisplay = document.createElement('span');
    numDisplay.textContent = formatNum(value);
    Object.assign(numDisplay.style, {
      width: '45px',
      textAlign: 'right',
      fontSize: '10px',
      color: '#aaa',
      fontVariantNumeric: 'tabular-nums',
    });

    slider.addEventListener('input', () => {
      const newVal = parseFloat(slider.value);
      onChange(newVal);
      numDisplay.textContent = formatNum(newVal);
      labelEl.style.color = newVal !== defaultValue ? '#f4d35e' : '#ccc';
    });

    row.appendChild(slider);
    row.appendChild(numDisplay);
  } else if (isHexColor(value)) {
    // Color picker
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = value;
    Object.assign(picker.style, {
      width: '32px',
      height: '22px',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      padding: '0',
    });
    picker.addEventListener('input', () => {
      onChange(picker.value);
      labelEl.style.color = picker.value !== defaultValue ? '#f4d35e' : '#ccc';
    });
    row.appendChild(picker);
  } else if (typeof value === 'string') {
    // Text input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    Object.assign(input.style, {
      width: '120px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(184, 233, 134, 0.15)',
      borderRadius: '3px',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '10px',
      padding: '2px 4px',
    });
    input.addEventListener('change', () => {
      onChange(input.value);
      labelEl.style.color = input.value !== defaultValue ? '#f4d35e' : '#ccc';
    });
    row.appendChild(input);
  } else {
    // Unsupported type — skip
    return null;
  }

  return row;
}

// --- Helpers ---

function formatNum(n) {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

function createButton(text, onClick, small) {
  const btn = document.createElement('button');
  btn.textContent = text;
  Object.assign(btn.style, {
    background: 'rgba(184, 233, 134, 0.1)',
    border: '1px solid rgba(184, 233, 134, 0.25)',
    borderRadius: '3px',
    color: '#b8e986',
    fontFamily: 'monospace',
    fontSize: small ? '9px' : '10px',
    padding: small ? '2px 6px' : '4px 10px',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'background 0.15s',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(184, 233, 134, 0.2)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(184, 233, 134, 0.1)';
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('debug-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

// --- Toggle ---

function toggle() {
  if (!initialized) {
    panelEl = buildPanel();
    if (!panelEl) return;
    document.body.appendChild(panelEl);
    initialized = true;
  }

  isOpen = !isOpen;
  panelEl.style.display = isOpen ? 'block' : 'none';

  if (isOpen) {
    // Refresh controls to reflect current config state
    rebuildControls();
  }
}

// --- Keyboard listener ---
// Backtick (~) toggles the panel. We listen on keydown and check for both ` and ~.
window.addEventListener('keydown', (e) => {
  if (e.key === '`' || e.key === '~') {
    // Don't toggle if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    toggle();
  }
});

// Expose on Mycelium API for programmatic access
if (typeof window !== 'undefined') {
  const waitForMycelium = () => {
    if (window.Mycelium) {
      window.Mycelium.debugPanel = { toggle, isOpen: () => isOpen };
    } else {
      setTimeout(waitForMycelium, 50);
    }
  };
  waitForMycelium();
}
