// Terrain: islands in a sea, the runway, and what colour the ground is.
// One file, one job: heightAt(x, z) is the only thing the flight model
// and the renderer ask about the world.

import { CFG } from './config.js';
import { makeNoise, falloff } from './random.js';

const fbm = makeNoise(20261126);

export function heightAt(x, z) {
  const rw = CFG.runway;
  // The runway strip is flattened to its own elevation.
  if (Math.abs(x - rw.x) < rw.halfW + 6 && z > rw.zMin - 10 && z < rw.zMax + 10) {
    return rw.height;
  }
  let land = 0;
  for (const isl of CFG.islands) {
    const dx = x - isl.cx;
    const dz = z - isl.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < isl.r) {
      const h = isl.h * falloff(d, isl.r);
      if (h > land) land = h;
    }
  }
  if (land <= 0.5) return -3; // open sea
  const hills = fbm(x * 0.004, z * 0.004);
  return land + hills * Math.min(land, 18) * 0.55;
}

export function isRunway(x, z) {
  const rw = CFG.runway;
  return Math.abs(x - rw.x) < rw.halfW && z > rw.zMin && z < rw.zMax;
}

// Ground colour at a world point, before distance fog.
export function groundColor(x, z, h) {
  const rw = CFG.runway;
  if (isRunway(x, z)) {
    // Centre dashes down the strip.
    const dash = Math.floor((z + 20) / 40) % 2 === 0;
    const nearCentre = Math.abs(x - rw.x) < 1.2;
    if (dash && nearCentre) return CFG.runwayLineColor;
    return CFG.runwayColor;
  }
  if (h < 1.5) return CFG.seaShallow; // shallows
  if (h < 3.5) return CFG.sand; // beach
  // Grass, greener low and yellower high, with a little noise texture.
  const n = fbm(x * 0.05 + 31, z * 0.05 + 17) * 0.5 + 0.5;
  if (h > 62) return CFG.snow;
  if (h > 42) return CFG.rock;
  const t = Math.max(0, Math.min(1, (h - 3.5) / 38));
  return mix3(CFG.grassLow, CFG.grassHigh, t * 0.7 + n * 0.3);
}

function mix3(a, b, t) {
  const pa = hexRgb(a);
  const pb = hexRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

const rgbCache = new Map();
export function hexRgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    v = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    rgbCache.set(hex, v);
  }
  return v;
}

// Blend an rgb() / #rrggbb colour toward the fog colour.
export function fogBlend(color, fog, amount) {
  const a = color.startsWith('#') ? hexRgb(color) : color.match(/\d+/g).map(Number);
  const b = hexRgb(fog);
  const r = Math.round(a[0] + (b[0] - a[0]) * amount);
  const g = Math.round(a[1] + (b[1] - a[1]) * amount);
  const bl = Math.round(a[2] + (b[2] - a[2]) * amount);
  return `rgb(${r},${g},${bl})`;
}
