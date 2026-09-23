'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#9b2d3f', // O - rojo vino
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // Tuerca - gris metálico
  '#ffeb3b', // Rayo - amarillo
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca
  [[9]],                                       // Rayo (powerup)
];

const RAYO = 9;
const RAYO_CHANCE = 0.05;
// Número de piezas normales entre garantías de rayo por nivel (mín/máx)
const RAYO_GUARANTEE_MIN = 5;
const RAYO_GUARANTEE_SPAN = 11;

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_STORAGE_KEY = 'tetris-theme';
const THEME_COLORS = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#dcdfe8', highlight: 'rgba(255,255,255,0.35)' },
};

const RECORDS_STORAGE_KEY = 'tetris-records';
const MAX_RECORDS = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startRecordsBody = document.getElementById('start-records-body');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const resetRecordsBtnStart = document.getElementById('reset-records-btn-start');

const gameoverRecordsSection = document.getElementById('gameover-records-section');
const gameoverNameEntry = document.getElementById('gameover-name-entry');
const playerNameInput = document.getElementById('player-name-input');
const saveRecordBtn = document.getElementById('save-record-btn');
const gameoverRecordsBody = document.getElementById('gameover-records-body');
const gameoverBestCombo = document.getElementById('gameover-best-combo');
const gameoverMaxLines = document.getElementById('gameover-max-lines');
const resetRecordsBtnGameover = document.getElementById('reset-records-btn-gameover');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let rayoPending, rayoCountdown;
let combo, maxComboRun, pendingRecordSaved;
let gameStarted = false;
let theme = readStoredTheme() === 'light' ? 'light' : 'dark';

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function applyTheme(t) {
  theme = t;
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    // almacenamiento no disponible (p. ej. modo privado estricto o iframe restringido)
  }
}

applyTheme(theme);

function defaultRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function isValidRecordEntry(entry) {
  return entry
    && typeof entry.name === 'string'
    && Number.isFinite(entry.score)
    && Number.isFinite(entry.lines)
    && Number.isFinite(entry.level);
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return defaultRecords();
    const parsed = JSON.parse(raw);
    return {
      top: Array.isArray(parsed.top) ? parsed.top.filter(isValidRecordEntry).slice(0, MAX_RECORDS) : [],
      bestCombo: typeof parsed.bestCombo === 'number' ? parsed.bestCombo : 0,
      maxLines: typeof parsed.maxLines === 'number' ? parsed.maxLines : 0,
    };
  } catch (e) {
    return defaultRecords();
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    // almacenamiento no disponible (p. ej. modo privado estricto o iframe restringido)
  }
}

function qualifiesForTop(records, candidateScore) {
  return records.top.length < MAX_RECORDS || candidateScore > records.top[records.top.length - 1].score;
}

function renderRecordsTable(tbody, list, highlightIndex) {
  tbody.textContent = '';
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'Sin records todavía';
    td.className = 'records-empty';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  list.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('record-highlight');
    [i + 1, entry.name, entry.score.toLocaleString(), entry.lines, entry.level].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function applyRecordsToUI(tbody, comboEl, linesEl2, records, highlightIndex) {
  renderRecordsTable(tbody, records.top, highlightIndex);
  comboEl.textContent = records.bestCombo;
  linesEl2.textContent = records.maxLines;
}

function refreshStartScreen() {
  applyRecordsToUI(startRecordsBody, startBestCombo, startMaxLines, loadRecords(), -1);
}

function refreshGameoverRecords(highlightIndex) {
  applyRecordsToUI(gameoverRecordsBody, gameoverBestCombo, gameoverMaxLines, loadRecords(), highlightIndex);
}

function showStartScreen() {
  refreshStartScreen();
  startScreen.classList.remove('hidden');
}

function hideStartScreen() {
  startScreen.classList.add('hidden');
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  try {
    localStorage.removeItem(RECORDS_STORAGE_KEY);
  } catch (e) {
    // almacenamiento no disponible
  }
  refreshStartScreen();
  refreshGameoverRecords(-1);
}

function saveScoreRecord() {
  if (pendingRecordSaved) return;
  const name = (playerNameInput.value || '').trim().slice(0, 12) || 'Jugador';
  const records = loadRecords();
  const entry = { name, score, lines, level, date: new Date().toISOString() };
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score);
  records.top = records.top.slice(0, MAX_RECORDS);
  records.bestCombo = Math.max(records.bestCombo, maxComboRun);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords(records);
  const idx = records.top.indexOf(entry);
  applyRecordsToUI(gameoverRecordsBody, gameoverBestCombo, gameoverMaxLines, records, idx);
  pendingRecordSaved = true;
  gameoverNameEntry.classList.add('hidden');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function resetRayoForLevel() {
  rayoPending = true;
  rayoCountdown = RAYO_GUARANTEE_MIN + Math.floor(Math.random() * (RAYO_GUARANTEE_SPAN + 1));
}

function randomPiece() {
  rayoCountdown--;
  let type;
  if (rayoPending && rayoCountdown <= 0) {
    type = RAYO;
  } else if (Math.random() < RAYO_CHANCE) {
    type = RAYO;
  } else {
    type = Math.floor(Math.random() * (RAYO - 1)) + 1;
  }
  if (type === RAYO) rayoPending = false;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function addLines(n) {
  const prevLevel = level;
  lines += n;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  if (level > prevLevel) resetRayoForLevel();
  updateHUD();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    score += (LINE_SCORES[cleared] || 0) * level;
    addLines(cleared);
  }
  return cleared;
}

function strikeLightning(x, y) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[r][x]) count++;
    board[r][x] = 0;
  }
  for (let c = 0; c < COLS; c++) {
    if (c !== x && board[y][c]) count++;
  }
  board.splice(y, 1);
  board.unshift(new Array(COLS).fill(0));
  score += count * 10 * level;
  addLines(1);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.type === RAYO) {
    strikeLightning(current.x, current.y);
    combo++;
  } else {
    merge();
    const cleared = clearLines();
    combo = cleared > 0 ? combo + 1 : 0;
  }
  if (combo > maxComboRun) maxComboRun = combo;
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEME_COLORS[theme].highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === RAYO) {
    context.font = `${Math.floor(size * 0.7)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#3e2723';
    context.fillText('⚡', x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEME_COLORS[theme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const records = loadRecords();
  let updated = false;
  if (maxComboRun > records.bestCombo) {
    records.bestCombo = maxComboRun;
    updated = true;
  }
  if (lines > records.maxLines) {
    records.maxLines = lines;
    updated = true;
  }
  if (updated) saveRecords(records);

  applyRecordsToUI(gameoverRecordsBody, gameoverBestCombo, gameoverMaxLines, records, -1);
  gameoverRecordsSection.classList.remove('hidden');

  pendingRecordSaved = false;
  if (qualifiesForTop(records, score)) {
    gameoverNameEntry.classList.remove('hidden');
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    gameoverNameEntry.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!gameStarted || gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    gameoverRecordsSection.classList.add('hidden');
    gameoverNameEntry.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  gameStarted = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxComboRun = 0;
  pendingRecordSaved = false;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  resetRayoForLevel();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (!gameStarted || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('click', () => {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
  if (!startScreen.classList.contains('hidden')) return;
  draw();
  drawNext();
});

playBtn.addEventListener('click', () => {
  hideStartScreen();
  init();
});

resetRecordsBtnStart.addEventListener('click', resetRecords);
resetRecordsBtnGameover.addEventListener('click', resetRecords);

saveRecordBtn.addEventListener('click', saveScoreRecord);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    saveScoreRecord();
  }
});

showStartScreen();
