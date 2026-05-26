# Project Status

## Completed Changes

- Created the first safe version of Monocular Depth as a static HTML/CSS/JS project.
- Kept the app to one fullscreen canvas with no backend, no dependencies, and no network calls.
- Limited particles to a maximum of `60` on desktop and `35` on mobile.
- Capped canvas `devicePixelRatio` at `1.5`.
- Removed per-frame blur filters, canvas shadows, heavy glow, gradients, and particle burst effects.
- Built depth cues from only size, alpha, speed, parallax, and simple line connections.
- Preserved the poetic two-layer perception model: a sharper responsive dominant layer and a delayed, offset, dimmer amblyopic layer.
- Added bottom-centered controls for perception, motion depth, and text fragments.
- Added subtle text fragments that fade in and out inside the field.
- Paused animation when the document is hidden.
- Added reduced-motion behavior that slows the field and lowers render scale.
- Added debounced resize handling.
- Added keyboard support and screen-reader value text for the perception slider.
- Updated README with concept, local testing, manual performance checks, GitHub Pages deployment, and privacy notes.

## Files Changed

- `index.html`
- `styles.css`
- `main.js`
- `README.md`
- `PROJECT_STATUS.md`

## Remaining Tasks

- Test on the laptop/browser combination that previously froze.
- Tune particle count or line distance lower if that machine still shows high CPU/GPU usage.
- Enable GitHub Pages after the first push if it is not already enabled in repository settings.

## Known Issues

- The visual field is intentionally subtle and may look very dim on low-brightness displays.
- Canvas rendering and frame pacing can vary across browsers and battery-saver modes.
- Real CPU/GPU impact should be checked on the target machine, not only through static validation.

## Local Verification

- Ran JavaScript syntax validation with `node --check main.js`.
- Confirmed the local static server serves `index.html` and `main.js`.
- Scanned app files for removed heavy APIs and allocation patterns: no `ctx.filter`, canvas shadows, gradients, `.map()`, `.forEach()`, or external network/tracking APIs were found.
- Confirmed the code includes `requestAnimationFrame`, `cancelAnimationFrame`, `document.hidden`, `visibilitychange`, capped `devicePixelRatio`, debounced resize, and particle-count constants.

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
