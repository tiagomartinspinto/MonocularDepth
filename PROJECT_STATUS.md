# Project Status

Public URL: [https://tiagomartinspinto.github.io/MonocularDepth/](https://tiagomartinspinto.github.io/MonocularDepth/)

## Completed Changes

- Reframed Monocular Depth as an abstract browser artwork about perception, adaptation, compensation, and learned space.
- Removed earlier specific-context framing from the public copy and project notes.
- Kept the app to a static HTML/CSS/JS site with no backend, no dependencies, no npm, and no build step.
- Kept one fullscreen canvas and one bottom-centered control surface.
- Limited particles to a maximum of `60` on desktop and `35` on mobile.
- Capped canvas `devicePixelRatio` at `1.5`.
- Removed per-frame blur filters, canvas shadows, heavy glow, gradients, and particle burst effects.
- Built depth cues from motion, scale, opacity, speed, parallax, and lightweight occlusion.
- Preserved two interacting perceptual systems: one stable and responsive, one delayed, offset, dimmer, and subtly unstable.
- Updated text fragments to abstract language: “distance learned itself”, “space arrives slowly”, “depth from movement”, “not fixed”, “between surfaces”, “perception compensates”, “the image reorganizes”, and “motion becomes space”.
- Updated the perception slider language to stable, adaptive, and unstable.
- Paused animation when the document is hidden.
- Added reduced-motion behavior that slows the field and lowers render scale.
- Kept debounced resize handling.
- Updated README with the abstract concept, Pages URL, local testing, manual performance checks, GitHub Pages deployment, and privacy notes.

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
- Confirmed the code includes `requestAnimationFrame`, `cancelAnimationFrame`, `document.hidden`, `visibilitychange`, capped `devicePixelRatio`, debounced resize, and particle-count constants.
- Scanned public files for terms from the earlier framing and found none remaining.
- Pushed to `main` and confirmed the public Pages URL returns HTTP `200`.

## Manual Tests To Do Next

- Open the local URL and confirm the canvas appears immediately.
- Run `document.getElementById("depth-field").dataset` in DevTools and confirm `safeMode` is `"true"`.
- Confirm desktop particle count is `60` or less and mobile particle count is `35` or less.
- Watch CPU/GPU in DevTools Performance Monitor or Activity Monitor while moving the pointer.
- Resize the window repeatedly and confirm the page does not freeze.
- Switch away from the tab for at least `10` seconds and confirm CPU drops while hidden.
- Return to the tab and confirm animation resumes without a jump.
- Enable reduced-motion at the OS level, reload, and confirm slower motion.
- Toggle motion depth and text fragments to confirm controls stay responsive.
