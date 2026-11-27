// Rendering: sky, raycast terrain, rings, the plane, HUD and gauges.
// One file, one job: everything drawn on the canvas lives here.
// The world layer is drawn rolled with the plane's bank; the HUD is not.

import { CFG, CALLSIGN } from './config.js';
import { groundColor, heightAt, fogBlend, hexRgb } from './terrain.js';
import { mulberry32 } from './random.js';
import { knots, feet, headingDeg } from './plane.js';

const TAU = Math.PI * 2;

// Clouds: fixed, seeded, scattered over the islands.
const cloudRand = mulberry32(77031);
const CLOUDS = [];
for (let i = 0; i < 26; i++) {
  CLOUDS.push({
    x: (cloudRand() - 0.5) * 3600,
    y: 190 + cloudRand() * 110,
    z: (cloudRand() - 0.5) * 3600,
    s: 60 + cloudRand() * 130,
  });
}

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = CFG.viewW;
  const H = CFG.viewH;
  const focal = (W / 2) / Math.tan(CFG.fov / 2);

  function project(wx, wy, wz, cam) {
    const dx = wx - cam.x;
    const dy = wy - cam.y;
    const dz = wz - cam.z;
    const sy = Math.sin(cam.yaw);
    const cy = Math.cos(cam.yaw);
    const fwd = dx * sy + dz * cy;
    const right = dx * cy - dz * sy;
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const up = dy * cp - fwd * sp;
    const fwd2 = fwd * cp + dy * sp;
    if (fwd2 < 2) return null;
    return {
      x: W / 2 + (right / fwd2) * focal,
      y: cam.horizonY - (up / fwd2) * focal,
      d: fwd2,
    };
  }

  function drawSky(cam) {
    const g = ctx.createLinearGradient(0, 0, 0, cam.horizonY + 40);
    g.addColorStop(0, CFG.skyTop);
    g.addColorStop(0.55, CFG.skyMid);
    g.addColorStop(1, CFG.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, cam.horizonY + 42);
    // Sun, placed far out along a fixed bearing so it moves with the view.
    const sun = project(
      cam.x + Math.sin(0.85) * 6000,
      cam.y + 2600,
      cam.z + Math.cos(0.85) * 6000,
      cam,
    );
    if (sun) {
      const sg = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 90);
      sg.addColorStop(0, 'rgba(255,244,196,0.95)');
      sg.addColorStop(0.25, 'rgba(255,236,170,0.55)');
      sg.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 90, 0, TAU);
      ctx.fill();
      ctx.fillStyle = CFG.sun;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 26, 0, TAU);
      ctx.fill();
    }
  }

  function drawClouds(cam) {
    for (const c of CLOUDS) {
      const p = project(c.x, c.y, c.z, cam);
      if (!p || p.x < -200 || p.x > W + 200 || p.y < -80 || p.y > cam.horizonY + 30) continue;
      const s = (c.s * focal) / p.d;
      if (s < 4) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.36, 0, 0, TAU);
      ctx.ellipse(p.x - s * 0.45, p.y + s * 0.1, s * 0.6, s * 0.28, 0, 0, TAU);
      ctx.ellipse(p.x + s * 0.5, p.y + s * 0.08, s * 0.65, s * 0.3, 0, 0, TAU);
      ctx.fill();
    }
  }

  // Classic raycast ground: one vertical strip per screen column.
  function drawTerrain(cam) {
    const cols = 200;
    const colW = W / cols;
    const skyRgb = hexRgb(CFG.skyLow);
    for (let i = 0; i < cols; i++) {
      const sx = (i + 0.5) * colW;
      const yawOff = Math.atan((sx - W / 2) / focal);
      const rayYaw = cam.yaw + yawOff;
      const sinR = Math.sin(rayYaw);
      const cosR = Math.cos(rayYaw);
      let maxY = H;
      let d = 9;
      while (d < 1500) {
        const gx = cam.x + sinR * d;
        const gz = cam.z + cosR * d;
        const gh = heightAt(gx, gz);
        const dy = gh - cam.y;
        const cp = Math.cos(cam.pitch);
        const sp = Math.sin(cam.pitch);
        const up = dy * cp - d * sp;
        const fwd2 = d * cp + dy * sp;
        if (fwd2 > 2) {
          const sy = cam.horizonY - (up / fwd2) * focal;
          if (sy < maxY && sy < H) {
            const fogAmt = Math.min(0.85, d / 1500);
            let col = groundColor(gx, gz, gh);
            if (gh < 1.5) {
              // Water: depth shimmer.
              const shimmer = Math.sin(gx * 0.08 + gz * 0.05) * 0.5 + 0.5;
              col = shimmer > 0.86 ? CFG.seaShallow : CFG.seaDeep;
            }
            col = fogBlend(col, CFG.skyLow, fogAmt);
            ctx.fillStyle = col;
            const top = Math.max(0, sy);
            ctx.fillRect(sx - colW / 2 - 0.5, top, colW + 1, maxY - top);
            maxY = sy;
          }
        }
        d *= 1.055;
        if (maxY <= cam.horizonY + 2 && d > 700) break;
      }
    }
    void skyRgb;
  }

  function drawRings(p, cam, time, state) {
    if (state === 'landed' || state === 'crashed') return; // mission over
    for (let i = 0; i < CFG.rings.length; i++) {
      const ring = CFG.rings[i];
      const done = i < p.rings;
      const next = i === p.rings;
      const pr = project(ring.x, ring.y, ring.z, cam);
      if (!pr || pr.d < 60) continue; // a ring just passed fills the lens; skip it
      const rPx = (ring.r * focal) / pr.d;
      if (rPx < 2 || pr.x < -rPx - 40 || pr.x > W + rPx + 40) continue;
      const pulse = next ? 1 + Math.sin(time * 4) * 0.06 : 1;
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.scale(1, 0.62);
      ctx.lineWidth = Math.max(3, rPx * 0.1);
      ctx.strokeStyle = done ? 'rgba(120,220,120,0.75)' : CFG.ringGold;
      ctx.shadowColor = done ? '#4caf50' : CFG.ringGlow;
      ctx.shadowBlur = next ? 26 : 12;
      ctx.beginPath();
      ctx.arc(0, 0, rPx * pulse, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1.5, rPx * 0.03);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, rPx * pulse * 0.86, 0, TAU);
      ctx.stroke();
      ctx.restore();
      if (next) {
        const dist = Math.round(pr.d * 3.2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${i + 1}  ·  ${dist} FT`, pr.x, pr.y - rPx * 0.7 - 12);
      }
    }
  }

  // The courier plane, chase view, banked with the roll.
  function drawPlane(p, time) {
    const cx = W / 2;
    const cy = H * 0.60 + p.pitch * 60;
    const s = 1.0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.roll * 0.85);
    ctx.scale(s, s);
    // Props, spinning.
    const propA = time * 28;
    ctx.strokeStyle = 'rgba(30,30,34,0.55)';
    ctx.lineWidth = 5;
    for (const wx of [-118, 118]) {
      ctx.beginPath();
      ctx.arc(wx, -6, 26, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wx - 24 * Math.cos(propA), -6 - 24 * Math.sin(propA));
      ctx.lineTo(wx + 24 * Math.cos(propA), -6 + 24 * Math.sin(propA));
      ctx.stroke();
    }
    // Wings.
    ctx.fillStyle = '#e8542f';
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-168, 26);
    ctx.lineTo(-168, 38);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.lineTo(168, 26);
    ctx.lineTo(168, 38);
    ctx.lineTo(10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c23e1d';
    ctx.fillRect(-168, 26, 30, 12);
    ctx.fillRect(138, 26, 30, 12);
    // Tail.
    ctx.fillStyle = '#d14a28';
    ctx.beginPath();
    ctx.moveTo(-8, 44);
    ctx.lineTo(-34, 92);
    ctx.lineTo(-16, 96);
    ctx.lineTo(2, 52);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 44);
    ctx.lineTo(34, 92);
    ctx.lineTo(16, 96);
    ctx.lineTo(-2, 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8542f';
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(-26, 96);
    ctx.lineTo(26, 96);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    const body = ctx.createLinearGradient(0, -18, 0, 96);
    body.addColorStop(0, '#f6f1e6');
    body.addColorStop(0.5, '#efe6d2');
    body.addColorStop(1, '#cdbfa4');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(20, -10, 22, 30);
    ctx.quadraticCurveTo(22, 78, 12, 96);
    ctx.lineTo(-12, 96);
    ctx.quadraticCurveTo(-22, 78, -22, 30);
    ctx.quadraticCurveTo(-20, -10, 0, -22);
    ctx.closePath();
    ctx.fill();
    // Cheatline.
    ctx.fillStyle = '#1f6fb2';
    ctx.fillRect(-22, 34, 44, 7);
    // Canopy, lit.
    const canopy = ctx.createLinearGradient(0, -14, 0, 22);
    canopy.addColorStop(0, '#bfe9ff');
    canopy.addColorStop(1, '#3d8fc4');
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(14, -6, 13, 16);
    ctx.lineTo(-13, 16);
    ctx.quadraticCurveTo(-14, -6, 0, -16);
    ctx.closePath();
    ctx.fill();
    // Callsign on the tail.
    ctx.fillStyle = '#1c2b3a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(CALLSIGN, 0, 82);
    // Nav lights.
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-168, 32, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2dff5a';
    ctx.beginPath();
    ctx.arc(168, 32, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCompass(p) {
    const hd = headingDeg(p.heading);
    const cx = W / 2;
    const y = 34;
    ctx.fillStyle = 'rgba(10,18,28,0.55)';
    roundRect(cx - 190, 12, 380, 44, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 190, 12, 380, 44);
    ctx.clip();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round((hd + d + 360) % 360);
      const x = cx + d * 3.1;
      const isCard = deg % 90 === 0;
      const isMid = deg % 45 === 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = isCard ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + (isCard ? 20 : 15));
      ctx.stroke();
      if (isCard || isMid) {
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] || String(deg);
        ctx.fillStyle = isCard ? '#ffd34d' : '#fff';
        ctx.fillText(label, x, y + 2);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(cx, 14);
    ctx.lineTo(cx - 6, 6);
    ctx.lineTo(cx + 6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(String(Math.round(hd)).padStart(3, '0') + '°', cx, 52);
  }

  function gauge(x, y, r, label, frac, color) {
    ctx.save();
    ctx.translate(x, y);
    const face = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
    face.addColorStop(0, '#22364a');
    face.addColorStop(1, '#0d1826');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
      ctx.lineTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9));
      ctx.stroke();
    }
    const a = Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12));
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, r + 13);
    ctx.restore();
  }

  function drawAttitude(p, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    ctx.rotate(-p.roll);
    const pitchPx = p.pitch * r * 1.4;
    ctx.fillStyle = '#3d8fc4';
    ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + r);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, 0);
    ctx.lineTo(-r * 0.2, 0);
    ctx.moveTo(r * 0.2, 0);
    ctx.lineTo(r * 0.55, 0);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', 0, r + 13);
    ctx.restore();
  }

  function drawHud(p, state, time) {
    // Top strip.
    ctx.fillStyle = 'rgba(10,18,28,0.55)';
    roundRect(14, 12, 250, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#9fc6e8';
    ctx.fillText('SPEED', 28, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(knots(p.speed) + ' KT', 28, 60);
    ctx.fillStyle = 'rgba(10,18,28,0.55)';
    roundRect(W - 264, 12, 250, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#9fc6e8';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ALTITUDE', W - 28, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(feet(p.y) + ' FT', W - 28, 60);
    drawCompass(p);

    // Mission panel, left.
    ctx.fillStyle = 'rgba(10,18,28,0.55)';
    roundRect(14, 92, 264, 118, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SKY COURIER — ISLAND RUN', 28, 114);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    const goal = p.rings < CFG.rings.length
      ? `Pass the rings: ${p.rings} / ${CFG.rings.length}`
      : 'All rings! Land on the runway';
    ctx.fillText(goal, 28, 136);
    ctx.fillText(`SCORE  ${p.score}`, 28, 158);
    ctx.fillText(`TIME  ${Math.floor(p.time / 60)}:${String(Math.floor(p.time % 60)).padStart(2, '0')}`, 28, 180);
    // Fuel bar.
    const fuelFrac = p.fuel / CFG.fuelMax;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(28, 190, 180, 10, 5);
    ctx.fill();
    const fuelCol = fuelFrac > 0.35 ? '#5ecf6a' : p.fuel > 0 && Math.sin(time * 8) > 0 ? '#ff5a4d' : '#ffb02e';
    ctx.fillStyle = fuelCol;
    roundRect(28, 190, Math.max(6, 180 * fuelFrac), 10, 5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('FUEL', 216, 199);

    // Throttle bar, right edge.
    ctx.fillStyle = 'rgba(10,18,28,0.55)';
    roundRect(W - 44, 150, 30, 220, 10);
    ctx.fill();
    ctx.fillStyle = '#ff9d00';
    const thH = 190 * p.throttle;
    roundRect(W - 38, 360 - thH, 18, thH, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', W - 29, 140);

    // Instrument panel, bottom centre — the lit gauges.
    const panelW = 470;
    const panelH = 118;
    const px = (W - panelW) / 2;
    const py = H - panelH - 14;
    ctx.fillStyle = 'rgba(8,14,24,0.72)';
    roundRect(px, py, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    gauge(px + 62, py + 44, 34, 'AIRSPEED', knots(p.speed) / 200, '#5ecf6a');
    drawAttitude(p, px + 168, py + 44, 34);
    gauge(px + 274, py + 44, 34, 'ALTITUDE', Math.min(1, p.y / 700), '#7fb2e8');
    gauge(px + 380, py + 44, 34, 'FUEL', fuelFrac, fuelFrac > 0.25 ? '#5ecf6a' : '#ff5a4d');
    ctx.fillStyle = '#9fc6e8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SKY-7 · TWIN-PROP COURIER', px + panelW / 2, py + 110);

    // Flash message.
    if (p.message && time < p.messageUntil) {
      ctx.fillStyle = 'rgba(10,18,28,0.6)';
      const mw = ctx.measureText(p.message).width + 44;
      roundRect(W / 2 - mw / 2, 92, mw, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.message, W / 2, 119);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function vignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function render(p, state, time) {
    // Chase camera: behind the plane, a touch above, looking along the nose.
    const camPitch = p.pitch * 0.55 - 0.02;
    const back = 16;
    const cam = {
      x: p.x - Math.sin(p.heading) * back,
      y: p.y + 5.5,
      z: p.z - Math.cos(p.heading) * back,
      yaw: p.heading,
      pitch: camPitch,
      horizonY: H * 0.42 - Math.tan(camPitch) * focal,
    };
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H * 0.55);
    ctx.rotate(-p.roll * 0.55);
    ctx.translate(-W / 2, -H * 0.55);
    drawSky(cam);
    drawClouds(cam);
    drawTerrain(cam);
    drawRings(p, cam, time, state);
    if (state !== 'title') drawPlane(p, time);
    ctx.restore();
    if (state === 'title') drawPlane(p, time);
    drawHud(p, state, time);
    vignette();
    return cam;
  }

  return { render, project };
}
