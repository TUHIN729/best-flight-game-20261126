// Sound: everything is synthesised with WebAudio. No audio files.
// One file, one job: engine hum, wind, ring chimes and landing fanfare.

export function makeAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: two detuned saws through a lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 55.7;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(lp);
      osc2.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      osc2.start();
      // Wind: looped noise buffer through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(bp);
      bp.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
      started = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    update(throttle, speed, flying) {
      if (!started || muted || !ctx) return;
      const t = ctx.currentTime;
      const eng = flying ? 0.05 + throttle * 0.06 : 0.02;
      engineGain.gain.setTargetAtTime(eng, t, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(52 + throttle * 46 + speed * 0.08, t, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.09, speed * 0.00045) : 0, t, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318, 0.5, 'sine', 0.18, 0.09);
    },
    takeoff() {
      tone(523, 0.3, 'triangle', 0.16);
      tone(784, 0.4, 'triangle', 0.14, 0.12);
    },
    landed() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.45, 'triangle', 0.18, i * 0.13));
    },
    crash() {
      tone(160, 0.7, 'sawtooth', 0.2);
      tone(90, 0.9, 'sawtooth', 0.16, 0.1);
    },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        const t = ctx.currentTime;
        if (engineGain) engineGain.gain.setTargetAtTime(muted ? 0 : 0.06, t, 0.05);
        if (windGain) windGain.gain.setTargetAtTime(0, t, 0.05);
      }
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
