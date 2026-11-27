// Flight model: where the plane is, how it moves, what it hits.
// One file, one job: step(state, input, dt) advances the simulation and
// reports events (ring, land, crash, fuel out) for the game to score.

import { CFG } from './config.js';
import { heightAt, isRunway } from './terrain.js';

export function freshPlane() {
  return {
    x: 0,
    y: CFG.runway.height + 1.5,
    z: -180,
    heading: 0, // 0 = north (+z), radians, clockwise from above
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: CFG.fuelMax,
    onGround: true,
    landed: false,
    crashed: false,
    rings: 0,
    ringFlash: 0,
    message: '',
    messageUntil: 0,
    score: 0,
    time: 0,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// input: { pitch: -1..1 (up positive), roll: -1..1 (right positive),
//          throttleDelta: -1..1 per second, brake: bool }
// Returns an array of event strings for this step.
export function stepPlane(p, input, dt) {
  const events = [];
  if (p.crashed || p.landed) return events;
  p.time += dt;

  // Throttle.
  p.throttle = clamp(p.throttle + input.throttleDelta * dt * 0.55, 0, 1);
  if (p.fuel <= 0) p.throttle = 0;
  if (input.brake) p.throttle = Math.max(0, p.throttle - dt * 1.2);

  // Attitude eases toward the stick.
  const rollTarget = clamp(input.roll, -1, 1) * CFG.maxRoll;
  const pitchTarget = clamp(input.pitch, -1, 1) * CFG.maxPitch;
  p.roll += clamp(rollTarget - p.roll, -CFG.rollRate * dt, CFG.rollRate * dt);
  p.pitch += clamp(pitchTarget - p.pitch, -CFG.pitchRate * dt, CFG.pitchRate * dt);

  // Speed chases the throttle; drag grows with the square of speed.
  const targetSpeed = CFG.minSpeed + p.throttle * (CFG.maxSpeed - CFG.minSpeed);
  const accel = p.onGround ? 55 : 26;
  p.speed += clamp(targetSpeed - p.speed, -accel * dt * 0.7, accel * dt);

  // A bank turns the nose; a steep bank without speed bleeds lift.
  const turnRate = Math.sin(p.roll) * CFG.turnAuthority * (0.35 + p.speed / 160);
  p.heading += turnRate * dt;

  // Climb and sink.
  let vy = Math.sin(p.pitch) * p.speed;
  if (p.speed < CFG.stallSpeed && !p.onGround) {
    vy -= (CFG.stallSpeed - p.speed) * 0.55; // stall sink
  }
  if (p.onGround) {
    if (p.speed > 62 && p.pitch > 0.08) {
      p.onGround = false;
      events.push('takeoff');
    } else {
      vy = 0;
    }
  }
  p.y += vy * dt;
  const cp = Math.cos(p.pitch);
  p.x += Math.sin(p.heading) * cp * p.speed * dt;
  p.z += Math.cos(p.heading) * cp * p.speed * dt;

  // Fuel.
  p.fuel = Math.max(0, p.fuel - (CFG.fuelBurnBase + CFG.fuelBurnThrottle * p.throttle) * dt);
  if (p.fuel <= 0 && !p._fuelWarned) {
    p._fuelWarned = true;
    events.push('fuel-out');
  }

  // Rings: 3D distance to the next uncollected ring.
  const ring = CFG.rings[p.rings];
  if (ring && !p.onGround) {
    const dx = p.x - ring.x;
    const dy = p.y - ring.y;
    const dz = p.z - ring.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < ring.r * 0.95) {
      p.rings += 1;
      p.score += CFG.ringScore;
      p.ringFlash = 1;
      events.push('ring');
    }
  }
  if (p.ringFlash > 0) p.ringFlash = Math.max(0, p.ringFlash - dt * 1.4);

  // Ground contact.
  const ground = heightAt(p.x, p.z);
  if (p.y <= ground + 1.5) {
    p.y = ground + 1.5;
    if (p.onGround) {
      // Already rolling on the ground: keep rolling. Running off the
      // runway end into rough ground at speed is a crash.
      if (!isRunway(p.x, p.z) && p.speed > 60) {
        p.crashed = true;
        events.push('crash');
      }
      return events;
    }
    if (isRunway(p.x, p.z)) {
      const gentle = Math.abs(vy) < 14 && p.speed < 95 && Math.abs(p.roll) < 0.35;
      if (p.rings >= CFG.rings.length && gentle) {
        p.landed = true;
        p.onGround = true;
        p.score += CFG.landScore + Math.round(p.fuel) * CFG.fuelBonusPerUnit;
        events.push('landed');
      } else if (gentle) {
        p.onGround = true;
        p.pitch = 0;
        p.roll *= 0.5;
        p.speed = Math.max(p.speed - 30 * dt, 0);
      } else {
        p.crashed = true;
        events.push('crash');
      }
    } else {
      p.crashed = true;
      events.push('crash');
    }
  }
  return events;
}

export function knots(speed) {
  return Math.round(speed * 0.62);
}
export function feet(alt) {
  return Math.round(alt * 3.2);
}
export function headingDeg(heading) {
  return ((heading * 180) / Math.PI % 360 + 360) % 360;
}
