const cart = document.querySelector(".cart:not(.cart--loop)");
const loopCart = document.querySelector(".cart--loop");
const explosionsLayer = document.querySelector(".explosions");
const streamTagline = document.querySelector(".stream-tagline");
const brandBlock = document.querySelector(".brand-block");
const scene = document.querySelector(".scene");

const settings = {
  mainCartDuration: 5000,
  mainToLoopDelay: 2000,
  startYRatio: 0.97,
  endYRatio: 0.16,
  pathTiltDeg: 4,
  pathOffsetXRatio: -0.08,
  pathOffsetYRatio: 0.09,
  ellipseHeightScale: 1.35,
  arcLiftRatio: 0.2,
  angle: 7,
  loopCartDuration: 3600,
  loopEntryRatio: 0.28,
  loopCircleRatio: 0.4,
  loopEntryRiseRatio: 0.05,
  loopEntryCurveRatio: 0.22,
  loopBaseYRatio: 0.34,
  loopCenterXRatio: 0.72,
  loopRadiusRatio: 0.18,
  loopVerticalScale: 1.22,
  loopPeakLiftRatio: 0.04,
  loopExitDropRatio: 0.05,
  loopExitArcRatio: 0.018,
  loopExitCurveRatio: 0.18,
  loopTiltDeg: -1,
  loopExitTiltDeg: 2,
  taglineMainTriggerXOffset: 90,
  taglineLoopTriggerXOffset: 26,
  taglineTriggerYRangeRatio: 0.24,
  taglineWaveCooldown: 1200,
  taglineWaveDuration: 1200,
  explosionMinDelay: 140,
  explosionMaxDelay: 420,
  explosionMinSize: 90,
  explosionMaxSize: 220,
  explosionDuration: 700,
  explosionFrames: 64,
  explosionColumns: 8
};

const state = {
  viewportWidth: 0,
  viewportHeight: 0,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  radiusX: 0,
  radiusY: 0,
  loopStartX: 0,
  loopStartY: 0,
  loopEntryStartY: 0,
  loopCenterX: 0,
  loopCenterY: 0,
  loopRadius: 0,
  loopRadiusY: 0,
  loopJoinY: 0,
  loopExitY: 0,
  loopExitX: 0,
  brandMainTriggerX: 0,
  brandLoopTriggerX: 0,
  brandCenterY: 0,
  previousMainX: null,
  previousLoopX: null,
  lastTaglineWaveAt: -Infinity,
  startTime: performance.now(),
  explosionTimeoutId: null
};

function easeInOut(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function measurePath() {
  const sceneRect = scene ? scene.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
  const vw = sceneRect.width;
  const vh = sceneRect.height;
  const rect = cart.getBoundingClientRect();
  const cartWidth = rect.width || Math.min(vw * 0.28, 420);
  const cartHeight = rect.height || cartWidth * 0.6;
  const loopRect = loopCart.getBoundingClientRect();
  const loopCartWidth = loopRect.width || Math.min(vw * 0.18, 260);

  state.viewportWidth = vw;
  state.viewportHeight = vh;

  const offsetX = vw * settings.pathOffsetXRatio;
  const offsetY = vh * settings.pathOffsetYRatio;

  // Quarter-oval from right-bottom to left side.
  state.startX = vw + cartWidth * 0.1 + offsetX;
  state.startY = vh * settings.startYRatio + offsetY;
  state.endX = -cartWidth * 1.2 + offsetX;
  state.endY = vh * settings.endYRatio - cartHeight * 0.2 + offsetY;

  state.radiusX = state.startX - state.endX;
  state.radiusY = (state.startY - state.endY) * settings.ellipseHeightScale;

  state.loopStartX = -loopCartWidth * 1.2;
  state.loopStartY = vh * settings.loopBaseYRatio;
  state.loopEntryStartY = state.loopStartY + vh * settings.loopEntryRiseRatio;
  state.loopCenterX = vw * settings.loopCenterXRatio;
  state.loopRadius = Math.min(vw, vh) * settings.loopRadiusRatio;
  state.loopRadiusY = state.loopRadius * settings.loopVerticalScale;
  state.loopCenterY = state.loopStartY - state.loopRadiusY - vh * settings.loopPeakLiftRatio;
  state.loopJoinY = state.loopCenterY + state.loopRadiusY;
  state.loopExitY = state.loopJoinY + vh * settings.loopExitDropRatio;
  state.loopExitX = vw + loopCartWidth * 1.2;

  if (brandBlock) {
    const brandRect = brandBlock.getBoundingClientRect();
    state.brandMainTriggerX = brandRect.right - sceneRect.left + settings.taglineMainTriggerXOffset;
    state.brandLoopTriggerX = brandRect.left - sceneRect.left - settings.taglineLoopTriggerXOffset;
    state.brandCenterY = brandRect.top - sceneRect.top + brandRect.height * 0.5;
  }
}

function initTaglineWave() {
  if (!streamTagline) {
    return;
  }

  const text = streamTagline.textContent || "";
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === " ") {
      fragment.appendChild(document.createTextNode(" "));
      continue;
    }

    const span = document.createElement("span");
    span.className = "char";
    span.style.setProperty("--char-index", String(i));
    span.textContent = char;
    fragment.appendChild(span);
  }

  streamTagline.textContent = "";
  streamTagline.appendChild(fragment);
}

function triggerTaglineWave(now) {
  if (!streamTagline) {
    return;
  }

  if (now - state.lastTaglineWaveAt < settings.taglineWaveCooldown) {
    return;
  }

  state.lastTaglineWaveAt = now;
  streamTagline.classList.remove("is-waving");
  // Force restart zodat de wave opnieuw afspeelt bij volgende pass.
  void streamTagline.offsetWidth;
  streamTagline.classList.add("is-waving");

  window.setTimeout(() => {
    streamTagline.classList.remove("is-waving");
  }, settings.taglineWaveDuration);
}

function shouldTriggerWave(previousX, currentX, currentY, direction) {
  if (previousX === null || currentX === null) {
    return false;
  }

  const yRange = state.viewportHeight * settings.taglineTriggerYRangeRatio;
  const isNearBrandY = Math.abs(currentY - state.brandCenterY) <= yRange;

  if (!isNearBrandY) {
    return false;
  }

  if (direction === "left") {
    if (!Number.isFinite(state.brandMainTriggerX)) {
      return false;
    }

    return previousX > state.brandMainTriggerX && currentX <= state.brandMainTriggerX;
  }

  if (!Number.isFinite(state.brandLoopTriggerX)) {
    return false;
  }

  return previousX < state.brandLoopTriggerX && currentX >= state.brandLoopTriggerX;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3;
}

function cubicBezierDerivative(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return 3 * mt ** 2 * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t ** 2 * (p3 - p2);
}

function rotatePointClockwise(x, y, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = state.viewportWidth * 0.5;
  const cy = state.viewportHeight * 0.5;

  const dx = x - cx;
  const dy = y - cy;

  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function spawnExplosion() {
  if (!explosionsLayer) {
    return;
  }

  const explosion = document.createElement("div");
  explosion.className = "explosion";

  const size = randomBetween(settings.explosionMinSize, settings.explosionMaxSize);
  const x = randomBetween(size * 0.5, state.viewportWidth - size * 0.5);
  const y = randomBetween(size * 0.5, state.viewportHeight - size * 0.5);
  const rotation = randomBetween(-180, 180);
  const startFrame = Math.floor(randomBetween(0, 12));
  const totalFrames = settings.explosionFrames - startFrame;
  const startTime = performance.now();

  explosion.style.setProperty("--size", `${size}px`);
  explosion.style.left = `${x}px`;
  explosion.style.top = `${y}px`;
  explosion.style.transform = `rotate(${rotation}deg)`;

  explosionsLayer.appendChild(explosion);

  function renderExplosion(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / settings.explosionDuration, 1);
    const frame = Math.min(
      settings.explosionFrames - 1,
      startFrame + Math.floor(progress * totalFrames)
    );
    const column = frame % settings.explosionColumns;
    const row = Math.floor(frame / settings.explosionColumns);

    explosion.style.opacity = progress < 0.08 ? String(progress / 0.08) : String(1 - progress * 0.15);
    explosion.style.backgroundPosition = `${(column / (settings.explosionColumns - 1)) * 100}% ${(row / (settings.explosionColumns - 1)) * 100}%`;

    if (progress < 1) {
      requestAnimationFrame(renderExplosion);
      return;
    }

    explosion.remove();
  }

  requestAnimationFrame(renderExplosion);
}

function scheduleExplosion() {
  const delay = randomBetween(settings.explosionMinDelay, settings.explosionMaxDelay);

  state.explosionTimeoutId = window.setTimeout(() => {
    spawnExplosion();
    scheduleExplosion();
  }, delay);
}

function getLoopCartPosition(now) {
  const cycleDuration = settings.mainCartDuration + settings.mainToLoopDelay + settings.loopCartDuration;
  const cycleTime = (now - state.startTime) % cycleDuration;
  const loopStartTime = settings.mainCartDuration + settings.mainToLoopDelay;

  if (cycleTime < loopStartTime) {
    return null;
  }

  const motionTime = cycleTime - loopStartTime;
  const rawT = motionTime / settings.loopCartDuration;
  const entryEnd = settings.loopEntryRatio;
  const loopEnd = entryEnd + settings.loopCircleRatio;

  let x;
  let y;
  let angle;

  if (rawT < entryEnd) {
    const segmentT = rawT / entryEnd;
    const controlOffsetX = state.viewportWidth * settings.loopEntryCurveRatio;
    const p0x = state.loopStartX;
    const p0y = state.loopJoinY;
    const p1x = state.loopStartX + controlOffsetX;
    const p1y = state.loopJoinY;
    const p2x = state.loopCenterX - controlOffsetX;
    const p2y = state.loopJoinY;
    const p3x = state.loopCenterX;
    const p3y = state.loopJoinY;

    x = cubicBezierPoint(p0x, p1x, p2x, p3x, segmentT);
    y = cubicBezierPoint(p0y, p1y, p2y, p3y, segmentT);

    const dx = cubicBezierDerivative(p0x, p1x, p2x, p3x, segmentT);
    const dy = cubicBezierDerivative(p0y, p1y, p2y, p3y, segmentT);
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  } else if (rawT < loopEnd) {
    const segmentT = (rawT - entryEnd) / settings.loopCircleRatio;
    const loopAngle = Math.PI / 2 - segmentT * Math.PI * 2;

    x = state.loopCenterX + state.loopRadius * Math.cos(loopAngle);
    y = state.loopCenterY + state.loopRadiusY * Math.sin(loopAngle);

    const dx = state.loopRadius * Math.sin(loopAngle);
    const dy = -state.loopRadiusY * Math.cos(loopAngle);
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  } else {
    const segmentT = (rawT - loopEnd) / (1 - loopEnd);
    const controlOffsetX = state.viewportWidth * settings.loopExitCurveRatio;
    const arcLift = state.viewportHeight * settings.loopExitArcRatio;
    const p0x = state.loopCenterX;
    const p0y = state.loopJoinY;
    const p1x = state.loopCenterX + controlOffsetX;
    const p1y = state.loopJoinY;
    const p2x = state.loopExitX - controlOffsetX;
    const p2y = state.loopExitY - arcLift;
    const p3x = state.loopExitX;
    const p3y = state.loopExitY;

    x = cubicBezierPoint(p0x, p1x, p2x, p3x, segmentT);
    y = cubicBezierPoint(p0y, p1y, p2y, p3y, segmentT);

    const dx = cubicBezierDerivative(p0x, p1x, p2x, p3x, segmentT);
    const dy = cubicBezierDerivative(p0y, p1y, p2y, p3y, segmentT);
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Laat de cart stijgen aan het einde van de looping
    if (segmentT > 0.85) {
      angle += settings.loopExitTiltDeg;
    }
  }

  const tilted = rotatePointClockwise(x, y, settings.loopTiltDeg);

  return {
    x: tilted.x,
    y: tilted.y,
    angle
  };
}

function animate(now) {
  const cycleDuration = settings.mainCartDuration + settings.mainToLoopDelay + settings.loopCartDuration;
  const cycleTime = (now - state.startTime) % cycleDuration;

  if (cycleTime < settings.mainCartDuration) {
    const rawT = cycleTime / settings.mainCartDuration;
    const t = easeInOut(rawT);
    const theta = t * (Math.PI / 2);

    // 1/4 ellipse segment.
    const pathX = state.startX - state.radiusX * Math.sin(theta);
    const baseY = state.startY - state.radiusY * (1 - Math.cos(theta));
    const arcLift = -4 * (state.viewportHeight * settings.arcLiftRatio) * t * (1 - t);
    const pathY = baseY + arcLift;
    const tilted = rotatePointClockwise(pathX, pathY, settings.pathTiltDeg);

    cart.style.opacity = "1";
    cart.style.transform = `translate3d(${tilted.x}px, ${tilted.y}px, 0) rotate(${settings.angle}deg)`;

    if (shouldTriggerWave(state.previousMainX, tilted.x, tilted.y, "left")) {
      triggerTaglineWave(now);
    }

    state.previousMainX = tilted.x;
  } else {
    cart.style.opacity = "0";
    state.previousMainX = null;
  }

  const loopCartPosition = getLoopCartPosition(now);

  if (loopCartPosition) {
    loopCart.style.opacity = "1";
    loopCart.style.transform = `translate3d(${loopCartPosition.x}px, ${loopCartPosition.y}px, 0) rotate(${loopCartPosition.angle}deg)`;

    if (shouldTriggerWave(state.previousLoopX, loopCartPosition.x, loopCartPosition.y, "right")) {
      triggerTaglineWave(now);
    }

    state.previousLoopX = loopCartPosition.x;
  } else {
    loopCart.style.opacity = "0";
    state.previousLoopX = null;
  }

  requestAnimationFrame(animate);
}

window.addEventListener("resize", measurePath);

if (cart.complete) {
  initTaglineWave();
  measurePath();
  scheduleExplosion();
  requestAnimationFrame(animate);
} else {
  cart.addEventListener("load", () => {
    initTaglineWave();
    measurePath();
    scheduleExplosion();
    requestAnimationFrame(animate);
  });
}
