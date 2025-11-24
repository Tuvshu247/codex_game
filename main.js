const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const gravity = 1600; // pixels per second squared
const groundY = canvas.height - 60;
const slingAnchor = { x: 150, y: groundY - 110 };
const maxLaunch = 160;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

class Bird {
  constructor() {
    this.radius = 16;
    this.reset();
  }

  reset() {
    this.pos = { x: slingAnchor.x, y: slingAnchor.y };
    this.vel = { x: 0, y: 0 };
    this.launched = false;
    this.trail = [];
    this.restTimer = 0;
  }

  launch(power) {
    this.vel = { x: power.x, y: power.y };
    this.launched = true;
  }

  update(dt) {
    if (!this.launched) return;

    this.vel.y += gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // ground collision
    if (this.pos.y + this.radius > groundY) {
      this.pos.y = groundY - this.radius;
      if (this.vel.y > 0) {
        this.vel.y *= -0.35;
        this.vel.x *= 0.9;
      }
    }

    const speed = Math.hypot(this.vel.x, this.vel.y);
    if (speed < 20 && this.pos.y + this.radius >= groundY - 1) {
      this.restTimer += dt;
    } else {
      this.restTimer = 0;
    }

    // trail
    this.trail.push({ x: this.pos.x, y: this.pos.y, life: 1 });
    if (this.trail.length > 40) this.trail.shift();
  }

  draw() {
    // trail
    for (const dot of this.trail) {
      const alpha = dot.life;
      ctx.fillStyle = `rgba(217,64,63,${alpha})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 5 * alpha, 0, Math.PI * 2);
      ctx.fill();
      dot.life = Math.max(0, dot.life - 0.02);
    }

    ctx.fillStyle = "#d9403f";
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4d03f";
    ctx.beginPath();
    ctx.arc(this.pos.x + 4, this.pos.y - 6, 6, Math.PI * 0.1, Math.PI * 1.3);
    ctx.fill();
  }
}

class Block {
  constructor(x, y, w, h) {
    this.pos = { x, y };
    this.w = w;
    this.h = h;
    this.health = 45;
  }

  damage(power) {
    this.health -= power;
    return this.health <= 0;
  }

  draw() {
    ctx.save();
    ctx.translate(this.pos.x + this.w / 2, this.pos.y + this.h / 2);
    ctx.rotate((Math.sin((90 - this.health) * 0.05) * Math.PI) / 180);
    ctx.fillStyle = this.health > 20 ? "#b0a48f" : "#c97f4f";
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

class Pig {
  constructor(x, y) {
    this.pos = { x, y };
    this.radius = 14;
    this.health = 20;
  }

  damage(power) {
    this.health -= power;
    return this.health <= 0;
  }

  draw() {
    ctx.fillStyle = "#6cbc5c";
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2d5b2a";
    ctx.beginPath();
    ctx.arc(this.pos.x - 5, this.pos.y - 4, 3, 0, Math.PI * 2);
    ctx.arc(this.pos.x + 5, this.pos.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4f8048";
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y + 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

const hud = {
  shots: document.getElementById("shots"),
  pigs: document.getElementById("pigs"),
  status: document.getElementById("status"),
};

const state = {
  bird: new Bird(),
  blocks: [],
  pigs: [],
  dragging: false,
  pointer: { x: 0, y: 0 },
  score: 0,
  shots: 0,
  won: false,
  autoResetTimer: 0,
};

function buildLevel() {
  state.blocks = [
    new Block(620, groundY - 60, 60, 60),
    new Block(680, groundY - 60, 60, 60),
    new Block(650, groundY - 120, 60, 60),
    new Block(720, groundY - 60, 60, 60),
    new Block(780, groundY - 60, 60, 60),
    new Block(750, groundY - 120, 60, 60),
    new Block(705, groundY - 180, 100, 30),
  ];

  state.pigs = [
    new Pig(705, groundY - 215),
    new Pig(650, groundY - 95),
    new Pig(770, groundY - 95),
  ];

  state.score = 0;
  state.shots = 0;
  state.won = false;
  state.autoResetTimer = 0;
  state.bird.reset();
  updateHud("Ready to launch");
}

buildLevel();

function circleRectCollision(circle, rect) {
  const nearestX = clamp(circle.pos.x, rect.pos.x, rect.pos.x + rect.w);
  const nearestY = clamp(circle.pos.y, rect.pos.y, rect.pos.y + rect.h);
  const dx = circle.pos.x - nearestX;
  const dy = circle.pos.y - nearestY;
  const distSq = dx * dx + dy * dy;
  return distSq < circle.radius * circle.radius;
}

function resolveCircleRect(bird, block) {
  const nearestX = clamp(bird.pos.x, block.pos.x, block.pos.x + block.w);
  const nearestY = clamp(bird.pos.y, block.pos.y, block.pos.y + block.h);
  const dx = bird.pos.x - nearestX;
  const dy = bird.pos.y - nearestY;
  const dist = Math.hypot(dx, dy) || 1;
  const overlap = bird.radius - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  bird.pos.x += nx * overlap;
  bird.pos.y += ny * overlap;
  const dot = bird.vel.x * nx + bird.vel.y * ny;
  bird.vel.x -= 1.4 * dot * nx;
  bird.vel.y -= 1.4 * dot * ny;
}

function handleCollisions() {
  for (const block of [...state.blocks]) {
    if (circleRectCollision(state.bird, block)) {
      const speed = Math.hypot(state.bird.vel.x, state.bird.vel.y);
      resolveCircleRect(state.bird, block);
      const power = speed * 0.08 + 5;
      if (block.damage(power)) {
        state.blocks = state.blocks.filter((b) => b !== block);
        state.score += 50;
      }
    }
  }

  for (const pig of [...state.pigs]) {
    const d = distance(state.bird.pos, pig.pos);
    if (d < state.bird.radius + pig.radius) {
      const power = Math.hypot(state.bird.vel.x, state.bird.vel.y) * 0.1 + 5;
      if (pig.damage(power)) {
        state.pigs = state.pigs.filter((p) => p !== pig);
        state.score += 150;
        updateHud("Pig down!");
      }
    }
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#9bd7ff");
  sky.addColorStop(1, "#e6f7ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#86d06c";
  ctx.fillRect(0, groundY - 12, canvas.width, 12);
  ctx.fillStyle = "#5b422d";
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
}

function drawSling() {
  ctx.strokeStyle = "#6b4226";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(slingAnchor.x - 8, slingAnchor.y + 16);
  const attachX = state.dragging ? state.pointer.x : state.bird.pos.x;
  const attachY = state.dragging ? state.pointer.y : state.bird.pos.y;
  ctx.lineTo(attachX, attachY);
  ctx.stroke();

  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(slingAnchor.x + 10, slingAnchor.y + 18);
  ctx.lineTo(attachX, attachY);
  ctx.stroke();

  ctx.fillStyle = "#5b3a1e";
  ctx.fillRect(slingAnchor.x - 12, slingAnchor.y + 18, 24, 40);
}

function drawUI() {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.font = "20px 'Segoe UI', sans-serif";
  ctx.fillText(`Score: ${state.score}`, 20, 32);

  if (!state.bird.launched) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText("Drag to aim, release to launch", 20, 56);
  }

  if (state.won) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 42px 'Segoe UI', sans-serif";
    ctx.fillText("Victory!", canvas.width / 2 - 80, 80);
  }
}

function drawAimGuide() {
  if (!state.dragging) return;
  const samples = 18;
  const step = 0.08;
  const startVel = {
    x: (slingAnchor.x - state.pointer.x) * 3,
    y: (slingAnchor.y - state.pointer.y) * 3,
  };
  let pos = { x: state.bird.pos.x, y: state.bird.pos.y };
  let vel = { ...startVel };

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < samples; i += 1) {
    vel.y += gravity * step;
    pos = { x: pos.x + vel.x * step, y: pos.y + vel.y * step };
    if (pos.y > groundY) break;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStructures() {
  for (const block of state.blocks) block.draw();
  for (const pig of state.pigs) pig.draw();
}

function pointerPosition(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
  const y = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
  return { x, y };
}

function startDrag(evt) {
  evt.preventDefault();
  const pos = pointerPosition(evt);
  const inside = distance(pos, state.bird.pos) <= state.bird.radius + 10;
  if (!state.bird.launched && inside) {
    state.dragging = true;
    state.pointer = pos;
    updateHud("Pull back and release");
  }
}

function moveDrag(evt) {
  if (!state.dragging) return;
  evt.preventDefault();
  const pos = pointerPosition(evt);
  const dx = pos.x - slingAnchor.x;
  const dy = pos.y - slingAnchor.y;
  const len = Math.hypot(dx, dy);
  if (len > maxLaunch) {
    const scale = maxLaunch / len;
    state.pointer = { x: slingAnchor.x + dx * scale, y: slingAnchor.y + dy * scale };
  } else {
    state.pointer = pos;
  }
}

function endDrag() {
  if (!state.dragging) return;
  const dx = slingAnchor.x - state.pointer.x;
  const dy = slingAnchor.y - state.pointer.y;
  state.dragging = false;
  state.bird.launch({ x: dx * 3, y: dy * 3 });
  state.shots += 1;
  updateHud("In flight");
}

canvas.addEventListener("mousedown", startDrag);
canvas.addEventListener("touchstart", startDrag);
canvas.addEventListener("mousemove", moveDrag);
canvas.addEventListener("touchmove", moveDrag);
canvas.addEventListener("mouseup", endDrag);
canvas.addEventListener("mouseleave", endDrag);
canvas.addEventListener("touchend", endDrag);

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") resetGame();
});

document.getElementById("reset").addEventListener("click", resetGame);

function resetGame() {
  buildLevel();
}

function updateHud(statusText) {
  hud.shots.textContent = `Shots: ${state.shots}`;
  hud.pigs.textContent = `Pigs: ${state.pigs.length}`;
  if (statusText) hud.status.textContent = statusText;
}

let last = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - last) / 1000, 0.05);
  last = timestamp;

  state.bird.update(dt);
  handleCollisions();

  if (state.bird.launched && state.bird.restTimer > 1.5) {
    state.autoResetTimer += dt;
    if (state.autoResetTimer > 1) {
      updateHud("Resetting…");
      resetGame();
    }
  } else {
    state.autoResetTimer = 0;
  }

  if (
    !state.won &&
    state.bird.pos.x > canvas.width + 120 &&
    Math.abs(state.bird.vel.x) < 10 &&
    Math.abs(state.bird.vel.y) < 10
  ) {
    updateHud("Out of bounds, resetting…");
    resetGame();
  }

  if (state.pigs.length === 0 && !state.won) {
    state.won = true;
    state.score += 500;
    updateHud("Victory! Reset to play again");
  }

  drawBackground();
  drawSling();
  drawAimGuide();
  drawStructures();
  state.bird.draw();
  drawUI();

  updateHud();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
