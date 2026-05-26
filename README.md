# Monocular Depth

Monocular Depth is a browser-based artwork exploring how depth and space can emerge through adaptation, motion, and perception.

The piece opens into a fullscreen dark field where two perceptual systems overlap. One remains stable and responsive; the other arrives slightly late, offset, dimmer, and occasionally unstable. Together they form a quiet field of negotiated space rather than a diagram or simulation.

Public version: [https://tiagomartinspinto.github.io/MonocularDepth/](https://tiagomartinspinto.github.io/MonocularDepth/)

## Performance

This is a static, performance-safe version:

- one canvas
- no external libraries
- no blur filters, canvas shadows, analytics, or network calls
- maximum `60` particles on desktop
- maximum `35` particles on mobile
- `devicePixelRatio` capped at `1.5`
- animation pauses when the document is hidden
- reduced motion slows the field and uses a lower render scale

## Run Locally

This is a static site with no build step.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

If port `8000` is busy, use another port:

```sh
python3 -m http.server 8130
```

Then open `http://localhost:8130`.

## Manual Performance Test

1. Open the local URL in Chrome, Safari, or Firefox.
2. Confirm the canvas is visible and the bottom controls are responsive.
3. Open DevTools Console and run:

   ```js
   document.getElementById("depth-field").dataset
   ```

   Desktop should show `particles: "60"` or less. Mobile width should show `particles: "35"` or less. `safeMode` should be `"true"`.

4. Open Chrome DevTools Performance Monitor, or macOS Activity Monitor, and watch CPU/GPU while moving the pointer slowly.
5. Toggle `motion depth` off and confirm movement becomes quieter.
6. Toggle `text` off and confirm the field keeps running without layout changes.
7. Resize the window repeatedly for 10 seconds and confirm there is no freeze.
8. Switch to another tab for at least 10 seconds, then return. CPU should drop while hidden and animation should resume calmly.
9. Enable the operating system's reduced-motion setting and reload the page. The field should slow down.

## Deploy On GitHub Pages

1. Push these files to a GitHub repository.
2. In the repository settings, open **Pages**.
3. Set the source to deploy from the main branch.
4. Choose the repository root as the publishing folder.
5. Save the settings and wait for the Pages URL to become available.

## Privacy

Monocular Depth runs entirely in the browser. It does not upload data, use tracking, include analytics, or make network calls.
