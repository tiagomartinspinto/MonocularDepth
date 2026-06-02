(function () {
  "use strict";

  const canvas = document.getElementById("depth-field");
  const ctx = canvas.getContext("2d", { alpha: false });
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const MAX_DESKTOP_PARTICLES = 60;
  const MAX_MOBILE_PARTICLES = 35;
  const MOBILE_BREAKPOINT = 640;
  const MAX_DPR = 1.5;
  const TEXT_EVENT_COUNT = 96;
  const TAU = Math.PI * 2;
  const FIELD_COLOR = "#f3f0e8";
  const MARK_COLOR = "#141412";
  const SECONDARY_MARK_COLOR = "#2a2a26";
  const LINE_COLOR = "#3a3a34";

  const softZones = [
    { x: 0.22, y: 0.34, radius: 0.25, phase: 0.4, driftX: 0.035, driftY: 0.029, wash: 0.032 },
    { x: 0.66, y: 0.28, radius: 0.21, phase: 2.1, driftX: 0.028, driftY: 0.022, wash: 0.026 },
    { x: 0.48, y: 0.58, radius: 0.3, phase: 3.7, driftX: 0.032, driftY: 0.027, wash: 0.038 },
    { x: 0.78, y: 0.68, radius: 0.24, phase: 5.2, driftX: 0.026, driftY: 0.032, wash: 0.03 }
  ];

  const depthBands = [
    { x: 0.46, y: 0.34, width: 0.92, height: 0.18, angle: -0.08, phase: 0.8, driftX: 0.026, driftY: 0.018, alpha: 0.042 },
    { x: 0.52, y: 0.52, width: 0.82, height: 0.16, angle: 0.12, phase: 2.9, driftX: 0.018, driftY: 0.022, alpha: 0.052 },
    { x: 0.58, y: 0.7, width: 1.06, height: 0.2, angle: -0.16, phase: 4.6, driftX: 0.022, driftY: 0.019, alpha: 0.038 }
  ];

  const SUBJECTS = [
    "the room",
    "the wall",
    "the image",
    "the window",
    "the floor",
    "the corner",
    "the horizon",
    "the surface",
    "the shadow",
    "the distance",
    "the memory",
    "the map",
    "the object",
    "the eye",
    "the other eye",
    "the blind spot",
    "the edge",
    "the field"
  ];

  const VERBS = [
    "forgets",
    "delays",
    "misplaces",
    "measures",
    "invents",
    "repeats",
    "folds",
    "loses",
    "shifts",
    "returns",
    "disappears",
    "hesitates",
    "remembers",
    "interrupts",
    "reverses"
  ];

  const OBJECTS = [
    "the horizon",
    "the room",
    "the image",
    "the shadow",
    "the surface",
    "the distance",
    "the floor",
    "the window",
    "the corner",
    "the map",
    "the object",
    "the eye",
    "the blind spot",
    "the edge",
    "the field",
    "silence",
    "depth",
    "perspective"
  ];

  const QUALIFIERS = [
    "in silence",
    "inside the wall",
    "near the horizon",
    "against perspective",
    "out of alignment",
    "at the edge",
    "behind the image",
    "without depth",
    "almost in focus",
    "slightly aside"
  ];

  const ADJECTIVES = [
    "unfinished",
    "borrowed",
    "slow",
    "misplaced",
    "silent",
    "accidental",
    "folded",
    "soft",
    "distant",
    "partial",
    "unstable",
    "shallow",
    "hidden",
    "reversed",
    "almost visible"
  ];

  const particles = [];
  const textEvents = [];
  const softFrames = softZones.map(() => ({ x: 0, y: 0, radius: 1 }));

  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    time: 0,
    lastTime: 0,
    animationId: 0,
    resizeId: 0,
    particleCount: 0,
    systemAX: 0.5,
    systemAY: 0.5,
    systemBX: 0.5,
    systemBY: 0.5,
    perception: 1.04,
    instability: 0.52,
    motionDepth: true,
    reducedMotion: reducedMotionQuery.matches,
    textFont: "15px ui-serif, Georgia, serif",
    textIndex: 0,
    textElapsed: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function easeInOut(value) {
    return value < 0.5
      ? 2 * value * value
      : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function seededUnit(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;

    return value - Math.floor(value);
  }

  function temporalInstability(seed) {
    return clamp(
      0.5 +
        Math.sin(state.time * 0.43 + seed) * 0.28 +
        Math.sin(state.time * 1.37 + seed * 0.41) * 0.14 +
        Math.sin(state.time * 2.7 + seed * 0.17) * 0.06,
      0,
      1
    );
  }

  function pick(bank) {
    return bank[Math.floor(Math.random() * bank.length)];
  }

  function updateSoftFrames() {
    const scale = Math.min(state.width, state.height);

    for (let index = 0; index < softZones.length; index += 1) {
      const zone = softZones[index];
      const frame = softFrames[index];

      frame.x = (zone.x + Math.cos(state.time * 0.021 + zone.phase) * zone.driftX) * state.width;
      frame.y = (zone.y + Math.sin(state.time * 0.017 + zone.phase * 1.3) * zone.driftY) * state.height;
      frame.radius = zone.radius * scale;
    }
  }

  function zoneSoftness(x, y, frame) {
    const dx = x - frame.x;
    const dy = y - frame.y;
    const distance = Math.sqrt(dx * dx + dy * dy) / frame.radius;

    if (distance >= 1) return 0;

    return easeInOut(1 - distance);
  }

  function softnessAt(x, y) {
    let softness = 0;

    for (let index = 0; index < softZones.length; index += 1) {
      softness = Math.max(softness, zoneSoftness(x, y, softFrames[index]));
    }

    return softness;
  }

  function generateSentence() {
    const template = Math.floor(Math.random() * 12);

    if (template === 0) return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)}`;
    if (template === 1) {
      return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)} ${pick(QUALIFIERS)}`;
    }
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

  function randomTextWait() {
    return Math.random() < 0.14 ? rand(30, 40) : rand(8, 24);
  }

  function randomTextX() {
    if (Math.random() < 0.68) {
      return Math.random() < 0.5 ? rand(0.12, 0.38) : rand(0.62, 0.88);
    }

    return rand(0.16, 0.84);
  }

  function randomTextY() {
    if (Math.random() < 0.58) {
      return Math.random() < 0.5 ? rand(0.15, 0.36) : rand(0.62, 0.8);
    }

    return rand(0.18, 0.78);
  }

  function createParticle() {
    const depth = Math.pow(rand(0.04, 1), 1.48);
    const plane = Math.floor(rand(0, 5));
    const horizonPull = 1 - depth;
    const planeY = 0.23 + plane * 0.13 + rand(-0.032, 0.032);
    const baseX = lerp(
      0.5 + rand(-0.2, 0.2) * horizonPull,
      rand(0.07, 0.93),
      0.42 + depth * 0.48
    );
    const baseY = clamp(
      lerp(0.48 + rand(-0.045, 0.045) * horizonPull, planeY, 0.48 + depth * 0.45),
      0.08,
      0.92
    );

    return {
      baseX,
      baseY,
      x: baseX + rand(-0.018, 0.018),
      y: baseY + rand(-0.018, 0.018),
      depth,
      plane,
      phase: rand(0, TAU),
      speed: lerp(0.022, 0.085, depth),
      radius: lerp(0.58, 2.12, depth),
      driftX: rand(0.006, 0.024) * lerp(0.35, 1, depth),
      driftY: rand(0.004, 0.018) * lerp(0.3, 0.9, depth),
      lineBias: Math.random(),
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0
    };
  }

  function createTextEvents() {
    const fontSize = state.width < 520 ? 12 : 13;
    state.textFont = `${fontSize}px ui-serif, Georgia, serif`;
    ctx.font = state.textFont;
    textEvents.length = 0;

    for (let index = 0; index < TEXT_EVENT_COUNT; index += 1) {
      const text = generateSentence();
      textEvents.push({
        text,
        width: ctx.measureText(text).width,
        x: randomTextX(),
        y: randomTextY(),
        wait: randomTextWait(),
        fadeIn: rand(4.8, 8.2),
        hold: rand(0.2, 1.5),
        fadeOut: rand(5.8, 9.8),
        alpha: rand(0.045, 0.095)
      });
    }

    state.textIndex = 0;
    state.textElapsed = 0;
  }

  function targetParticleCount() {
    return state.width <= MOBILE_BREAKPOINT ? MAX_MOBILE_PARTICLES : MAX_DESKTOP_PARTICLES;
  }

  function rebuildParticles() {
    state.particleCount = targetParticleCount();
    particles.length = 0;

    for (let index = 0; index < state.particleCount; index += 1) {
      particles.push(createParticle());
    }
  }

  function resizeCanvas() {
    const nextWidth = Math.max(320, window.innerWidth);
    const nextHeight = Math.max(320, window.innerHeight);
    const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    state.resizeId = 0;
    state.width = nextWidth;
    state.height = nextHeight;
    state.dpr = state.reducedMotion ? 1 : nextDpr;

    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    rebuildParticles();
    createTextEvents();

    canvas.dataset.particles = String(state.particleCount);
    canvas.dataset.dpr = String(state.dpr);
    canvas.dataset.safeMode = "true";

    drawStillFrame();
  }

  function scheduleResize() {
    if (state.resizeId) return;
    state.resizeId = window.requestAnimationFrame(resizeCanvas);
  }

  function clearField() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = FIELD_COLOR;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function drawSoftWash(strength) {
    for (let index = 0; index < softZones.length; index += 1) {
      const zone = softZones[index];
      const frame = softFrames[index];
      const flicker = temporalInstability(zone.phase);
      const radius = frame.radius * lerp(0.72, 1.08, flicker);
      const alpha = zone.wash * strength * lerp(0.58, 1.18, flicker);
      const gradient = ctx.createRadialGradient(frame.x, frame.y, 0, frame.x, frame.y, radius);

      gradient.addColorStop(0, "rgba(243, 240, 232, 0.52)");
      gradient.addColorStop(0.62, "rgba(243, 240, 232, 0.18)");
      gradient.addColorStop(1, "rgba(243, 240, 232, 0)");

      ctx.globalAlpha = alpha;
      ctx.fillStyle = gradient;
      ctx.fillRect(frame.x - radius, frame.y - radius, radius * 2, radius * 2);
    }

    ctx.globalAlpha = 1;
  }

  function drawExposureVeil() {
    const flicker = temporalInstability(8.4);
    const alpha = (state.reducedMotion ? 0.004 : 0.007) + flicker * (state.reducedMotion ? 0.003 : 0.007);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = FIELD_COLOR;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.globalAlpha = 1;
  }

  function drawDepthBands() {
    const scale = Math.min(state.width, state.height);

    for (let index = 0; index < depthBands.length; index += 1) {
      const band = depthBands[index];
      const flicker = temporalInstability(band.phase + index * 1.7);
      const x =
        (band.x + Math.cos(state.time * 0.018 + band.phase) * band.driftX) * state.width;
      const y =
        (band.y + Math.sin(state.time * 0.015 + band.phase * 1.2) * band.driftY) * state.height;
      const width = band.width * Math.max(state.width, state.height);
      const height = band.height * scale * lerp(0.86, 1.18, flicker);
      const gradient = ctx.createLinearGradient(0, -height * 0.5, 0, height * 0.5);

      gradient.addColorStop(0, "rgba(20, 20, 18, 0)");
      gradient.addColorStop(0.28, "rgba(20, 20, 18, 0.08)");
      gradient.addColorStop(0.52, "rgba(20, 20, 18, 0.18)");
      gradient.addColorStop(0.74, "rgba(20, 20, 18, 0.07)");
      gradient.addColorStop(1, "rgba(20, 20, 18, 0)");

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(band.angle + Math.sin(state.time * 0.012 + band.phase) * 0.025);
      ctx.globalAlpha = band.alpha * lerp(0.72, 1.22, flicker);
      ctx.fillStyle = gradient;
      ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  function updateSystems(delta) {
    const scale = state.reducedMotion ? 0.32 : 1;
    const ampX = state.reducedMotion ? 0.012 : 0.055;
    const ampY = state.reducedMotion ? 0.008 : 0.038;
    const time = state.time * scale;
    const targetAX =
      0.5 + Math.cos(time * 0.17) * ampX + Math.sin(time * 0.061 + 0.7) * ampX * 0.24;
    const targetAY =
      0.5 + Math.sin(time * 0.13 + 1.1) * ampY + Math.cos(time * 0.047) * ampY * 0.2;
    const targetBX =
      0.5 + Math.cos(time * 0.115 + 1.9) * ampX * 0.78 + Math.sin(time * 0.039) * ampX * 0.18;
    const targetBY =
      0.5 + Math.sin(time * 0.095 + 2.6) * ampY * 0.82 + Math.cos(time * 0.043 + 0.4) * ampY * 0.2;
    const quick = clamp((state.reducedMotion ? 0.012 : 0.034) * delta, 0, 0.1);
    const slow = clamp((state.reducedMotion ? 0.006 : 0.018) * delta, 0, 0.07);

    state.systemAX += (targetAX - state.systemAX) * quick;
    state.systemAY += (targetAY - state.systemAY) * quick;
    state.systemBX += (targetBX - state.systemBX) * slow;
    state.systemBY += (targetBY - state.systemBY) * slow;
  }

  function updateParticles(delta) {
    const reduced = state.reducedMotion ? 0.15 : 1;
    const drift = state.motionDepth ? reduced : reduced * 0.16;
    const follow = clamp((state.reducedMotion ? 0.004 : 0.012) * delta, 0, 0.08);
    const systemAParallax = state.motionDepth ? 0.12 : 0.035;
    const systemBParallax = state.motionDepth ? 0.17 : 0.05;
    const offsetX = lerp(1.4, 6.8, state.instability);
    const offsetY = lerp(0.8, 4.4, state.instability);

    for (let index = 0; index < state.particleCount; index += 1) {
      const p = particles[index];
      const phase = state.time * p.speed * drift + p.phase;
      const targetX = p.baseX + Math.cos(phase) * p.driftX;
      const targetY = p.baseY + Math.sin(phase * 1.21) * p.driftY;
      const depthPush = p.depth - 0.5;

      p.x += (targetX - p.x) * follow;
      p.y += (targetY - p.y) * follow;

      p.x1 = (p.x + (state.systemAX - 0.5) * systemAParallax * depthPush) * state.width;
      p.y1 = (p.y + (state.systemAY - 0.5) * systemAParallax * depthPush) * state.height;
      p.x2 =
        (p.x + (state.systemBX - 0.5) * systemBParallax * depthPush) * state.width +
        offsetX * (0.5 + p.depth);
      p.y2 =
        (p.y + (state.systemBY - 0.5) * systemBParallax * depthPush) * state.height +
        offsetY * (1 - p.depth);
    }
  }

  function addBrokenSegment(x1, y1, x2, y2, start, end) {
    ctx.moveTo(lerp(x1, x2, start), lerp(y1, y2, start));
    ctx.lineTo(lerp(x1, x2, end), lerp(y1, y2, end));
  }

  function drawResidueSmudge(x, y, span, depth, softness, phase, alpha, color) {
    const instability = temporalInstability(phase + depth * 2.7);
    const wash = softness * lerp(0.2, 0.74, temporalInstability(phase * 0.61 + depth));
    const baseAlpha = clamp(alpha * lerp(0.58, 1.08, instability) * (1 - wash * 0.45), 0.004, 0.2);
    const angle =
      Math.sin(phase * 1.7 + state.time * 0.026) * 0.44 +
      Math.sin(phase * 0.43) * 0.16;
    const length = span * lerp(2.8, 6.2, seededUnit(phase + 1.7)) * lerp(0.78, 1.24, depth);
    const spread = span * lerp(0.78, 1.66, seededUnit(phase + 4.1)) * (1 + softness * 0.64);
    const layers = softness > 0.34 ? 5 : 4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "butt";

    for (let layer = 0; layer < layers; layer += 1) {
      const seed = phase + layer * 3.17;
      const offsetY = (seededUnit(seed + 2.2) - 0.5) * spread;
      const start = -length * lerp(0.3, 0.55, seededUnit(seed + 5.4));
      const mid = start + length * lerp(0.22, 0.38, seededUnit(seed + 6.7));
      const end = start + length * lerp(0.42, 0.72, seededUnit(seed + 7.9));
      const bend = (seededUnit(seed + 9.1) - 0.5) * spread * 0.14;
      const layerAlpha = baseAlpha * lerp(0.28, 0.72, seededUnit(seed + 10.6));

      ctx.globalAlpha = layerAlpha;
      ctx.lineWidth = clamp(span * lerp(0.16, 0.42, seededUnit(seed + 11.3)), 0.18, 1.05);
      ctx.beginPath();
      ctx.moveTo(start, offsetY);
      ctx.lineTo(mid, offsetY + bend);
      if (seededUnit(seed + 12.8) > 0.34) {
        ctx.moveTo(mid + length * 0.08, offsetY + bend * 0.18);
        ctx.lineTo(end, offsetY + bend * 0.36);
      }
      ctx.stroke();

      if (layer < 2) {
        ctx.globalAlpha = layerAlpha * 0.34;
        ctx.fillRect(
          start + length * 0.12,
          offsetY - ctx.lineWidth * 0.75,
          length * lerp(0.12, 0.24, seededUnit(seed + 13.9)),
          ctx.lineWidth * lerp(0.7, 1.5, seededUnit(seed + 15.1))
        );
      }
    }

    ctx.restore();

    if (softness > 0.18) {
      const offset = lerp(0.55, 1.65, softness);

      ctx.save();
      ctx.translate(
        x + Math.cos(phase + state.time * 0.08) * offset,
        y + Math.sin(phase * 1.13 + state.time * 0.06) * offset
      );
      ctx.rotate(angle + 0.08);
      ctx.strokeStyle = color;
      ctx.lineCap = "butt";
      ctx.globalAlpha = clamp(baseAlpha * softness * 0.38, 0.004, 0.05);
      ctx.lineWidth = clamp(span * 0.28, 0.22, 0.9);
      ctx.beginPath();
      ctx.moveTo(-length * 0.34, (seededUnit(phase + 18.2) - 0.5) * spread * 0.44);
      ctx.lineTo(length * 0.22, (seededUnit(phase + 19.6) - 0.5) * spread * 0.4);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(
        x - Math.cos(phase * 0.83) * offset * 0.8,
        y + Math.sin(phase * 0.71) * offset * 0.58
      );
      ctx.rotate(angle - 0.05);
      ctx.strokeStyle = FIELD_COLOR;
      ctx.fillStyle = FIELD_COLOR;
      ctx.lineCap = "butt";
      ctx.globalAlpha = clamp(softness * alpha * 0.24, 0.002, 0.044);
      ctx.lineWidth = clamp(span * 0.24, 0.18, 0.72);
      ctx.beginPath();
      ctx.moveTo(-length * 0.38, 0);
      ctx.lineTo(length * 0.3, (seededUnit(phase + 21.4) - 0.5) * spread * 0.3);
      ctx.stroke();
      ctx.globalAlpha *= 0.52;
      ctx.fillRect(-length * 0.18, -ctx.lineWidth * 0.42, length * 0.34, ctx.lineWidth * 0.84);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  function drawResidueCluster(x, y, span, depth, softness, phase, alpha, color) {
    const clusterSoftness = clamp(softness + 0.18, 0, 1);
    const clusterSpan = span * lerp(1.6, 2.8, depth);
    const angle = Math.sin(phase * 0.58 + state.time * 0.018) * 0.18;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = "butt";

    for (let layer = 0; layer < 5; layer += 1) {
      const seed = phase + layer * 5.31;
      const offsetY = (seededUnit(seed + 1.1) - 0.5) * clusterSpan * 1.2;
      const length = clusterSpan * lerp(2.2, 4.6, seededUnit(seed + 2.4));
      const left = -length * lerp(0.3, 0.6, seededUnit(seed + 3.7));
      const width = length * lerp(0.18, 0.44, seededUnit(seed + 4.9));
      const height = clamp(clusterSpan * lerp(0.08, 0.22, seededUnit(seed + 6.2)), 0.28, 1.6);

      ctx.globalAlpha = alpha * lerp(0.18, 0.42, seededUnit(seed + 7.5));
      ctx.fillRect(left, offsetY, width, height);

      ctx.globalAlpha *= 0.8;
      ctx.lineWidth = height * lerp(0.7, 1.25, seededUnit(seed + 8.8));
      ctx.beginPath();
      ctx.moveTo(left - width * 0.24, offsetY + height * 0.5);
      ctx.lineTo(left + width * 1.18, offsetY + height * (0.32 + seededUnit(seed + 9.9) * 0.36));
      ctx.stroke();
    }

    ctx.restore();

    if (clusterSoftness > 0.28) {
      drawResidueSmudge(
        x + Math.cos(phase) * clusterSpan * 0.2,
        y + Math.sin(phase * 0.7) * clusterSpan * 0.12,
        clusterSpan * 0.44,
        depth,
        clusterSoftness,
        phase + 8.2,
        alpha * 0.9,
        color
      );
    }

    ctx.globalAlpha = 1;
  }

  function drawLines() {
    const maxDistance = state.reducedMotion ? 118 : 165;
    const maxDistanceSq = maxDistance * maxDistance;
    const lineLimit = state.reducedMotion ? 4 : 9;
    const vanishX = state.width * (0.5 + (state.systemAX - 0.5) * 0.18);
    const vanishY = state.height * (0.52 + (state.systemAY - 0.5) * 0.12);
    let lineCount = 0;

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 0.45;

    for (let i = 0; i < state.particleCount; i += 1) {
      const a = particles[i];
      if (a.lineBias < 0.58) continue;

      for (let j = i + 1; j < state.particleCount; j += 1) {
        if (((i * 17 + j * 31) % 11) !== 0) continue;

        const b = particles[j];
        if (a.plane !== b.plane) continue;

        const depthGap = Math.abs(a.depth - b.depth);
        if (depthGap > 0.32) continue;

        const dx = a.x1 - b.x1;
        const dy = a.y1 - b.y1;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > maxDistanceSq) continue;

        const seed = i * 12.9898 + j * 78.233;
        const pulse = (Math.sin(state.time * 0.24 + seed) + 1) * 0.5;
        if (pulse < 0.5) continue;

        const depth = (a.depth + b.depth) * 0.5;
        const fade = easeInOut((pulse - 0.5) / 0.5);
        const distanceFade = 1 - distanceSq / maxDistanceSq;
        const perspectivePull = lerp(0.018, 0.055, 1 - depth);
        const ax = lerp(a.x1, vanishX, perspectivePull);
        const ay = lerp(a.y1, vanishY, perspectivePull);
        const bx = lerp(b.x1, vanishX, perspectivePull);
        const by = lerp(b.y1, vanishY, perspectivePull);
        const softness = softnessAt((ax + bx) * 0.5, (ay + by) * 0.5);
        const temporalFade = lerp(0.46, 1, temporalInstability(seed));
        const shift = Math.sin(seed * 0.37) * 0.035;

        ctx.lineCap = "butt";
        ctx.lineWidth = lerp(0.38, 0.78, softness);
        ctx.globalAlpha =
          fade * distanceFade * lerp(0.012, 0.064, depth) * (1 - softness * 0.62) * temporalFade;
        ctx.beginPath();
        addBrokenSegment(ax, ay, bx, by, 0.08, 0.24 + shift * 0.5);
        if (pulse > 0.58) addBrokenSegment(ax, ay, bx, by, 0.42 - shift, 0.58);
        if (depth > 0.58 && pulse > 0.68) addBrokenSegment(ax, ay, bx, by, 0.76, 0.9);
        ctx.stroke();

        if (softness > 0.14) {
          const smear = softness * lerp(0.12, 0.32, temporalFade);

          ctx.globalAlpha *= smear;
          ctx.beginPath();
          addBrokenSegment(ax + 0.9, ay - 0.54, bx + 0.9, by - 0.54, 0.1, 0.3 + shift * 0.4);
          addBrokenSegment(ax - 0.76, ay + 0.44, bx - 0.76, by + 0.44, 0.48 - shift, 0.64);
          ctx.stroke();

          ctx.strokeStyle = FIELD_COLOR;
          ctx.globalAlpha = clamp(softness * 0.016, 0.002, 0.02);
          ctx.lineWidth = lerp(0.7, 1.5, softness);
          ctx.beginPath();
          addBrokenSegment(ax, ay, bx, by, 0.26, 0.38);
          addBrokenSegment(ax, ay, bx, by, 0.62, 0.74);
          ctx.stroke();
          ctx.strokeStyle = LINE_COLOR;
        }

        lineCount += 1;
        if (lineCount >= lineLimit) {
          ctx.globalAlpha = 1;
          return;
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  function drawSystemB() {
    ctx.fillStyle = SECONDARY_MARK_COLOR;

    for (let index = 0; index < state.particleCount; index += 1) {
      const p = particles[index];
      const unstable = 0.58 + Math.sin(state.time * 0.45 + p.phase) * 0.18;
      const softness = softnessAt(p.x2, p.y2);
      const dissolve = lerp(0.68, 1, temporalInstability(p.phase));
      const alpha = (0.04 + state.instability * 0.024) * unstable * (1 - softness * 0.42) * dissolve;
      const span = p.radius * lerp(1.8, 3.4 + softness * 0.7, p.depth);

      drawResidueSmudge(p.x2, p.y2, span, p.depth, softness, p.phase + 1.4, alpha, SECONDARY_MARK_COLOR);

      if (index % 4 === 0 || softness > 0.46) {
        drawResidueCluster(
          p.x2,
          p.y2,
          span * 1.05,
          p.depth,
          softness,
          p.phase + 2.6,
          alpha * 0.55,
          SECONDARY_MARK_COLOR
        );
      }
    }

    ctx.globalAlpha = 1;
  }

  function drawOcclusion() {
    ctx.fillStyle = FIELD_COLOR;

    for (let index = 0; index < state.particleCount; index += 1) {
      const p = particles[index];
      if (p.depth < 0.78 || p.lineBias < 0.42) continue;

      drawResidueSmudge(
        p.x1,
        p.y1,
        p.radius * lerp(3.8, 6.4, p.depth),
        p.depth,
        softnessAt(p.x1, p.y1),
        p.phase + 5.6,
        0.032,
        FIELD_COLOR
      );
    }

    ctx.globalAlpha = 1;
  }

  function drawSystemA() {
    ctx.fillStyle = MARK_COLOR;

    for (let index = 0; index < state.particleCount; index += 1) {
      const p = particles[index];
      const softness = softnessAt(p.x1, p.y1);
      const span = p.radius * lerp(1.8, 3.8 + softness * 0.9, p.depth);
      const focus = lerp(0.74, 1.03, temporalInstability(p.phase + p.depth * 3));
      const baseAlpha = lerp(0.12, 0.38, p.depth) * (1 - softness * 0.38) * focus;

      drawResidueSmudge(p.x1, p.y1, span, p.depth, softness, p.phase, baseAlpha, MARK_COLOR);

      if (index % 3 === 0 || p.depth > 0.74) {
        drawResidueCluster(
          p.x1,
          p.y1,
          span * 1.12,
          p.depth,
          softness,
          p.phase + 4.4,
          baseAlpha * 0.46,
          MARK_COLOR
        );
      }
    }

    ctx.globalAlpha = 1;
  }

  function drawLanguage() {
    const event = textEvents[state.textIndex];
    if (!event) return;

    let elapsed = state.textElapsed;
    const visibleStart = event.wait;
    const fadeInEnd = visibleStart + event.fadeIn;
    const holdEnd = fadeInEnd + event.hold;
    const fadeOutEnd = holdEnd + event.fadeOut;

    while (elapsed > fadeOutEnd) {
      elapsed -= fadeOutEnd;
      state.textIndex = (state.textIndex + 1) % textEvents.length;
      state.textElapsed = elapsed;
      return;
    }

    if (elapsed < visibleStart) return;

    let alpha = 0;
    if (elapsed < fadeInEnd) {
      alpha = easeInOut((elapsed - visibleStart) / event.fadeIn);
    } else if (elapsed < holdEnd) {
      alpha = 1;
    } else {
      alpha = easeInOut((fadeOutEnd - elapsed) / event.fadeOut);
    }

    const x = clamp(event.x * state.width, event.width / 2 + 20, state.width - event.width / 2 - 20);
    const y = event.y * state.height;
    const softness = softnessAt(x, y);
    const flicker = lerp(0.76, 1, temporalInstability(event.width * 0.017));

    ctx.font = state.textFont;
    ctx.fillStyle = MARK_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha * event.alpha * 1.28 * (1 - softness * 0.18) * flicker;
    ctx.fillText(event.text, x, y);

    if (softness > 0.36) {
      ctx.globalAlpha = alpha * event.alpha * softness * 0.16;
      ctx.fillText(event.text, x + 0.8, y - 0.55);
    }

    ctx.globalAlpha = 1;
  }

  function drawStillFrame() {
    clearField();
    updateParticles(1);
    updateSoftFrames();
    drawDepthBands();
    drawSystemB();
    drawLines();
    drawOcclusion();
    drawSoftWash(0.38);
    drawSystemA();
    drawSoftWash(0.08);
    drawExposureVeil();
    drawLanguage();
  }

  function drawFrame(now) {
    if (document.hidden) {
      state.animationId = 0;
      return;
    }

    const rawDelta = state.lastTime ? Math.min(50, now - state.lastTime) : 16.667;
    const delta = clamp(rawDelta / 16.667, 0.25, 3);
    const timeScale = state.reducedMotion ? 0.25 : 0.72;

    state.lastTime = now;
    state.time += (rawDelta / 1000) * timeScale;
    state.textElapsed += rawDelta / 1000;

    updateSoftFrames();
    updateSystems(delta);
    updateParticles(delta);
    clearField();
    drawDepthBands();
    drawSystemB();
    drawLines();
    drawOcclusion();
    drawSoftWash(0.38);
    drawSystemA();
    drawSoftWash(0.08);
    drawExposureVeil();
    drawLanguage();

    state.animationId = window.requestAnimationFrame(drawFrame);
  }

  function startAnimation() {
    if (state.animationId || document.hidden) return;

    state.lastTime = performance.now();
    state.animationId = window.requestAnimationFrame(drawFrame);
  }

  function stopAnimation() {
    if (!state.animationId) return;

    window.cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stopAnimation();
    } else {
      state.lastTime = performance.now();
      startAnimation();
    }
  }

  function onMotionPreferenceChange() {
    state.reducedMotion = reducedMotionQuery.matches;
    resizeCanvas();
  }

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", onMotionPreferenceChange);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(onMotionPreferenceChange);
  }

  window.addEventListener("resize", scheduleResize);
  document.addEventListener("visibilitychange", onVisibilityChange);

  resizeCanvas();
  startAnimation();
})();
