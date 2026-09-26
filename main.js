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
  SRGBColorSpace,
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
// Flattened layers collapse onto one plane slightly in front of fixation, so the whole image keeps sliding as a single sheet.
const FLAT_DEPTH = 6.5;
const COVER = 1.5;
const MAX_DPR = 1.5;
const FOG_NEAR = 4;
const FOG_FAR = 24;

// One warm tonal ladder. Every step has a single role; depth moves a tone toward the field.
const TONE = {
  field: 0xf3f0e8,
  graphite: 0x6d6a63,
  charcoal: 0x3d3b37,
  ink: 0x211f1c,
  trace: 0x4a4843,
  text: 0x3a3833
};

const STAIN = { grain: 11, stretch: 0.65, tilt: 0, warp: 0.6, rough: 0.6, edge: 0.2, inner: 0.5, erase: 0.1, cut: null };
const VEIL = { grain: 3, stretch: 0.7, tilt: 0, warp: 1.4, rough: 0.6, edge: 0.18, inner: 0.3, erase: 0, cut: null };

// Masses are [x, y, radiusX, radiusY, weight, angle?] in view fractions (-1..1) at each layer's depth.
// Several unrelated depth concentrations, placed independently of screen height: near material sits high as well as low,
// far material low as well as high, so the frame never settles into sky, horizon, and ground.
// Each layer's grain runs in its own direction (tilt), so no shared horizontal dominates.
// A cut is a wavering half-plane [normalX, normalY, offset] that gives an occluding edge without a visible rectangle.
// Built far to near so that space assembles from the back.
const LAYERS = [
  { depth: 21, kind: "stain", tone: "ink", opacity: 0.8, edge: 0.1, tilt: 0.4,
    masses: [[0.3, -0.26, 0.1, 0.12, 1, 0.4]] },
  { depth: 17.5, kind: "stain", tone: "charcoal", opacity: 0.72, edge: 0.1, tilt: -0.3,
    masses: [[0.64, 0.46, 0.1, 0.13, 1, -0.3], [-0.64, 0.0, 0.06, 0.08, 0.6]] },
  { depth: 15.2, kind: "veil", opacity: 0.5,
    masses: [[0.1, 0.2, 0.6, 0.55, 0.9]] },
  { depth: 13.2, kind: "stain", tone: "graphite", opacity: 0.66, edge: 0.1, tilt: 0.9,
    masses: [[-0.52, 0.52, 0.1, 0.12, 1, -0.4]] },
  { depth: 12.4, kind: "stain", tone: "graphite", opacity: 0.14, grain: 2.2, stretch: 1, rough: 0.35, edge: 0.14, inner: 0.7, erase: 0,
    masses: [[-0.1, 0.05, 0.7, 0.65, 1]] },
  { depth: 11.6, kind: "stain", tone: "charcoal", opacity: 0.42, edge: 0.12, tilt: -0.8,
    masses: [[0.5, 0.58, 0.07, 0.09, 1]] },
  { depth: 10.3, kind: "veil", opacity: 0.6, cut: [-0.6, 0.8, -0.05],
    masses: [[0.45, 0.1, 0.4, 0.4, 1], [-0.55, 0.35, 0.3, 0.34, 0.7]] },
  { depth: 9, kind: "stain", tone: "graphite", opacity: 0.66, tilt: -0.6, edge: 0.14, cut: [-0.34, 0.94, -0.75],
    masses: [[0.6, -0.55, 0.13, 0.14, 1, -0.6]] },
  { depth: 8, kind: "stain", tone: "ink", opacity: 1, inner: 0.3, erase: 0.05, tilt: 0.3, edge: 0.16, cut: [0.82, -0.57, -0.33],
    masses: [[-0.2, 0.22, 0.19, 0.21, 1, 0.5]] },
  { depth: 7, kind: "veil", opacity: 0.7, cut: [0.8, 0.6, -0.03],
    masses: [[-0.36, 0.4, 0.34, 0.36, 1]] },
  { depth: 6, kind: "stain", tone: "graphite", opacity: 0.62, tilt: 1.1, stretch: 0.8, edge: 0.4, cut: [-0.94, 0.34, -0.62],
    masses: [[0.44, -0.42, 0.22, 0.26, 1, 0.6], [0.7, -0.66, 0.1, 0.12, 0.7]] },
  { depth: 5, kind: "stain", tone: "charcoal", opacity: 0.7, tilt: 0.45, edge: 0.4,
    masses: [[-0.36, 0.36, 0.26, 0.3, 1, 0.4]] },
  { depth: 4.3, kind: "veil", opacity: 0.78, cut: [0.6, -0.8, 0.25],
    masses: [[-0.5, -0.4, 0.34, 0.4, 1], [0.62, 0.45, 0.3, 0.3, 0.7]] }
];

// Trace structures: incomplete spatial correspondences rather than drawn lines.
// Each structure is a screen line [x, y, angleDeg] as seen from its own transient viewpoint (near the camera path).
// Fragments [t0, t1, depth0, depth1] recede through real depth along rays from that viewpoint, so they taper and
// lose focus with distance, sort against residue and veils, and only line up as the camera passes the viewpoint.
// Viewpoints and angles differ per structure, so the implied alignments never share one perspective centre.
const TRACES = [
  { viewpoint: [0.3, -0.05, 0.1], line: [-0.62, 0.5, -24], opacity: 0.64,
    fragments: [[0, 1.2, 6.5, 13], [1.32, 1.5, 15, 17]] },
  { viewpoint: [-0.22, -0.06, 0.05], line: [0.12, -0.28, -20], opacity: 0.64,
    fragments: [[-0.22, -0.1, 13.5, 13], [0, 0.8, 11, 7]] },
  { viewpoint: [-0.2, 0.05, 0], line: [0.6, 0.7, -100], opacity: 0.6,
    fragments: [[0, 0.45, 5.8, 12]] },
  { viewpoint: [0.25, 0.04, 0.12], line: [-0.86, -0.74, 36], opacity: 0.62,
    fragments: [[0, 0.3, 5.2, 6.4], [0.38, 0.46, 14, 15]] },
  { viewpoint: [0.18, 0.02, -0.12], line: [0.22, -0.4, 70], opacity: 0.62,
    fragments: [[0, 0.3, 9.5, 12]] }
];
// Width in pixels at 1080 lines at the fixation depth; perspective tapers it with distance, and material nearer than
// fixation spreads out of focus (wider, paler), so near portions read as defocused rather than drawn.
const TRACE_WIDTH_PX = 4;
// Receding fragments are split into pieces no deeper than this, so each piece sorts correctly against the layers.
const TRACE_PIECE_DEPTH = 1.6;

// Depth is legible, becomes uncertain, flattens, then forms again. Durations are loose so it never reads as a loop.
// Each phase eases from wherever the previous one left off to its target over `transition` seconds, then holds.
// align: parallax cancellation onto one shared plane (FLAT_DEPTH). drift: independent layer wandering.
// compress: nearer layers take on mid-depth tone and strength, so depth contrast collapses without revealing far strata.
const PHASES = {
  legible: {
    duration: [55, 80],
    transition: 28,
    next: "uncertain",
    target: { align: 0, drift: 0.15, compress: 0, veil: 0, trace: 1 }
  },
  uncertain: {
    duration: [30, 40],
    transition: 26,
    next: "flat",
    target: { align: 0.4, drift: 0.08, compress: 0.45, veil: 0.2, trace: 0.4 }
  },
  flat: {
    duration: [42, 50],
    transition: 22,
    next: "forming",
    target: { align: 1, drift: 0, compress: 1, veil: 0.05, trace: 0 }
  },
  forming: {
    duration: [36, 46],
    transition: 34,
    next: "legible",
    target: { align: 0, drift: 0.15, compress: 0, veil: 0, trace: 0.85 }
  }
};

const TEXT_CANVAS_WIDTH = 2048;
const TEXT_CANVAS_HEIGHT = 128;
const TEXT_FONT_PX = 64;
const TEXT_FONT_FAMILY = 'ui-serif, Georgia, "Times New Roman", serif';
const TEXT_MAX_OPACITY = 0.8;
// A sentence sits between existing layers, never on one: from just behind the nearest residue to just past the far veil.
const TEXT_DEPTHS = [5.5, 6.5, 7.5, 8.5, 9.6, 11];
// Regions are starting zones only; each is widened so a sentence can lean into residue or a veil instead of waiting in open space.
const TEXT_REGION_SPREAD = [0.18, 0.12];
// Defocus as a fraction of type height, reached a few units away from the fixation depth.
const TEXT_SOFTNESS = 0.036;
const TEXT_CANDIDATES = 48;
const TEXT_REGIONS = [
  [-0.6, -0.2, -0.4, -0.22],
  [-0.12, 0.2, -0.76, -0.62],
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
    const [mx, my, rx, ry, weight, angle = 0] = masses[index];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = ((x - mx) * cos + (y - my) * sin) / rx;
    const dy = ((y - my) * cos - (x - mx) * sin) / ry;
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

// Trace cross-section is a soft gaussian, so a wider quad reads as a less focused line rather than a thicker stroke.
// Only a fragment's true ends dissolve; pieces inside a fragment join without a seam.
function traceTexture(fadeStart, fadeEnd) {
  const width = 16;
  const height = 256;
  const data = new Uint8Array(width * height * 4);

  for (let j = 0; j < height; j += 1) {
    const v = (j + 0.5) / height;
    const along = (fadeStart ? smoothstep(0, 0.35, v) : 1) * (fadeEnd ? smoothstep(0, 0.45, 1 - v) : 1);

    for (let i = 0; i < width; i += 1) {
      const offset = ((i + 0.5) / width - 0.5) * 2;
      const value = Math.round(clamp(along * Math.exp(-offset * offset * 4.5), 0, 1) * 255);
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

let renderer;

try {
  renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
} catch (error) {
  canvas.dataset.webgl = "unavailable";
}

if (renderer) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 80);
  const fog = new Fog(TONE.field, FOG_NEAR, FOG_FAR);
  const fieldColor = new Color(TONE.field).getRGB({}, SRGBColorSpace);
  // Same curve and blend space as Three.js linear fog (mixed after sRGB output conversion),
  // so legible layers keep exactly the tone they had under scene fog.
  const fixationHaze = smoothstep(FOG_NEAR, FOG_FAR, FIXATION_DEPTH);
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
    phaseElapsed: 0,
    phaseDuration: rand(...PHASES.forming.duration),
    // The volume first assembles out of a flattened state.
    phaseFrom: { align: 0.7, drift: 0, compress: 0.8, veil: 0, trace: 0 },
    params: { align: 0.7, drift: 0, compress: 0.8, veil: 0, trace: 0 },
    fixationRemaining: rand(18, 34),
    buildQueue: [],
    ready: false,
    animationId: 0,
    resizeId: 0,
    lastFrame: 0
  };

  const layers = LAYERS.map((source, index) => {
    const spec = { ...(source.kind === "veil" ? VEIL : STAIN), ...source };
    const color = new Color(source.kind === "veil" ? TONE.field : TONE[source.tone]);
    // Atmospheric fade is applied per layer rather than by scene fog, so it can be compressed.
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0
    });
    const mesh = new Mesh(plane, material);
    mesh.visible = false;
    scene.add(mesh);

    return {
      spec,
      mesh,
      material,
      tone: color.getRGB({}, SRGBColorSpace),
      haze: smoothstep(FOG_NEAR, FOG_FAR, source.depth),
      appear: 0,
      seed: index * 2.39 + 0.7,
      driftRate: rand(0.8, 1.25)
    };
  });

  const traceMaps = [traceTexture(false, false), traceTexture(true, false), traceTexture(false, true), traceTexture(true, true)];
  const traceFragments = [];
  const traceSegments = [];

  for (let index = 0; index < TRACES.length; index += 1) {
    const trace = TRACES[index];

    for (let f = 0; f < trace.fragments.length; f += 1) {
      const [t0, t1, depth0, depth1] = trace.fragments[f];
      const fragment = {
        trace,
        lag: rand(0, 0.45),
        rateA: TAU / rand(45, 85),
        rateB: TAU / rand(95, 150),
        phaseA: rand(0, TAU),
        phaseB: rand(0, TAU),
        opacity: 0
      };
      const pieces = Math.max(1, Math.ceil(Math.abs(depth1 - depth0) / TRACE_PIECE_DEPTH));
      traceFragments.push(fragment);

      for (let p = 0; p < pieces; p += 1) {
        const a = p / pieces;
        const b = (p + 1) / pieces;
        const material = new MeshBasicMaterial({
          color: new Color(TONE.trace),
          alphaMap: traceMaps[(p === 0 ? 1 : 0) + (p === pieces - 1 ? 2 : 0)],
          transparent: true,
          depthWrite: false,
          opacity: 0
        });
        const mesh = new Mesh(new PlaneGeometry(1, 1), material);
        mesh.visible = false;
        scene.add(mesh);
        traceSegments.push({
          fragment,
          from: [lerp(t0, t1, a), lerp(depth0, depth1, a)],
          to: [lerp(t0, t1, b), lerp(depth0, depth1, b)],
          mesh,
          material,
          focus: 1
        });
      }
    }
  }

  const textCanvas = document.createElement("canvas");
  textCanvas.width = TEXT_CANVAS_WIDTH;
  textCanvas.height = TEXT_CANVAS_HEIGHT;
  const textContext = textCanvas.getContext("2d", { willReadFrequently: true });
  const textTexture = new CanvasTexture(textCanvas);
  textTexture.minFilter = LinearMipmapLinearFilter;
  // Haze is applied by hand, as for the layers, so the sentence compresses with the rest of the volume.
  const textMaterial = new MeshBasicMaterial({
    color: new Color(TONE.text),
    alphaMap: textTexture,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0
  });
  const textMesh = new Mesh(plane, textMaterial);
  textMesh.visible = false;
  scene.add(textMesh);
  const textTone = new Color(TONE.text).getRGB({}, SRGBColorSpace);
  const inkLevel = new Color(TONE.ink).getRGB({}, SRGBColorSpace).g;
  const tone = {};

  const text = {
    stage: "wait",
    elapsed: 0,
    wait: rand(26, 40),
    fadeIn: 0,
    hold: 0,
    fadeOut: 0,
    depth: 6,
    region: null,
    recent: [],
    fx: 0,
    fy: 0,
    fontPx: TEXT_FONT_PX,
    measured: 0,
    base: new Vector3()
  };
  const eye = new Vector3();
  const anchor = new Vector3();
  const probe = new Vector3();
  const layerCentre = new Vector3();

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

  // Point at `depth` on the ray from a structure's viewpoint through screen position t along its line.
  function tracePoint(trace, t, depth) {
    const [vx, vy, vz] = trace.viewpoint;
    const [x, y, angle] = trace.line;
    const radians = (angle * Math.PI) / 180;
    const fx = x + (t * Math.cos(radians)) / NOMINAL_ASPECT;
    const fy = y + t * Math.sin(radians);
    const reach = depth + vz;

    return new Vector3(vx + fx * HALF_TAN * NOMINAL_ASPECT * reach, vy + fy * HALF_TAN * reach, -depth);
  }

  function layoutTraces() {
    const cameraAtRest = new Vector3(0, 0, 0);

    for (let index = 0; index < traceSegments.length; index += 1) {
      const segment = traceSegments[index];
      const trace = segment.fragment.trace;
      const start = tracePoint(trace, segment.from[0], segment.from[1]);
      const end = tracePoint(trace, segment.to[0], segment.to[1]);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dir = end.clone().sub(start);
      const length = dir.length();
      dir.normalize();
      const normal = cameraAtRest.clone().sub(mid);
      normal.sub(dir.clone().multiplyScalar(normal.dot(dir))).normalize();
      const side = dir.clone().cross(normal);

      basis.makeBasis(side, dir, normal);
      segment.mesh.quaternion.setFromRotationMatrix(basis);
      segment.mesh.position.copy(mid);
      // Each piece is a trapezoid, so width changes continuously along a fragment instead of stepping between pieces.
      const blurStart = clamp((FIXATION_DEPTH - segment.from[1]) / 3, 0, 1);
      const blurEnd = clamp((FIXATION_DEPTH - segment.to[1]) / 3, 0, 1);
      const pixel = (TRACE_WIDTH_PX * 2 * HALF_TAN * FIXATION_DEPTH) / 1080;
      const halfStart = (pixel * (1 + 1.1 * blurStart)) / 2;
      const halfEnd = (pixel * (1 + 1.1 * blurEnd)) / 2;
      const positions = segment.mesh.geometry.attributes.position;
      positions.setXYZ(0, -halfEnd, 0.5, 0);
      positions.setXYZ(1, halfEnd, 0.5, 0);
      positions.setXYZ(2, -halfStart, -0.5, 0);
      positions.setXYZ(3, halfStart, -0.5, 0);
      positions.needsUpdate = true;
      segment.mesh.scale.set(1, length, 1);
      // Defocused near pieces spread their tone rather than darkening.
      segment.focus = lerp(1, 0.45, (blurStart + blurEnd) / 2);
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

  // Defocus is baked into the type once per sentence, as it is into the residue: a small gaussian spread of the glyphs.
  function softenSentence(sigma) {
    if (sigma < 0.4) return;

    const radius = Math.ceil(sigma * 3);
    const x0 = Math.max(0, Math.floor((TEXT_CANVAS_WIDTH - text.measured) / 2) - radius * 2);
    const x1 = Math.min(TEXT_CANVAS_WIDTH, Math.ceil((TEXT_CANVAS_WIDTH + text.measured) / 2) + radius * 2);
    const width = x1 - x0;
    const height = TEXT_CANVAS_HEIGHT;
    const image = textContext.getImageData(x0, 0, width, height);
    const data = image.data;
    const kernel = new Float32Array(radius * 2 + 1);
    const source = new Float32Array(width * height);
    const spread = new Float32Array(width * height);
    let total = 0;

    for (let k = -radius; k <= radius; k += 1) {
      kernel[k + radius] = Math.exp(-(k * k) / (2 * sigma * sigma));
      total += kernel[k + radius];
    }
    for (let k = 0; k < kernel.length; k += 1) kernel[k] /= total;
    for (let i = 0; i < width * height; i += 1) source[i] = data[i * 4 + 1];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) sum += source[y * width + clamp(x + k, 0, width - 1)] * kernel[k + radius];
        spread[y * width + x] = sum;
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) sum += spread[clamp(y + k, 0, height - 1) * width + x] * kernel[k + radius];
        const value = Math.round(sum);
        data[(y * width + x) * 4] = value;
        data[(y * width + x) * 4 + 1] = value;
        data[(y * width + x) * 4 + 2] = value;
      }
    }

    textContext.putImageData(image, x0, 0);
    textTexture.needsUpdate = true;
  }

  function sentenceBase(fx, fy, depth, target) {
    const halfWidth = HALF_TAN * depth * state.aspect;
    const halfText = (text.measured * textWorldScale(depth)) / 2 / halfWidth;

    return target.set(clamp(fx, -0.9 + halfText, 0.9 - halfText) * halfWidth, fy * HALF_TAN * depth, -depth);
  }

  function placeSentence() {
    const scale = textWorldScale(text.depth);

    textMesh.scale.set(TEXT_CANVAS_WIDTH * scale, TEXT_CANVAS_HEIGHT * scale, 1);
    sentenceBase(text.fx, text.fy, text.depth, text.base);
  }

  function textHaze(depth) {
    const haze = smoothstep(FOG_NEAR, FOG_FAR, depth);
    return Math.max(haze, lerp(haze, fixationHaze, state.params.compress));
  }

  function toneLevel(color) {
    return color.getRGB(tone, SRGBColorSpace).g;
  }

  // Coverage of a layer's actual alpha map where the sight line from `from` through `point` crosses it.
  function layerCoverage(layer, point, from) {
    const map = layer.material.alphaMap;
    if (!layer.mesh.visible || !map) return 0;

    const depth = layer.spec.depth;
    const reach = (-depth - from.z) / (point.z - from.z);
    const scale = alignOffset(depth, layerCentre.set(0, 0, -depth), from);
    const u = 0.5 + (from.x + (point.x - from.x) * reach - layerCentre.x) / (2 * HALF_TAN * depth * state.aspect * COVER * scale);
    const v = 0.5 + (from.y + (point.y - from.y) * reach - layerCentre.y) / (2 * HALF_TAN * depth * COVER * scale);
    if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0;

    const { data, width, height } = map.image;
    return (data[(Math.floor(v * height) * width + Math.floor(u * width)) * 4 + 1] / 255) * layer.material.opacity;
  }

  // How a candidate would sit in the volume, judged from the residue and veils actually built, as the camera will see it
  // while the sentence is present. Contrast is relative to the same type on open field at the same depth, so haze is not
  // counted against far placements. `front` is occlusion by nearer veils, which read as passing behind (a nearer stain over
  // dark type reads as type on the stain, so it only counts as lost contrast); `surround` is residue just around the sentence.
  function assessPlacement(fx, fy, depth, times, levels) {
    const field = fieldColor.g;
    const type = lerp(textTone.g, field, textHaze(depth));
    const reference = field - type;
    const worldScale = textWorldScale(depth);
    const halfText = (text.measured / 2) * worldScale;
    const typeHeight = text.fontPx * worldScale;
    const rows = [-0.18, 0.02, 0.22];
    const columns = 24;
    const ratios = [];
    let front = 0;
    let fronted = 0;
    let surround = 0;
    let ring = 0;
    let scale = 1;

    function sightLine(dx, dy) {
      probe.set(anchor.x + dx * scale, anchor.y + dy * scale, anchor.z);
      let background = field;
      let full = field;
      let transmit = 1;
      let clear = 1;

      for (let index = 0; index < layers.length; index += 1) {
        const cover = layerCoverage(layers[index], probe, eye);
        full = lerp(full, levels[index], cover);
        if (layers[index].spec.depth > depth) background = full;
        else {
          transmit *= 1 - cover;
          if (layers[index].spec.kind === "veil") clear *= 1 - cover;
        }
      }

      return { contrast: Math.max(0, background - type) * transmit, veiled: 1 - clear, full };
    }

    for (let t = 0; t < times.length; t += 1) {
      cameraPosition(state.time + times[t] * (state.reducedMotion ? 0.5 : 1), eye);
      scale = alignOffset(depth, sentenceBase(fx, fy, depth, anchor), eye);

      for (let c = 0; c < columns; c += 1) {
        const dx = ((c + 0.5) / columns - 0.5) * 2 * halfText;

        for (let r = 0; r < rows.length; r += 1) {
          const sample = sightLine(dx, rows[r] * typeHeight);
          ratios.push(sample.contrast / reference);
          front = Math.max(front, sample.veiled);
          if (sample.veiled > 0.12) fronted += 1;
        }

        for (const dy of [-1.3, 1.3]) {
          surround += (field - sightLine(dx, dy * typeHeight).full) / (field - inkLevel);
          ring += 1;
        }
      }
    }

    const mean = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    const low = ratios.filter((value) => value < 0.5).length / ratios.length;

    return { mean, low, front, fronted: fronted / ratios.length, surround: surround / ring };
  }

  // Placement looks for a sentence that is in the volume rather than on it: most often partly behind a veil, otherwise
  // open but close to residue that parallax will set it against. Readability comes first.
  function chooseSentencePlacement() {
    const region = pick(TEXT_REGIONS.filter((zone) => zone !== text.region));
    const within = Math.random() < 0.6;
    const times = [text.fadeIn * 0.7, text.fadeIn + text.hold * 0.5];
    const levels = layers.map((layer) => toneLevel(layer.material.color));
    let best = null;

    for (let n = 0; n < TEXT_CANDIDATES; n += 1) {
      const fx = rand(region[0] - TEXT_REGION_SPREAD[0], region[1] + TEXT_REGION_SPREAD[0]);
      const fy = clamp(rand(region[2] - TEXT_REGION_SPREAD[1], region[3] + TEXT_REGION_SPREAD[1]), -0.8, 0.8);
      if (Math.abs(fx) < 0.22 && Math.abs(fy) < 0.28) continue;

      const depth = pick(TEXT_DEPTHS) + rand(-0.2, 0.2);
      const fit = assessPlacement(fx, fy, depth, times, levels);
      let score;

      if (fit.mean < 0.7 || fit.low > 0.2) score = fit.mean - 2;
      else if (within) score = 1 - 2 * Math.abs(fit.front - 0.42) - Math.abs(fit.fronted - 0.25) + 0.4 * fit.surround;
      else score = 1 - 2 * Math.abs(fit.surround - 0.22) + 0.3 * fit.mean + 0.3 * Math.min(fit.front, 0.3);

      score += rand(0, 0.15);
      // Sentences should not keep returning to the same pocket of the field, whichever zone they start from.
      for (const [x, y] of text.recent) if (Math.hypot(fx - x, fy - y) < 0.3) score -= 0.35;
      if (!best || score > best.score) best = { region, fx, fy, depth, score };
    }

    return best;
  }

  function beginSentence() {
    drawSentence(generateSentence());
    text.fadeIn = rand(6, 9);
    text.hold = rand(2.2, 4);
    text.fadeOut = rand(7, 10);

    const placement = chooseSentencePlacement();
    text.region = placement.region;
    text.depth = placement.depth;
    text.fx = placement.fx;
    text.fy = placement.fy;
    text.recent = [[text.fx, text.fy], ...text.recent].slice(0, 3);
    softenSentence(TEXT_SOFTNESS * text.fontPx * smoothstep(0.5, 3.5, Math.abs(text.depth - FIXATION_DEPTH)));
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
    state.phaseElapsed += dt;

    if (state.phaseElapsed >= state.phaseDuration) {
      state.phase = PHASES[state.phase].next;
      state.phaseElapsed = 0;
      state.phaseDuration = rand(...PHASES[state.phase].duration);
      state.phaseFrom = { ...state.params };
      canvas.dataset.phase = state.phase;
    }

    const phase = PHASES[state.phase];
    const progress = smoothstep(0, 1, state.phaseElapsed / phase.transition);

    for (const key in phase.target) {
      state.params[key] = lerp(state.phaseFrom[key], phase.target[key], progress);
    }
  }

  // Continuous perceptual adjustment: small translation while holding a mid-depth fixation,
  // with occasional slow re-fixation. Points nearer and farther than fixation drift in opposite directions.
  function cameraPosition(t, target) {
    const motion = state.reducedMotion ? 0.2 : 1;

    return target.set(
      motion * 0.24 * (0.62 * Math.sin((t * TAU) / 97 + 1.3) + 0.38 * Math.sin((t * TAU) / 173 + 4.1)),
      motion * 0.085 * (0.6 * Math.sin((t * TAU) / 131 + 0.4) + 0.4 * Math.sin((t * TAU) / 229 + 2.2)),
      motion * 0.32 * (0.7 * Math.sin((t * TAU) / 211 + 5) + 0.3 * Math.sin((t * TAU) / 317 + 0.9))
    );
  }

  function updateCamera(dt) {
    const motion = state.reducedMotion ? 0.2 : 1;

    cameraPosition(state.time, camera.position);

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

  // Parallax compensation: at align = 1 every layer shifts and scales exactly as if it sat on one shared plane.
  // The camera keeps moving and the image keeps moving, but near and far stop betraying their depths.
  function alignOffset(depth, target, from = camera.position) {
    const align = state.params.align;
    const advance = from.z;
    const shift = (align * (FLAT_DEPTH - depth)) / (FLAT_DEPTH + advance);
    const scale = lerp(1, (FLAT_DEPTH * (depth + advance)) / (depth * (FLAT_DEPTH + advance)), align);

    target.x += from.x * shift;
    target.y += from.y * shift;
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

      // Compression only ever lightens layers nearer than the fixation depth; far haze is left as it is.
      const compress = state.params.compress;
      const nearness = clamp((FIXATION_DEPTH - depth) / (FIXATION_DEPTH - FOG_NEAR), 0, 1);
      const haze = Math.max(layer.haze, lerp(layer.haze, fixationHaze, compress));
      layer.material.color.setRGB(
        lerp(layer.tone.r, fieldColor.r, haze),
        lerp(layer.tone.g, fieldColor.g, haze),
        lerp(layer.tone.b, fieldColor.b, haze),
        SRGBColorSpace
      );

      let alpha = opacity * smoothstep(0, 1, layer.appear);
      alpha *= 1 - 0.35 * compress * nearness;
      if (kind === "veil") alpha = Math.min(0.92, alpha * (1 + state.params.veil));
      layer.material.opacity = alpha;
    }
  }

  function updateTraces() {
    const presence = state.ready ? state.params.trace : 0;

    for (let index = 0; index < traceFragments.length; index += 1) {
      const fragment = traceFragments[index];
      const pulse =
        0.6 * Math.sin(state.time * fragment.rateA + fragment.phaseA) +
        0.4 * Math.sin(state.time * fragment.rateB + fragment.phaseB);
      const arrival = smoothstep(fragment.lag, fragment.lag + 0.55, presence);
      fragment.opacity = fragment.trace.opacity * arrival * smoothstep(-0.45, 0.35, pulse);
    }

    for (let index = 0; index < traceSegments.length; index += 1) {
      const segment = traceSegments[index];
      segment.material.opacity = segment.fragment.opacity * segment.focus;
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

    // Like the layers: haze by depth, and while depth compresses a near sentence takes on mid-depth haze and recedes a little.
    const haze = textHaze(text.depth);
    const nearness = clamp((FIXATION_DEPTH - text.depth) / (FIXATION_DEPTH - FOG_NEAR), 0, 1);
    textMaterial.color.setRGB(
      lerp(textTone.r, fieldColor.r, haze),
      lerp(textTone.g, fieldColor.g, haze),
      lerp(textTone.b, fieldColor.b, haze),
      SRGBColorSpace
    );
    textMaterial.opacity = TEXT_MAX_OPACITY * envelope * (1 - 0.25 * state.params.compress * nearness);
  }

  function step(dt) {
    const timeScale = state.reducedMotion ? 0.5 : 1;

    state.time += dt * timeScale;
    updatePhase(dt);
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
  canvas.dataset.traces = String(traceFragments.length);
  layoutTraces();
  resize();
  start();
}
