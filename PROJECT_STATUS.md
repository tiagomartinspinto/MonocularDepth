# Project Status

## Passing-Field Experiment

Branch: `passing-clouds-test` (not merged, not pushed), from `main` at `exhibition-candidate-1`.

- Eight residue fields now pass slowly across the frame in one shared oblique direction (the far fragments, the faint wash, the small upper stains, the broad far veil, and the two near soft masses); the ink, the graphite at fixation, and the veils whose cuts occlude them stay anchored, like a disturbance held on the retina while the field beyond it goes by.
- Passage speed follows depth (nearer material passes faster), so passage is itself a monocular depth cue. Near material crosses the view in roughly 1.5 minutes, the farthest in about 6.
- The passage is never steady: a shared slow sway lets it hesitate and gather again. While depth flattens, every field converges on one much slower shared speed, so the passage all but stalls on the flat plane and resumes as depth forms.
- Each passing field is a stream of two long tiles. A tile that has left the frame is rebuilt from new, seeded masses of the same material and joins the back of the stream, so what arrives never repeats what left. The work still opens on its composed arrangement.
- Evolving residue states depart further from the composed state (stronger in-place reshaping, edge and density redistribution, and a broad uneven threshold so openings form in one part of a field while another closes). Centre displacement is unchanged, so anchored fields do not travel.
- Text placement predicts where passing fields will be while a sentence is present. Text corpus, timing, flattening, recalibration, palette, haze, occlusion, and reduced-motion handling are otherwise unchanged; reduced motion slows the passage to 30%.
- Upstream tiles are built after the volume has assembled, nearest first, so start-up time is unchanged.
- Anchored fields (the far veil, the graphite at fixation, the ink, and the two veils that cut across them) are positionally anchored but no longer frozen: morphology without passage. Their alternate states barely move or resize masses; edges, internal density and broad threshold lobes change instead, and each alternate keeps the composed state's overall strength, so nothing swells or breathes. Their change order is finer, so a change is scattered rather than sweeping.
- Anchored fields never settle. Each is read through two slow, overlapping changes (one toward each alternate state) that reach different parts of the field at different times and in opposite senses, so some part is always under way while another is turning. Each change has its own rate and a wandering pace that never stops; they slow to about 70% while depth is flat and continue through recalibration. Their change order is equalised over the residue, so change is spread evenly in time.
- The field's total strength is held while its material moves: alternates are balanced to the composed state, and a small opacity correction (computed exactly from precomputed map moments) keeps the displayed total constant, so nothing breathes or pulses. Every 5-second window shows change, centroids stay within about 1.5% of each field's width, and total strength stays within 1%.
- Passing fields are unchanged: identical tile maps, speeds, direction, sway and flat-phase stall.

## Three.js Depth-Volume Experiment

Branch: `threejs-depth-volume-test` (not merged, not pushed). The original 2D canvas implementation remains preserved on `main`.

- Replaced the 2D canvas field with a Three.js shallow depth volume: one renderer, one scene, one perspective camera, one animation loop.
- Introduced genuine Z-depth: 13 translucent spatial layers between 4.3 and 21 units from the viewer.
- Layers are washed-charcoal residue, erasure veils, and one faint formless density, generated procedurally as alpha maps at startup.
- Layer planes cover 1.5x the view at their depth and fade to zero alpha before their edges, so plane boundaries are not visible.
- Depth cues are built into the volume itself: occlusion by field-coloured veils with wavering cut edges, fog as aerial perspective, finer texture detail with distance, softer layers away from the fixation depth.
- Autonomous camera parallax: tiny lateral, vertical and forward drift while holding a mid-depth fixation, with occasional slow re-fixation. Near and far material slide in opposite directions.
- Depth cycle, loosely timed and non-repeating: legible, uncertain (relative motion begins converging and veils thicken), flat (layers collapse onto one shared plane), then space forms again.
- Flattening now reaches and holds near-full parallax cancellation: each phase eases to its target and holds, giving a flat plateau of roughly 18-27 seconds at full alignment. The image still moves as one sheet during the plateau.
- Independent layer drift is suppressed during the flat phase and returns slowly as depth re-forms.
- Depth contrast is compressed during flat without revealing additional far layers: nearer layers take on mid-depth tone and strength, while far haze is left unchanged.
- Legible-phase parallax was slightly strengthened (camera lateral travel increased by about 40%).
- Landscape-like horizontal composition removed: no horizon band, sky zone, ground zone, shoreline, or cloud-bank forms. Residue now forms a few separate compound depth events.
- Depth cues are distributed independently of screen height: near, defocused material sits high as well as low, and small crisp distant material sits high as well as low.
- Negative space was rebalanced away from a sky/horizon/ground reading into irregular open areas; text regions were moved to follow the new open areas.
- Genuine Z-depth and flattening behavior were preserved (alignment still reaches 1.0 with a near-motionless flat plateau of roughly 21-27 seconds).
- The trace field has been removed completely; evolving residue, spatial depth, flattening, recalibration, and occasional text now carry the composition.
- Rare English sentence kept (same word banks and templates): one sentence maximum, long intervals, slow fade in, brief presence, slow fade out, placed in the scene at a shallow depth where it can be partly veiled.
- The sentence layer now occupies real scene depth: each sentence sits between existing layers (about 5.5 to 11 units, never on a layer's plane), so it sorts against residue and veils and shares the camera parallax and flattening like everything else.
- Placement starts from the existing text zones but reads the built residue and veil maps along the sight line, so a sentence is often partly behind a veil or close to residue rather than always in empty space; readability is checked first and recent positions are avoided.
- Text can be partially occluded by the spatial layers themselves (no HTML mask). Focus and contrast respond subtly to depth: sentences away from the fixation depth are baked slightly softer, and haze and flat-phase compression apply to text as they do to the layers.
- Text remains autonomous and restrained: same fades, no motion of its own, no UI overlay or DOM text introduced.
- On `thought-cadence-test`, the observer-aware cloud voice is replaced with 26 authored perceptual thoughts: short checks, interrupted corrections, spatial and temporal fragments, two subvocal hesitations, and occasional longer thoughts. Entries remain equally selected from those outside the recent-fragment exclusion window (16 entries at this corpus size). The silence between fragments is arrhythmic and independent of the image: a long absence (120–240 s, 35%), a moderate pause (45–90 s, 50%) or, rarely, a quick second thought (5–18 s, 15%) that is never followed by another. Placement and rendering are unchanged.
- On `language-memory-test`, the corpus stays at 26 fragments but gains memory: six mostly locational lines (`still there`, `closer`, `that part`, `further back`, `inside / no`, `after that`) are replaced by `found it`, `not gone`, `it was darker`, `there was more here`, `I thought this was closer` and `I had it just now`. Three fragments contain `I` and none contain `you`.
- No fragment uses a slash: interruption is carried by syntax, timing and correction alone (`the other one`, `a little lower`, `same place maybe`, `it moved or I did`, `I had it just now`). The two hesitations are written traces of vocal sound rather than words: an open breath (`ahhhhhhhhh`) and a longer closed-mouth hum (`mmmmmmmmmmmm`), their letter count standing for duration.
- Fragments are grouped into six unseen families (finding, remembering, holding, correcting, losing, hesitation). Selection remembers only the previous fragment's family and the silence since it: after a long silence it is free; after a moderate pause it stays in the same or a neighbouring family 30% of the time; after a quick return it stays in the same family or moves to a correction 75% of the time. The sounds are never chosen as related, and one never directly follows the other. Anti-repetition, timing, placement and the image are unchanged, and selection never reads the visual state.
- On `thought-behaviour-test`, a thought is no longer one indivisible caption. After the family memory chooses a fragment (unchanged), the thought is planned whole as a few timed marks, each showing a span of a line on one of three sheets of type: two for thoughts, one for what a thought leaves behind. At most two thoughts and one residue are ever visible, and nothing in the plan reads the image. In a 200,000-thought simulation: about 58% appear whole, with slightly varied fade curves; 11% are corrected, as a second fragment chosen like a quick return appears elsewhere while the first is still fading (1–6 s visible together); 8% are interrupted, stopping a word or two short at a word boundary, never quite reaching full strength and fading sooner; 4.5% leave their last word or two in place for 2–8 s after the rest has gone; 5% are echoes and 7% imperfect returns, where a fragment shown at least three thoughts earlier comes back somewhere new as its last word or two, or missing a word or two at either end. A recalled fragment cannot be recalled again for the next six recalls. The corpus is unchanged, and the partial forms exist only while shown.
- The two sounds (about 7% of thoughts) are shown at 2–5 lengths in turn, changing by at least two letters every few seconds and never letter by letter. The first letter stays in place: letters gained fade in on the second sheet and are then taken into the first; letters let go are handed to the second sheet and fade from there. A sound may grow to full length, start full and let go, swell and settle, or (rarely) break off before full length. The outer silences (long, moderate, quick return) are unchanged, and everything a thought does happens within its one appearance.
- Procedural texture resolution was improved: each residue map now covers only the region its masses reach and is rastered to the layer's intended softness (about 1 to 3 screen pixels per texel at 1080 lines, previously about 4 to 8).
- Visible edge aliasing and stair-stepping were removed at the source: noise is no longer generated finer than the raster that carries it, and edges are resolved against the local gradient so thresholds cannot step from texel to texel when magnified.
- Residue generation was varied to reduce repeated procedural signatures: each layer has its own fine-octave character, fine structure is not sheared into streaks or filaments, and internal density is broad and uneven rather than an even grain. Silhouettes and composition are unchanged.
- No new rendering dependencies, shaders, or post-processing were introduced; residue is still generated procedurally on the CPU as alpha maps.
- Strictly monochrome warm tonal ladder: off-white field, graphite, charcoal, ink, and text tones. No colour.
- No visible 3D primitives, particles, dots, grids, wireframes, network graphs, or post-processing.
- No user interaction: no controls, no pointer, touch, or keyboard handling, no OrbitControls.
- Rendering capped at 30 fps (20 fps with reduced motion), device pixel ratio capped at 1.5, animation stopped while the document is hidden.
- After a WebGL context loss and restore, the field clear colour is re-applied (Three.js resets it to black), so the artwork resumes exactly as it was rendered before the loss.
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
- Scene renders 13 residue layers and no trace fragments; measured differential parallax between near and far layers in the legible phase, converging in the flat phase.
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
