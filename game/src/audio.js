// Velvet Hour — sound, synthesized live with WebAudio. No audio files.
// One clear job: footsteps, clinks, stings and chimes. Silent until the first
// key or click (browsers demand a gesture), and M mutes everything.

export function makeAudio() {
  return { ctx: null, muted: false, master: null };
}

function ensure(audio) {
  if (audio.ctx) return audio.ctx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.4;
    audio.master.connect(audio.ctx.destination);
    return audio.ctx;
  } catch (e) {
    return null;
  }
}

export function unlockAudio(audio) {
  const ctx = ensure(audio);
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(audio, freq, dur, type, vol, slideTo) {
  if (audio.muted) return;
  const ctx = ensure(audio);
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

function noiseBurst(audio, dur, vol, freq) {
  if (audio.muted) return;
  const ctx = ensure(audio);
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq || 900;
  const gain = ctx.createGain();
  gain.gain.value = vol || 0.1;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
}

export const sfx = {
  step(audio) { noiseBurst(audio, 0.06, 0.05, 500); },
  creak(audio) { tone(audio, 180, 0.22, 'sawtooth', 0.05, 90); },
  clink(audio) { tone(audio, 1900, 0.12, 'triangle', 0.14, 1200); tone(audio, 2600, 0.08, 'sine', 0.08); },
  grab(audio) { tone(audio, 660, 0.1, 'triangle', 0.12); tone(audio, 990, 0.16, 'triangle', 0.12); },
  spotted(audio) { tone(audio, 220, 0.5, 'sawtooth', 0.1, 440); },
  alarm(audio) { tone(audio, 330, 0.35, 'square', 0.07, 220); tone(audio, 220, 0.35, 'square', 0.07, 330); },
  caught(audio) { tone(audio, 160, 0.7, 'sawtooth', 0.12, 60); },
  win(audio) {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone(audio, f, 0.3, 'triangle', 0.12), i * 120);
    });
  },
};
