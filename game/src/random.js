// Seeded randomness and smooth value noise for the terrain.
// One file, one job: deterministic numbers, so every run looks the same
// from the same seed and the screenshots are reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise on a hashed grid. Returns roughly [-1, 1].
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  function hash(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function fade(t) {
    return t * t * (3 - 2 * t);
  }
  function noise2(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const u = fade(fx);
    const v = fade(fz);
    const top = a + (b - a) * u;
    const bot = c + (d - c) * u;
    return (top + (bot - top) * v) * 2 - 1;
  }
  // Fractal sum of three octaves.
  return function fbm(x, z) {
    return (
      noise2(x, z) * 0.55 +
      noise2(x * 2.13 + 7.7, z * 2.13 + 3.1) * 0.3 +
      noise2(x * 4.31 + 13.7, z * 4.31 + 9.4) * 0.15
    );
  };
}

// Smoothstep falloff: 1 at the centre, 0 at and past the edge.
export function falloff(d, r) {
  const t = Math.max(0, Math.min(1, 1 - d / r));
  return t * t * (3 - 2 * t);
}
