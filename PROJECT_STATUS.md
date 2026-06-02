# Project Status

## Completed

- Built a static HTML/CSS/JS artwork with one fullscreen canvas.
- Kept the particle field performance-safe: `60` particles maximum on desktop, `35` on mobile, and `devicePixelRatio` capped at `1.5`.
- Avoided blur filters, canvas shadows, particle glow, analytics, tracking, npm, and build steps.
- Added pause-on-hidden-tab behavior and reduced-motion handling.
- Removed visible controls so the artwork remains an uninterrupted field.
- Removed pointer and touch interaction.
- Made the field fully autonomous for exhibition playback.
- Refined particle placement into subtle depth planes with slower drift.
- Added a sparse broken depth-line layer between nearby particles.
- Tuned the line layer toward unstable perspective rather than network-graph structure.
- Simplified the text system to English-only word banks and templates.
- Tightened the sentence layer toward quieter perceptual language.
- Added a rare English-language sentence layer with one sentence maximum on screen.
- Created exhibition note for curatorial, wall-text, and installation use.
- Museum/public polish pass completed.
- Light-background museum test pass added.
- Shifted to an off-white field with dark particles, dark text, and subtle dark perspective lines.
- Added subtle non-uniform softness zones without illustrative or condition-specific framing.
- Refined monochrome light-field optics toward haze, uneven focus, and subtle visual dissolution.
- Kept the reference atmospheric only; no colour, no portrait, no music-video copy, no medical simulation claim.
- Refined circular particles into irregular optical marks.
- Reduced particle-demo/dot-field appearance.
- Updated the meta description for the final public polish pass.
- Kept deployment references generic in the visible documentation.
- Simplified README into a short public-facing artwork note.

## Files

- `index.html`
- `styles.css`
- `main.js`
- `README.md`
- `EXHIBITION_NOTE.md`
- `PROJECT_STATUS.md`

## Known Issues

- The light field may need display brightness and contrast checked on the final exhibition screen.
- Browser and battery-saver modes can affect canvas frame pacing.
- GitHub Pages may take a short moment to refresh cached assets after a push.

## Verification

- `node --check main.js` passes.
- Local page loads.
- Canvas renders.
- No visible UI panel.
- No console errors found in the local browser check.
- English-only text scan passes.
- Earlier framing terms remain absent from public files.

## Manual Tests

- Open the Pages URL and confirm the canvas fills the window.
- Confirm no visible UI appears.
- Confirm CPU/GPU usage remains reasonable during passive playback.
- Switch away from the tab and confirm activity drops.
- Enable reduced motion and confirm the field slows down.
