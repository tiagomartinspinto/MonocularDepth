import {
  CanvasTexture,
  Color,
  DataTexture,
  Fog,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  Vector3,
  WebGLRenderer
} from "./vendor/three/three.module.js";

const canvas = document.getElementById("depth-field");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const TAU = Math.PI * 2;
const FOV = 24;
const HALF_TAN = Math.tan((FOV * Math.PI) / 360);
const NOMINAL_ASPECT = 16 / 9;
const FIXATION_DEPTH = 9;
const COVER = 1.5;
const MAX_DPR = 1.5;
const FOG_NEAR = 4;

// One warm tonal ladder. Every step has a single role; depth moves a tone toward the field.
const TONE = {
  field: 0xf3f0e8,
  graphite: 0x6d6a63,
  charcoal: 0x3d3b37,
  ink: 0x211f1c,
  trace: 0x4a4843,
  text: 0x3a3833
};

const STAIN = { grain: 7, stretch: 0.13, tilt: 0, warp: 1.3, rough: 0.75, edge: 0.07, inner: 0.6, erase: 0.35, cut: null };
const VEIL = { grain: 3.2, stretch: 0.4, tilt: 0, warp: 1.4, rough: 0.6, edge: 0.18, inner: 0.3, erase: 0, cut: null };

// Masses are [x, y, radiusX, radiusY, weight] in view fractions (-1..1) at each layer's depth: long strata, not objects.
// A cut is a wavering half-plane [normalX, normalY, offset] that gives an occluding edge without a visible rectangle.
// Built far to near so that space assembles from the back.
const LAYERS = [
  { depth: 21, kind: "stain", tone: "ink", opacity: 0.8, stretch: 0.1, tilt: 0.015,
    masses: [[-0.3, 0.1, 1.0, 0.05, 1], [0.7, 0.04, 0.3, 0.035, 0.8]] },
  { depth: 17.5, kind: "stain", tone: "charcoal", opacity: 0.72,
    masses: [[0.3, 0.02, 0.6, 0.07, 1], [-0.9, 0.28, 0.4, 0.05, 0.75]] },
  { depth: 15.2, kind: "veil", opacity: 0.55,
    masses: [[0.2, 0.08, 0.8, 0.35, 0.9]] },
  { depth: 13.2, kind: "stain", tone: "graphite", opacity: 0.66, tilt: -0.04,
    masses: [[0.35, -0.28, 0.45, 0.06, 1], [-0.95, 0.2, 0.35, 0.06, 0.8]] },
  { depth: 12.4, kind: "stain", tone: "graphite", opacity: 0.2, grain: 2.2, stretch: 0.2, rough: 0.35, inner: 0.7, erase: 0.5,
    masses: [[-0.25, -0.3, 1.4, 0.5, 1]] },
  { depth: 11.6, kind: "stain", tone: "charcoal", opacity: 0.68, stretch: 0.09,
    masses: [[-0.45, -0.03, 0.75, 0.05, 1]] },
  { depth: 10.3, kind: "veil", opacity: 0.6, cut: [-0.94, 0.34, -0.3],
    masses: [[0.4, 0.2, 0.45, 0.3, 1], [-0.55, -0.34, 0.35, 0.2, 0.8]] },
  { depth: 9, kind: "stain", tone: "graphite", opacity: 0.7, tilt: 0.05,
    masses: [[0.85, 0.3, 0.4, 0.08, 1]] },
  { depth: 8, kind: "stain", tone: "ink", opacity: 1, inner: 0.3, erase: 0.2, cut: [0.05, -1, 0.02],
    masses: [[-0.75, -0.14, 0.55, 0.13, 1]] },
  { depth: 7, kind: "veil", opacity: 0.7, cut: [0.97, -0.24, -0.16],
    masses: [[-0.34, 0.06, 0.45, 0.28, 1]] },
  { depth: 6, kind: "stain", tone: "graphite", opacity: 0.62, tilt: -0.03,
    masses: [[-0.6, -0.04, 0.55, 0.16, 1], [0.95, 0.4, 0.35, 0.05, 0.7]] },
  { depth: 5, kind: "stain", tone: "charcoal", opacity: 0.7,
    masses: [[-0.9, -0.45, 0.45, 0.1, 1]] },
  { depth: 4.3, kind: "veil", opacity: 0.78, cut: [0.18, -0.98, 0.3],
    masses: [[-0.1, -0.2, 0.4, 0.45, 1], [-0.75, 0.55, 0.3, 0.2, 0.7]] }
];

// Sparse receding traces: [x, y] in view fractions at a depth. They nearly share a vanishing point, but not quite.
const TRACES = [
  { from: [-0.62, -0.42, 8], to: [-0.1, -0.16, 21], segments: [[0.05, 0.3], [0.42, 0.56], [0.72, 0.8]], opacity: 0.6 },
  { from: [0.5, -0.5, 8.5], to: [0.14, -0.17, 19], segments: [[0.1, 0.36], [0.55, 0.66]], opacity: 0.5 },
  { from: [0.8, 0.34, 9], to: [0.24, 0.1, 18], segments: [[0, 0.2], [0.34, 0.6]], opacity: 0.45 },
  { from: [-0.92, 0.2, 9.5], to: [-0.4, 0.07, 15], segments: [[0.12, 0.44], [0.6, 0.72]], opacity: 0.45 },
  { from: [0.05, -0.36, 11], to: [0.02, -0.12, 23], segments: [[0.2, 0.5]], opacity: 0.4 },
  { from: [0.3, 0.29, 12], to: [0.64, 0.31, 12.6], segments: [[0, 0.3], [0.46, 0.86]], opacity: 0.38 }
];

// Depth is legible, becomes uncertain, flattens, then forms again. Durations are loose so it never reads as a loop.
const PHASES = {
  legible: {
    duration: [55, 85],
    next: () => "uncertain",
    target: { align: 0, drift: 0.1, fogFar: 24, nearFade: 1, veil: 0, trace: 1 }
  },
  uncertain: {
    duration: [28, 42],
    next: () => (Math.random() < 0.75 ? "flat" : "forming"),
    target: { align: 0.2, drift: 1, fogFar: 32, nearFade: 0.85, veil: 0.25, trace: 0.4 }
  },
  flat: {
    duration: [16, 28],
    next: () => "forming",
    target: { align: 0.92, drift: 0.45, fogFar: 60, nearFade: 0.55, veil: 0.1, trace: 0.05 }
  },
  forming: {
    duration: [30, 46],
    next: () => "legible",
    target: { align: 0, drift: 0.15, fogFar: 22, nearFade: 1, veil: 0, trace: 0.8 }
  }
};

const PARAM_TAU = { align: 9, drift: 14, fogFar: 14, nearFade: 14, veil: 14, trace: 12 };

const TEXT_CANVAS_WIDTH = 2048;
const TEXT_CANVAS_HEIGHT = 128;
const TEXT_FONT_PX = 64;
const TEXT_FONT_FAMILY = 'ui-serif, Georgia, "Times New Roman", serif';
const TEXT_MAX_OPACITY = 0.8;
const TEXT_REGIONS = [
  [0.12, 0.62, -0.62, -0.4],
  [-0.72, -0.3, 0.4, 0.62],
  [0.18, 0.66, 0.02, 0.14],
  [-0.2, 0.25, 0.56, 0.7]
];

const SUBJECTS = [
  "the room", "the wall", "the image", "the window", "the floor", "the corner",
  "the horizon", "the surface", "the shadow", "the distance", "the memory", "the map",
  "the object", "the eye", "the other eye", "the blind spot", "the edge", "the field"
];

const VERBS = [
  "forgets", "delays", "misplaces", "measures", "invents", "repeats", "folds", "loses",
  "shifts", "returns", "disappears", "hesitates", "remembers", "interrupts", "reverses"
];

const OBJECTS = [
  "the horizon", "the room", "the image", "the shadow", "the surface", "the distance",
  "the floor", "the window", "the corner", "the map", "the object", "the eye",
  "the blind spot", "the edge", "the field", "silence", "depth", "perspective"
];

const QUALIFIERS = [
  "in silence", "inside the wall", "near the horizon", "against perspective", "out of alignment",
  "at the edge", "behind the image", "without depth", "almost in focus", "slightly aside"
];

const ADJECTIVES = [
  "unfinished", "borrowed", "slow", "misplaced", "silent", "accidental", "folded", "soft",
  "distant", "partial", "unstable", "shallow", "hidden", "reversed", "almost visible"
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(bank) {
  return bank[Math.floor(Math.random() * bank.length)];
}

function mulberry32(seed) {
  let a = seed >>> 0;

  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoise(seed) {
  const random = mulberry32(seed);
  const source = new Uint8Array(256);
  const perm = new Uint8Array(512);
  const gradX = new Float32Array(256);
  const gradY = new Float32Array(256);

  for (let i = 0; i < 256; i += 1) source[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = source[i];
    source[i] = source[j];
    source[j] = swap;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = source[i & 255];
  for (let i = 0; i < 256; i += 1) {
    const angle = random() * TAU;
    gradX[i] = Math.cos(angle);
    gradY[i] = Math.sin(angle);
  }

  // 2D gradient noise, roughly -0.7..0.7.
  return function noise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const xi = x0 & 255;
    const yi = y0 & 255;
    const fx = x - x0;
    const fy = y - y0;
    const g00 = perm[xi + perm[yi]];
    const g10 = perm[xi + 1 + perm[yi]];
    const g01 = perm[xi + perm[yi + 1]];
    const g11 = perm[xi + 1 + perm[yi + 1]];
    const n00 = gradX[g00] * fx + gradY[g00] * fy;
    const n10 = gradX[g10] * (fx - 1) + gradY[g10] * fy;
    const n01 = gradX[g01] * fx + gradY[g01] * (fy - 1);
    const n11 = gradX[g11] * (fx - 1) + gradY[g11] * (fy - 1);
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const bottom = n00 + u * (n10 - n00);
    const top = n01 + u * (n11 - n01);

    return bottom + v * (top - bottom);
  };
}

const noise = createNoise(19);

// Octaves are rotated against each other so no grid direction survives.
function fbm(x, y, octaves) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amp * noise(x, y);
    norm += amp;
    const nx = x * 1.6 - y * 1.2 + 3.1;
    const ny = x * 1.2 + y * 1.6 + 1.7;
    x = nx;
    y = ny;
    amp *= 0.5;
  }

  return (sum / norm) * 1.4;
}

function composition(masses, x, y) {
  let value = 0;

  for (let index = 0; index < masses.length; index += 1) {
    const [mx, my, rx, ry, weight] = masses[index];
    const dx = (x - mx) / rx;
    const dy = (y - my) / ry;
    value = Math.max(value, weight * Math.exp(-(dx * dx + dy * dy)));
  }

  return value;
}

function edgeFade(unit) {
  return smoothstep(0, 0.14, unit) * smoothstep(0, 0.14, 1 - unit);
}

// Washed charcoal / erasure density, stored as an alpha map.
// Noise is sampled in world units, so deeper layers carry finer detail on screen (a texture gradient cue).
// Layers away from the fixation depth are generated softer and at lower resolution: focus as a depth cue.
function residueTexture(spec, aspect) {
  const focusBlur = clamp(Math.abs(spec.depth - FIXATION_DEPTH) / FIXATION_DEPTH, 0, 1);
  const height = spec.kind === "veil" && !spec.cut ? 200 : Math.round(lerp(420, 220, clamp(focusBlur * 1.2, 0, 1)));
  const width = Math.max(64, Math.round(height * aspect));
  const data = new Uint8Array(width * height * 4);
  const freq = spec.grain * (spec.depth / FIXATION_DEPTH);
  const edge = spec.edge + focusBlur * 0.16;
  const cosA = Math.cos(spec.tilt);
  const sinA = Math.sin(spec.tilt);
  const offsetX = spec.depth * 17.3;
  const offsetY = spec.depth * -11.9;
  // On narrow screens the composition keeps its proportions and is cropped rather than squeezed.
  const compose = Math.pow(aspect / NOMINAL_ASPECT, 0.4);

  for (let j = 0; j < height; j += 1) {
    const v = (j + 0.5) / height;
    const fadeY = edgeFade(v);
    const y = (v - 0.5) * 2 * COVER;

    for (let i = 0; i < width; i += 1) {
      const k = (j * width + i) * 4;
      const u = (i + 0.5) / width;
      const fade = fadeY * edgeFade(u);
      const x = (u - 0.5) * 2 * COVER;

      data[k + 3] = 255;
      if (fade <= 0 || composition(spec.masses, x * compose, y) < 0.004) continue;

      const px = x * aspect * freq;
      const py = y * freq;
      const rx = (px * cosA - py * sinA) * spec.stretch + offsetX;
      const ry = px * sinA + py * cosA + offsetY;
      const warpX = fbm(rx + 1.7, ry + 9.2, 3);
      const warpY = fbm(rx + 8.3, ry + 2.8, 3);

      // Masses only set how much residue a region holds; they never draw an outline.
      // Edges come from the internal strata, so nothing reads as a bounded object.
      const mass = composition(spec.masses, (x + warpX * 0.16) * compose, y + warpY * 0.07);
      const body = fbm(rx + warpX * spec.warp, ry + warpY * spec.warp, 5);

      // Edge quality wanders: pressed charcoal in places, feathered wash in others.
      const edgeHere = edge * lerp(0.2, 1.8, smoothstep(-0.45, 0.45, fbm(rx * 0.55 + 9.1, ry * 0.55 - 4.3, 2)));
      const coverage = lerp(-0.45, 0.8, mass);
      let alpha = smoothstep(-edgeHere, edgeHere, body * spec.rough + coverage) * smoothstep(0.03, 0.6, mass);

      if (spec.cut) {
        const [nx, ny, offset] = spec.cut;
        const along = nx * x + ny * y - offset + warpY * 0.07 + warpX * 0.03;
        const soft = 0.02 + focusBlur * 0.04 + 0.03 * smoothstep(-0.3, 0.5, warpX);
        alpha *= smoothstep(-soft, soft, along);
      }

      if (alpha <= 0.002) continue;

      const density = fbm(rx * 2.1 + 5.1, ry * 3.4 - 3.3, 3);
      alpha *= 1 - spec.inner + spec.inner * smoothstep(-0.55, 0.6, density);

      if (spec.erase > 0) {
        const wipe = fbm(rx * 0.4 + 2.2, ry * 6.5, 3);
        alpha *= 1 - spec.erase * smoothstep(0.1, 0.55, wipe);
      }

      alpha *= 0.88 + 0.12 * noise(rx * 9.7, ry * 9.7) * 1.4;

      const value = clamp(Math.round(alpha * fade * 255), 0, 255);
      data[k] = value;
      data[k + 1] = value;
      data[k + 2] = value;
    }
  }

  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

// Soft-ended, slightly uneven hairline profile shared by every trace segment.
function traceTexture() {
  const width = 8;
  const height = 256;
  const data = new Uint8Array(width * height * 4);

  for (let j = 0; j < height; j += 1) {
    const v = (j + 0.5) / height;
    const along = smoothstep(0, 0.18, v) * smoothstep(0, 0.24, 1 - v) * (0.72 + 0.28 * (fbm(v * 7.3, 4.1, 3) * 0.5 + 0.5));

    for (let i = 0; i < width; i += 1) {
      const across = 1 - Math.abs((i + 0.5) / width - 0.5) * 2;
      const value = Math.round(clamp(along * smoothstep(0, 0.7, across), 0, 1) * 255);
      const k = (j * width + i) * 4;
      data[k] = value;
      data[k + 1] = value;
      data[k + 2] = value;
      data[k + 3] = 255;
    }
  }

  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

function generateSentence() {
  const template = Math.floor(Math.random() * 12);

  if (template === 0) return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)}`;
  if (template === 1) return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)} ${pick(QUALIFIERS)}`;
  if (template === 2) return `${pick(ADJECTIVES)} ${pick(OBJECTS)}`;
  if (template === 3) return `${pick(OBJECTS)} without ${pick(OBJECTS)}`;
  if (template === 4) return `${pick(SUBJECTS)} inside ${pick(OBJECTS)}`;
  if (template === 5) return `${pick(SUBJECTS)} remembers ${pick(OBJECTS)}`;
  if (template === 6) return `${pick(SUBJECTS)} arrives in reverse`;
  if (template === 7) return `${pick(OBJECTS)} against perspective`;
  if (template === 8) return `${pick(SUBJECTS)} almost remembers perspective`;
  if (template === 9) return `${pick(OBJECTS)} almost in focus`;
  if (template === 10) return `${pick(SUBJECTS)} without depth`;
  return `${pick(OBJECTS)} at the edge of ${pick(OBJECTS)}`;
}

function viewPoint(fx, fy, depth, aspect) {
  return new Vector3(fx * HALF_TAN * depth * aspect, fy * HALF_TAN * depth, -depth);
}

let renderer;

try {
  renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
} catch (error) {
  canvas.dataset.webgl = "unavailable";
}

if (renderer) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 80);
  const fog = new Fog(TONE.field, FOG_NEAR, PHASES.forming.target.fogFar);
  const plane = new PlaneGeometry(1, 1);
  const fixation = new Vector3(0, 0, -FIXATION_DEPTH);
  const fixationTarget = fixation.clone();
  const fixationEase = fixation.clone();
  const basis = new Matrix4();

  const state = {
    width: 1,
    height: 1,
    aspect: NOMINAL_ASPECT,
    textureAspect: 0,
    reducedMotion: reducedMotionQuery.matches,
    time: rand(0, 400),
    phase: "forming",
    phaseRemaining: rand(...PHASES.forming.duration),
    params: { ...PHASES.forming.target, fogFar: 18 },
    fixationRemaining: rand(18, 34),
    buildQueue: [],
    ready: false,
    animationId: 0,
    resizeId: 0,
    lastFrame: 0
  };

  const layers = LAYERS.map((source, index) => {
    const spec = { ...(source.kind === "veil" ? VEIL : STAIN), ...source };
    const material = new MeshBasicMaterial({
      color: new Color(source.kind === "veil" ? TONE.field : TONE[source.tone]),
      transparent: true,
      depthWrite: false,
      opacity: 0
    });
    const mesh = new Mesh(plane, material);
    mesh.visible = false;
    scene.add(mesh);

    return {
      spec,
      mesh,
      material,
      appear: 0,
      seed: index * 2.39 + 0.7,
      driftRate: rand(0.8, 1.25)
    };
  });

  const traceMap = traceTexture();
  const traceSegments = [];

  for (let index = 0; index < TRACES.length; index += 1) {
    const trace = TRACES[index];

    for (let s = 0; s < trace.segments.length; s += 1) {
      const material = new MeshBasicMaterial({
        color: new Color(TONE.trace),
        alphaMap: traceMap,
        transparent: true,
        depthWrite: false,
        opacity: 0
      });
      const mesh = new Mesh(plane, material);
      scene.add(mesh);
      traceSegments.push({
        trace,
        range: trace.segments[s],
        mesh,
        material,
        rateA: TAU / rand(40, 80),
        rateB: TAU / rand(90, 150),
        phaseA: rand(0, TAU),
        phaseB: rand(0, TAU)
      });
    }
  }

  const textCanvas = document.createElement("canvas");
  textCanvas.width = TEXT_CANVAS_WIDTH;
  textCanvas.height = TEXT_CANVAS_HEIGHT;
  const textContext = textCanvas.getContext("2d");
  const textTexture = new CanvasTexture(textCanvas);
  textTexture.minFilter = LinearMipmapLinearFilter;
  const textMaterial = new MeshBasicMaterial({
    color: new Color(TONE.text),
    alphaMap: textTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0
  });
  const textMesh = new Mesh(plane, textMaterial);
  textMesh.visible = false;
  scene.add(textMesh);

  const text = {
    stage: "wait",
    elapsed: 0,
    wait: rand(26, 40),
    fadeIn: 0,
    hold: 0,
    fadeOut: 0,
    depth: 6,
    fx: 0,
    fy: 0,
    fontPx: TEXT_FONT_PX,
    measured: 0,
    base: new Vector3()
  };

  scene.fog = fog;
  renderer.setClearColor(TONE.field, 1);
  textTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  function queueTextures() {
    state.textureAspect = state.aspect;
    state.buildQueue = layers.slice();
  }

  function buildNextTexture() {
    const layer = state.buildQueue.shift();
    if (!layer) return;

    const previous = layer.material.alphaMap;
    layer.material.alphaMap = residueTexture(layer.spec, state.textureAspect);
    layer.material.needsUpdate = !previous;
    layer.mesh.visible = true;
    if (previous) previous.dispose();
    if (!state.buildQueue.length) state.ready = true;
  }

  function layoutTraces() {
    const cameraAtRest = new Vector3(0, 0, 0);

    for (let index = 0; index < traceSegments.length; index += 1) {
      const segment = traceSegments[index];
      const from = viewPoint(segment.trace.from[0], segment.trace.from[1], segment.trace.from[2], NOMINAL_ASPECT);
      const to = viewPoint(segment.trace.to[0], segment.trace.to[1], segment.trace.to[2], NOMINAL_ASPECT);
      const start = from.clone().lerp(to, segment.range[0]);
      const end = from.clone().lerp(to, segment.range[1]);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dir = end.clone().sub(start);
      const length = dir.length();
      dir.normalize();
      const normal = cameraAtRest.clone().sub(mid);
      normal.sub(dir.clone().multiplyScalar(normal.dot(dir))).normalize();
      const side = dir.clone().cross(normal);
      const distance = -mid.z;

      basis.makeBasis(side, dir, normal);
      segment.mesh.quaternion.setFromRotationMatrix(basis);
      segment.mesh.position.copy(mid);
      segment.mesh.scale.set(0.0058 * (1 + 0.3 * (distance / 10)), length, 1);
    }
  }

  function resize() {
    state.resizeId = 0;
    state.width = Math.max(320, window.innerWidth);
    state.height = Math.max(320, window.innerHeight);
    state.aspect = state.width / state.height;

    renderer.setPixelRatio(state.reducedMotion ? 1 : Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(state.width, state.height, false);
    camera.aspect = state.aspect;
    camera.updateProjectionMatrix();

    for (let index = 0; index < layers.length; index += 1) {
      const depth = layers[index].spec.depth;
      layers[index].mesh.scale.set(2 * HALF_TAN * depth * state.aspect * COVER, 2 * HALF_TAN * depth * COVER, 1);
    }

    if (!state.textureAspect || Math.abs(Math.log(state.aspect / state.textureAspect)) > Math.log(1.3)) {
      queueTextures();
    }

    if (text.stage !== "wait") placeSentence();

    canvas.dataset.dpr = String(renderer.getPixelRatio());
    renderStill();
  }

  function scheduleResize() {
    if (state.resizeId) return;
    state.resizeId = window.requestAnimationFrame(resize);
  }

  function textWorldScale(depth) {
    const fontPx = clamp(state.height * 0.018, 14, 34);
    return (fontPx * 2 * depth * HALF_TAN) / state.height / text.fontPx;
  }

  function drawSentence(sentence) {
    text.fontPx = TEXT_FONT_PX;
    textContext.font = `400 ${text.fontPx}px ${TEXT_FONT_FAMILY}`;
    text.measured = textContext.measureText(sentence).width;

    if (text.measured > TEXT_CANVAS_WIDTH - 96) {
      text.fontPx = Math.floor((TEXT_FONT_PX * (TEXT_CANVAS_WIDTH - 96)) / text.measured);
      textContext.font = `400 ${text.fontPx}px ${TEXT_FONT_FAMILY}`;
      text.measured = textContext.measureText(sentence).width;
    }

    textContext.fillStyle = "#000";
    textContext.fillRect(0, 0, TEXT_CANVAS_WIDTH, TEXT_CANVAS_HEIGHT);
    textContext.fillStyle = "#fff";
    textContext.textAlign = "center";
    textContext.textBaseline = "middle";
    textContext.fillText(sentence, TEXT_CANVAS_WIDTH / 2, TEXT_CANVAS_HEIGHT / 2);
    textTexture.needsUpdate = true;
  }

  function placeSentence() {
    const scale = textWorldScale(text.depth);
    const halfWidth = HALF_TAN * text.depth * state.aspect;
    const halfHeight = HALF_TAN * text.depth;
    const halfText = (text.measured * scale) / 2 / halfWidth;
    const fx = clamp(text.fx, -0.9 + halfText, 0.9 - halfText);

    textMesh.scale.set(TEXT_CANVAS_WIDTH * scale, TEXT_CANVAS_HEIGHT * scale, 1);
    text.base.set(fx * halfWidth, text.fy * halfHeight, -text.depth);
  }

  function beginSentence() {
    const region = pick(TEXT_REGIONS);

    drawSentence(generateSentence());
    text.depth = Math.random() < 0.18 ? rand(7.6, 8.6) : rand(5.2, 6.8);
    text.fx = rand(region[0], region[1]);
    text.fy = rand(region[2], region[3]);
    text.fadeIn = rand(6, 9);
    text.hold = rand(2.2, 4);
    text.fadeOut = rand(7, 10);
    text.stage = "in";
    text.elapsed = 0;
    placeSentence();
    textMesh.visible = true;
  }

  function updateSentence(dt) {
    text.elapsed += dt;

    if (text.stage === "wait") {
      if (text.elapsed >= text.wait && state.ready) beginSentence();
      return 0;
    }

    if (text.stage === "in") {
      if (text.elapsed >= text.fadeIn) {
        text.stage = "hold";
        text.elapsed = 0;
        return 1;
      }
      return smoothstep(0, 1, text.elapsed / text.fadeIn);
    }

    if (text.stage === "hold") {
      if (text.elapsed >= text.hold) {
        text.stage = "out";
        text.elapsed = 0;
      }
      return 1;
    }

    if (text.elapsed >= text.fadeOut) {
      text.stage = "wait";
      text.elapsed = 0;
      text.wait = Math.random() < 0.2 ? rand(55, 80) : rand(28, 50);
      textMesh.visible = false;
      return 0;
    }

    return 1 - smoothstep(0, 1, text.elapsed / text.fadeOut);
  }

  function updatePhase(dt) {
    state.phaseRemaining -= dt;

    if (state.phaseRemaining <= 0) {
      state.phase = PHASES[state.phase].next();
      state.phaseRemaining = rand(...PHASES[state.phase].duration);
      canvas.dataset.phase = state.phase;
    }

    const target = PHASES[state.phase].target;

    for (const key in target) {
      state.params[key] += (target[key] - state.params[key]) * (1 - Math.exp(-dt / PARAM_TAU[key]));
    }
  }

  // Continuous perceptual adjustment: small translation while holding a mid-depth fixation,
  // with occasional slow re-fixation. Points nearer and farther than fixation drift in opposite directions.
  function updateCamera(dt) {
    const motion = state.reducedMotion ? 0.2 : 1;
    const t = state.time;

    camera.position.set(
      motion * 0.17 * (0.62 * Math.sin((t * TAU) / 97 + 1.3) + 0.38 * Math.sin((t * TAU) / 173 + 4.1)),
      motion * 0.07 * (0.6 * Math.sin((t * TAU) / 131 + 0.4) + 0.4 * Math.sin((t * TAU) / 229 + 2.2)),
      motion * 0.32 * (0.7 * Math.sin((t * TAU) / 211 + 5) + 0.3 * Math.sin((t * TAU) / 317 + 0.9))
    );

    state.fixationRemaining -= dt;
    if (state.fixationRemaining <= 0) {
      state.fixationRemaining = rand(18, 40);
      fixationTarget.set(rand(-0.25, 0.25) * motion, rand(-0.12, 0.12) * motion, -FIXATION_DEPTH + rand(-1.5, 1.5));
    }

    const ease = 1 - Math.exp(-dt / 5);
    fixationEase.lerp(fixationTarget, ease);
    fixation.lerp(fixationEase, ease);
    camera.lookAt(fixation);
  }

  // Parallax compensation: at align = 1 every layer shifts and scales as if it sat on the fixation plane.
  // The camera keeps moving, yet the volume reads flat.
  function alignOffset(depth, target) {
    const align = state.params.align;
    const advance = camera.position.z;
    const shift = align * (1 - depth / FIXATION_DEPTH);
    const scale = lerp(1, (FIXATION_DEPTH * (depth + advance)) / (depth * (FIXATION_DEPTH + advance)), align);

    target.x += camera.position.x * shift;
    target.y += camera.position.y * shift;
    return scale;
  }

  function updateLayers(dt) {
    const drift = state.params.drift * (state.reducedMotion ? 0.25 : 1);
    const t = state.time;

    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index];
      const { depth, kind, opacity } = layer.spec;
      if (!layer.mesh.visible) continue;

      layer.appear = Math.min(1, layer.appear + dt / 7);

      const rate = layer.driftRate;
      const position = layer.mesh.position;
      position.set(
        drift * 0.012 * depth * Math.sin((t * TAU * rate) / 47 + layer.seed),
        drift * 0.006 * depth * Math.sin((t * TAU * rate) / 61 + layer.seed * 1.7),
        -depth
      );

      const scale = alignOffset(depth, position) * (1 + drift * 0.015 * Math.sin((t * TAU * rate) / 71 + layer.seed * 0.6));
      const coverX = 2 * HALF_TAN * depth * state.aspect * COVER;
      const coverY = 2 * HALF_TAN * depth * COVER;
      layer.mesh.scale.set(coverX * scale, coverY * scale, 1);

      let alpha = opacity * smoothstep(0, 1, layer.appear);
      alpha *= lerp(1, state.params.nearFade, clamp((7.5 - depth) / 3, 0, 1));
      if (kind === "veil") alpha = Math.min(0.92, alpha * (1 + state.params.veil));
      layer.material.opacity = alpha;
    }
  }

  function updateTraces() {
    const presence = state.ready ? state.params.trace : 0;

    for (let index = 0; index < traceSegments.length; index += 1) {
      const segment = traceSegments[index];
      const pulse =
        0.6 * Math.sin(state.time * segment.rateA + segment.phaseA) +
        0.4 * Math.sin(state.time * segment.rateB + segment.phaseB);
      segment.material.opacity = segment.trace.opacity * presence * smoothstep(-0.1, 0.5, pulse);
      segment.mesh.visible = segment.material.opacity > 0.003;
    }
  }

  function updateText(dt) {
    const envelope = updateSentence(dt);
    if (!textMesh.visible) return;

    const position = textMesh.position.copy(text.base);
    const scale = alignOffset(text.depth, position);
    const worldScale = textWorldScale(text.depth) * scale;
    textMesh.scale.set(TEXT_CANVAS_WIDTH * worldScale, TEXT_CANVAS_HEIGHT * worldScale, 1);
    textMaterial.opacity = TEXT_MAX_OPACITY * envelope;
  }

  function step(dt) {
    const timeScale = state.reducedMotion ? 0.5 : 1;

    state.time += dt * timeScale;
    updatePhase(dt);
    fog.far = state.params.fogFar;
    updateCamera(dt * timeScale);
    updateLayers(dt);
    updateTraces();
    updateText(dt);
  }

  function renderStill() {
    step(0);
    renderer.render(scene, camera);
  }

  function frame(now) {
    state.animationId = window.requestAnimationFrame(frame);

    const interval = state.reducedMotion ? 1000 / 20 : 1000 / 30;
    const elapsed = now - state.lastFrame;
    if (elapsed < interval - 2) return;

    state.lastFrame = now;
    if (state.buildQueue.length) buildNextTexture();
    step(Math.min(elapsed, 100) / 1000);
    renderer.render(scene, camera);
  }

  function start() {
    if (state.animationId || document.hidden) return;
    state.lastFrame = performance.now();
    state.animationId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (!state.animationId) return;
    window.cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }

  function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
  }

  function onMotionPreferenceChange() {
    state.reducedMotion = reducedMotionQuery.matches;
    resize();
  }

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", onMotionPreferenceChange);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(onMotionPreferenceChange);
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop();
  });
  canvas.addEventListener("webglcontextrestored", start);
  window.addEventListener("resize", scheduleResize);
  document.addEventListener("visibilitychange", onVisibilityChange);

  canvas.dataset.phase = state.phase;
  canvas.dataset.layers = String(layers.length);
  canvas.dataset.traces = String(traceSegments.length);
  layoutTraces();
  resize();
  start();
}
