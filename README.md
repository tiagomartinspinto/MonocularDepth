# Monocular Depth

Monocular Depth is a browser-based artwork where space, language, and perception drift out of alignment.

The piece opens into a fullscreen dark field of slow particles. Depth emerges through motion, scale, opacity, parallax, and occlusion. A rare multilingual Dada sentence may appear, then fade back into silence.

Deployed with GitHub Pages.

## Performance

- static HTML/CSS/JS
- no backend, npm, build step, analytics, or tracking
- one canvas
- no visible UI panels
- no blur filters, canvas shadows, or particle glow
- maximum `60` particles on desktop and `35` on mobile
- `devicePixelRatio` capped at `1.5`
- animation pauses when the document is hidden
- reduced motion slows the field

## Run Locally

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Manual Check

1. Confirm the canvas fills the window.
2. Confirm there is no visible UI panel.
3. In DevTools Console, run:

   ```js
   document.getElementById("depth-field").dataset
   ```

   Desktop should show `particles: "60"` or less. Mobile width should show `particles: "35"` or less. `safeMode` should be `"true"`.

4. Move the pointer slowly and watch that CPU/GPU usage stays calm.
5. Switch tabs and confirm animation pauses while hidden.

## GitHub Pages

GitHub Pages can serve the repository root directly. No build step is required.

## Privacy

Monocular Depth runs entirely in the browser. It uploads no data and makes no external tracking or analytics calls.
