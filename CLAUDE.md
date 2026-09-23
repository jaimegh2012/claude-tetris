# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No `package.json`, no build, no tests, no linter. README and UI text are in Spanish.

## Run

Open `index.html` directly, or serve statically: `python -m http.server 8000` then visit `http://localhost:8000`.

## Architecture

Three files, all logic in `game.js` (plain `<script>`, `'use strict'`, global state, no modules):

- `index.html` — `#board` canvas (300×600), `#next-canvas` (120×120), HUD spans (`#score`, `#lines`, `#level`), `#overlay` used for both PAUSA and GAME OVER, `#start-screen` shown before the game starts.
- `style.css` — dark/light theme via CSS variables on `:root` / `body.light-theme`.
- `game.js` — module-level `let` vars (`board`, `current`, `next`, `score`, `combo`, `maxComboRun`, `gameStarted`, ...) reset in `init()`. `restartBtn` calls `init()` directly (skips the start screen).

**Startup flow**: the script no longer calls `init()` automatically. At the bottom it calls `showStartScreen()`, which renders the local records (see below) into `#start-screen` and leaves it visible; `board`/`current`/etc. stay `undefined` and the animation loop does not run yet. Clicking `#play-btn` calls `hideStartScreen()` + `init()`, which sets `gameStarted = true` and starts `requestAnimationFrame(loop)`. The global `keydown` handler and `togglePause()` both guard on `!gameStarted` (in addition to `paused`/`gameOver`) so keyboard input before the first `init()` doesn't touch `current`/`board` while they're still `undefined`.

Piece lifecycle: `randomPiece()` -> `spawn()` (`current = next`, new `next`; game over if spawn collides) -> `collide()`-checked moves -> `lockPiece()` = `merge()` + `clearLines()` + `spawn()`. Board cells hold `0` or color index 1–8; `PIECES` and `COLORS` are indexed by the same type number (index 0 is `null`). Type 8 (`Tuerca`) is a 3×3 ring with an empty center cell.

Type 9 (`RAYO`) is a 1×1 powerup piece, excluded from the normal 1–8 random pool. `randomPiece()` spawns it with probability `RAYO_CHANCE`, or forces it via a per-level countdown (`rayoPending`/`rayoCountdown`, reset by `resetRayoForLevel()` in `init()` and whenever `addLines()` bumps `level`) so every level guarantees at least one. `lockPiece()` branches on `current.type === RAYO`: instead of `merge()` + `clearLines()`, it calls `strikeLightning(x, y)`, which clears the piece's full row and column (row collapses like a normal line clear via `splice`/`unshift`; column cells are just zeroed) and awards `10 * level` per destroyed cell plus 1 line via the shared `addLines()` helper (also used by `clearLines()`).

Drop paths are separate: gravity in `loop()`, `softDrop()` (+1/row), `hardDrop()` (+2/row via `ghostY()`). All converge on `lockPiece()`.

**Combo**: `lockPiece()` increments the module-level `combo` whenever `clearLines()` returns a count > 0 (it now returns the number of cleared lines) or the piece was a RAYO strike; otherwise it resets `combo` to `0`. `maxComboRun` tracks the highest `combo` reached in the current game and is compared against the stored `bestCombo` in `endGame()`.

**Local records** (`localStorage['tetris-records']`, JSON shape `{ top: [{name, score, lines, level, date}] (≤5, sorted desc by score), bestCombo, maxLines }`): `loadRecords()`/`saveRecords()` follow the same try/catch pattern as `readStoredTheme()`/`applyTheme()` and never throw; `loadRecords()` also filters out malformed entries (`isValidRecordEntry`). `endGame()` updates `bestCombo`/`maxLines` if beaten and shows the name-entry input (`#gameover-name-entry`) only when `score` qualifies for the top 5 (`qualifiesForTop()`); `saveScoreRecord()` inserts, sorts, trims to 5, persists, and highlights the new row (`.record-highlight`). Player names are always inserted via `textContent` (never `innerHTML`) to avoid XSS. `applyRecordsToUI()` is the shared renderer used by the start screen, the game-over overlay, and the reset flow to avoid duplicating the render+summary logic.

## Gotchas

- Canvas size in `index.html` is hardcoded; changing `COLS`/`ROWS`/`BLOCK` in `game.js` requires updating `width`/`height` of `#board` by hand.
- Initial drop interval `1000` and formula `max(100, 1000 - (level-1)*90)` are duplicated in `init()` and `clearLines()`.
- `endGame()` can run inside `loop()` (via `lockPiece` -> `spawn`), but `loop()` then unconditionally re-requests a frame after `cancelAnimationFrame`, so the loop keeps running after game over. Keep in mind if touching loop/endGame/pause logic.
- Rotation is `rotateCW` only, with simple horizontal kicks `[0, -1, 1, -2, 2]` in `tryRotate` (not SRS).
- Keyboard uses `e.code` (`KeyP`, `KeyX`, `Space`, arrows), so layout-independent.
- `#gameover-records-section` and `#gameover-name-entry` are toggled via the `.hidden` class, but their base rules are ID selectors; the `.hidden` override for them had to be written as `#id.hidden` (id+class specificity) to beat the base `#id { display: flex }` rule — a bare `.hidden { display: none }` alone is not enough for ID-styled elements.
- Before the first `init()` call (start screen showing), `board`/`current`/`next` are `undefined`; any new code path reachable from that state (keyboard, theme toggle, etc.) must check `gameStarted` first, same as the existing `keydown` handler and `togglePause()`.
