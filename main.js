const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreboardEl = document.getElementById("scoreboard");
const statusEl = document.getElementById("status");

const DPR_MAX = 2;
const ARENA = { width: 1200, height: 720 };
const PADDLE = { width: 16, height: 120, speed: 560 };
const BALL = {
  radius: 10,
  baseSpeed: 350,
  maxSpeed: 760,
  speedStep: 24,
};

const state = {
  running: false,
  waitingForServe: true,
  serveTimer: 0,
  score: { left: 0, right: 0 },
  left: { x: 34, y: ARENA.height / 2 - PADDLE.height / 2, vy: 0 },
  right: { x: ARENA.width - 34 - PADDLE.width, y: ARENA.height / 2 - PADDLE.height / 2, vy: 0 },
  ball: {
    x: ARENA.width / 2,
    y: ARENA.height / 2,
    vx: BALL.baseSpeed,
    vy: BALL.baseSpeed * 0.22,
    speed: BALL.baseSpeed,
  },
  input: {
    up: false,
    down: false,
    touchActive: false,
    touchY: ARENA.height / 2,
  },
};

let rafId = 0;
let lastTime = performance.now();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateScoreboard() {
  scoreboardEl.textContent = `${state.score.left} : ${state.score.right}`;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resetBall(scoredLeft = false) {
  const dir = scoredLeft ? -1 : 1;
  const randomTilt = (Math.random() * 0.7 + 0.2) * (Math.random() > 0.5 ? 1 : -1);
  state.ball.x = ARENA.width / 2;
  state.ball.y = ARENA.height / 2;
  state.ball.speed = BALL.baseSpeed;
  state.ball.vx = state.ball.speed * dir;
  state.ball.vy = state.ball.speed * randomTilt;
}

function restartGame() {
  state.score.left = 0;
  state.score.right = 0;
  state.left.y = ARENA.height / 2 - PADDLE.height / 2;
  state.right.y = ARENA.height / 2 - PADDLE.height / 2;
  state.waitingForServe = true;
  state.serveTimer = 0;
  state.running = false;
  updateScoreboard();
  resetBall(false);
  setStatus("Neu gestartet • Space zum Starten");
}

function handleKeyEvent(event, isDown) {
  if (["ArrowUp", "ArrowDown", " ", "KeyW", "KeyS", "KeyR"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "ArrowUp" || event.code === "KeyW") {
    state.input.up = isDown;
  }
  if (event.code === "ArrowDown" || event.code === "KeyS") {
    state.input.down = isDown;
  }

  if (!isDown && event.code === "Space") {
    state.running = !state.running;
    if (state.running) {
      setStatus(state.waitingForServe ? "Los geht's!" : "Läuft...");
    } else {
      setStatus("Pausiert • Space zum Fortsetzen");
    }
  }

  if (!isDown && event.code === "KeyR") {
    restartGame();
  }
}

function updatePlayer(dt) {
  let dir = 0;
  if (state.input.up) dir -= 1;
  if (state.input.down) dir += 1;

  if (state.input.touchActive) {
    const targetY = state.input.touchY - PADDLE.height / 2;
    const diff = targetY - state.left.y;
    const maxStep = PADDLE.speed * dt;
    state.left.y += clamp(diff, -maxStep, maxStep);
  } else {
    state.left.y += dir * PADDLE.speed * dt;
  }

  state.left.y = clamp(state.left.y, 0, ARENA.height - PADDLE.height);
}

function updateAi(dt) {
  const aiMaxSpeed = 470;
  const aiLag = 0.15;
  const target = state.ball.y - PADDLE.height / 2;
  const predicted = state.right.y + (target - state.right.y) * aiLag;
  const delta = predicted - state.right.y;
  const maxStep = aiMaxSpeed * dt;
  state.right.y += clamp(delta, -maxStep, maxStep);
  state.right.y = clamp(state.right.y, 0, ARENA.height - PADDLE.height);
}

function paddleCollision(paddle, isLeft) {
  const b = state.ball;
  if (
    b.x + BALL.radius < paddle.x ||
    b.x - BALL.radius > paddle.x + PADDLE.width ||
    b.y + BALL.radius < paddle.y ||
    b.y - BALL.radius > paddle.y + PADDLE.height
  ) {
    return false;
  }

  const impact = (b.y - (paddle.y + PADDLE.height / 2)) / (PADDLE.height / 2);
  const clampedImpact = clamp(impact, -1, 1);
  b.speed = Math.min(BALL.maxSpeed, b.speed + BALL.speedStep);
  const direction = isLeft ? 1 : -1;
  b.vx = direction * b.speed * (0.92 + Math.random() * 0.08);
  b.vy = b.speed * clampedImpact * 0.9;
  b.x = isLeft ? paddle.x + PADDLE.width + BALL.radius : paddle.x - BALL.radius;
  return true;
}

function scorePoint(leftScored) {
  if (leftScored) {
    state.score.left += 1;
  } else {
    state.score.right += 1;
  }
  updateScoreboard();
  state.waitingForServe = true;
  state.serveTimer = 0.8;
  resetBall(leftScored);
  setStatus("Punkt! Kurz bereitmachen...");
}

function updateBall(dt) {
  const b = state.ball;
  const maxStep = 1 / 240;
  let remaining = dt;

  // Sub-steps reduce tunneling for fast ball movement.
  while (remaining > 0) {
    const step = Math.min(maxStep, remaining);
    remaining -= step;

    b.x += b.vx * step;
    b.y += b.vy * step;

    if (b.y - BALL.radius <= 0) {
      b.y = BALL.radius;
      b.vy *= -1;
    } else if (b.y + BALL.radius >= ARENA.height) {
      b.y = ARENA.height - BALL.radius;
      b.vy *= -1;
    }

    const hitLeft = paddleCollision(state.left, true);
    const hitRight = !hitLeft && paddleCollision(state.right, false);

    if (hitLeft || hitRight) {
      continue;
    }

    if (b.x < -BALL.radius) {
      scorePoint(false);
      break;
    }
    if (b.x > ARENA.width + BALL.radius) {
      scorePoint(true);
      break;
    }
  }
}

function drawNet() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 79, 216, 0.45)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(ARENA.width / 2, 0);
  ctx.lineTo(ARENA.width / 2, ARENA.height);
  ctx.stroke();
  ctx.restore();
}

function drawRect(x, y, w, h) {
  ctx.fillRect(x, y, w, h);
}

function render() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const sx = canvas.clientWidth / ARENA.width;
  const sy = canvas.clientHeight / ARENA.height;
  const scale = Math.min(sx, sy);
  const offsetX = (canvas.clientWidth - ARENA.width * scale) / 2;
  const offsetY = (canvas.clientHeight - ARENA.height * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(8, 1, 13, 0.95)";
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

  drawNet();

  ctx.shadowColor = "rgba(255, 79, 216, 0.9)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ff4fd8";

  drawRect(state.left.x, state.left.y, PADDLE.width, PADDLE.height);
  drawRect(state.right.x, state.right.y, PADDLE.width, PADDLE.height);

  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, BALL.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;

  if (state.running) {
    updatePlayer(dt);
    updateAi(dt);

    if (state.waitingForServe) {
      state.serveTimer -= dt;
      if (state.serveTimer <= 0) {
        state.waitingForServe = false;
        setStatus("Läuft...");
      }
    } else {
      updateBall(dt);
    }
  }

  render();
  rafId = requestAnimationFrame(tick);
}

function toArenaY(clientY) {
  const rect = canvas.getBoundingClientRect();
  const relative = clamp((clientY - rect.top) / rect.height, 0, 1);
  return relative * ARENA.height;
}

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  if (event.clientX <= rect.left + rect.width / 3) {
    state.input.touchActive = true;
    state.input.touchY = toArenaY(event.clientY);
    canvas.setPointerCapture(event.pointerId);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.input.touchActive) return;
  state.input.touchY = toArenaY(event.clientY);
});

const endPointer = () => {
  state.input.touchActive = false;
};
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", endPointer);

window.addEventListener("keydown", (event) => handleKeyEvent(event, true));
window.addEventListener("keyup", (event) => handleKeyEvent(event, false));
window.addEventListener("resize", resizeCanvas);

updateScoreboard();
resizeCanvas();
resetBall(false);
render();
cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(tick);
