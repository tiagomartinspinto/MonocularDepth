(function () {
  "use strict";

  const canvas = document.getElementById("depth-field");
  const ctx = canvas.getContext("2d", { alpha: false });
  const perceptionInput = document.getElementById("perception");
  const motionToggle = document.getElementById("motion-depth");
  const textToggle = document.getElementById("text-toggle");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const MAX_DESKTOP_PARTICLES = 60;
  const MAX_MOBILE_PARTICLES = 35;
  const MOBILE_BREAKPOINT = 640;
  const MAX_DPR = 1.5;
  const RESIZE_DELAY = 140;
  const TAU = Math.PI * 2;

  const fragments = [
    "depth without stereo",
    "one eye learned distance",
    "the world arrived through motion",
    "not flat, but negotiated",
    "seeing is compensation"
  ];

  const particles = [];
  const notes = [];

  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    time: 0,
    lastTime: 0,
    animationId: 0,
    resizeTimer: 0,
    particleCount: 0,
    pointerActive: false,
    pointerX: 0.5,
    pointerY: 0.5,
    gazeX: 0.5,
    gazeY: 0.5,
    delayedX: 0.5,
    delayedY: 0.5,
    perception: Number(perceptionInput.value),
    instability: 0.44,
    motionDepth: motionToggle.checked,
    showText: textToggle.checked,
    reducedMotion: reducedMotionQuery.matches,
    textFont: "16px ui-serif, Georgia, serif"
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

  function createParticle() {
    const depth = Math.pow(rand(0.04, 1), 1.35);

    return {
      baseX: rand(0.06, 0.94),
      baseY: rand(0.07, 0.93),
      x: rand(0.06, 0.94),
      y: rand(0.07, 0.93),
      depth,
      phase: rand(0, TAU),
      speed: lerp(0.035, 0.13, depth),
      radius: lerp(0.72, 2.35, depth),
      driftX: rand(0.009, 0.034) * depth,
      driftY: rand(0.008, 0.028) * depth,
      lineBias: Math.random(),
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0
    };
  }

  function createNotes() {
    const spacing = 5.4;
    const cycle = fragments.length * spacing;

    notes.length = 0;
    for (let index = 0; index < fragments.length; index += 1) {
      notes.push({
        text: fragments[index],
        x: rand(0.18, 0.82),
        y: rand(0.2, 0.68),
        delay: index * spacing,
        duration: 3.4,
        cycle,
        width: 0
      });
    }
  }

  function updateTextMetrics() {
    const size = state.width < 520 ? 16 : 19;
    state.textFont = `${size}px ui-serif, Georgia, serif`;
    ctx.font = state.textFont;

    for (let index = 0; index < notes.length; index += 1) {
      notes[index].width = ctx.measureText(notes[index].text).width;
    }
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

  function updateSettings() {
    state.perception = Number(perceptionInput.value);
    state.instability = easeInOut(state.perception / 2);
    state.motionDepth = motionToggle.checked;
    state.showText = textToggle.checked;
    state.reducedMotion = reducedMotionQuery.matches;

    const level = state.perception / 2;
    let text = "clear";
    if (level >= 0.72) {
      text = "unstable";
    } else if (level >= 0.34) {
      text = "adapted";
    }
    perceptionInput.setAttribute("aria-valuetext", text);
  }

  function setPerceptionValue(value) {
    const min = Number(perceptionInput.min);
    const max = Number(perceptionInput.max);
    perceptionInput.value = clamp(value, min, max).toFixed(2);
    updateSettings();
  }

  function onPerceptionKeydown(event) {
    const step = Number(perceptionInput.step) || 0.01;
    const value = Number(perceptionInput.value);
    const min = Number(perceptionInput.min);
    const max = Number(perceptionInput.max);
    let next = value;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      next = value - step;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      next = value + step;
    } else if (event.key === "PageDown") {
      next = value - step * 10;
    } else if (event.key === "PageUp") {
      next = value + step * 10;
    } else if (event.key === "Home") {
      next = min;
    } else if (event.key === "End") {
      next = max;
    } else {
      return;
    }

    event.preventDefault();
    setPerceptionValue(next);
  }

  function resizeCanvas() {
    const nextWidth = Math.max(320, window.innerWidth);
    const nextHeight = Math.max(320, window.innerHeight);
    const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    state.width = nextWidth;
    state.height = nextHeight;
    state.dpr = state.reducedMotion ? 1 : nextDpr;

    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    rebuildParticles();
    updateTextMetrics();

    canvas.dataset.particles = String(state.particleCount);
    canvas.dataset.dpr = String(state.dpr);
    canvas.dataset.safeMode = "true";

    drawStillFrame();
  }

  function scheduleResize() {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(resizeCanvas, RESIZE_DELAY);
  }

  function setPointer(clientX, clientY, active) {
    state.pointerX = clamp(clientX / state.width, 0, 1);
    state.pointerY = clamp(clientY / state.height, 0, 1);
    state.pointerActive = active;
  }

  function onPointerMove(event) {
    setPointer(event.clientX, event.clientY, true);
  }

  function onTouchMove(event) {
    if (event.touches.length > 0) {
      setPointer(event.touches[0].clientX, event.touches[0].clientY, true);
    }
  }

  function clearField() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#050506";
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function updateGaze(delta) {
    let targetX = state.pointerX;
    let targetY = state.pointerY;

    if (!state.pointerActive) {
      const idle = state.reducedMotion ? 0.008 : 0.03;
      targetX = 0.5 + Math.cos(state.time * 0.08) * idle;
      targetY = 0.5 + Math.sin(state.time * 0.065) * idle;
    }

    const quick = clamp((state.reducedMotion ? 0.035 : 0.085) * delta, 0, 0.24);
    const slow = clamp((state.reducedMotion ? 0.01 : 0.025) * delta, 0, 0.14);

    state.gazeX += (targetX - state.gazeX) * quick;
    state.gazeY += (targetY - state.gazeY) * quick;
    state.delayedX += (targetX - state.delayedX) * slow;
    state.delayedY += (targetY - state.delayedY) * slow;
  }

  function updateParticles(delta) {
    const motion = state.motionDepth ? 1 : 0.16;
    const reduced = state.reducedMotion ? 0.15 : 1;
    const drift = motion * reduced;
    const follow = clamp((state.reducedMotion ? 0.004 : 0.012) * delta, 0, 0.08);
    const sharpParallax = state.motionDepth ? 0.12 : 0.035;
    const softParallax = state.motionDepth ? 0.17 : 0.05;
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

      p.x1 = (p.x + (state.gazeX - 0.5) * sharpParallax * depthPush) * state.width;
      p.y1 = (p.y + (state.gazeY - 0.5) * sharpParallax * depthPush) * state.height;
      p.x2 =
        (p.x + (state.delayedX - 0.5) * softParallax * depthPush) * state.width +
        offsetX * (0.5 + p.depth);
      p.y2 =
        (p.y + (state.delayedY - 0.5) * softParallax * depthPush) * state.height +
        offsetY * (1 - p.depth);
    }
  }

  function drawLines() {
    const maxDistance = 84;
    const maxDistanceSq = maxDistance * maxDistance;

    ctx.beginPath();
    for (let i = 0; i < state.particleCount; i += 1) {
      const a = particles[i];
      if (a.lineBias < 0.28) continue;

      for (let j = i + 1; j < state.particleCount; j += 1) {
        if (((i + j) & 1) === 1) continue;

        const b = particles[j];
        if (Math.abs(a.depth - b.depth) > 0.18) continue;

        const dx = a.x1 - b.x1;
        const dy = a.y1 - b.y1;
        if (dx * dx + dy * dy > maxDistanceSq) continue;

        ctx.moveTo(a.x1, a.y1);
        ctx.lineTo(b.x1, b.y1);
      }
    }

    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#d8d8cf";
    ctx.lineWidth = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawAmblyopicLayer() {
    ctx.fillStyle = "#cbcbc3";

    for (let index = 0; index < state.particleCount; index += 1) {
      const p = particles[index];
      const unstable = 0.58 + Math.sin(state.time * 0.45 + p.phase) * 0.18;
      const alpha = (0.055 + state.instability * 0.03) * unstable;

      ctx.globalAlpha = clamp(alpha, 0.02, 0.12);
      ctx.beginPath();
      ctx.arc(p.x2, p.y2, p.radius * lerp(1.15, 1.5, p.depth), 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawDominantLayer() {
    ctx.fillStyle = "#ededE6";

    for (let index = 0; index < state.particleCount; index += 1) {
      const p = particles[index];
      const radius = p.radius * lerp(0.82, 1.32, p.depth);

      ctx.globalAlpha = lerp(0.14, 0.36, p.depth);
      ctx.beginPath();
      ctx.arc(p.x1, p.y1, radius, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawTextFragments() {
    if (!state.showText) return;

    ctx.font = state.textFont;
    ctx.fillStyle = "#ecece6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      let local = (state.time - note.delay) % note.cycle;
      if (local < 0) local += note.cycle;
      if (local > note.duration) continue;

      const visible =
        easeInOut(clamp(local / 1.35, 0, 1)) *
        easeInOut(clamp((note.duration - local) / 1.45, 0, 1));
      if (visible < 0.025) continue;

      const x = clamp(
        note.x * state.width + (state.delayedX - 0.5) * 14,
        note.width / 2 + 18,
        state.width - note.width / 2 - 18
      );
      const y = note.y * state.height + (state.delayedY - 0.5) * 10;

      ctx.globalAlpha = visible * 0.12;
      ctx.fillText(note.text, x, y);
    }

    ctx.globalAlpha = 1;
  }

  function drawStillFrame() {
    clearField();
    updateParticles(1);
    drawAmblyopicLayer();
    drawLines();
    drawDominantLayer();
    drawTextFragments();
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

    updateGaze(delta);
    updateParticles(delta);
    clearField();
    drawAmblyopicLayer();
    drawLines();
    drawDominantLayer();
    drawTextFragments();

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
    updateSettings();
    resizeCanvas();
  }

  perceptionInput.addEventListener("input", updateSettings);
  perceptionInput.addEventListener("keydown", onPerceptionKeydown);
  motionToggle.addEventListener("change", updateSettings);
  textToggle.addEventListener("change", updateSettings);

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", onMotionPreferenceChange);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(onMotionPreferenceChange);
  }

  window.addEventListener("resize", scheduleResize);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerdown", onPointerMove);
  window.addEventListener("pointerleave", () => {
    state.pointerActive = false;
  });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("blur", () => {
    state.pointerActive = false;
  });
  document.addEventListener("visibilitychange", onVisibilityChange);

  createNotes();
  updateSettings();
  resizeCanvas();
  startAnimation();
})();
