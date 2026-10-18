---
name: games
priority: 90
enabled: true
---

# Games

Build the game the admin describes, never a substitute or a simpler toy.

- Size the canvas to its container times `devicePixelRatio`, resize it on resize and orientation change, and keep game logic in logical units that do not depend on screen size.
- Loop: `requestAnimationFrame` with delta time (clamped to about 50 ms), plus a fixed physics step if needed. Pause on `visibilitychange` and show a pause screen.
- States: title → playing → paused → game over (score, best score, replay). Start on a tap.
- Controls follow the touch-first rules: the game is fully playable with thumbs (on-screen controls or tap/swipe/drag, multi-touch). The keyboard is a desktop bonus.
- Feel: responsive controls, clear feedback (particles, flashes, a little screen shake), progressive difficulty, fair collisions.
- Sound: Web Audio, unlocked on the first tap. Short generated sounds (oscillators) or bundled assets. A mute toggle remembered in `runtime.storage`.
- Graphics: draw with code, SVG or bundled assets. No remote images when the app is offline.
- Persist best scores, settings and progress (`runtime.storage` or `runtime.db`).
- Performance: 60 fps on mid-range phones. Reuse objects (pools) when there are many entities and avoid allocations inside the loop.
- Libraries when they add real value: Phaser (2D action), PixiJS (many sprites), three.js (3D), matter-js (physics). Plain canvas for simple games.
