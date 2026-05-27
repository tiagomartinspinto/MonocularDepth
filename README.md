# Monocular Depth

Monocular Depth is a browser-based artwork exploring how depth and space can emerge through adaptation, motion, and perception.

The piece opens into a fullscreen dark field where two perceptual systems overlap. One remains stable and responsive; the other arrives slightly late, offset, dimmer, and occasionally unstable. Together they form a quiet field of negotiated space.

Its language layer is a multilingual Dada machine. English, Portuguese, Galician, and Finnish word banks leak into one another through broken templates and hybrid words. A sentence appears, fades, disappears, and leaves the field empty again. The text is not translated or explained; it behaves like unstable geography being reassembled.

Public version: [https://tiagomartinspinto.github.io/MonocularDepth/](https://tiagomartinspinto.github.io/MonocularDepth/)

## Performance

This is a static, performance-safe version:

- one canvas
- no visible UI panels
- no external libraries
- no blur filters, canvas shadows, analytics, or network calls
- maximum `60` particles on desktop
- maximum `35` particles on mobile
- `devicePixelRatio` capped at `1.5`
- animation pauses when the document is hidden
- reduced motion slows the field and uses a lower render scale
- text events are generated from banks and then faded one at a time

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
2. Confirm the canvas appears fullscreen without a visible control panel.
3. Open DevTools Console and run:

   ```js
   document.getElementById("depth-field").dataset
   ```

   Desktop should show `particles: "60"` or less. Mobile width should show `particles: "35"` or less. `safeMode` should be `"true"`.

4. Watch CPU/GPU in Chrome DevTools Performance Monitor or macOS Activity Monitor while moving the pointer slowly.
5. Wait long enough to confirm the language layer sometimes shows nothing, then fades in no more than one sentence at a time.
6. Resize the window repeatedly for 10 seconds and confirm there is no freeze.
7. Switch to another tab for at least 10 seconds, then return. CPU should drop while hidden and animation should resume calmly.
8. Enable the operating system's reduced-motion setting and reload the page. The field should slow down.

## Deploy On GitHub Pages

1. Push these files to a GitHub repository.
2. In the repository settings, open **Pages**.
3. Set the source to deploy from the main branch.
4. Choose the repository root as the publishing folder.
5. Save the settings and wait for the Pages URL to become available.

## Privacy

Monocular Depth runs entirely in the browser. It does not upload data, use tracking, include analytics, or make network calls.
