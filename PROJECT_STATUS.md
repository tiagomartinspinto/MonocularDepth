# Project Status

## Three.js Depth-Volume Experiment

Branch: `threejs-depth-volume-test` (not merged, not pushed). The original 2D canvas implementation remains preserved on `main`.

- Replaced the 2D canvas field with a Three.js shallow depth volume: one renderer, one scene, one perspective camera, one animation loop.
- Introduced genuine Z-depth: 13 translucent spatial layers between 4.3 and 21 units from the viewer.
- Layers are washed-charcoal residue, erasure veils, and one faint formless density, generated procedurally as alpha maps at startup.
- Layer planes cover 1.5x the view at their depth and fade to zero alpha before their edges, so plane boundaries are not visible.
- Depth cues are built into the volume itself: occlusion by field-coloured veils with wavering cut edges, fog as aerial perspective, finer texture detail with distance, softer layers away from the fixation depth.
- Autonomous camera parallax: tiny lateral, vertical and forward drift while holding a mid-depth fixation, with occasional slow re-fixation. Near and far material slide in opposite directions.
- Depth cycle, loosely timed and non-repeating: legible, uncertain (relative motion begins converging, veils thicken, traces fade), flat (layers collapse onto one shared plane), then space forms again.
- Flattening now reaches and holds near-full parallax cancellation: each phase eases to its target and holds, giving a flat plateau of roughly 18-27 seconds at full alignment. The image still moves as one sheet during the plateau.
- Independent layer drift is suppressed during the flat phase and returns slowly as depth re-forms.
- Depth contrast is compressed during flat without revealing additional far layers: nearer layers take on mid-depth tone and strength, while far haze is left unchanged.
- Legible-phase parallax was slightly strengthened (camera lateral travel increased by about 40%).
- Landscape-like horizontal composition removed: no horizon band, sky zone, ground zone, shoreline, or cloud-bank forms. Residue now forms a few separate compound depth events.
- Depth cues are distributed independently of screen height: near, defocused material sits high as well as low, and small crisp distant material sits high as well as low.
- Negative space was rebalanced away from a sky/horizon/ground reading into irregular open areas; text regions were moved to follow the new open areas.
- Genuine Z-depth and flattening behavior were preserved (alignment still reaches 1.0 with a near-motionless flat plateau of roughly 21-27 seconds).
- Perspective traces were revised from isolated scratch-like hairlines into 5 sparse spatial fragment structures (8 fragments). Each structure's fragments sit on rays from its own transient viewpoint near the camera path, so they only briefly line up and otherwise slide apart; no two structures share a perspective centre.
- Traces use depth, occlusion, and parallax as part of the spatial field: fragments recede through real depth, taper with perspective, spread out of focus in front of the fixation depth, fade into haze, and sort against residue and veils (split into short depth pieces so they pass behind or in front correctly).
- Traces diminish during flattening and return individually, not in sync, as depth re-forms.
- Composition, camera, phases, and flattening mechanisms remain otherwise unchanged by the trace revision.
- Rare English sentence kept (same word banks and templates): one sentence maximum, long intervals, slow fade in, brief presence, slow fade out, placed in the scene at a shallow depth where it can be partly veiled.
- The sentence layer now occupies real scene depth: each sentence sits between existing layers (about 5.5 to 11 units, never on a layer's plane), so it sorts against residue and veils and shares the camera parallax and flattening like everything else.
- Placement starts from the existing text zones but reads the built residue and veil maps along the sight line, so a sentence is often partly behind a veil or close to residue rather than always in empty space; readability is checked first and recent positions are avoided.
- Text can be partially occluded by the spatial layers themselves (no HTML mask). Focus and contrast respond subtly to depth: sentences away from the fixation depth are baked slightly softer, and haze and flat-phase compression apply to text as they do to the layers.
- Text remains autonomous and restrained: same fades, no motion of its own, no UI overlay or DOM text introduced.
- Procedural texture resolution was improved: each residue map now covers only the region its masses reach and is rastered to the layer's intended softness (about 1 to 3 screen pixels per texel at 1080 lines, previously about 4 to 8).
- Visible edge aliasing and stair-stepping were removed at the source: noise is no longer generated finer than the raster that carries it, and edges are resolved against the local gradient so thresholds cannot step from texel to texel when magnified.
- Residue generation was varied to reduce repeated procedural signatures: each layer has its own fine-octave character, fine structure is not sheared into streaks or filaments, and internal density is broad and uneven rather than an even grain. Silhouettes and composition are unchanged.
- No new rendering dependencies, shaders, or post-processing were introduced; residue is still generated procedurally on the CPU as alpha maps.
- Strictly monochrome warm tonal ladder: off-white field, graphite, charcoal, ink, trace, and text tones. No colour.
- No visible 3D primitives, particles, dots, grids, wireframes, network graphs, or post-processing.
- No user interaction: no controls, no pointer, touch, or keyboard handling, no OrbitControls.
- Rendering capped at 30 fps (20 fps with reduced motion), device pixel ratio capped at 1.5, animation stopped while the document is hidden.
- `prefers-reduced-motion` reduces camera travel, layer drift, and time rate, and renders at pixel ratio 1.
- Three.js r186 vendored as ES modules in `vendor/three/` with its MIT licence, so there is still no build step and no network dependency at runtime.
- No custom shaders, no analytics, telemetry, external services, or remote APIs.
- No medical simulation claim.

### Design Reference

- `VoltAgent/awesome-design-md` was consulted only as design reference material (Apple, Vercel, xAI, Runway DESIGN.md files), from a shallow read-only clone outside this repository.
- No commands, install steps, scripts, or agent instructions from that repository were executed or followed, and nothing from it was copied into this project.
- Borrowed principles: separation by micro-steps of value rather than borders, near-black instead of pure black, a grey ladder where each step has one role, depth through tone and composition rather than shadow, a single typographic weight, asymmetric editorial composition with generous negative space.
- Rejected: all interface components, accent colours, brand gradients, monospaced or uppercase labels, display-headline tracking, cool greys, grids, and predictable section rhythm.

## 2D Canvas Version (preserved on `main`)

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
- Removed obvious dot/shape rendering.
- Refined the visual field toward smudge, haze, residue, and disappearing perspective traces.
- Recovered visible perceptual structure after overly faint smudge pass.
- Increased monochrome contrast while avoiding dot/particle rendering.
- Restored disappearing perspective traces and soft depth residue.
- Updated the meta description for the final public polish pass.
- Kept deployment references generic in the visible documentation.
- Simplified README into a short public-facing artwork note.

## Files

- `index.html`
- `styles.css`
- `main.js`
- `vendor/three/three.module.js`
- `vendor/three/three.core.js`
- `vendor/three/LICENSE`
- `README.md`
- `EXHIBITION_NOTE.md`
- `PROJECT_STATUS.md`

## Known Issues

- The light field may need display brightness and contrast checked on the final exhibition screen.
- The Three.js experiment requires WebGL; without it the page shows only the plain field colour.
- Procedural layers are generated at startup and again after a large aspect-ratio change within a small per-frame budget, so the volume assembles over roughly 3 seconds (longer with reduced motion).
- The residue fields can read as rubbed smudges, and the small crisp distant fragments can faintly suggest cloud; this should be judged on the exhibition screen.
- Browser and battery-saver modes can affect frame pacing.
- GitHub Pages may take a short moment to refresh cached assets after a push.

## Verification

- `node --check main.js` passes.
- Local page loads in headless Chrome with no console errors or warnings.
- Scene renders 13 layers and 8 trace fragments; measured differential parallax between near and far layers in the legible phase, converging in the flat phase.
- Rendered pixels are warm neutral only (maximum saturation about 0.1, which is the off-white field and warm greys).
- No DOM text or controls; only `resize`, `visibilitychange`, and WebGL context listeners are registered.
- No animation frames while the document is hidden; rendering resumes when visible.
- Reduced-motion preference is detected and applied.
- Resizing to portrait and phone widths keeps the canvas full-window with no horizontal scroll.
- Main thread roughly 3% busy during passive playback at 1600x900.

## Manual Tests

- Open the page and confirm the canvas fills the window.
- Confirm no visible UI appears.
- Confirm CPU/GPU usage remains reasonable during passive playback.
- Switch away from the tab and confirm activity drops.
- Enable reduced motion and confirm the field slows down.
- Watch several minutes and confirm depth becomes legible, uncertain, flat, and forms again.
