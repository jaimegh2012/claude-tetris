# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No `package.json`, no build, no tests, no linter. README and UI text are in Spanish.

## Run

Open `index.html` directly, or serve statically: `python -m http.server 8000` then visit `http://localhost:8000`.

## Architecture

Three files, all logic in `game.js` (plain `<script>`, `'use strict'`, global state, no modules):

- `index.html` — `#board` canvas (300×600), `#next-canvas` (120×120), HUD spans (`#score`, `#lines`, `#level`), `#overlay` used for both PAUSA and GAME OVER.
- `style.css` — dark theme.
- `game.js` — module-level `let` vars (`board`, `current`, `next`, `score`, ...) reset in `init()`. `restartBtn` calls `init()`.

Piece lifecycle: `randomPiece()` -> `spawn()` (`current = next`, new `next`; game over if spawn collides) -> `collide()`-checked moves -> `lockPiece()` = `merge()` + `clearLines()` + `spawn()`. Board cells hold `0` or color index 1–8; `PIECES` and `COLORS` are indexed by the same type number (index 0 is `null`). Type 8 (`Tuerca`) is a 3×3 ring with an empty center cell.

Type 9 (`RAYO`) is a 1×1 powerup piece, excluded from the normal 1–8 random pool. `randomPiece()` spawns it with probability `RAYO_CHANCE`, or forces it via a per-level countdown (`rayoPending`/`rayoCountdown`, reset by `resetRayoForLevel()` in `init()` and whenever `addLines()` bumps `level`) so every level guarantees at least one. `lockPiece()` branches on `current.type === RAYO`: instead of `merge()` + `clearLines()`, it calls `strikeLightning(x, y)`, which clears the piece's full row and column (row collapses like a normal line clear via `splice`/`unshift`; column cells are just zeroed) and awards `10 * level` per destroyed cell plus 1 line via the shared `addLines()` helper (also used by `clearLines()`).

Drop paths are separate: gravity in `loop()`, `softDrop()` (+1/row), `hardDrop()` (+2/row via `ghostY()`). All converge on `lockPiece()`.

Visual skins: `SKINS = { retro, neon, pastel, pixel }` (near `COLORS`/`THEME_COLORS`), each with a `colors` array (same 0–9 indexing as `PIECES`/`COLORS`; `retro`/`pixel` just reference the original `COLORS` array) plus optional flags (`glow`, `forceDarkBg`, `rounded`, `texture`). `drawBlock()` now reads `SKINS[currentSkin].colors[colorIndex]` instead of `COLORS` directly and branches its drawing on those flags: `glow` sets `context.shadowBlur`/`shadowColor` before filling and resets `shadowBlur = 0` at the end of the function (must stay reset or grid/HUD drawing after it inherits the glow); `rounded` uses `context.roundRect` when available, falling back to a plain `fillRect`; `texture` calls `drawPixelTexture()`, which subdivides the block into a 4×4 grid of alternating lighter/darker sub-squares with 1px dark borders. `draw()`/`drawNext()` fill the canvas black first when `SKINS[currentSkin].forceDarkBg` is set (neon only), independent of the light/dark `theme` toggle. Skin choice lives in `currentSkin`, persisted to `localStorage` (`tetris-skin`) via `applySkin()`/`readStoredSkin()`, mirroring the `theme`/`applyTheme()`/`readStoredTheme()` pattern; the `#skin-select` change handler calls `applySkin()` then `draw(); drawNext();` to repaint immediately without reload.

## Gotchas

- Canvas size in `index.html` is hardcoded; changing `COLS`/`ROWS`/`BLOCK` in `game.js` requires updating `width`/`height` of `#board` by hand.
- Initial drop interval `1000` and formula `max(100, 1000 - (level-1)*90)` are duplicated in `init()` and `clearLines()`.
- `endGame()` can run inside `loop()` (via `lockPiece` -> `spawn`), but `loop()` then unconditionally re-requests a frame after `cancelAnimationFrame`, so the loop keeps running after game over. Keep in mind if touching loop/endGame/pause logic.
- Rotation is `rotateCW` only, with simple horizontal kicks `[0, -1, 1, -2, 2]` in `tryRotate` (not SRS).
- Keyboard uses `e.code` (`KeyP`, `KeyX`, `Space`, arrows), so layout-independent.
