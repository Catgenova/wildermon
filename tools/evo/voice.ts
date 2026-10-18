/**
 * A kind's voice, played offline: each cue it has (`VOICES`) at each stage,
 * written out as a WAV and drawn as a spectrogram, for a reviewer who cannot
 * listen. `node tools/evo/voice.mjs <species> <outdir>`.
 */
import { VOICES } from '../../src/audio/voices';
import type { BeastAct } from '../../src/game/events';

const species = (window as unknown as { SPECIES: string }).SPECIES;
const RATE = 44100;
const SECS = 2;
const out: Record<string, { wav: string; png: string; peak: number; rms: number }> = {};

function wav(buf: AudioBuffer): string {
  const d = buf.getChannelData(0);
  const bytes = new DataView(new ArrayBuffer(44 + d.length * 2));
  const str = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); bytes.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true); bytes.setUint32(24, RATE, true);
  bytes.setUint32(28, RATE * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true); str(36, 'data'); bytes.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  let s = '';
  const u = new Uint8Array(bytes.buffer);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

function spectrogram(buf: AudioBuffer, label: string): string {
  const d = buf.getChannelData(0);
  const N = 512, hop = 256, cols = Math.floor((d.length - N) / hop), H = 200;
  const cv = document.createElement('canvas');
  cv.width = cols;
  cv.height = H + 60;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, cv.width, cv.height);
  for (let c = 0; c < cols; c++) {
    const re = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = d[c * hop + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    // A plain DFT over the bins drawn: slow, and a page of it is a few seconds.
    for (let y = 0; y < H; y++) {
      const k = Math.round(1 + (y / H) ** 2 * (N / 2 - 2));
      let sr = 0, si = 0;
      for (let i = 0; i < N; i++) { const a = (-2 * Math.PI * k * i) / N; sr += re[i] * Math.cos(a); si += re[i] * Math.sin(a); }
      const db = 20 * Math.log10(Math.hypot(sr, si) + 1e-6);
      const v = Math.max(0, Math.min(1, (db + 40) / 60));
      g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(255 * v * v)},${Math.round(80 * (1 - v) * v * 4)})`;
      g.fillRect(c, H - y, 1, 1);
    }
  }
  // The waveform under it.
  g.strokeStyle = '#6cf';
  g.beginPath();
  for (let c = 0; c < cols; c++) { const s = d[c * hop]; g.lineTo(c, H + 30 - s * 28); }
  g.stroke();
  g.fillStyle = '#fff';
  g.font = '11px sans-serif';
  g.fillText(label, 4, 12);
  return cv.toDataURL('image/png');
}

(async () => {
  const voice = VOICES[species] ?? {};
  for (const act of Object.keys(voice) as BeastAct[]) {
    for (const stage of [0, 1, 2]) {
      const ctx = new OfflineAudioContext(1, RATE * SECS, RATE);
      voice[act]!(ctx, ctx.destination, 0.05, stage, 0.5);
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0;
      for (const x of d) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
      out[`${act}-${stage}`] = { wav: wav(buf), png: spectrogram(buf, `${species} ${act} stage ${stage}`), peak, rms: Math.sqrt(sum / d.length) };
    }
  }
  (window as unknown as { OUT: unknown }).OUT = out;
})();
