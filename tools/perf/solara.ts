/**
 * Drives `solara-page.ts` in Chromium on the page's own clock and prints what each scene cost, a JSON line a run.
 *
 *   node .perf-out/solara.mjs '<json>'   where json is { runs: [{ name, scene, dpr, zoom, hour, frames, step, throttle, profile, pan, groundEvery }] }
 *
 * `profile`: a CPU profile of the measured frames, its self time summed by function, the top 30 printed.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

interface Run { shot?: string; name: string; scene: Record<string, unknown>; dpr?: number; zoom?: number; hour?: number; frames?: number; step?: number; warm?: number; throttle?: number; profile?: boolean; pan?: number; groundEvery?: number; width?: number; height?: number; near?: string }
const arg = process.argv[2] ?? '{}';
const cfg = JSON.parse(arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8') : arg) as { runs: Run[] };

const bundled = await build({
  entryPoints: [resolve('tools/perf/solara-page.ts')], bundle: true, format: 'iife', write: false, logLevel: 'error',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}' },
});
const page = bundled.outputFiles[0].text;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])] });
try {
  for (const r of cfg.runs) {
    const ctx = await browser.newContext({ viewport: { width: r.width ?? 1280, height: r.height ?? 720 }, deviceScaleFactor: r.dpr ?? 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: `(() => {
      const real = performance.now.bind(performance);
      let t = real();
      const d0 = Date.now() - t;
      // The page's clock moves by \`tick\`, and within a frame by the real time spent in it, so budgets kept in
      // milliseconds a frame (the beasts' allowance, the trees' idle slice) hold as they do in a browser.
      let mark = real();
      const inFrame = ${process.env.FROZEN ? 'false' : 'true'};
      let last = t;
      performance.now = () => (last = Math.max(last, inFrame ? t + Math.min(250, real() - mark) : t));
      Date.now = () => d0 + performance.now();
      let made = 0;
      const make = document.createElement.bind(document);
      document.createElement = (name, o) => { if (String(name).toLowerCase() === 'canvas') made++; return make(name, o); };
      window.driven = { tick: (ms) => { t = Math.max(t + ms, last); mark = real(); }, realNow: real, canvases: () => made };
    })();` });
    await tab.addScriptTag({ content: `window.solaraScene = ${JSON.stringify(r.scene)};` });
    const tLoad = Date.now();
    await tab.addScriptTag({ content: page });
    await tab.evaluate(() => (window as unknown as { solara: { ready: Promise<void> } }).solara.ready);
    const loadMs = Date.now() - tLoad;
    if (thrown.length) throw new Error(`the page threw: ${thrown.join('; ')}`);
    const counts = await tab.evaluate(() => (window as unknown as { solara: { counts: unknown } }).solara.counts);
    const cdp = await ctx.newCDPSession(tab);
    const zoom = r.zoom ?? 1, hour = r.hour ?? 13, step = r.step ?? 1000 / 30, n = r.frames ?? 60;
    const run = (frames: number) => tab.evaluate(([frames, step, zoom, hour, pan, groundEvery]) =>
      (window as unknown as { solara: { frames: (...a: unknown[]) => unknown } }).solara.frames(frames, step, zoom, hour, { pan, groundEvery }),
    [frames, step, zoom, hour, r.pan ?? 0, r.groundEvery ?? 0] as const);
    // Warm: a few rounds with breaks between, so the sculpted chunk and the idle bakes land.
    for (let i = 0; i < (r.warm ?? 4); i++) { await run(30); await tab.waitForTimeout(150); }
    if (r.throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: r.throttle });
    if (r.profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
    const m = await run(n) as Record<string, unknown>;
    let top: unknown = undefined;
    if (r.profile) {
      const { profile } = await cdp.send('Profiler.stop') as { profile: { nodes: Array<{ id: number; callFrame: { functionName: string; url: string; lineNumber: number }; hitCount?: number; children?: number[] }>; samples: number[]; timeDeltas: number[] } };
      // Self time by node from samples and deltas, summed by function name and line.
      const self = new Map<number, number>();
      for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
      const byFn = new Map<string, number>();
      let total = 0;
      for (const node of profile.nodes) {
        const t = self.get(node.id) ?? 0;
        total += t;
        const k = `${node.callFrame.functionName || '(anon)'}:${node.callFrame.lineNumber}`;
        byFn.set(k, (byFn.get(k) ?? 0) + t);
      }
      // And the native drawing calls' time by the function that made them (two levels up, past the page's own wrappers).
      const parent = new Map<number, number>();
      for (const node of profile.nodes) for (const c of node.children ?? []) parent.set(c, node.id);
      const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
      const NATIVE = new Set(['drawImage', 'fill', 'stroke', 'getImageData', 'Path2D', 'fillText', 'strokeText', 'clip', 'putImageData', 'fillRect']);
      const natives = new Map<string, number>();
      for (const node of profile.nodes) {
        if (!NATIVE.has(node.callFrame.functionName)) continue;
        let up = parent.get(node.id);
        while (up !== undefined) {
          const f = byId.get(up)!.callFrame.functionName;
          if (f && !/drawImage|apply|<computed>|^P\d|^G\d|(anon)/.test(f)) break;
          up = parent.get(up);
        }
        const k = `${node.callFrame.functionName}<-${up !== undefined ? byId.get(up)!.callFrame.functionName + ':' + byId.get(up)!.callFrame.lineNumber : '?'}`;
        natives.set(k, (natives.get(k) ?? 0) + (self.get(node.id) ?? 0));
      }
      top = { natives: [...natives].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +(v / n).toFixed(2)]), totalMs: Math.round(total), perFrame: +(total / n).toFixed(1), fns: [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, +(v / n).toFixed(2)]) };
    }
    let near: unknown;
    if (r.near) {
      const text = readFileSync(r.near, 'utf8');
      near = await tab.evaluate(([t]) => (window as unknown as { solara: { layNear: (t: string, n: number) => unknown } }).solara.layNear(t, 10), [text] as const);
    }
    if (r.shot) {
      const url = await tab.evaluate(() => (document.querySelector('canvas') as HTMLCanvasElement).toDataURL('image/png'));
      const { writeFileSync } = await import('node:fs');
      writeFileSync(r.shot, Buffer.from(url.split(',')[1], 'base64'));
    }
    const bakes = process.env.BAKESTATS ? await tab.evaluate(() => (window as unknown as { solara: { bakeStats: () => unknown } }).solara.bakeStats()) : undefined;
    const gb = await tab.evaluate(() => (window as unknown as { solara: { groundBeat: (n: number) => unknown } }).solara.groundBeat(5));
    if (r.throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(JSON.stringify({ name: r.name, zoom, hour, dpr: r.dpr ?? 1, throttle: r.throttle ?? 1, loadMs, counts, ...m, groundBeat: gb, near, bakes, profile: top }));
    await ctx.close();
  }
} finally {
  await browser.close();
}
