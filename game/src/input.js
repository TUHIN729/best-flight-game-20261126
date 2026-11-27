// Input: keyboard and mouse, merged into one control frame.
// One file, one job: read the devices, hand the game a clean input.

export function makeInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0.5, y: 0.5, active: false, down: false };
  const pressed = new Set(); // edge-triggered keys, consumed by the game

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = (e.clientY - r.top) / r.height;
    mouse.active = true;
  });
  canvas.addEventListener('mousedown', () => {
    mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  function has(...names) {
    return names.some((n) => keys.has(n));
  }

  return {
    // Returns { pitch, roll, throttleDelta, brake } for this frame.
    frame() {
      let pitch = 0;
      let roll = 0;
      let throttleDelta = 0;
      if (has('ArrowUp', 'w')) throttleDelta += 1;
      if (has('ArrowDown', 's')) throttleDelta -= 1;
      if (has('ArrowLeft', 'a')) roll -= 1;
      if (has('ArrowRight', 'd')) roll += 1;
      // Mouse steering: bank toward the pointer, pitch by its height.
      if (mouse.active && !mouse.down) {
        const mx = (mouse.x - 0.5) * 2;
        const my = (mouse.y - 0.5) * 2;
        if (Math.abs(mx) > 0.12) roll += Math.max(-1, Math.min(1, mx * 1.4));
        if (Math.abs(my) > 0.18) pitch += Math.max(-1, Math.min(1, -my * 0.9));
      }
      // Direct pitch keys: I/K or PgUp/PgDn for pilots who want them.
      if (has('i')) pitch += 1;
      if (has('k')) pitch -= 1;
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        roll: Math.max(-1, Math.min(1, roll)),
        throttleDelta,
        brake: has(' '),
      };
    },
    // True once when the key is first pressed; the game consumes it.
    wasPressed(...names) {
      for (const n of names) {
        if (pressed.has(n)) {
          pressed.delete(n);
          return true;
        }
      }
      return false;
    },
    get mouseDown() {
      return mouse.down;
    },
    consumeMouseDown() {
      const d = mouse.down;
      mouse.down = false;
      return d;
    },
  };
}
