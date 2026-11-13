#!/usr/bin/env node
/**
 * The suite in supabase/test/manifest.json, one shard of it at a time.
 *
 *   node supabase/test/run-all.mjs --shard 4/6            bundle and run shard 4
 *   node supabase/test/run-all.mjs --shard 4/6 --dry      list shard 4
 *   node supabase/test/run-all.mjs --only fog,arch        just these (file names, no .ts)
 *   node supabase/test/run-all.mjs --rebalance <dir|json>... [--shards 6]
 *
 * Running: every test of the shard bundled in one esbuild build (outdir
 * node_modules/.cache/run), then each run with node in manifest order against
 * whatever Postgres the PG* environment names. A failing test does not stop
 * the rest. Each test's tail is printed (the whole output too, folded, on
 * GitHub), then a table of them all; per-test seconds go to --durations
 * (default node_modules/.cache/run/durations.json). Exit 1 when any failed.
 *
 * Options: --tail N (lines of a failure's output, default 40), --timeout M
 * (minutes a test may take before it is killed and failed, default 30).
 *
 * --rebalance reads durations files (or directories of them) and gives every
 * test a shard again, longest first onto the shard with the least so far
 * (a test with no time counts as the median), keeping the manifest's order.
 * --base 1=300,3=240 counts seconds a shard spends outside the runner.
 *
 * An entry: { file, title, shard, external?: [packages esbuild leaves to
 * node_modules], env?: {...}, node?: [node flags], why }.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = join(ROOT, 'supabase/test/manifest.json');
const OUT = join(ROOT, 'node_modules/.cache/run');
const CI = !!process.env.GITHUB_ACTIONS;

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i < 0 ? dflt : args[i + 1];
};
const flag = (name) => args.includes(name);

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const stem = (t) => basename(t.file, '.ts');
{
  const seen = new Set();
  for (const t of manifest) {
    if (!t.file || !t.title || !Number.isInteger(t.shard)) throw new Error(`manifest entry without file, title or shard: ${JSON.stringify(t)}`);
    if (seen.has(stem(t))) throw new Error(`${t.file} is in the manifest twice`);
    seen.add(stem(t));
    if (!existsSync(join(ROOT, t.file))) throw new Error(`${t.file} is in the manifest and not on disk`);
  }
}

if (flag('--rebalance')) rebalance();
else await run();

function rebalance() {
  const shards = Number(opt('--shards', 6));
  const files = [];
  const walk = (p) => statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : p.endsWith('.json') && files.push(p);
  for (let i = args.indexOf('--rebalance') + 1; i < args.length && !args[i].startsWith('--'); i++) walk(args[i]);
  if (!files.length) throw new Error('--rebalance wants durations files or directories of them');
  const secs = new Map();
  for (const f of files) {
    for (const [file, r] of Object.entries(JSON.parse(readFileSync(f, 'utf8')).tests ?? {})) {
      secs.set(file, Math.max(secs.get(file) ?? 0, r.seconds));
    }
  }
  const known = [...secs.values()].sort((a, b) => a - b);
  const median = known.length ? known[known.length >> 1] : 1;
  const load = Array(shards + 1).fill(0);
  for (const kv of (opt('--base', '') || '').split(',').filter(Boolean)) {
    const [s, v] = kv.split('=').map(Number);
    load[s] += v;
  }
  const before = [...load];
  for (const t of manifest) before[t.shard] = (before[t.shard] ?? 0) + (secs.get(t.file) ?? median);
  const order = manifest.map((t, i) => [i, secs.get(t.file) ?? median]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [i, s] of order) {
    let best = 1;
    for (let k = 2; k <= shards; k++) if (load[k] < load[best]) best = k;
    manifest[i].shard = best;
    load[best] += s;
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${secs.size} timed of ${manifest.length} (median ${median.toFixed(1)} s for the rest)`);
  for (let k = 1; k <= shards; k++) {
    console.log(`shard ${k}: ${(before[k] / 60).toFixed(1)} min -> ${(load[k] / 60).toFixed(1)} min`);
  }
}

async function run() {
  let tests = manifest;
  const shard = opt('--shard');
  if (shard) {
    const [n, of] = shard.split('/').map(Number);
    if (!(n >= 1 && n <= of)) throw new Error(`--shard ${shard}: want N/M`);
    tests = tests.filter((t) => t.shard === n);
  }
  const only = opt('--only');
  if (only) {
    const want = new Set(only.split(',').map((s) => basename(s.trim(), '.ts')));
    tests = tests.filter((t) => want.has(stem(t)));
    for (const w of want) if (!manifest.some((t) => stem(t) === w)) throw new Error(`--only ${w}: not in the manifest`);
  }
  if (flag('--dry')) {
    tests.forEach((t, i) => console.log(`${String(i + 1).padStart(3)}  ${t.file.padEnd(40)} ${t.title}`));
    console.log(`${tests.length} tests`);
    return;
  }
  if (!tests.length) throw new Error('no tests to run');

  mkdirSync(OUT, { recursive: true });
  const broken = await build(tests);
  const tail = Number(opt('--tail', 40));
  const timeout = Number(opt('--timeout', 30)) * 60_000;
  const results = [];
  const t0 = Date.now();
  for (const [i, t] of tests.entries()) {
    const head = `[${i + 1}/${tests.length}] ${t.title} (${t.file})`;
    let r;
    if (broken.has(t.file)) {
      console.log(head);
      r = { ok: false, seconds: 0, lines: broken.get(t.file).split('\n'), why: 'did not build' };
    } else {
      if (CI) console.log(`::group::${head}`);
      else console.log(head);
      r = await one(t, timeout);
      if (CI) console.log('::endgroup::');
    }
    results.push({ t, ...r });
    if (r.ok) {
      console.log(`  ok ${r.seconds.toFixed(1)} s`);
      if (!CI) for (const l of r.lines.slice(-3)) console.log(`  | ${l}`);
    } else {
      if (CI) console.log(`::error title=${t.file}::${t.title}: ${r.why}`);
      console.log(`  FAILED (${r.why}) ${r.seconds.toFixed(1)} s, last ${Math.min(tail, r.lines.length)} lines:`);
      for (const l of r.lines.slice(-tail)) console.log(`  | ${l}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  const total = (Date.now() - t0) / 1000;
  console.log('\n status  seconds  test');
  for (const r of results) console.log(` ${r.ok ? 'ok    ' : 'FAILED'}  ${r.seconds.toFixed(1).padStart(7)}  ${stem(r.t).padEnd(22)} ${r.t.title}`);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed, ${(total / 60).toFixed(1)} min`);
  for (const r of failed) console.log(`  failed: ${r.t.file} (${r.why})`);

  const durations = resolve(ROOT, opt('--durations', join(OUT, 'durations.json')));
  mkdirSync(dirname(durations), { recursive: true });
  writeFileSync(durations, JSON.stringify({
    shard: shard ?? null,
    tests: Object.fromEntries(results.map((r) => [r.t.file, { seconds: Math.round(r.seconds * 10) / 10, ok: r.ok }])),
  }, null, 2) + '\n');
  console.log(`durations: ${durations.startsWith(ROOT) ? relative(ROOT, durations) : durations}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [`### Shard ${shard ?? 'all'}: ${results.length - failed.length} passed, ${failed.length} failed`, '',
      '| | s | test |', '|---|---:|---|',
      ...[...failed, ...results.filter((r) => r.ok)].map((r) => `| ${r.ok ? 'ok' : '**failed**'} | ${r.seconds.toFixed(1)} | \`${stem(r.t)}\` ${r.t.title.replace(/\|/g, '\\|')} |`)];
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n', { flag: 'a' });
  }
  process.exitCode = failed.length ? 1 : 0;
}

/** One esbuild build for every test; when it fails, each alone, to name the ones that do not build. */
async function build(tests) {
  const esbuild = await import('esbuild');
  const external = [...new Set(manifest.flatMap((t) => t.external ?? []))].sort();
  const options = (ts) => ({
    absWorkingDir: ROOT,
    entryPoints: ts.map((t) => ({ in: t.file, out: stem(t) })),
    bundle: true, platform: 'node', format: 'esm', external,
    outdir: OUT, outExtension: { '.js': '.mjs' }, logLevel: 'silent',
  });
  const broken = new Map();
  const t0 = Date.now();
  try {
    await esbuild.build(options(tests));
  } catch {
    for (const t of tests) {
      try {
        await esbuild.build(options([t]));
      } catch (e) {
        broken.set(t.file, (e.errors ?? []).map((m) => `${m.location?.file ?? ''}:${m.location?.line ?? ''} ${m.text}`).join('\n') || String(e));
      }
    }
  }
  console.log(`built ${tests.length - broken.size} of ${tests.length} in ${((Date.now() - t0) / 1000).toFixed(1)} s` +
    (broken.size ? `; ${broken.size} did not build: ${[...broken.keys()].join(', ')}` : ''));
  return broken;
}

function one(t, timeout) {
  return new Promise((done) => {
    const start = Date.now();
    const child = spawn(process.execPath, [...(t.node ?? []), join(OUT, `${stem(t)}.mjs`)], {
      cwd: ROOT, env: { ...process.env, ...(t.env ?? {}) }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = [];
    let partial = '';
    const take = (chunk) => {
      const s = partial + chunk.toString();
      const parts = s.split('\n');
      partial = parts.pop();
      for (const l of parts) {
        lines.push(l);
        if (CI) console.log(l);
      }
      if (lines.length > 5000) lines.splice(0, lines.length - 5000);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (partial) { lines.push(partial); if (CI) console.log(partial); }
      const seconds = (Date.now() - start) / 1000;
      const why = timedOut ? `timed out after ${timeout / 60_000} min` : signal ? `killed by ${signal}` : `exit ${code}`;
      done({ ok: code === 0 && !timedOut, seconds, lines, why });
    });
  });
}
