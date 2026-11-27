// Sky Courier: The Island Run — main loop, states and scoring.
// One file, one job: own the game state machine and drive the loop.

import { CFG, PLANE_NAME } from './config.js';
import { freshPlane, stepPlane } from './plane.js';
import { makeRenderer } from './render.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { shotParams, applyShot, autopilotInput } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = CFG.viewW;
canvas.height = CFG.viewH;

const renderer = makeRenderer(canvas);
const audio = makeAudio();
const input = makeInput(canvas);

let plane = freshPlane();
let state = 'title'; // title | flying | paused | landed | crashed
let autopilot = false;
let best = 0;
try {
  best = Number(window.localStorage.getItem('skycourier-best') || '0');
} catch (e) {
  best = 0;
}

const { shot } = shotParams();
if (shot) {
  const setup = applyShot(shot, plane);
  if (setup.state) {
    state = setup.state;
    autopilot = setup.autopilot;
    if (state === 'flying') plane.message = '';
  }
}

function setMessage(text, seconds) {
  plane.message = text;
  plane.messageUntil = performance.now() / 1000 + seconds;
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev === 'ring') {
      audio.ring();
      setMessage(`RING ${plane.rings} OF ${CFG.rings.length}  ·  +${CFG.ringScore}`, 2.2);
    } else if (ev === 'takeoff') {
      audio.takeoff();
      setMessage('AIRBORNE — FLY THE RINGS', 2.5);
    } else if (ev === 'fuel-out') {
      setMessage('FUEL EMPTY — GLIDE HER HOME', 3);
    } else if (ev === 'landed') {
      audio.landed();
      state = 'landed';
      saveBest();
    } else if (ev === 'crash') {
      audio.crash();
      state = 'crashed';
      saveBest();
    }
  }
}

function saveBest() {
  if (plane.score > best) {
    best = plane.score;
    try {
      window.localStorage.setItem('skycourier-best', String(best));
    } catch (e) {
      /* storage unavailable; best score just lives for this session */
    }
  }
}

function reset() {
  plane = freshPlane();
  state = 'flying';
  autopilot = false;
  setMessage('FULL THROTTLE — PULL UP AT 60 KT', 3);
}

function startFlying() {
  audio.unlock();
  if (state === 'title') {
    state = 'flying';
    setMessage('FULL THROTTLE — PULL UP AT 60 KT', 3);
  }
}

let last = performance.now();
let titleT = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (input.wasPressed('Enter', ' ')) {
    if (state === 'title') startFlying();
  }
  if (input.consumeMouseDown() && state === 'title') startFlying();
  if (input.wasPressed('r', 'R')) {
    if (state === 'landed' || state === 'crashed') reset();
  }
  if (input.wasPressed('p', 'P', 'Escape')) {
    if (state === 'flying') state = 'paused';
    else if (state === 'paused') state = 'flying';
  }
  if (input.wasPressed('m', 'M')) {
    const m = audio.toggleMute();
    setMessage(m ? 'SOUND OFF' : 'SOUND ON', 1.2);
  }

  if (state === 'flying') {
    const ctl = autopilot ? autopilotInput(plane) : input.frame();
    const events = stepPlane(plane, ctl, dt);
    handleEvents(events);
    audio.update(plane.throttle, plane.speed, !plane.onGround);
    if (plane.fuel <= 0 && plane.onGround === false && plane.y < 40) {
      // nothing extra; the glide decides
    }
  } else if (state === 'title') {
    titleT += dt;
    // Idle on the runway: props turning, throttle blipping.
    plane.throttle = 0.3 + Math.sin(titleT * 1.4) * 0.06;
    audio.update(plane.throttle, 0, false);
  }

  renderer.render(plane, state, t);

  // Overlays: title, pause, landed, crashed.
  const ctx = canvas.getContext('2d');
  if (state === 'title') drawTitle(ctx, t);
  else if (state === 'paused') drawPaused(ctx);
  else if (state === 'landed') drawEnd(ctx, true);
  else if (state === 'crashed') drawEnd(ctx, false);

  requestAnimationFrame(frame);
}

function drawTitle(ctx, t) {
  const W = CFG.viewW;
  const H = CFG.viewH;
  ctx.fillStyle = 'rgba(6,12,22,0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.fillText('SKY COURIER', W / 2, 168);
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText('— THE ISLAND RUN —', W / 2, 212);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Fly the golden rings over the islands, then land her on the runway', W / 2, 258);
  ctx.fillText('before the fuel runs dry. Six rings. One runway. No second chances.', W / 2, 284);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#bfe9ff';
  ctx.fillText('W / S or ↑ / ↓  throttle      A / D or ← / →  bank      mouse steers too', W / 2, 330);
  ctx.fillText('I / K  pitch      SPACE  brake      P  pause      M  sound', W / 2, 356);
  if (Math.sin(t * 3) > -0.2) {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER OR CLICK TO FLY', W / 2, 420);
  }
  if (best > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${best}`, W / 2, 462);
  }
}

function drawPaused(ctx) {
  const W = CFG.viewW;
  const H = CFG.viewH;
  ctx.fillStyle = 'rgba(6,12,22,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Press P to keep flying', W / 2, H / 2 + 30);
}

function drawEnd(ctx, landed) {
  const W = CFG.viewW;
  const H = CFG.viewH;
  ctx.fillStyle = 'rgba(6,12,22,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = landed ? '#5ecf6a' : '#ff5a4d';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(landed ? 'LANDED — WELCOME HOME' : 'CRASHED', W / 2, 240);
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  const ringsText = `Rings ${plane.rings} / ${CFG.rings.length}   ·   Score ${plane.score}   ·   Best ${best}`;
  ctx.fillText(ringsText, W / 2, 292);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#bfe9ff';
  if (landed) {
    ctx.fillText('The courier is safe, the cargo is dry, and the runway is yours.', W / 2, 330);
  } else if (plane.fuel <= 0) {
    ctx.fillText('She ran dry over the islands. Watch the fuel gauge next time.', W / 2, 330);
  } else {
    ctx.fillText('The islands are unforgiving. Ease her down next time.', W / 2, 330);
  }
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', W / 2, 392);
}

// Test hook: the screenshot script reads window.__game.
window.__game = {
  get state() {
    return state;
  },
  get plane() {
    return plane;
  },
  get name() {
    return PLANE_NAME;
  },
};

requestAnimationFrame(frame);
