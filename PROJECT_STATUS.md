# Project Status

Public URL: [https://tiagomartinspinto.github.io/MonocularDepth/](https://tiagomartinspinto.github.io/MonocularDepth/)

## Completed Changes

- Transformed the fixed text layer into a multilingual Dada language machine.
- Removed the previous fixed text fragments.
- Added mixed English, Portuguese, Galician, and Finnish word banks for subjects, verbs, objects, qualifiers, and adjectives.
- Added a hybrid word generator that combines fragments across languages.
- Added template-based sentence generation with languages intentionally colliding rather than separating or translating.
- Pre-generates text events from the language machine so the animation loop only fades one sentence at a time.
- Enforces a maximum of one visible sentence at a time.
- Added long empty pauses, random text positions, low opacity, slow fade-in, and slow fade-out.
- Removed the visible bottom UI panel so the canvas remains the whole artwork.
- Kept the app to a static HTML/CSS/JS site with no backend, no dependencies, no npm, and no build step.
- Kept one fullscreen canvas.
- Limited particles to a maximum of `60` on desktop and `35` on mobile.
- Capped canvas `devicePixelRatio` at `1.5`.
- Kept the performance-safe particle system with no per-frame blur filters, canvas shadows, heavy glow, gradients, or particle burst effects.
- Built depth cues from motion, scale, opacity, speed, parallax, and lightweight occlusion.
- Preserved two interacting perceptual systems: one stable and responsive, one delayed, offset, dimmer, and subtly unstable.
- Paused animation when the document is hidden.
- Kept reduced-motion behavior that slows the field and lowers render scale.
- Updated README with the Dada language-machine direction, Pages URL, local testing, manual performance checks, GitHub Pages deployment, and privacy notes.

## Files Changed

- `index.html`
- `styles.css`
- `main.js`
- `README.md`
- `PROJECT_STATUS.md`

## Remaining Tasks

- Test on the laptop/browser combination that previously froze.
- Tune particle count or line distance lower if that machine still shows high CPU/GPU usage.
- Re-check the Pages CDN after cache expiry if an old asset is still visible immediately after deployment.

## Known Issues

- The visual field is intentionally subtle and may look very dim on low-brightness displays.
- Canvas rendering and frame pacing can vary across browsers and battery-saver modes.
- Real CPU/GPU impact should be checked on the target machine, not only through static validation.
- GitHub Pages can take a short moment to refresh cached assets after a push.

## Local Verification

- Ran JavaScript syntax validation with `node --check main.js`.
- Confirmed the local static server serves `index.html` and `main.js`.
- Scanned app files for removed heavy APIs and allocation patterns: no `ctx.filter`, canvas shadows, gradients, `.map()`, `.forEach()`, or external network/tracking APIs were found.
- Confirmed the code includes `requestAnimationFrame`, `cancelAnimationFrame`, `document.hidden`, `visibilitychange`, capped `devicePixelRatio`, and particle-count constants.
- Confirmed the old fixed fragments are no longer present.
- Confirmed the new multilingual word-bank fragments are present.
- Scanned public files for terms from the earlier framing and found none remaining.

## Manual Tests To Do Next

- Open the local URL and confirm the canvas appears immediately.
- Run `document.getElementById("depth-field").dataset` in DevTools and confirm `safeMode` is `"true"`.
- Confirm desktop particle count is `60` or less and mobile particle count is `35` or less.
- Watch CPU/GPU in DevTools Performance Monitor or Activity Monitor while moving the pointer.
- Confirm there is no visible UI panel.
- Wait through several language cycles and confirm no more than one sentence is visible at a time.
- Confirm empty pauses occur between text appearances.
- Resize the window repeatedly and confirm the page does not freeze.
- Switch away from the tab for at least `10` seconds and confirm CPU drops while hidden.
- Return to the tab and confirm animation resumes without a jump.
- Enable reduced-motion at the OS level, reload, and confirm slower motion.
