// Screenshot states: deterministic setups for ?shot=start|play|ring|end.
// One file, one job: put the plane somewhere worth photographing, then
// hold it there with a gentle autopilot so the shot is stable.

import { CFG } from './config.js';
import { heightAt } from './terrain.js';

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || '', seed: Number(q.get('seed') || '1') };
}

// Place the plane and return { state, autopilot } for the shot.
export function applyShot(shot, p) {
  const ring = CFG.rings;
  if (shot === 'start') {
    p.x = 0;
    p.y = CFG.runway.height + 1.5;
    p.z = -200;
    p.heading = 0;
    p.speed = 0;
    p.throttle = 0.35;
    p.onGround = true;
    return { state: 'title', autopilot: false };
  }
  if (shot === 'play') {
    p.x = 120;
    p.y = 105;
    p.z = 640;
    p.heading = 0.42;
    p.pitch = 0.04;
    p.roll = 0.28;
    p.speed = 128;
    p.throttle = 0.72;
    p.onGround = false;
    p.rings = 2;
    p.score = 200;
    p.time = 74;
    return { state: 'flying', autopilot: true };
  }
  if (shot === 'ring') {
    const r = ring[3];
    p.x = r.x - Math.sin(0.55) * 95;
    p.y = r.y + 6;
    p.z = r.z - Math.cos(0.55) * 95;
    p.heading = 0.55;
    p.pitch = 0.02;
    p.roll = -0.22;
    p.speed = 132;
    p.throttle = 0.78;
    p.onGround = false;
    p.rings = 3;
    p.score = 300;
    p.time = 118;
    return { state: 'flying', autopilot: true };
  }
  if (shot === 'end') {
    p.x = 0;
    p.y = CFG.runway.height + 1.5;
    p.z = 120;
    p.heading = 0;
    p.speed = 24;
    p.throttle = 0.12;
    p.onGround = true;
    p.landed = true;
    p.rings = CFG.rings.length;
    p.score = 1240;
    p.time = 212;
    p.fuel = 61;
    return { state: 'landed', autopilot: false };
  }
  return { state: null, autopilot: false };
}

// Steer gently toward the next ring so a shot never drifts off course.
export function autopilotInput(p) {
  const target = CFG.rings[p.rings] || { x: 0, y: 40, z: 0 };
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const wantHeading = Math.atan2(dx, dz);
  let dh = wantHeading - p.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const wantY = target.y;
  const dy = wantY - p.y;
  return {
    pitch: Math.max(-0.5, Math.min(0.5, dy * 0.01)),
    roll: Math.max(-0.8, Math.min(0.8, dh * 1.6)),
    throttleDelta: p.speed < 125 ? 0.5 : p.speed > 140 ? -0.5 : 0,
    brake: false,
  };
}

export function groundAt(x, z) {
  return heightAt(x, z);
}
