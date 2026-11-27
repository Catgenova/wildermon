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

/**
 * Hands skilled enough that no skill gate (`src/game/craftgates.ts`) is in the way of a test about something else: these
 * skills at `level` on the island, for player `u` in world `w` (SQL expressions), never lowered.
 */
export const HANDS = 90;
export const handsSql = (w: string, u: string, skills: readonly string[], level = HANDS): string =>
  `insert into skill (world_id, uid, id, value) select ${w}, ${u}, s, ${level} from unnest(array[${skills.map((s) => `'${s}'`).join(', ')}]::text[]) s
     on conflict (world_id, uid, id) do update set value = greatest(skill.value, excluded.value)`;
/** And the same in a browser's game. */
export const hands = (g: { skills: { values: Map<string, number> } }, skills: readonly string[], level = HANDS): void => {
  for (const s of skills) g.skills.values.set(s, Math.max(g.skills.values.get(s) ?? 0, level));
};
/**
 * A browser's new body as the island's tests make theirs (straight into `player`, no `starter_kit`): without the cloth a
 * new body comes ashore in (`STARTER_WEAR`, game.ts), neither worn nor carried, which slows a walk and tires a dig a little.
 */
export const bare = (g: { player: { equipped: Record<string, number | null> }; inventory: { remove(uid: number, count?: number): boolean } },
  wear: ReadonlyArray<readonly [string, string]>): void => {
  for (const [, slot] of wear) {
    const uid = g.player.equipped[slot];
    g.player.equipped[slot] = null;
    if (uid != null) g.inventory.remove(uid);
  }
};
/** The skills walls, floors, roofs and columns are planned and built in. */
export const BUILD_HANDS: readonly string[] = ['carpentry', 'masonry'];
/** The skills recipes are made in (`craftgates.ts`, a gate on every recipe), and paving and restoring. */
export const CRAFT_HANDS: readonly string[] = [
  'alchemy', 'blacksmithing', 'bowyery', 'brewing', 'carpentry', 'cooking', 'enchanting', 'fine_carpentry', 'first_aid',
  'fishing', 'fletching', 'glassblowing', 'jewellery', 'leatherworking', 'masonry', 'milling', 'papyrusmaking', 'pottery',
  'repair', 'ropemaking', 'smelting', 'stonecutting', 'tailoring', 'paving', 'restoration',
];
/**
 * A worker's skills at every recipe's and sowing's level up to `level` (`craftgates.ts`): under the first evolution
 * stage, so its level and stage stay a first stage's. As JSON for the island, as an object for the browser.
 */
export const WORKER_HANDS = 20;
export const workerHands = (level = WORKER_HANDS): Record<string, number> =>
  Object.fromEntries([...CRAFT_HANDS, 'farming'].map((s) => [s, level]));
export const workerHandsJson = (level = WORKER_HANDS): string => JSON.stringify(workerHands(level));
/** `handsSql` for every player of a list (`uids`: SQL, comma-separated uuids). */
export const handsSqlEach = (w: string, uids: string, skills: readonly string[], level = HANDS): string =>
  `insert into skill (world_id, uid, id, value) select ${w}, p, s, ${level}
     from unnest(array[${uids}]::uuid[]) p, unnest(array[${skills.map((s) => `'${s}'`).join(', ')}]::text[]) s
     on conflict (world_id, uid, id) do update set value = greatest(skill.value, excluded.value)`;
