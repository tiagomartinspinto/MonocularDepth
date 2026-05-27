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

  const SUBJECTS = [
    "the staircase",
    "a escada",
    "a escaleira",
    "portaikko",
    "the wall",
    "a parede",
    "seinä",
    "the room",
    "a sala",
    "a habitación",
    "huone",
    "the horizon",
    "o horizonte",
    "horisontti",
    "the corridor",
    "o corredor",
    "käytävä",
    "the image",
    "a imagem",
    "a imaxe",
    "kuva",
    "the shadow",
    "a sombra",
    "varjo",
    "the surface",
    "a superfície",
    "pinta",
    "the window",
    "a janela",
    "a fiestra",
    "ikkuna",
    "the floor",
    "o chão",
    "o chan",
    "lattia",
    "the corner",
    "o canto",
    "o recuncho",
    "kulma",
    "the memory",
    "a memória",
    "a memoria",
    "muisti",
    "the map",
    "o mapa",
    "kartta",
    "the object",
    "o objeto",
    "o obxecto",
    "esine",
    "the weather",
    "o tempo",
    "sää"
  ];

  const VERBS = [
    "forgot",
    "esqueceu",
    "unohti",
    "borrowed",
    "emprestou",
    "lainasi",
    "folded",
    "dobrou",
    "taittoi",
    "misplaced",
    "perdeu",
    "kadotti",
    "refused",
    "recusou",
    "rexeitou",
    "kieltäytyi",
    "swallowed",
    "engoliu",
    "tragou",
    "nielaisi",
    "rearranged",
    "reorganizou",
    "reordenou",
    "järjesti",
    "delayed",
    "atrasou",
    "viivästytti",
    "translated",
    "traduziu",
    "traduciu",
    "käänsi",
    "interrupted",
    "interrompeu",
    "keskeytti",
    "removed",
    "removeu",
    "poisti",
    "invented",
    "inventou",
    "keksi",
    "rotated",
    "rodou",
    "kiersi"
  ];

  const OBJECTS = [
    "the horizon",
    "o horizonte",
    "horisontti",
    "tomorrow",
    "amanhã",
    "mañá",
    "huomenna",
    "silence",
    "silêncio",
    "silencio",
    "hiljaisuus",
    "distance",
    "distância",
    "distancia",
    "etäisyys",
    "weather",
    "tempo",
    "sää",
    "memory",
    "memória",
    "memoria",
    "muisti",
    "the image",
    "a imagem",
    "a imaxe",
    "kuva",
    "the room",
    "a sala",
    "huone",
    "the shadow",
    "a sombra",
    "varjo",
    "geometry",
    "geometria",
    "geometría",
    "surface",
    "superfície",
    "superficie",
    "pinta",
    "perspective",
    "perspetiva",
    "perspectiva"
  ];

  const QUALIFIERS = [
    "without permission",
    "sem permissão",
    "sen permiso",
    "ilman lupaa",
    "sideways",
    "de lado",
    "sivuttain",
    "in silence",
    "em silêncio",
    "en silencio",
    "hiljaa",
    "by mistake",
    "por engano",
    "vahingossa",
    "inside the wall",
    "dentro da parede",
    "seinän sisällä",
    "for no reason",
    "sem razão",
    "sen razón",
    "ilman syytä",
    "near the horizon",
    "junto ao horizonte",
    "horisontin lähellä",
    "against perspective"
  ];

  const ADJECTIVES = [
    "unfinished",
    "inacabado",
    "keskeneräinen",
    "borrowed",
    "emprestado",
    "lainattu",
    "slow",
    "lento",
    "hidas",
    "sideways",
    "oblíquo",
    "oblicuo",
    "vino",
    "misplaced",
    "perdido",
    "kadonnut",
    "silent",
    "silencioso",
    "hiljainen",
    "accidental",
    "acidental",
    "satunnainen",
    "folded",
    "dobrado",
    "taitettu",
    "soft",
    "suave",
    "pehmeä"
  ];

  const HYBRID_LEFT = [
    "hori",
    "sombra",
    "muisti",
    "pinta",
    "escada",
    "silenç",
    "varjo",
    "dobra",
    "lattia",
    "recuncho",
    "kuva",
    "etä",
    "janela",
    "huone",
    "kartta",
    "porta",
    "sein",
    "tempo",
    "obxecto",
    "fiestra"
  ];

  const HYBRID_RIGHT = [
    "seinä",
    "space",
    "distance",
    "wall",
    "ikko",
    "aisuus",
    "horizonte",
    "motion",
    "memory",
    "sombra",
    "distância",
    "ikkuna",
    "horizon",
    "perspectiva",
    "huone",
    "geometria",
    "pinta",
    "varjo",
    "mapa",
    "kulma"
  ];

  const particles = [];
  const textEvents = [];

  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    time: 0,
    lastTime: 0,
    animationId: 0,
    resizeId: 0,
    particleCount: 0,
    pointerActive: false,
    pointerX: 0.5,
    pointerY: 0.5,
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

  function randomInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function pick(bank) {
    return bank[Math.floor(Math.random() * bank.length)];
  }

  function duplicateVowel(word) {
    const vowels = "aeiouáàâãéêíóõúyäö";

    for (let attempt = 0; attempt < word.length; attempt += 1) {
      const index = randomInt(0, word.length - 1);
      const letter = word.charAt(index);

      if (vowels.includes(letter.toLowerCase())) {
        return `${word.slice(0, index)}${letter}${word.slice(index)}`;
      }
    }

    return word;
  }

  function hybridWord() {
    let left = pick(HYBRID_LEFT);
    let right = pick(HYBRID_RIGHT);

    if (left.length > 4 && Math.random() < 0.3) {
      left = left.slice(0, left.length - randomInt(1, Math.min(3, left.length - 3)));
    }

    if (right.length > 4 && Math.random() < 0.26) {
      right = right.slice(randomInt(1, Math.min(2, right.length - 3)));
    }

    if (Math.random() < 0.28) {
      if (Math.random() < 0.5) {
        left = duplicateVowel(left);
      } else {
        right = duplicateVowel(right);
      }
    }

    if (Math.random() < 0.24) {
      if (left.length > 3 && Math.random() < 0.5) {
        left = left.slice(0, -1);
      } else if (right.length > 3) {
        right = right.slice(1);
      }
    }

    if (Math.random() < 0.24) {
      if (left.length > 2 && Math.random() < 0.34) {
        return `${left}${left.slice(-2)}${right}`;
      }

      if (right.length > 2 && Math.random() < 0.67) {
        return `${left}${right.slice(0, 2)}${right}`;
      }

      if (left.length > 3 && right.length > 3) {
        return `${left}${right.charAt(0)}${left.charAt(left.length - 1)}${right}`;
      }
    }

    return `${left}${right}`;
  }

  function generateSentence() {
    const template = Math.floor(Math.random() * 24);

    if (template === 0) return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)}`;
    if (template === 1) {
      return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)} ${pick(QUALIFIERS)}`;
    }
    if (template === 2) return `${pick(ADJECTIVES)} ${pick(OBJECTS)}`;
    if (template === 3) return `${pick(OBJECTS)} without ${pick(OBJECTS)}`;
    if (template === 4) return `${pick(SUBJECTS)} inside ${pick(OBJECTS)}`;
    if (template === 5) return `${pick(SUBJECTS)} remembers ${pick(OBJECTS)}`;
    if (template === 6) return `${pick(SUBJECTS)} arrives in reverse`;
    if (template === 7) return `${pick(OBJECTS)}, ${pick(OBJECTS)}, ${pick(OBJECTS)}`;
    if (template === 8) return `${pick(SUBJECTS)} made of ${pick(OBJECTS)}`;
    if (template === 9) return `${pick(SUBJECTS)} wears ${pick(OBJECTS)}`;
    if (template === 10) return `${pick(OBJECTS)} against perspective`;
    if (template === 11) return `${pick(SUBJECTS)} inside quotation marks`;
    if (template === 12) return `${pick(SUBJECTS)} ${pick(VERBS)} ${hybridWord()}`;
    if (template === 13) return `${hybridWord()} without ${pick(OBJECTS)}`;
    if (template === 14) return `${pick(ADJECTIVES)} ${hybridWord()}`;
    if (template === 15) return `${hybridWord()}, ${pick(OBJECTS)}, ${pick(SUBJECTS)}`;
    if (template === 16) return `${pick(SUBJECTS)} inside ${hybridWord()}`;
    if (template === 17) return `${hybridWord()} ${hybridWord()}`;
    if (template === 18) return `${pick(OBJECTS)} inside sideways`;
    if (template === 19) return `${pick(VERBS)} without ${hybridWord()}`;
    if (template === 20) return `${pick(SUBJECTS)}, ${pick(QUALIFIERS)}, ${hybridWord()}`;
    if (template === 21) return `${pick(OBJECTS)} remembers ${pick(QUALIFIERS)}`;
    if (template === 22) return `${pick(ADJECTIVES)} ${pick(VERBS)} ${pick(OBJECTS)}`;
    return `${hybridWord()} against ${hybridWord()}`;
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

  function updateSystems(delta) {
    let targetX = state.pointerX;
    let targetY = state.pointerY;

    if (!state.pointerActive) {
      const idle = state.reducedMotion ? 0.008 : 0.03;
      targetX = 0.5 + Math.cos(state.time * 0.08) * idle;
      targetY = 0.5 + Math.sin(state.time * 0.065) * idle;
    }

    const quick = clamp((state.reducedMotion ? 0.035 : 0.085) * delta, 0, 0.24);
    const slow = clamp((state.reducedMotion ? 0.01 : 0.025) * delta, 0, 0.14);

    state.systemAX += (targetX - state.systemAX) * quick;
    state.systemAY += (targetY - state.systemAY) * quick;
    state.systemBX += (targetX - state.systemBX) * slow;
    state.systemBY += (targetY - state.systemBY) * slow;
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

  function drawSystemB() {
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

  function drawOcclusion() {
    ctx.fillStyle = "#050506";

    for (let index = 0; index < state.particleCount; index += 1) {
      const p = particles[index];
      if (p.depth < 0.78 || p.lineBias < 0.42) continue;

      ctx.globalAlpha = 0.035;
      ctx.beginPath();
      ctx.arc(p.x1, p.y1, p.radius * 5.2, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawSystemA() {
    ctx.fillStyle = "#edede6";

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

    ctx.font = state.textFont;
    ctx.fillStyle = "#ecece6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha * event.alpha;
    ctx.fillText(event.text, x, y);
    ctx.globalAlpha = 1;
  }

  function drawStillFrame() {
    clearField();
    updateParticles(1);
    drawSystemB();
    drawLines();
    drawOcclusion();
    drawSystemA();
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

    updateSystems(delta);
    updateParticles(delta);
    clearField();
    drawSystemB();
    drawLines();
    drawOcclusion();
    drawSystemA();
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

  resizeCanvas();
  startAnimation();
})();
