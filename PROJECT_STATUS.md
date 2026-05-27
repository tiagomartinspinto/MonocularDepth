# Project Status

Public URL: [https://tiagomartinspinto.github.io/MonocularDepth/](https://tiagomartinspinto.github.io/MonocularDepth/)

## Completed Changes

- Transformed the fixed text layer into a multilingual Dada language machine.
- Removed the previous fixed text fragments.
- Added mixed English, Portuguese, Galician, and Finnish word banks for subjects, verbs, objects, qualifiers, and adjectives.
- Added a hybrid word generator that combines fragments across languages.
- Added template-based sentence generation with languages intentionally colliding rather than separating or translating.
- Added a final Dada refinement pass with rarer text, broken sentence templates, and less grammatically clean language.
- Increased silence between text events to `8`-`24` seconds, with occasional `30`-`40` second gaps.
- Made hybrid words less clean through truncation, vowel duplication, missing seam letters, and awkward overlaps.
- Made text smaller, dimmer, slower to fade, and less likely to appear near the exact center.
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
- Confirmed the final Dada templates and longer silence range are present.
- Confirmed the local browser loads the page with `particles: "60"`, `dpr: "1.5"`, `safeMode: "true"`, and `0` visible controls.
- Captured a local browser screenshot confirming the dark minimal particle field renders.
- Scanned public files for terms from the earlier framing and found none remaining.
- Pushed the multilingual Dada language-machine version to `main`.
- Pushed the final Dada refinement pass to `main`.
- Confirmed the public Pages URL returns HTTP `200`.
- Confirmed a cache-busted Pages request for `main.js` returns the updated language-machine asset.

## Manual Tests To Do Next

- Open the local URL and confirm the canvas appears immediately.
- Run `document.getElementById("depth-field").dataset` in DevTools and confirm `safeMode` is `"true"`.
- Confirm desktop particle count is `60` or less and mobile particle count is `35` or less.
- Watch CPU/GPU in DevTools Performance Monitor or Activity Monitor while moving the pointer.
- Confirm there is no visible UI panel.
- Wait through several language cycles and confirm no more than one sentence is visible at a time.
- Confirm most text pauses last `8`-`24` seconds and that occasional pauses can last `30`-`40` seconds.
- Confirm hybrid words sometimes look truncated, vowel-doubled, seam-damaged, or awkwardly overlapped.
- Resize the window repeatedly and confirm the page does not freeze.
- Switch away from the tab for at least `10` seconds and confirm CPU drops while hidden.
- Return to the tab and confirm animation resumes without a jump.
- Enable reduced-motion at the OS level, reload, and confirm slower motion.
