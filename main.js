import {
  CanvasTexture,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  Vector2,
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
// Main-thread time per frame given to generating residue while the volume assembles.
const TEXTURE_BUDGET_MS = 12;
const FOG_NEAR = 4;
const FOG_FAR = 24;
// Internal frame displacement in fractions of the view's half-width, not display aspect.
// A point at fixation stays put; nearer and farther material re-register in opposite directions.
const RECALIBRATION = {
  amplitude: 0.03,
  quiet: [40, 100],
  duration: [12, 25]
};
// Evolving residue: a few fields hold two alternate states beside their composed one, built once with the rest of the
// map, and move between them slowly: an edge advances or retreats, density gathers in one part and thins in another, an
// opening appears or closes. The field stays where it is and stays the same material. amount is how far the alternates
// depart from the composed state; times are in seconds.
// shift moves a mass by a fraction of its own radius and is kept small, so a field never travels; swell, turn and
// reweigh reshape it in place. edge and density are how far, in noise cells, an alternate draws its edge irregularity and
// its internal density from. bias moves the whole field's threshold; open moves it unevenly, in broad lobes, so an
// opening forms in one part of a field while another part closes. front is the width of the band in which a change
// passes through the field.
const MORPH = {
  amount: 1,
  shift: 0.3,
  swell: 0.28,
  turn: 0.35,
  reweigh: 0.2,
  edge: 1,
  density: 1.3,
  bias: 0.09,
  open: 0.18,
  front: 0.3,
  transition: [12, 30],
  hold: [8, 30],
  concurrent: 2,
  reduced: 0.4
};
// By depth: the near streaked mass, the lower-right soft mass, and the far upper-right cluster.
const MORPH_LAYERS = [5, 6, 17.5];
// Anchored instability: the fields that do not pass stay where they are but are not frozen. They hold three states like
// evolving residue, drawn and read differently. Their masses barely move or resize, since position is the one thing
// that holds; instead their edges are drawn from distant noise, density moves between and within masses, and broad
// lobes of the threshold open and fill with no change to the field's overall strength, so nothing swells or breathes.
// The order in which parts change is finer (order), so a change is scattered rather than advancing through the field.
// And they never settle: two slow changes run through every part of a field at once, one toward each alternate, each
// reaching different parts at different times and in opposite senses, so wherever one part is turning another is
// under way. Each goes round once in a time drawn from cycle, at a pace that wanders but never falls below lull, and
// slows a little while depth is flat. The two do not share a period, so the field rarely returns to a figure it held.
// Times are in seconds.
const ANCHOR = {
  amount: 1,
  shift: 0.05,
  swell: 0.08,
  turn: 0.12,
  reweigh: 0.12,
  edge: 1.5,
  density: 1.8,
  bias: 0,
  open: 0.32,
  order: 1.8,
  cycle: [100, 180],
  lull: 0.4,
  flat: 0.7
};
// By depth: the far veil, the graphite at fixation, the ink, and the two veils that cut across them.
const ANCHOR_LAYERS = [10.3, 9, 8, 7, 4.3];
// Aura drift: the anchored fields are not fixed either. Each strays very slowly from its composed place on its own:
// mostly along the passage axis, sometimes with it and sometimes against it, never in step with another field or with
// the passage, so it reads as material lagging behind the sky rather than as a second, slower current. reach is how far,
// in view half-heights, a field strays at most; cross is the share of that across the passage axis; periods are in
// seconds and share no common beat. While depth is flat the drift slows to flat of its pace.
const AURA = {
  reach: 0.11,
  cross: 0.45,
  periods: [[260, 420], [430, 700], [150, 240]],
  flat: 0.3
};
// Edge language shared by all residue, so no field reads as a painted stroke laid over the others: a contour may hold
// for a stretch, then dissolve. feather widens the outer threshold of the crisper fields where their masses thin out,
// by an amount that wanders along the contour between firm (a share of it) and full, so a thin outer mass reads as
// wash rather than a flat stamped shape; their interiors and grain stay as they are. A cut's softness ranges
// over cut and wanders along its length, and its line meanders by waver, so it no longer reads as a mask.
const EDGE = {
  feather: 3,
  firm: 0.35,
  cut: [0.035, 0.12],
  waver: 0.06
};
// Passage: some fields are not held in place but carried slowly across the frame, all in one oblique direction, while
// the others stay where they are, like a disturbance held on the retina while the field beyond it goes by. Each passing
// field moves at its own depth, nearer material faster, so passage is itself a depth cue. The passage is never steady:
// it slows and gathers again (sway), and while depth flattens every field converges on one much slower speed (flat), so
// the passage all but stalls on the shared plane. A passing field is a stream of two long tiles: a tile that has left
// the frame is rebuilt with new masses of the same material and joins the back of the stream, so what arrives is never
// what left. speed is in view half-widths per second at the fixation depth; direction is in radians from the screen's
// horizontal; length is a tile's half-length in view half-widths; clusters is how many masses a new tile may carry.
const PASSAGE = {
  speed: 0.012,
  direction: -0.2,
  sway: 0.4,
  flat: 0.3,
  length: 1.8,
  clusters: [1, 3],
  reduced: 0.3
};
// By depth: the far fragments, the faint wash, the small upper stains, the near soft masses and the broad far veil.
const PASSAGE_LAYERS = [21, 17.5, 15.2, 13.2, 12.4, 11.6, 6, 5];

// One warm tonal ladder. Every step has a single role; depth moves a tone toward the field.
const TONE = {
  field: 0xf3f0e8,
  graphite: 0x6d6a63,
  charcoal: 0x3d3b37,
  ink: 0x211f1c,
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

// Depth is legible, becomes uncertain, flattens, then forms again. Durations are loose so it never reads as a loop.
// Each phase eases from wherever the previous one left off to its target over `transition` seconds, then holds.
// align: parallax cancellation onto one shared plane (FLAT_DEPTH). drift: independent layer wandering.
// compress: nearer layers take on mid-depth tone and strength, so depth contrast collapses without revealing far strata.
const PHASES = {
  legible: {
    duration: [55, 80],
    transition: 28,
    next: "uncertain",
    target: { align: 0, drift: 0.15, compress: 0, veil: 0 }
  },
  uncertain: {
    duration: [30, 40],
    transition: 26,
    next: "flat",
    target: { align: 0.4, drift: 0.08, compress: 0.45, veil: 0.2 }
  },
  flat: {
    duration: [42, 50],
    transition: 22,
    next: "forming",
    target: { align: 1, drift: 0, compress: 1, veil: 0.05 }
  },
  forming: {
    duration: [36, 46],
    transition: 34,
    next: "legible",
    target: { align: 0, drift: 0.15, compress: 0, veil: 0 }
  }
};

const TEXT_CANVAS_WIDTH = 2048;
const TEXT_CANVAS_HEIGHT = 128;
const TEXT_FONT_PX = 64;
const TEXT_FONT_FAMILY = 'ui-serif, Georgia, "Times New Roman", serif';
const TEXT_MAX_OPACITY = 0.8;
// The silence after a fragment has faded, in seconds to the next one: sometimes a long absence in which text can be
// forgotten, usually a moderate pause, and now and then a second thought soon after the first. A quick return is never
// followed by another. Timing never looks at the image.
const TEXT_GAPS = {
  long: { chance: 0.35, range: [120, 240] },
  normal: { chance: 0.5, range: [45, 90] },
  short: { chance: 0.15, range: [5, 18] }
};
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

// Authored whole, never assembled: perceptual checks, corrections and sounds held before words, completed by the moving
// image. A sound's written length is its duration.
// Loose families give the thought a weak memory of itself. They are never shown and imply no order.
const FRAGMENTS = {
  finding: ["there", "again", "found it", "behind that", "just beside it"],
  remembering: ["a moment ago", "was that part there before", "before it moved", "it was darker", "I thought this was closer"],
  holding: ["still", "wait", "can still find this part", "not gone"],
  correcting: ["no", "not that edge", "the other one", "a little lower", "same place maybe", "it moved or I did"],
  losing: ["that bit left", "not there", "there was more here", "I had it just now"],
  hesitation: ["ahhhhhhhhh", "mmmmmmmmmmmm"]
};
// Where a returning thought may drift after a moderate pause: its own family or one beside it.
const FAMILY_NEIGHBOURS = {
  finding: ["holding", "correcting"],
  remembering: ["correcting", "losing"],
  holding: ["losing", "remembering"],
  correcting: ["finding", "remembering"],
  losing: ["finding", "remembering"]
};
// How often the next fragment stays near the last one's family: sometimes after a moderate pause, usually after a quick
// return (then its own family or a correction). A long silence forgets it. A hesitation is never followed by another.
const TEXT_MEMORY = { normal: 0.3, short: 0.75 };
const FRAGMENT_LINES = Object.values(FRAGMENTS).flat();
const FRAGMENT_FAMILY = new Map(Object.entries(FRAGMENTS).flatMap(([family, lines]) => lines.map((line) => [line, family])));
// What a chosen thought then does, weighted among what the fragment and recent memory allow. Most are simply there and
// gone; others are overtaken by a correction before they have left, stop short, leave a word or two behind, or come back
// later as a piece of themselves or slightly wrong. None of it reads the image.
const THOUGHT_BEHAVIOURS = { whole: 0.6, corrected: 0.12, interrupted: 0.15, residue: 0.07, echo: 0.05, altered: 0.07 };
// A sound is held rather than shown: its length grows, lets go, swells and settles, or breaks off before it is full.
const SOUND_BEHAVIOURS = { grow: 0.35, release: 0.35, swell: 0.15, broken: 0.15 };
// Words too slight to be all that stays behind, and words a returning thought would not end on.
const SLIGHT_WORDS = new Set(["it", "that", "the", "a", "or", "I", "one", "was", "this"]);
const OPEN_WORDS = new Set(["a", "the", "or", "was", "this", "just", "can", "I"]);
// Fragments recently recalled, which cannot be recalled again, so no piece keeps coming back.
const RECALL_MEMORY = 6;

// A fragment cannot return until most of the others have been shown, about half an hour at the usual intervals. The
// choice knows only the last fragment's family and the silence since it, never the image.
function chooseFragment(mind, gap) {
  const previous = mind.family;
  const unsaid = (families) => families.flatMap((family) => FRAGMENTS[family]).filter((line) => !mind.said.includes(line));
  let related = null;
  if (previous && previous !== "hesitation") {
    if (gap === "short" && Math.random() < TEXT_MEMORY.short) related = [...new Set([previous, "correcting"])];
    else if (gap === "normal" && Math.random() < TEXT_MEMORY.normal) related = [previous, ...FAMILY_NEIGHBOURS[previous]];
  }
  const near = related ? unsaid(related) : [];
  if (near.length) return pick(near);
  return pick(unsaid(Object.keys(FRAGMENTS).filter((family) => !(previous === "hesitation" && family === "hesitation"))));
}

function remember(mind, fragment) {
  mind.said = [fragment, ...mind.said].slice(0, FRAGMENT_LINES.length - 10);
  mind.family = FRAGMENT_FAMILY.get(fragment);
}

function words(line) {
  return [...line.matchAll(/\S+/g)].map((match) => [match.index, match.index + match[0].length]);
}

// Where the last word or two begin, if they can stand alone: what may stay behind, or come back later on its own.
function remnants(line) {
  const spans = words(line);
  return [1, 2]
    .filter((count) => spans.length > count && !(count === 1 && SLIGHT_WORDS.has(line.slice(...spans.at(-1)))))
    .map((count) => spans.at(-count)[0]);
}

// Where a thought can stop short: a word or two before its end, never before its second word.
function breaks(line) {
  const spans = words(line);
  return [1, 2].filter((count) => spans.length - count >= 2).map((count) => line.slice(0, spans.at(-count - 1)[1]));
}

// How a thought may come back slightly wrong: a word or two missing at either end, and not left hanging.
function alterations(line) {
  const spans = words(line);
  return [1, 2]
    .filter((count) => spans.length - count >= 2)
    .flatMap((count) => [line.slice(0, spans.at(-count - 1)[1]), line.slice(spans[count][0])])
    .filter((version) => !OPEN_WORDS.has(version.slice(version.lastIndexOf(" ") + 1)));
}

// Earlier fragments that can come back: not the last two, not a sound, and not one recalled recently.
function recallable(mind, derive) {
  return mind.said
    .slice(2)
    .filter((line) => FRAGMENT_FAMILY.get(line) !== "hesitation" && !mind.recalled.includes(line) && derive(line).length);
}

function weighted(weights, allowed = () => true) {
  const options = Object.keys(weights).filter(allowed);
  let roll = Math.random() * options.reduce((sum, key) => sum + weights[key], 0);
  return options.find((key) => (roll -= weights[key]) < 0) ?? options.at(-1);
}

function thoughtFade() {
  return { fadeIn: rand(6, 9), hold: rand(2.2, 4), fadeOut: rand(7, 10), ease: rand(0.8, 1.25) };
}

// A thought is planned whole as it begins: the lines it may show, and marks that each show a span of one line on one of
// three sheets of type (two for thoughts, one for what stays behind) with a fade of its own. A mark that starts at full
// strength where another on the same sheet ends replaces it in the same frame, so a line can lose or gain letters without
// a visible cut.
function thoughtPlan(behaviour, lines, marks) {
  const full = marks.map((mark) => ({ start: 0, peak: 1, ease: 1, spans: [[0, lines[mark.line].length]], ...mark }));
  for (const mark of full) mark.end = mark.start + mark.fadeIn + mark.hold + mark.fadeOut;
  return {
    behaviour,
    lines: lines.map((line) => ({ text: line, placed: false })),
    marks: full,
    end: Math.max(...full.map((mark) => mark.end))
  };
}

function markLevel(mark, time) {
  const age = time - mark.start;
  if (age < mark.fadeIn) return mark.peak * smoothstep(0, 1, age / mark.fadeIn) ** mark.ease;
  if (age < mark.fadeIn + mark.hold) return mark.peak;
  return mark.peak * (1 - smoothstep(0, 1, (age - mark.fadeIn - mark.hold) / mark.fadeOut)) ** mark.ease;
}

// The family memory chooses what comes next; only then is it decided what the thought does. A correction is chosen as a
// quick second thought would be. A recalled piece prefers the family the thought had turned to, and appears somewhere new.
function planThought(mind) {
  const fragment = chooseFragment(mind, mind.gap);
  if (FRAGMENT_FAMILY.get(fragment) === "hesitation") {
    remember(mind, fragment);
    return planSound(fragment);
  }

  const echoes = recallable(mind, remnants);
  const returns = recallable(mind, alterations);
  const allowed = {
    whole: true,
    corrected: true,
    interrupted: breaks(fragment).length > 0,
    residue: remnants(fragment).length > 0,
    echo: echoes.length > 0,
    altered: returns.length > 0
  };
  const behaviour = weighted(THOUGHT_BEHAVIOURS, (key) => allowed[key]);
  const fade = thoughtFade();

  if (behaviour === "echo" || behaviour === "altered") {
    const sources = behaviour === "echo" ? echoes : returns;
    const kin = sources.filter((line) => FRAGMENT_FAMILY.get(line) === FRAGMENT_FAMILY.get(fragment));
    const source = pick(kin.length ? kin : sources);
    const version = behaviour === "echo" ? source.slice(pick(remnants(source))) : pick(alterations(source));
    mind.recalled = [source, ...mind.recalled].slice(0, RECALL_MEMORY);
    mind.family = FRAGMENT_FAMILY.get(source);
    if (behaviour === "echo") fade.hold = rand(1.5, 3);
    return thoughtPlan(behaviour, [version], [{ sheet: "a", line: 0, ...fade }]);
  }

  remember(mind, fragment);

  if (behaviour === "interrupted") {
    // It never quite arrives, and is let go sooner.
    const reach = rand(0.6, 0.9);
    return thoughtPlan(behaviour, [pick(breaks(fragment))], [
      { sheet: "a", line: 0, fadeIn: fade.fadeIn * reach, peak: smoothstep(0, 1, reach), hold: rand(0.3, 1.2), fadeOut: rand(5, 7.5) }
    ]);
  }

  if (behaviour === "residue") {
    // As the thought begins to go, its last word or two are handed to the third sheet and stay a few seconds longer.
    const cut = pick(remnants(fragment));
    const held = fade.fadeIn + fade.hold;
    return thoughtPlan(behaviour, [fragment], [
      { sheet: "a", line: 0, fadeIn: fade.fadeIn, hold: fade.hold, fadeOut: 0, ease: fade.ease },
      { sheet: "a", line: 0, spans: [[0, fragment.slice(0, cut).trimEnd().length]], start: held, fadeIn: 0, hold: 0, fadeOut: fade.fadeOut, ease: fade.ease },
      { sheet: "r", line: 0, spans: [[cut, fragment.length]], start: held, fadeIn: 0, hold: fade.fadeOut + rand(-1, 2), fadeOut: rand(3, 6) }
    ]);
  }

  if (behaviour === "corrected") {
    // The next thought arrives elsewhere while this one is still going, and they share a few seconds.
    const correction = chooseFragment(mind, "short");
    if (FRAGMENT_FAMILY.get(correction) !== "hesitation") {
      remember(mind, correction);
      const start = fade.fadeIn + fade.hold + fade.fadeOut * rand(0.15, 0.35);
      return thoughtPlan(behaviour, [fragment, correction], [
        { sheet: "a", line: 0, ...fade },
        { sheet: "b", line: 1, start, fadeIn: rand(3.5, 5.5), hold: rand(2.2, 4), fadeOut: rand(7, 10), ease: rand(0.8, 1.25) }
      ]);
    }
  }

  return thoughtPlan("whole", [fragment], [{ sheet: "a", line: 0, ...fade }]);
}

// Lengths from `from` to `to` in a few steps of at least two letters.
function soundRamp(from, to, stages = 3 + Math.floor(rand(0, 3))) {
  const steps = Math.max(1, Math.min(stages - 1, Math.floor((to - from) / 2)));
  const parts = Array(steps).fill(2);
  for (let spare = to - from - 2 * steps; spare > 0; spare -= 1) parts[Math.floor(rand(0, steps))] += 1;
  return parts.reduce((lengths, part) => [...lengths, lengths.at(-1) + part], [from]);
}

// Written length is duration. A sound is shown at a few lengths in turn, seconds apart and a handful of letters at a time,
// never letter by letter. It keeps its first letter where it is: letters it gains fade in on the second sheet and are then
// taken into the first; letters it lets go are handed to the second sheet and fade from there.
function planSound(sound) {
  const shape = weighted(SOUND_BEHAVIOURS);
  const full = sound.length;
  const short = sound.indexOf(sound.at(-1)) + 2 + Math.floor(rand(0, 2));
  let lengths;
  if (shape === "grow") lengths = soundRamp(short, full);
  else if (shape === "release") lengths = soundRamp(short, full).reverse();
  else if (shape === "swell") lengths = [...soundRamp(short, full, 3), Math.round(lerp(short, full, rand(0.3, 0.55)))];
  else lengths = soundRamp(short, Math.round(lerp(short, full, rand(0.45, 0.7))), 2 + Math.floor(rand(0, 2)));

  const marks = [];
  let start = 0;
  let settled = rand(5, 8);
  lengths.forEach((length, index) => {
    const mark = { sheet: "a", line: 0, spans: [[0, length]], start, fadeIn: index ? 0 : settled, hold: 0, fadeOut: 0 };
    marks.push(mark);
    const turn = settled + rand(2, 4);
    const next = lengths[index + 1];
    if (next === undefined) {
      mark.hold = turn - start - mark.fadeIn;
      mark.fadeOut = shape === "broken" ? rand(3.5, 5) : rand(6, 9);
      return;
    }
    const change = rand(2, 3.5);
    const grows = next > length;
    marks.push({
      sheet: "b",
      line: 0,
      spans: grows ? [[length, next]] : [[next, length]],
      start: turn,
      fadeIn: grows ? change : 0,
      hold: 0,
      fadeOut: grows ? 0 : change
    });
    start = grows ? turn + change : turn;
    mark.hold = start - mark.start - mark.fadeIn;
    settled = turn + change;
  });
  return thoughtPlan(shape, [sound], marks);
}

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

// A shared octave construction: each octave doubles in frequency and is rotated against the last so no grid direction
// survives. A layer can carry its own character from octave 2 upwards (see residueCharacter).
function octaveCharacter(gain, scale, turn, twist, restore = 1) {
  const steps = [];

  for (let octave = 0; octave < 6; octave += 1) {
    const size = octave === 0 ? 2 : scale;
    const angle = octave === 0 ? SHARED_TURN : turn + twist * (octave - 1);
    steps.push([size * Math.cos(angle), size * Math.sin(angle), size]);
  }

  return { gain, steps, restore };
}

const SHARED_TURN = Math.atan2(1.2, 1.6);
const SHARED_OCTAVES = octaveCharacter(0.5, 2, SHARED_TURN, 0);

// Octaves 0 and 1 always follow the shared construction, so every layer keeps the silhouettes the composition was built
// on; `character` and `detail` only shape octave 2 upwards. Normalisation stays that of the shared construction, so a
// quieter octave lowers variation instead of being rescaled back.
// `cell` is the size of an octave-0 cell in pixels at 1080 lines: an octave fades out before its cell becomes finer than
// `limit`, so no detail is generated finer than the softness and raster meant to carry it (this is what used to alias).
// `shiftX`/`shiftY` take back part of a domain warp that was added to x/y, from octave 2 upwards only: the warp still
// shapes the masses, but fine structure is not sheared into curling, smoke-like filaments.
function fbm(x, y, octaves, cell, limit, character = SHARED_OCTAVES, detail = 1, shiftX = 0, shiftY = 0) {
  const norm = 1 - 0.5 ** octaves;
  let sum = 0;
  let amp = 0.5;

  for (let octave = 0; octave < octaves; octave += 1) {
    const band = smoothstep(limit, limit * 1.6, cell);
    if (band <= 0) break;

    sum += amp * band * (octave > 1 ? detail : 1) * noise(x, y);
    if (octave === 1) {
      x = (x - 1.6 * shiftX + 1.2 * shiftY) * character.restore;
      y -= 1.2 * shiftX + 1.6 * shiftY;
    }
    const [c, s, size] = character.steps[octave];
    const nx = x * c - y * s + 3.1;
    const ny = x * s + y * c + 1.7;
    x = nx;
    y = ny;
    cell /= size;
    amp *= octave === 0 ? 0.5 : character.gain;
  }

  return (sum / norm) * 1.4;
}

// Each layer's own fine structure: how quickly detail falls away and how its octaves turn against each other, so
// no single noise signature (fixed ratios, fixed 37 degree turn, even roughness) repeats across the field. On crisp
// layers fine octaves mostly undo the layer's stretch, which otherwise resolved into parallel hatching; defocused layers
// keep it, so they read as a wiped direction rather than rounding into puffy lobes.
function residueCharacter(spec) {
  const crisp = 1 - clamp((residueBlur(spec) - 1.5) / 2, 0, 1);
  const random = mulberry32(Math.round(spec.depth * 997));
  const sign = () => (random() < 0.5 ? -1 : 1);

  return octaveCharacter(
    lerp(0.42, 0.62, random()),
    lerp(1.75, 2.3, random()),
    sign() * lerp(0.5, 1.3, random()),
    sign() * lerp(0.2, 0.7, random()),
    lerp(1, 1 / spec.stretch, 0.75 * crisp)
  );
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

// Softness of a layer's residue in pixels at 1080 lines: sharpest at the fixation depth, increasingly defocused in
// front of it, only slightly softer behind it (distant material stays small and fairly crisp). Veils and faint washes
// are broad by nature. The raster follows this softness, so texels are always finer than the detail they carry.
function residueBlur(spec) {
  const blur = spec.depth < FIXATION_DEPTH
    ? lerp(1.5, 3.6, clamp((FIXATION_DEPTH - spec.depth) / (FIXATION_DEPTH - FOG_NEAR), 0, 1))
    : lerp(1.5, 2.7, clamp((spec.depth - FIXATION_DEPTH) / 12, 0, 1));

  return spec.kind === "veil" || spec.opacity < 0.2 ? Math.max(blur, 4.8) : blur;
}

// Alternate states of one field share its material body. Only what a field holds changes: its masses move a little,
// grow or shrink and reweigh, its edge irregularity and internal density are drawn from nearby noise, and its threshold
// shifts slightly. Seeded by depth, so the alternates are the same on every load; a passing tile's by its generation too.
function residueStates(spec, amount, character = MORPH) {
  const random = mulberry32(Math.round(spec.depth * 131) + 7 + spec.generation * 7919);
  const signed = () => random() * 2 - 1;
  const states = [{ masses: spec.masses, warp: [0, 0], density: [0, 0], bias: 0, open: 0 }];

  for (let index = 0; index < 2; index += 1) {
    states.push({
      masses: spec.masses.map(([mx, my, rx, ry, weight, angle = 0]) => [
        mx + amount * character.shift * rx * signed(),
        my + amount * character.shift * ry * signed(),
        rx * (1 + amount * character.swell * signed()),
        ry * (1 + amount * character.swell * signed()),
        weight * (1 + amount * character.reweigh * signed()),
        angle + amount * character.turn * signed()
      ]),
      warp: [amount * character.edge * signed(), amount * character.edge * signed()],
      density: [amount * character.density * signed(), amount * character.density * signed()],
      bias: amount * character.bias * signed(),
      open: amount * character.open
    });
  }

  return states;
}

// An anchored field's total alpha, as its two changes read it, depends on where both changes stand. These sums over its
// map (order-weighted moments of the differences between its states) give that total for any two phases at once, so the
// field's overall strength can be held while its material moves (see steadiness).
const ANCHOR_WAVES = [1.4, 2.1];

function anchoredMoments(data) {
  const lut = [];
  for (let v = 0; v < 256; v += 1) {
    const t1 = TAU * ANCHOR_WAVES[0] * (v / 255);
    const t2 = TAU * ANCHOR_WAVES[1] * (v / 255);
    lut.push([Math.cos(t1), Math.sin(t1), Math.cos(t2), Math.sin(t2), Math.cos(t1 + t2), Math.sin(t1 + t2), Math.cos(t1 - t2), Math.sin(t1 - t2)]);
  }
  const m = new Float64Array(13);
  for (let k = 0; k < data.length; k += 4) {
    const g = data[k + 1];
    const d = data[k] - g;
    const e = data[k + 2] - g;
    m[0] += g;
    if (!d && !e) continue;
    const [c1, s1, c2, s2, cp, sp, cm, sm] = lut[data[k + 3]];
    m[1] += d;
    m[2] += e;
    m[3] += d * c1;
    m[4] += d * s1;
    m[5] += e * c2;
    m[6] += e * s2;
    m[7] += d * c2;
    m[8] += d * s2;
    m[9] += d * cp;
    m[10] += d * sp;
    m[11] += d * cm;
    m[12] += d * sm;
  }
  return m;
}

// The opacity that keeps an anchored field at its composed strength for its current phases (same read as its shader).
function steadiness(m, phaseX, phaseY, amount) {
  if (m[0] <= 0) return 1;
  const p = TAU * phaseX;
  const q = TAU * phaseY;
  const dc1 = Math.cos(p) * m[3] - Math.sin(p) * m[4];
  const ec2 = Math.cos(q) * m[5] + Math.sin(q) * m[6];
  const dc2 = Math.cos(q) * m[7] + Math.sin(q) * m[8];
  const dc12 = 0.5 * (Math.cos(p - q) * m[9] - Math.sin(p - q) * m[10] + Math.cos(p + q) * m[11] - Math.sin(p + q) * m[12]);
  const change = 0.5 * (m[1] - dc1) + 0.33 * (m[2] - ec2) - 0.165 * (m[1] - dc1 - dc2 + dc12);
  return clamp(m[0] / (m[0] + amount * change), 0.8, 1.25);
}

// Washed charcoal / erasure density, stored as an alpha map.
// Noise is sampled in world units, so deeper layers carry finer detail on screen (a texture gradient cue).
// Layers away from the fixation depth are generated softer: focus as a depth cue.
// The map covers only the region its masses can reach (placed on the plane through the texture offset and repeat), so
// resolution is spent where residue is. It is built a row at a time, so generation can be spread across frames.
// With alternate states the composed state goes to G, which is what an ordinary alpha map reads, and the others to R
// and B; the costly material body is computed once for all of them.
function* residueJob(spec, aspect, states = [{ masses: spec.masses, warp: [0, 0], density: [0, 0], bias: 0, open: 0 }]) {
  const focusBlur = clamp(Math.abs(spec.depth - FIXATION_DEPTH) / FIXATION_DEPTH, 0, 1);
  const blur = residueBlur(spec);
  // Veils stay broad; stains may keep structure down to about two texels, so their edges break up rather than round off.
  const limit = blur * (spec.kind === "veil" ? 1.6 : 1.45);
  const texel = clamp(blur * 0.62, 1, 3);
  // A passing tile is longer than the view along its passage; everything else covers the view by COVER both ways.
  const coverX = spec.cover;
  const planeRows = (COVER * 1080) / texel;
  const planeCols = ((coverX * 1080) / texel) * aspect;
  const freq = spec.grain * (spec.depth / FIXATION_DEPTH);
  const cell = 540 / freq;
  const character = residueCharacter(spec);
  const edge = spec.edge + focusBlur * 0.16;
  // Fields generated crisp (near the fixation depth) take the most feathering at their outer edge.
  const crisp = smoothstep(2.4, 1.6, blur);
  const cosA = Math.cos(spec.tilt);
  const sinA = Math.sin(spec.tilt);
  // Each passing tile reads its own part of the layer's material.
  const offsetX = spec.depth * 17.3 + spec.grainOffset[0];
  const offsetY = spec.depth * -11.9 + spec.grainOffset[1];
  // On narrow screens the composition keeps its proportions and is cropped rather than squeezed.
  const compose = Math.pow(aspect / NOMINAL_ASPECT, 0.4);

  // Bounds of every point where a mass reaches the 0.004 threshold below which nothing is drawn, plus a clear margin.
  let left = 1;
  let right = 0;
  let bottom = 1;
  let top = 0;
  for (const state of states) {
    for (const [mx, my, rx, ry, weight, angle = 0] of state.masses) {
      const reach = Math.sqrt(Math.max(0, Math.log(weight / 0.004)));
      const ex = reach * Math.hypot(rx * Math.cos(angle), ry * Math.sin(angle));
      const ey = reach * Math.hypot(rx * Math.sin(angle), ry * Math.cos(angle));
      left = Math.min(left, 0.5 + (mx - ex) / compose / (2 * coverX) - 3 / planeCols);
      right = Math.max(right, 0.5 + (mx + ex) / compose / (2 * coverX) + 3 / planeCols);
      bottom = Math.min(bottom, 0.5 + (my - ey) / (2 * COVER) - 3 / planeRows);
      top = Math.max(top, 0.5 + (my + ey) / (2 * COVER) + 3 / planeRows);
    }
  }
  left = Math.max(0, left);
  right = Math.min(1, right);
  bottom = Math.max(0, bottom);
  top = Math.min(1, top);

  const width = Math.max(8, Math.ceil((right - left) * planeCols));
  const height = Math.max(8, Math.ceil((top - bottom) * planeRows));
  const fields = states.map(() => new Float32Array(width * height).fill(-4));
  const rests = states.map(() => new Float32Array(width * height));
  const feathers = states.map(() => new Float32Array(width * height).fill(1));
  const edges = new Float32Array(width * height);

  for (let j = 0; j < height; j += 1) {
    const v = bottom + ((j + 0.5) / height) * (top - bottom);
    const fadeY = edgeFade(v);
    const y = (v - 0.5) * 2 * COVER;

    for (let i = 0; i < width; i += 1) {
      const k = j * width + i;
      const u = left + ((i + 0.5) / width) * (right - left);
      const fade = fadeY * edgeFade(u);
      const x = (u - 0.5) * 2 * coverX;

      let reachable = 0;
      for (const state of states) reachable = Math.max(reachable, composition(state.masses, x * compose, y));
      if (fade <= 0 || reachable < 0.004) continue;

      const px = x * aspect * freq;
      const py = y * freq;
      const rx = (px * cosA - py * sinA) * spec.stretch + offsetX;
      const ry = px * sinA + py * cosA + offsetY;
      const warpX = fbm(rx + 1.7, ry + 9.2, 3, cell, limit);
      const warpY = fbm(rx + 8.3, ry + 2.8, 3, cell, limit);
      // Broad, independent fields: where fine structure is worked up or left smooth, and where density is uneven.
      const detail = lerp(0.35, 1.15, smoothstep(-0.4, 0.4, fbm(rx * 0.22 - 6.3, ry * 0.22 + 2.9, 2, cell / 0.22, limit)));

      // The material body is shared by every state.
      const body = fbm(rx + warpX * spec.warp, ry + warpY * spec.warp, 5, cell, limit, character, detail, warpX * spec.warp * 0.7, warpY * spec.warp * 0.7);

      // Edge quality wanders: pressed charcoal in places, feathered wash in others.
      edges[k] = edge * lerp(0.2, 1.8, smoothstep(-0.45, 0.45, fbm(rx * 0.55 + 9.1, ry * 0.55 - 4.3, 2, cell / 0.55, limit)));

      // How far this part of a contour dissolves: broad, so a contour holds along one stretch and loosens along another.
      const loosen = smoothstep(-0.45, 0.45, fbm(rx * 0.35 - 2.7, ry * 0.35 + 6.1, 2, cell / 0.35, limit));

      let cut = 1;
      if (spec.cut) {
        const [nx, ny, offset] = spec.cut;
        const meander = fbm(rx * 0.25 + 5.3, ry * 0.25 - 1.9, 2, cell / 0.25, limit);
        const along = nx * x + ny * y - offset + warpY * 0.07 + warpX * 0.03 + EDGE.waver * meander;
        const soft = lerp(EDGE.cut[0], EDGE.cut[1], loosen) + focusBlur * 0.04 + 0.03 * smoothstep(-0.3, 0.5, warpX);
        cut = smoothstep(-soft, soft, along);
      }

      let erased = -1;
      let grained = -1;
      for (let s = 0; s < states.length; s += 1) {
        const state = states[s];
        const [shiftX, shiftY] = state.warp;
        const [denseX, denseY] = state.density;
        const edgeX = s === 0 ? warpX : fbm(rx + 1.7 + shiftX, ry + 9.2 + shiftY, 3, cell, limit);
        const edgeY = s === 0 ? warpY : fbm(rx + 8.3 + shiftX, ry + 2.8 + shiftY, 3, cell, limit);

        // Masses only set how much residue a region holds; they never draw an outline.
        // Edges come from the internal strata, so nothing reads as a bounded object.
        const mass = composition(state.masses, (x + edgeX * 0.16) * compose, y + edgeY * 0.07);
        // Broad lobes of the threshold rise and fall separately in each alternate: parts of the field open, others fill.
        const open = state.open && state.open * fbm(rx * 0.45 + 3.3 * s, ry * 0.45 - 5.9 * s, 2, cell / 0.45, limit);
        fields[s][k] = body * spec.rough + lerp(-0.45, 0.8, mass) + state.bias + open;
        // Only where the field thins toward its outside; its interior keeps the edges of its own strata.
        feathers[s][k] = 1 + EDGE.feather * crisp * lerp(EDGE.firm, 1, loosen) * (1 - smoothstep(0.2, 0.7, mass));
        let amount = smoothstep(0.03, 0.6, mass) * fade * cut;
        if (amount <= 0.002 || fields[s][k] < -1.2) continue;

        // Internal density: broad and uneven rather than an even grain, following the layer's own direction like a wiped
        // wash. It is held back from the finest scales, where it read as a stippled surface or as hatching.
        const uneven = lerp(0.5, 1.5, smoothstep(-0.4, 0.4, fbm(rx * 0.3 + 4.7 + denseX, ry * 0.3 - 8.1 + denseY, 2, cell / 0.3, limit)));
        const inner = Math.min(1, spec.inner * uneven);
        const density = fbm(rx * 1.7 + 5.1 + denseX, ry * 2 - 3.3 + denseY, 2, cell / 2, limit * 1.5);
        amount *= 1 - inner + inner * smoothstep(-0.55, 0.6, density);

        if (spec.erase > 0) {
          // Erasure runs in long wiped passes; kept broader than the softness so it never resolves into scratched lines.
          if (erased < 0) erased = 1 - spec.erase * smoothstep(0.1, 0.55, fbm(rx * 0.4 + 2.2, ry * 5, 2, cell / 5, limit * 1.8));
          amount *= erased;
        }

        // A much weaker fine grain, only where the raster and softness can hold it; its mean stays the same without it.
        if (grained < 0) grained = 0.88 + 0.09 * smoothstep(limit * 1.5, limit * 2.4, cell / 9.7) * detail * noise(rx * 9.7, ry * 9.7);
        rests[s][k] = amount * grained;
      }
    }
    yield;
  }

  // Edges are resolved against the local gradient of the field: never narrower than the layer's softness (and never
  // under about two texels), so a sharp threshold can no longer step from texel to texel when the map is magnified,
  // and defocused layers cannot open crisp hairline gaps.
  const spread = Math.max(0.9, (0.8 * blur) / texel);
  const data = new Uint8Array(width * height * 4);
  // Channels per state: the composed state in G; alternates in R and B (a single state fills all three).
  const channels = states.length === 1 ? [[0, 1, 2]] : [[1], [0], [2]];
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const k = j * width + i;
      if (states.length === 1) data[k * 4 + 3] = 255;
      else {
        // Alpha holds the order in which parts of the field change: broad, irregular lobes, so a change advances
        // through the field rather than dissolving all of it at once.
        const x = (left + ((i + 0.5) / width) * (right - left) - 0.5) * 2 * coverX * aspect + spec.depth * 3.1 + spec.grainOffset[0];
        const y = (bottom + ((j + 0.5) / height) * (top - bottom) - 0.5) * 2 * COVER - spec.depth * 1.7 + spec.grainOffset[1];
        const scatter = spec.order;
        const order = 0.5 + 0.9 * (0.65 * noise(x * 1.4 * scatter, y * 1.4 * scatter) + 0.35 * noise(x * 2.9 * scatter + 7.3, y * 2.9 * scatter - 4.1));
        data[k * 4 + 3] = Math.round(clamp(order, 0, 1) * 255);
      }

      for (let s = 0; s < states.length; s += 1) {
        const field = fields[s];
        const rest = rests[s];
        if (rest[k] <= 0) continue;

        const f = field[k];
        const east = i + 1 < width && field[k + 1] > -4 ? field[k + 1] : f;
        const west = i > 0 && field[k - 1] > -4 ? field[k - 1] : f;
        const north = j + 1 < height && field[k + width] > -4 ? field[k + width] : f;
        const south = j > 0 && field[k - width] > -4 ? field[k - width] : f;
        const soft = Math.max(edges[k], spread * Math.hypot(east - west, north - south) * 0.5) * feathers[s][k];
        const value = Math.round(clamp(smoothstep(-soft, soft, f) * rest[k], 0, 1) * 255);
        for (const channel of channels[s]) data[k * 4 + channel] = value;
      }
    }
    yield;
  }

  // An anchored field's alternates keep the composed state's overall strength: material moves within the field rather
  // than appearing or vanishing, so a change never reads as the field swelling or breathing.
  if (spec.balance && states.length === 3) {
    const sums = [0, 0, 0];
    for (let k = 0; k < width * height; k += 1) for (let c = 0; c < 3; c += 1) sums[c] += data[k * 4 + c];
    for (const c of [0, 2]) {
      // A sparse, crisp field can gain far more from its broad threshold lobes than a dense one, so the range is wide.
      const ratio = sums[c] > 0 ? clamp(sums[1] / sums[c], 0.4, 2.5) : 1;
      for (let k = 0; k < width * height; k += 1) data[k * 4 + c] = Math.min(255, Math.round(data[k * 4 + c] * ratio));
    }

    // Its order is spread evenly over the residue it holds (a monotone remap, so the lobes keep their shapes), so its
    // continuous changes are always passing through some part of the field.
    const counts = new Float64Array(256);
    let total = 0;
    for (let k = 0; k < width * height; k += 1) {
      if (data[k * 4] || data[k * 4 + 1] || data[k * 4 + 2]) {
        counts[data[k * 4 + 3]] += 1;
        total += 1;
      }
    }
    if (total) {
      const remap = new Uint8Array(256);
      let below = 0;
      for (let v = 0; v < 256; v += 1) {
        remap[v] = Math.round(((below + counts[v] / 2) / total) * 255);
        below += counts[v];
      }
      for (let k = 0; k < width * height; k += 1) data[k * 4 + 3] = remap[data[k * 4 + 3]];
    }
  }

  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(1 / (right - left), 1 / (top - bottom));
  texture.offset.set(-left / (right - left), -bottom / (top - bottom));
  texture.needsUpdate = true;

  return texture;
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
  const fieldColor = new Color(TONE.field).getRGB({}, SRGBColorSpace);
  // Same curve and blend space as Three.js linear fog (mixed after sRGB output conversion),
  // so legible layers keep exactly the tone they had under scene fog.
  const fixationHaze = smoothstep(FOG_NEAR, FOG_FAR, FIXATION_DEPTH);
  const plane = new PlaneGeometry(1, 1);
  const fixation = new Vector3(0, 0, -FIXATION_DEPTH);
  const fixationTarget = fixation.clone();
  const fixationEase = fixation.clone();

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
    phaseFrom: { align: 0.7, drift: 0, compress: 0.8, veil: 0 },
    params: { align: 0.7, drift: 0, compress: 0.8, veil: 0 },
    fixationRemaining: rand(18, 34),
    buildQueue: [],
    buildJob: null,
    ready: false,
    animationId: 0,
    resizeId: 0,
    lastFrame: 0
  };

  // A separate clock: no phase targets or camera-path timing drive these events.
  const spatialFrame = {
    remaining: rand(...RECALIBRATION.quiet),
    elapsed: 0,
    duration: 0,
    turn: 0,
    from: 0,
    peak: 0,
    settled: 0,
    offset: 0,
    strength: state.reducedMotion ? 0.35 : 1,
    projectedOffset: NaN,
    projectedAlign: NaN
  };

  function createLayer(spec, index) {
    const color = new Color(spec.kind === "veil" ? TONE.field : TONE[spec.tone]);
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

    // An evolving field reads its map as one of its three stored states, or partway from one to another: each part of
    // the field changes when the transition reaches it in the stored order. Only this read of the map is replaced.
    let morph = null;
    if (MORPH_LAYERS.includes(spec.depth)) {
      const uniforms = {
        stateFrom: { value: new Vector3(0, 1, 0) },
        stateTo: { value: new Vector3(0, 1, 0) },
        stateProgress: { value: 0 },
        stateAmount: { value: 1 }
      };
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader =
          "uniform vec3 stateFrom;\nuniform vec3 stateTo;\nuniform float stateProgress;\nuniform float stateAmount;\n" +
          shader.fragmentShader.replace(
            "#include <alphamap_fragment>",
            [
              "#ifdef USE_ALPHAMAP",
              "\tvec4 states = texture2D( alphaMap, vAlphaMapUv );",
              `\tfloat reached = smoothstep( states.a - ${MORPH.front.toFixed(3)}, states.a + ${MORPH.front.toFixed(3)}, stateProgress * ${(1 + 2 * MORPH.front).toFixed(3)} - ${MORPH.front.toFixed(3)} );`,
              "\tfloat evolved = mix( dot( states.rgb, stateFrom ), dot( states.rgb, stateTo ), reached );",
              "\tdiffuseColor.a *= mix( states.g, evolved, stateAmount );",
              "#endif"
            ].join("\n")
          );
      };
      material.customProgramCacheKey = () => "residue-states";
      morph = {
        states: residueStates(spec, MORPH.amount),
        uniforms,
        anchored: false,
        state: 0,
        next: 0,
        moving: false,
        elapsed: 0,
        duration: 0,
        // Staggered, so the fields never begin together.
        wait: rand(4, 28)
      };
    } else if (ANCHOR_LAYERS.includes(spec.depth)) {
      // An anchored field reads its map through two changes at once. Each part of the field sits at its own point in
      // both, set by the stored order at two different spatial rates and in opposite senses, so at any moment some parts
      // are turning while others are under way; the first leans toward one alternate, the second toward the other.
      const uniforms = {
        statePhase: { value: new Vector2(rand(0, 1), rand(0, 1)) },
        stateAmount: { value: 1 }
      };
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader =
          "uniform vec2 statePhase;\nuniform float stateAmount;\n" +
          shader.fragmentShader.replace(
            "#include <alphamap_fragment>",
            [
              "#ifdef USE_ALPHAMAP",
              "\tvec4 states = texture2D( alphaMap, vAlphaMapUv );",
              `\tfloat towardR = 0.5 - 0.5 * cos( 6.2831853 * ( states.a * ${ANCHOR_WAVES[0].toFixed(3)} + statePhase.x ) );`,
              `\tfloat towardB = 0.66 * ( 0.5 - 0.5 * cos( 6.2831853 * ( states.a * ${ANCHOR_WAVES[1].toFixed(3)} - statePhase.y ) ) );`,
              "\tfloat evolved = mix( mix( states.g, states.r, towardR ), states.b, towardB );",
              "\tdiffuseColor.a *= mix( states.g, evolved, stateAmount );",
              "#endif"
            ].join("\n")
          );
      };
      material.customProgramCacheKey = () => "residue-anchored";
      morph = {
        states: residueStates(spec, ANCHOR.amount, ANCHOR),
        uniforms,
        anchored: true,
        phase: [uniforms.statePhase.value.x, uniforms.statePhase.value.y],
        rates: [1 / rand(...ANCHOR.cycle), 1 / rand(...ANCHOR.cycle)],
        paces: [[rand(0, TAU), rand(0, TAU)], [rand(0, TAU), rand(0, TAU)]],
        moments: null,
        steady: 1
      };
    }

    // Each anchored field wanders on its own axis, near the passage direction, with its own sense and beats.
    let aura = null;
    if (ANCHOR_LAYERS.includes(spec.depth)) {
      const channel = () => {
        const weights = [rand(0.45, 0.6), rand(0.25, 0.35), rand(0.1, 0.2)];
        const total = weights[0] + weights[1] + weights[2];
        return {
          rates: AURA.periods.map(([low, high]) => TAU / rand(low, high)),
          phases: AURA.periods.map(() => rand(0, TAU)),
          weights: weights.map((weight) => weight / total)
        };
      };
      const heading = PASSAGE.direction + rand(-0.5, 0.5) + (Math.random() < 0.5 ? Math.PI : 0);
      aura = {
        reach: AURA.reach * rand(0.7, 1),
        cos: Math.cos(heading),
        sin: Math.sin(heading),
        along: channel(),
        across: channel(),
        x: 0,
        y: 0
      };
    }

    return {
      spec,
      mesh,
      material,
      tone: color.getRGB({}, SRGBColorSpace),
      haze: smoothstep(FOG_NEAR, FOG_FAR, spec.depth),
      appear: 0,
      seed: index * 2.39 + 0.7,
      driftRate: rand(0.8, 1.25),
      morph,
      aura,
      stream: null,
      origin: 0,
      placing: false,
      deferred: false
    };
  }

  // A new tile for a stream: a few clusters of the layer's own scale, one after another along the tile with open field
  // between them, often with a lesser part beside them that can separate or merge as it passes. Its material is another
  // part of the same layer's material. Seeded by generation, so a stream never repeats itself.
  function tileSpec(stream) {
    stream.generation += 1;
    const { base } = stream;
    const random = mulberry32(Math.round(stream.depth * 1013) + stream.generation * 104729);
    const [, anchorY, rx0, ry0, , angle0 = 0] = base.masses[0];
    const span = Math.max(0.2, PASSAGE.length - 0.55 - 1.6 * rx0);
    const most = rx0 > 0.3 ? Math.min(2, PASSAGE.clusters[1]) : PASSAGE.clusters[1];
    const count = PASSAGE.clusters[0] + Math.floor(random() * (most - PASSAGE.clusters[0] + 1));
    const masses = [];

    for (let n = 0; n < count; n += 1) {
      const x = -span + ((n + 0.2 + 0.6 * random()) / count) * 2 * span;
      const y = lerp(anchorY, random() * 1.4 - 0.7, 0.6);
      const size = lerp(0.7, 1.25, random());
      const rx = rx0 * size * lerp(0.8, 1.2, random());
      const ry = ry0 * size * lerp(0.8, 1.2, random());
      const angle = angle0 + (random() * 2 - 1) * 0.5;
      masses.push([x, y, rx, ry, lerp(0.75, 1, random()), angle]);
      if (random() < 0.6) {
        const side = random() < 0.5 ? -1 : 1;
        masses.push([
          x + side * rx * lerp(1, 1.8, random()),
          y + (random() * 2 - 1) * ry * 1.2,
          rx * lerp(0.35, 0.6, random()),
          ry * lerp(0.35, 0.6, random()),
          lerp(0.5, 0.8, random()),
          angle + (random() * 2 - 1) * 0.6
        ]);
      }
    }

    return {
      ...base,
      masses,
      cut: null,
      cover: PASSAGE.length,
      generation: stream.generation,
      grainOffset: [random() * 200 - 100, random() * 200 - 100]
    };
  }

  // The composed tile is turned with its passage; its masses and cut are turned back, so the field opens as composed.
  function seatInTile(spec) {
    const cos = Math.cos(PASSAGE.direction);
    const sin = Math.sin(PASSAGE.direction);
    const a = NOMINAL_ASPECT;

    return {
      ...spec,
      cover: PASSAGE.length,
      masses: spec.masses.map(([x, y, rx, ry, weight, angle = 0]) => [
        x * cos + (y / a) * sin, y * cos - x * a * sin, rx, ry, weight, angle - PASSAGE.direction
      ]),
      cut: spec.cut && [spec.cut[0] * cos + spec.cut[1] * a * sin, spec.cut[1] * cos - (spec.cut[0] * sin) / a, spec.cut[2]]
    };
  }

  const streams = [];
  const layers = LAYERS.flatMap((source, index) => {
    const base = {
      ...(source.kind === "veil" ? VEIL : STAIN),
      ...source,
      cover: COVER,
      grainOffset: [0, 0],
      generation: 0,
      order: ANCHOR_LAYERS.includes(source.depth) ? ANCHOR.order : 1,
      balance: ANCHOR_LAYERS.includes(source.depth)
    };
    if (!PASSAGE_LAYERS.includes(source.depth)) return [createLayer(base, index)];

    // The first tile carries the field as composed, so the work opens on its composition; the next waits upstream.
    const stream = { depth: source.depth, base, offset: 0, velocity: 0, generation: 0, tiles: [] };
    for (let t = 0; t < 2; t += 1) {
      const tile = createLayer(t === 0 ? seatInTile(base) : tileSpec(stream), index);
      tile.stream = stream;
      tile.origin = -2 * PASSAGE.length * t;
      // The upstream tile is not in the frame for a while yet, so it is built last and does not hold up the volume.
      tile.deferred = t > 0;
      tile.mesh.rotation.z = PASSAGE.direction;
      stream.tiles.push(tile);
    }
    streams.push(stream);
    return stream.tiles;
  });
  // Beyond this, in view half-widths along the passage, a tile's upstream end has left the frame with any parallax.
  const PASSAGE_EXIT = 1.7;
  let passageStrength = state.reducedMotion ? PASSAGE.reduced : 1;
  const evolving = layers.filter((layer) => layer.morph && !layer.morph.anchored);
  const unsettled = layers.filter((layer) => layer.morph && layer.morph.anchored);
  let auraTime = rand(0, 600);
  // Channel of each stored state: composed (G), first alternate (R), second alternate (B).
  const STATE_CHANNELS = [[0, 1, 0], [1, 0, 0], [0, 0, 1]];
  let morphStrength = state.reducedMotion ? MORPH.reduced : 1;

  // Two sheets of type for thoughts that may briefly overlap, and a third for what a thought leaves behind.
  const textSheets = Object.fromEntries(
    ["a", "b", "r"].map((name) => {
      const sheet = document.createElement("canvas");
      sheet.width = TEXT_CANVAS_WIDTH;
      sheet.height = TEXT_CANVAS_HEIGHT;
      const texture = new CanvasTexture(sheet);
      texture.minFilter = LinearMipmapLinearFilter;
      // Haze is applied by hand, as for the layers, so the sentence compresses with the rest of the volume.
      const material = new MeshBasicMaterial({
        color: new Color(TONE.text),
        alphaMap: texture,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0
      });
      const mesh = new Mesh(plane, material);
      mesh.visible = false;
      scene.add(mesh);
      return [name, { context: sheet.getContext("2d", { willReadFrequently: true }), texture, material, mesh, mark: null, line: null, level: 0 }];
    })
  );
  const textTone = new Color(TONE.text).getRGB({}, SRGBColorSpace);
  const inkLevel = new Color(TONE.ink).getRGB({}, SRGBColorSpace).g;
  const tone = {};

  const text = {
    stage: "wait",
    elapsed: 0,
    wait: rand(26, 40),
    gap: "long",
    family: null,
    said: [],
    recalled: [],
    thought: null,
    region: null,
    recent: []
  };
  const eye = new Vector3();
  const anchor = new Vector3();
  const probe = new Vector3();
  const layerCentre = new Vector3();

  renderer.setClearColor(TONE.field, 1);
  for (const sheet of Object.values(textSheets)) sheet.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  function queueTextures() {
    state.textureAspect = state.aspect;
    // Upstream tiles come last, nearest first, since nearer material arrives sooner.
    const upstream = layers.filter((layer) => layer.deferred).sort((a, b) => a.spec.depth - b.spec.depth);
    state.buildQueue = layers.filter((layer) => !layer.deferred).concat(upstream);
    state.buildJob = null;
  }

  // Residue is generated a few rows at a time within a small per-frame budget, so assembling the volume never stalls
  // playback; a layer keeps its previous map until the new one is complete.
  function buildTextures(budget) {
    const until = performance.now() + budget;

    while (state.buildQueue.length && performance.now() < until) {
      const layer = state.buildQueue[0];
      if (!state.buildJob) state.buildJob = residueJob(layer.spec, state.textureAspect, layer.morph ? layer.morph.states : undefined);

      const { done, value } = state.buildJob.next();
      if (!done) continue;

      state.buildQueue.shift();
      state.buildJob = null;
      // A rebuilt passing tile joins the back of its stream only now, so an old map never enters the frame.
      if (layer.placing) {
        layer.placing = false;
        layer.origin = Math.min(...layer.stream.tiles.filter((tile) => tile !== layer).map((tile) => tile.origin)) - 2 * PASSAGE.length;
      }
      if (layer.morph && layer.morph.anchored) layer.morph.moments = anchoredMoments(value.image.data);
      const previous = layer.material.alphaMap;
      layer.material.alphaMap = value;
      layer.material.needsUpdate = !previous;
      layer.mesh.visible = true;
      if (previous) previous.dispose();
      if (!state.buildQueue.some((queued) => !queued.deferred)) state.ready = true;
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
    // renderStill() reapplies the internal frame to this fresh physical projection.
    spatialFrame.projectedOffset = NaN;

    for (let index = 0; index < layers.length; index += 1) {
      const depth = layers[index].spec.depth;
      layers[index].mesh.scale.set(2 * HALF_TAN * depth * state.aspect * layers[index].spec.cover, 2 * HALF_TAN * depth * COVER, 1);
    }

    if (!state.textureAspect || Math.abs(Math.log(state.aspect / state.textureAspect)) > Math.log(1.3)) {
      queueTextures();
    }

    for (const line of text.thought ? text.thought.lines : []) if (line.placed) sentenceBase(line, line.fx, line.fy, line.depth, line.base);

    canvas.dataset.dpr = String(renderer.getPixelRatio());
    renderStill();
  }

  function scheduleResize() {
    if (state.resizeId) return;
    state.resizeId = window.requestAnimationFrame(resize);
  }

  function textWorldScale(depth, linePx) {
    const fontPx = clamp(state.height * 0.018, 14, 34);
    return (fontPx * 2 * depth * HALF_TAN) / state.height / linePx;
  }

  function measureLine(line) {
    const context = textSheets.a.context;
    line.fontPx = TEXT_FONT_PX;
    context.font = `400 ${line.fontPx}px ${TEXT_FONT_FAMILY}`;
    line.measured = context.measureText(line.text).width;

    if (line.measured > TEXT_CANVAS_WIDTH - 96) {
      line.fontPx = Math.floor((TEXT_FONT_PX * (TEXT_CANVAS_WIDTH - 96)) / line.measured);
      context.font = `400 ${line.fontPx}px ${TEXT_FONT_FAMILY}`;
      line.measured = context.measureText(line.text).width;
    }
  }

  // Each span is set where it falls in the whole line, so pieces of one line on different sheets stay in register.
  function drawSpans(sheet, line, spans) {
    const context = sheet.context;
    const left = (TEXT_CANVAS_WIDTH - line.measured) / 2;
    context.font = `400 ${line.fontPx}px ${TEXT_FONT_FAMILY}`;
    context.fillStyle = "#000";
    context.fillRect(0, 0, TEXT_CANVAS_WIDTH, TEXT_CANVAS_HEIGHT);
    context.fillStyle = "#fff";
    context.textAlign = "left";
    context.textBaseline = "middle";
    for (const [from, to] of spans) {
      context.fillText(line.text.slice(from, to), left + context.measureText(line.text.slice(0, from)).width, TEXT_CANVAS_HEIGHT / 2);
    }
    sheet.texture.needsUpdate = true;
  }

  // Defocus is baked into the type once per sentence, as it is into the residue: a small gaussian spread of the glyphs.
  function softenSentence(sheet, line) {
    const sigma = line.sigma;
    if (sigma < 0.4) return;

    const textContext = sheet.context;
    const radius = Math.ceil(sigma * 3);
    const x0 = Math.max(0, Math.floor((TEXT_CANVAS_WIDTH - line.measured) / 2) - radius * 2);
    const x1 = Math.min(TEXT_CANVAS_WIDTH, Math.ceil((TEXT_CANVAS_WIDTH + line.measured) / 2) + radius * 2);
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
    sheet.texture.needsUpdate = true;
  }

  function sentenceBase(line, fx, fy, depth, target) {
    const halfWidth = HALF_TAN * depth * state.aspect;
    const halfText = (line.measured * textWorldScale(depth, line.fontPx)) / 2 / halfWidth;

    return target.set(clamp(fx, -0.9 + halfText, 0.9 - halfText) * halfWidth, fy * HALF_TAN * depth, -depth);
  }

  function textHaze(depth) {
    const haze = smoothstep(FOG_NEAR, FOG_FAR, depth);
    return Math.max(haze, lerp(haze, fixationHaze, state.params.compress));
  }

  function toneLevel(color) {
    return color.getRGB(tone, SRGBColorSpace).g;
  }

  // Coverage of a layer's actual alpha map where the sight line from `from` through `point` crosses it, `ahead` seconds
  // from now (a passing field will have moved on by then).
  function layerCoverage(layer, point, from, ahead = 0) {
    const map = layer.material.alphaMap;
    if (!layer.mesh.visible || !map || layer.placing) return 0;

    const depth = layer.spec.depth;
    const reach = (-depth - from.z) / (point.z - from.z);
    const scale = alignOffset(depth, layerCentre.set(0, 0, -depth), from);
    let hitX = from.x + (point.x - from.x) * reach - layerCentre.x - (layer.aura ? layer.aura.x : 0);
    let hitY = from.y + (point.y - from.y) * reach - layerCentre.y - (layer.aura ? layer.aura.y : 0);
    if (layer.stream) {
      const cos = Math.cos(PASSAGE.direction);
      const sin = Math.sin(PASSAGE.direction);
      const along = (layer.origin + layer.stream.offset + layer.stream.velocity * ahead) * HALF_TAN * depth * state.aspect * scale;
      hitX -= along * cos;
      hitY -= along * sin;
      [hitX, hitY] = [hitX * cos + hitY * sin, hitY * cos - hitX * sin];
    }
    const planeU = 0.5 + hitX / (2 * HALF_TAN * depth * state.aspect * layer.spec.cover * scale);
    const planeV = 0.5 + hitY / (2 * HALF_TAN * depth * COVER * scale);
    const u = planeU * map.repeat.x + map.offset.x;
    const v = planeV * map.repeat.y + map.offset.y;
    if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0;

    const { data, width, height } = map.image;
    return (data[(Math.floor(v * height) * width + Math.floor(u * width)) * 4 + 1] / 255) * layer.material.opacity;
  }

  // How a candidate would sit in the volume, judged from the residue and veils actually built, as the camera will see it
  // while the sentence is present. Contrast is relative to the same type on open field at the same depth, so haze is not
  // counted against far placements. `front` is occlusion by nearer veils, which read as passing behind (a nearer stain over
  // dark type reads as type on the stain, so it only counts as lost contrast); `surround` is residue just around the sentence.
  function assessPlacement(line, fx, fy, depth, times, levels) {
    const field = fieldColor.g;
    const type = lerp(textTone.g, field, textHaze(depth));
    const reference = field - type;
    const worldScale = textWorldScale(depth, line.fontPx);
    const halfText = (line.measured / 2) * worldScale;
    const typeHeight = line.fontPx * worldScale;
    const rows = [-0.18, 0.02, 0.22];
    const columns = 24;
    const ratios = [];
    let front = 0;
    let fronted = 0;
    let surround = 0;
    let ring = 0;
    let scale = 1;
    let ahead = 0;

    function sightLine(dx, dy) {
      probe.set(anchor.x + dx * scale, anchor.y + dy * scale, anchor.z);
      let background = field;
      let full = field;
      let transmit = 1;
      let clear = 1;

      for (let index = 0; index < layers.length; index += 1) {
        const cover = layerCoverage(layers[index], probe, eye, ahead);
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
      ahead = times[t];
      cameraPosition(state.time + times[t] * (state.reducedMotion ? 0.5 : 1), eye);
      scale = alignOffset(depth, sentenceBase(line, fx, fy, depth, anchor), eye);

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
  function chooseSentencePlacement(line, times) {
    const region = pick(TEXT_REGIONS.filter((zone) => zone !== text.region));
    const within = Math.random() < 0.6;
    const levels = layers.map((layer) => toneLevel(layer.material.color));
    let best = null;

    for (let n = 0; n < TEXT_CANDIDATES; n += 1) {
      const fx = rand(region[0] - TEXT_REGION_SPREAD[0], region[1] + TEXT_REGION_SPREAD[0]);
      const fy = clamp(rand(region[2] - TEXT_REGION_SPREAD[1], region[3] + TEXT_REGION_SPREAD[1]), -0.8, 0.8);
      if (Math.abs(fx) < 0.22 && Math.abs(fy) < 0.28) continue;

      const depth = pick(TEXT_DEPTHS) + rand(-0.2, 0.2);
      const fit = assessPlacement(line, fx, fy, depth, times, levels);
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

  // A line is placed when its first mark appears, from the fade of that mark, and every later span of it stays there.
  function placeLine(line, mark) {
    measureLine(line);
    const placement = chooseSentencePlacement(line, [mark.fadeIn * 0.7, mark.fadeIn + mark.hold * 0.5]);
    text.region = placement.region;
    line.depth = placement.depth;
    line.fx = placement.fx;
    line.fy = placement.fy;
    text.recent = [[line.fx, line.fy], ...text.recent].slice(0, 3);
    line.sigma = TEXT_SOFTNESS * line.fontPx * smoothstep(0.5, 3.5, Math.abs(line.depth - FIXATION_DEPTH));
    line.base = sentenceBase(line, line.fx, line.fy, line.depth, new Vector3());
    line.placed = true;
  }

  function showMark(sheet, mark) {
    sheet.mark = mark;
    sheet.mesh.visible = Boolean(mark);
    if (!mark) return;

    const line = text.thought.lines[mark.line];
    if (!line.placed) placeLine(line, mark);
    sheet.line = line;
    drawSpans(sheet, line, mark.spans);
    softenSentence(sheet, line);
  }

  // The silences between thoughts are as before; whatever a thought does happens within its own appearance.
  function updateThought(dt) {
    text.elapsed += dt;

    if (text.stage === "wait") {
      if (text.elapsed < text.wait || !state.ready) return;
      text.thought = planThought(text);
      text.stage = "thought";
      text.elapsed = 0;
    }

    const time = text.elapsed;
    const finished = time >= text.thought.end;
    for (const [name, sheet] of Object.entries(textSheets)) {
      const mark = finished ? null : text.thought.marks.find((m) => m.sheet === name && time >= m.start && time < m.end) ?? null;
      if (mark !== sheet.mark) showMark(sheet, mark);
      sheet.level = mark ? markLevel(mark, time) : 0;
    }
    if (!finished) return;

    text.thought = null;
    text.stage = "wait";
    text.elapsed = 0;
    const { long, normal, short } = TEXT_GAPS;
    // After a quick return, only a long or a moderate silence.
    const roll = Math.random() * (text.gap === "short" ? long.chance + normal.chance : long.chance + normal.chance + short.chance);
    text.gap = roll < long.chance ? "long" : roll < long.chance + normal.chance ? "normal" : "short";
    text.wait = rand(...TEXT_GAPS[text.gap].range);
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

  function updateSpatialFrame(dt) {
    // Ease preference changes too, so enabling reduced motion cannot snap the frame.
    spatialFrame.strength = lerp(spatialFrame.strength, state.reducedMotion ? 0.35 : 1, 1 - Math.exp(-dt / 5));
    if (!state.ready || dt <= 0) return;

    const elapsed = dt * (state.reducedMotion ? 0.5 : 1);
    if (!spatialFrame.duration) {
      spatialFrame.remaining -= elapsed;
      if (spatialFrame.remaining > 0) return;

      spatialFrame.from = spatialFrame.offset;
      spatialFrame.peak = (Math.random() < 0.5 ? -1 : 1) * rand(0.7, 1);
      spatialFrame.settled = spatialFrame.peak * rand(0.2, 0.45);
      spatialFrame.duration = rand(...RECALIBRATION.duration);
      spatialFrame.turn = rand(0.52, 0.72);
      spatialFrame.elapsed = 0;
    }

    spatialFrame.elapsed = Math.min(spatialFrame.duration, spatialFrame.elapsed + elapsed);
    const progress = spatialFrame.elapsed / spatialFrame.duration;
    const outward = progress < spatialFrame.turn;
    const u = outward ? progress / spatialFrame.turn : (progress - spatialFrame.turn) / (1 - spatialFrame.turn);
    // Zero velocity and acceleration at each join; a longer disagreement and shorter partial correction.
    const ease = u * u * u * (u * (u * 6 - 15) + 10);
    spatialFrame.offset = outward
      ? lerp(spatialFrame.from, spatialFrame.peak, ease)
      : lerp(spatialFrame.peak, spatialFrame.settled, ease);

    if (progress === 1) {
      spatialFrame.duration = 0;
      spatialFrame.remaining = rand(...RECALIBRATION.quiet);
    }
  }

  function projectSpatialFrame() {
    const offset = spatialFrame.offset * spatialFrame.strength * RECALIBRATION.amplitude;
    const align = state.params.align;
    if (offset === spatialFrame.projectedOffset && align === spatialFrame.projectedAlign) return;

    // Leave focal length, aspect and in-plane dimensions alone. In camera space this adds
    // offset * (FIXATION_DEPTH / depth - 1) to projected x: a change in registration between
    // depths, with no zoom or horizontal rescaling of the individual residue planes or type.
    // Blend the inverse-depth term toward FLAT_DEPTH using the existing alignment amount.
    // At full flattening it is one shared translation, so it cannot reopen the depth cues.
    camera.updateProjectionMatrix();
    const projection = camera.projectionMatrix.elements;
    projection[8] += offset * (1 - align * FIXATION_DEPTH / FLAT_DEPTH);
    projection[12] += offset * FIXATION_DEPTH * (1 - align);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    spatialFrame.projectedOffset = offset;
    spatialFrame.projectedAlign = align;
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

  // Each evolving field holds a state, then slowly moves to another: usually the other alternate, sometimes back to the
  // composed state, never on a fixed round. At most two fields change at once. Changes pause, without snapping, while
  // depth is flattened, and none begins during a global recalibration.
  function updateMorph(dt) {
    morphStrength = lerp(morphStrength, state.reducedMotion ? MORPH.reduced : 1, 1 - Math.exp(-dt / 5));
    const clock = dt * (1 - smoothstep(0.5, 0.9, state.params.align)) * (state.reducedMotion ? 0.7 : 1);
    let moving = 0;
    for (let index = 0; index < evolving.length; index += 1) if (evolving[index].morph.moving) moving += 1;

    for (let index = 0; index < evolving.length; index += 1) {
      const morph = evolving[index].morph;
      morph.elapsed += clock;

      const { uniforms } = morph;
      if (!morph.moving) {
        const free = moving < MORPH.concurrent && !spatialFrame.duration && state.ready;
        if (morph.elapsed >= morph.wait && free) {
          morph.next = morph.state === 0 ? (Math.random() < 0.5 ? 1 : 2) : Math.random() < 0.4 ? 0 : 3 - morph.state;
          uniforms.stateFrom.value.fromArray(STATE_CHANNELS[morph.state]);
          uniforms.stateTo.value.fromArray(STATE_CHANNELS[morph.next]);
          uniforms.stateProgress.value = 0;
          morph.duration = rand(...MORPH.transition);
          morph.elapsed = 0;
          morph.moving = true;
          moving += 1;
        } else if (morph.elapsed >= morph.wait) {
          morph.wait = morph.elapsed + rand(3, 8);
        }
      } else {
        const u = Math.min(1, morph.elapsed / morph.duration);
        uniforms.stateProgress.value = smoothstep(0, 1, u);
        if (u >= 1) {
          morph.state = morph.next;
          uniforms.stateFrom.value.fromArray(STATE_CHANNELS[morph.state]);
          uniforms.stateProgress.value = 0;
          morph.moving = false;
          morph.elapsed = 0;
          morph.wait = rand(...MORPH.hold);
          moving -= 1;
        }
      }

      // Reduced motion keeps the change but takes each state only part of the way from the composed one.
      uniforms.stateAmount.value = morphStrength;
    }
  }

  // Anchored fields never rest. Each of their two changes advances at its own rate, at a pace that wanders between
  // lull and full but never stops; while depth is flat both slow a little. They go on through recalibration: this
  // disturbance belongs to seeing, not to space.
  function updateAnchored(dt) {
    const clock = dt * (state.reducedMotion ? 0.7 : 1) * lerp(1, ANCHOR.flat, smoothstep(0.5, 0.9, state.params.align));
    const t = state.time;

    for (const layer of unsettled) {
      const { morph } = layer;
      for (let change = 0; change < 2; change += 1) {
        const [a, b] = morph.paces[change];
        const pace = 0.5 + 0.5 * (0.6 * Math.sin((t * TAU) / 67 + a) + 0.4 * Math.sin((t * TAU) / 109 + b));
        morph.phase[change] = (morph.phase[change] + clock * morph.rates[change] * lerp(ANCHOR.lull, 1, pace)) % 1;
      }
      morph.uniforms.statePhase.value.set(morph.phase[0], morph.phase[1]);
      morph.uniforms.stateAmount.value = morphStrength;
      // Material moves within the field; the field as a whole neither gathers nor fades.
      morph.steady = morph.moments ? steadiness(morph.moments, morph.phase[0], morph.phase[1], morphStrength) : 1;
    }
  }

  // Passing fields keep going through every phase. Nearer material passes faster; as depth flattens every field takes
  // one slow shared speed, so the passage cannot reopen depth. A tile whose upstream end has left the frame is rebuilt
  // with new masses and placed at the back of its stream once its map is ready.
  function updatePassage(dt) {
    passageStrength = lerp(passageStrength, state.reducedMotion ? PASSAGE.reduced : 1, 1 - Math.exp(-dt / 5));
    const align = state.params.align;
    const t = state.time;
    const sway = 1 + PASSAGE.sway * (0.6 * Math.sin((t * TAU) / 181 + 2.3) + 0.4 * Math.sin((t * TAU) / 277 + 0.8));

    for (const stream of streams) {
      stream.velocity = PASSAGE.speed * passageStrength * sway * lerp(FIXATION_DEPTH / stream.depth, PASSAGE.flat, align);
      stream.offset += stream.velocity * dt;

      for (const tile of stream.tiles) {
        if (tile.placing || tile.origin + stream.offset - PASSAGE.length < PASSAGE_EXIT) continue;
        tile.spec = tileSpec(stream);
        if (tile.morph) tile.morph.states = residueStates(tile.spec, MORPH.amount);
        tile.placing = true;
        if (state.buildQueue[0] === tile) state.buildJob = null;
        if (!state.buildQueue.includes(tile)) state.buildQueue.push(tile);
      }
    }
  }

  function wander(channel, t) {
    let sum = 0;
    for (let k = 0; k < channel.rates.length; k += 1) sum += channel.weights[k] * Math.sin(t * channel.rates[k] + channel.phases[k]);
    return sum;
  }

  function updateLayers(dt) {
    const drift = state.params.drift * (state.reducedMotion ? 0.25 : 1);
    const t = state.time;
    auraTime += dt * (state.reducedMotion ? 0.5 : 1) * lerp(1, AURA.flat, smoothstep(0.5, 0.9, state.params.align));

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
      if (layer.stream) {
        // Carried along the passage in the layer's own view scale, so flattening still holds it on the shared plane.
        const along = (layer.origin + layer.stream.offset) * HALF_TAN * depth * state.aspect * scale;
        position.x += along * Math.cos(PASSAGE.direction);
        position.y += along * Math.sin(PASSAGE.direction);
      }
      if (layer.aura) {
        // In the layer's own view scale, so a stray reads the same size at every depth and flattening still holds.
        const { aura } = layer;
        const unit = aura.reach * HALF_TAN * depth * scale;
        const along = unit * wander(aura.along, auraTime);
        const across = unit * AURA.cross * wander(aura.across, auraTime);
        aura.x = along * aura.cos - across * aura.sin;
        aura.y = along * aura.sin + across * aura.cos;
        position.x += aura.x;
        position.y += aura.y;
      }
      const coverX = 2 * HALF_TAN * depth * state.aspect * layer.spec.cover;
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
      if (layer.morph && layer.morph.anchored) alpha *= layer.morph.steady;
      if (kind === "veil") alpha = Math.min(0.92, alpha * (1 + state.params.veil));
      layer.material.opacity = alpha;
    }
  }

  function updateText(dt) {
    updateThought(dt);

    for (const sheet of Object.values(textSheets)) {
      if (!sheet.mesh.visible) continue;

      const line = sheet.line;
      const position = sheet.mesh.position.copy(line.base);
      const scale = alignOffset(line.depth, position);
      const worldScale = textWorldScale(line.depth, line.fontPx) * scale;
      sheet.mesh.scale.set(TEXT_CANVAS_WIDTH * worldScale, TEXT_CANVAS_HEIGHT * worldScale, 1);

      // Like the layers: haze by depth, and while depth compresses a near sentence takes on mid-depth haze and recedes a little.
      const haze = textHaze(line.depth);
      const nearness = clamp((FIXATION_DEPTH - line.depth) / (FIXATION_DEPTH - FOG_NEAR), 0, 1);
      sheet.material.color.setRGB(
        lerp(textTone.r, fieldColor.r, haze),
        lerp(textTone.g, fieldColor.g, haze),
        lerp(textTone.b, fieldColor.b, haze),
        SRGBColorSpace
      );
      sheet.material.opacity = TEXT_MAX_OPACITY * sheet.level * (1 - 0.25 * state.params.compress * nearness);
    }
  }

  function step(dt) {
    const timeScale = state.reducedMotion ? 0.5 : 1;

    state.time += dt * timeScale;
    updatePhase(dt);
    updateCamera(dt * timeScale);
    updateSpatialFrame(dt);
    projectSpatialFrame();
    updateMorph(dt);
    updateAnchored(dt);
    updatePassage(dt);
    updateLayers(dt);
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
    // Once every field has a map, rebuilding a passing tile takes a smaller share of each frame.
    if (state.buildQueue.length) {
      const settled = state.ready && state.buildQueue.every((layer) => layer.material.alphaMap);
      buildTextures(settled ? TEXTURE_BUDGET_MS / 2 : TEXTURE_BUDGET_MS);
    }
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
  canvas.addEventListener("webglcontextrestored", () => {
    // Three.js rebuilds its GL state on restore, which returns the clear colour to black.
    renderer.setClearColor(TONE.field, 1);
    start();
  });
  window.addEventListener("resize", scheduleResize);
  document.addEventListener("visibilitychange", onVisibilityChange);

  canvas.dataset.phase = state.phase;
  canvas.dataset.layers = String(layers.length);
  resize();
  start();
}
