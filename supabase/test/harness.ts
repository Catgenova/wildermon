/**
 * What every island test had a copy of: the database, the tally of checks, the
 * summary line, and now a seed for anything rolled and a scale for anything
 * timed by the wall clock.
 *
 * Imported by relative path (`./harness`); esbuild bundles it into each test
 * the way CI builds them, so nothing here runs on its own.
 */
import { execFileSync } from 'node:child_process';

/**
 * One psql over stdin against the suite's database, the output trimmed.
 * `db` names another database on the same server instead of PGDATABASE.
 */
export const psql = (sql: string, opts: { db?: string } = {}): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    // The largest any test asked for.
    maxBuffer: 512 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: opts.db ?? process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

export const ok: string[] = [];
export const bad: string[] = [];
export const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** Every check passed then every check failed, the tally under `title`, and exit 1 on any failure. */
export const finish = (title: string): void => {
  for (const line of [...ok, ...bad]) console.log(line);
  console.log(`\n${title} — ${ok.length} of ${ok.length + bad.length}`);
  if (bad.length) process.exit(1);
};

/* ---- seeded randomness -------------------------------------------------------------- */

let root: number | null = null;
let streams = 0;

/** mulberry32: a small, fast 32-bit generator, uniform in [0, 1). */
const mulberry32 = (a: number): (() => number) => () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * A seeded stand-in for Math.random. The seed is SEED from the environment, or
 * a random one; either way it is printed once, and again if the test exits
 * with a failure, so a failing run can be played again with SEED=<n>. Each
 * call gives a stream of its own off the same seed.
 */
export const seed = (): (() => number) => {
  if (root === null) {
    const given = process.env.SEED;
    if (given !== undefined && given !== '') {
      const n = Number(given);
      if (!Number.isInteger(n)) throw new Error(`SEED must be an integer, not ${given}`);
      root = n >>> 0;
    } else {
      root = (Math.random() * 4294967296) >>> 0;
    }
    const at = root;
    console.log(`seed ${at} (SEED=${at} to play it again)`);
    process.on('exit', (code) => {
      if (code) console.log(`seed ${at} — SEED=${at} to play this run again`);
    });
  }
  return mulberry32((root + Math.imul(streams++, 0x9e3779b9)) >>> 0);
};

/* ---- wall-clock budgets ------------------------------------------------------------- */

/** TIME_SCALE from the environment (default 1): what every wall-clock budget is multiplied by on a slow machine. */
export const timeScale = (): number => {
  const given = process.env.TIME_SCALE;
  if (given === undefined || given === '') return 1;
  const n = Number(given);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`TIME_SCALE must be a positive number, not ${given}`);
  return n;
};
