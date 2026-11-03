/**
 * How many people the island holds at once, measured on the island.
 *
 * Asked for: "Do 3" — a load test on the live project in place of the
 * estimate worked out from a test database. Run by `.github/workflows/load.yml`.
 *
 * Simulated people are rows in `player` on the real island, in country nobody
 * is near, in knots of five (each hears four others, as people in a
 * settlement or on a road do). Each one is its own connection through the
 * pooler, as PostgREST's are, and asks what a browser asks, as often as a
 * browser asks it (`src/net/island.ts`, `src/game/keep.ts`):
 *
 *   every second     the creatures and ground near (`rpc_near`), the whole answer every 20 s and what changed since in between
 *   every second     a step (`rpc_move`), half of them, the walkers
 *   every 4 s        the springs (`rpc_springs`)
 *   every 5 s        what was foraged near (`foraged`)
 *   every 20 s       the roster, what is worn and the pack (`player`, `rpc_worn`, `item`)
 *   every 60 s       the beat (`rpc_settle`)
 *
 * Every one of those is asked as `authenticated` with the person's own claims,
 * inside a transaction that is rolled back: the island does all the work and
 * keeps none of it, so nobody walks a trail into the ground, nothing is paced,
 * nothing is said. The rows themselves are kept awake (`seen_at`) so the
 * island's own clock (`world_tick`, `stock_tick`) works round them as it does
 * round anybody, which is real work on real creatures, as anybody walking
 * there would make.
 *
 * Stepped: so many people for so long, then more. After each step: how long
 * each ask took (on this runner, so with the way there and back in it), how
 * many failed, how much of the database's time went (`pg_stat_statements`),
 * how long the island's clock took (`cron.job_run_details`), and the CPU, when
 * the project's metrics answer. Stops at the first step that is past
 * `MAX_P95_MS` or `MAX_FAILED`, and takes every row it made away, whatever
 * happened, before it stops.
 *
 * Environment:
 *   DB_URL        a connection through the pooler in transaction mode (port 6543); password in PGPASSWORD
 *   ADMIN_URL     the same in session mode, for setting up and measuring (defaults to DB_URL)
 *   ISLAND        the island's name; the longest-lived island with the most people on it when empty
 *   STEPS         people at each step, "10,25,50,75,100,150"
 *   STEP_SECS     how long each step lasts, 120
 *   MAX_P95_MS    the slowest 5% of asks past this ends the test, 1500
 *   MAX_FAILED    this share of asks failing ends the test, 0.02
 *   CORES         the database's CPU cores, for the share of them used, 2
 *   MAX_CPU       the project's CPU this busy ends the test, 0.9
 *   METRICS_URL   the project's Prometheus endpoint, with METRICS_KEY (the service key) to read it
 */
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';

const DB_URL = process.env.DB_URL ?? '';
const ADMIN_URL = process.env.ADMIN_URL || DB_URL;
const STEPS = (process.env.STEPS ?? '10,25,50,75,100,150').split(',').map(Number).filter((n) => n > 0);
const STEP_SECS = Number(process.env.STEP_SECS ?? 120);
const MAX_P95_MS = Number(process.env.MAX_P95_MS ?? 1500);
const MAX_FAILED = Number(process.env.MAX_FAILED ?? 0.02);
const CORES = Number(process.env.CORES ?? 2);
const MAX_CPU = Number(process.env.MAX_CPU ?? 0.9);
const KNOT = 5;
/** Every simulated person's uid starts with this, so the clean-up can find each one and nothing else. */
const UID_HEAD = '10ad7e57-0000-4000-8000-';
const uidOf = (i: number): string => `${UID_HEAD}${String(i).padStart(12, '0')}`;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const lit = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** One question on the setting-up connection, the answer's lines. */
function admin(sql: string): string[] {
  const out = execFileSync('psql', [ADMIN_URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', env: process.env, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').filter((l) => l.length > 0);
}

/* ---- One simulated person: a psql of its own, asked one thing at a time ---- */

type Kind = 'near' | 'near_whole' | 'move' | 'springs' | 'foraged' | 'reconcile' | 'settle';

class Body {
  private proc: ChildProcessWithoutNullStreams;
  private waiting: ((lines: string[]) => void) | null = null;
  private lines: string[] = [];
  private n = 0;
  cs = '';
  gs = '';
  have = '{}';
  stopped = false;

  constructor(readonly uid: string, readonly world: string, readonly x: number, readonly y: number, readonly walker: boolean) {
    this.proc = spawn('psql', [DB_URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=0'], { env: process.env });
    const rl = createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      if (line.startsWith('@@done ')) {
        const w = this.waiting;
        this.waiting = null;
        const got = this.lines;
        this.lines = [];
        w?.(got);
      } else this.lines.push(line);
    });
    // psql's own errors come here: kept with the answer, which is how a failure is counted.
    createInterface({ input: this.proc.stderr }).on('line', (line) => this.lines.push(`ERROR ${line}`));
    this.proc.on('exit', () => {
      this.stopped = true;
      this.waiting?.(['ERROR psql went away']);
    });
  }

  /** One ask, as PostgREST makes it: a transaction of its own, as the person, rolled back. */
  async ask(sql: string): Promise<{ ms: number; lines: string[]; failed: boolean }> {
    if (this.stopped) return { ms: 0, lines: [], failed: true };
    const tag = ++this.n;
    const claims = JSON.stringify({ sub: this.uid, role: 'authenticated' });
    const t0 = performance.now();
    const answer = new Promise<string[]>((r) => { this.waiting = r; });
    this.proc.stdin.write(`begin;\nset local role authenticated;\nselect set_config('request.jwt.claims', ${lit(claims)}, true) \\g /dev/null\n${sql}\nrollback;\n\\echo @@done ${tag}\n`);
    const lines = await answer;
    return { ms: performance.now() - t0, lines, failed: lines.some((l) => l.startsWith('ERROR')) };
  }

  near(whole: boolean): string {
    const w = lit(this.world);
    if (whole) {
      // The whole answer, and the ids it holds for the asks after it (`p_have`), worked out from its packed rows.
      return `select length(j::text) || '|' || coalesce(j->'creatures'->>'at', '') || '|' || coalesce(j->'ground'->>'at', '') || '|' ||
  coalesce((select string_agg(r->>((select i - 1 from jsonb_array_elements_text(j->'creatures'->'cols') with ordinality c(k, i) where k = 'id')::int), ',')
    from jsonb_array_elements(j->'creatures'->'rows') r), '')
from (select rpc_near(${w}, 40, '', '{}', true, 40, true, '') j) q;`;
    }
    return `select length(j::text) || '|' || coalesce(j->'creatures'->>'at', '') || '|' || coalesce(j->'ground'->>'at', '')
from (select rpc_near(${w}, 40, ${lit(this.cs)}, ${lit(this.have)}::int[], true, 40, false, ${lit(this.gs)}) j) q;`;
  }

  step(t: number): string {
    // Back and forth along two tiles, a step a second.
    const dx = Math.sin(t / 4) * 2;
    return `select length(coalesce(rpc_move(${lit(this.world)}, ${(this.x + dx).toFixed(2)}, ${this.y.toFixed(2)}, 0, '[]'::jsonb)::text, ''));`;
  }

  springs(): string {
    return `select length(coalesce(rpc_springs(${lit(this.world)}, 40, '{}'::jsonb)::text, ''));`;
  }

  foraged(): string {
    const x = Math.floor(this.x), y = Math.floor(this.y);
    return `select count(*) from foraged where world_id = ${lit(this.world)} and x between ${x - 40} and ${x + 40} and y between ${y - 40} and ${y + 40} and at > now() - interval '2 days';`;
  }

  reconcile(): string {
    const w = lit(this.world);
    return `select length(coalesce(json_agg(p)::text, '')) from player p where p.world_id = ${w} and p.away = false;
select length(coalesce(rpc_worn(${w})::text, ''));
select count(*) from item where world_id = ${w} and holder in ('player', 'bag') and holder_uid = ${lit(this.uid)};`;
  }

  settle(): string {
    return `select length(coalesce(rpc_settle(p_world => ${lit(this.world)})::text, ''));`;
  }

  close(): void {
    this.stopped = true;
    try {
      this.proc.stdin.end('\\q\n');
    } catch { /* gone already */ }
    setTimeout(() => this.proc.kill('SIGKILL'), 2000).unref();
  }
}

/* ---- What a step measured ---------------------------------------------------- */

const took = new Map<Kind, number[]>();
let asked = 0;
let failed = 0;
const failures: string[] = [];
const note = (kind: Kind, r: { ms: number; lines: string[]; failed: boolean }): void => {
  asked += 1;
  if (r.failed) {
    failed += 1;
    if (failures.length < 12) failures.push(`${kind}: ${r.lines.find((l) => l.startsWith('ERROR')) ?? '?'}`);
    return;
  }
  let list = took.get(kind);
  if (!list) took.set(kind, (list = []));
  list.push(r.ms);
};
const pct = (xs: number[], p: number): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** What a browser asks, as often as it asks it, for as long as `live` says. */
async function live(b: Body, until: () => boolean): Promise<void> {
  const t0 = performance.now() / 1000;
  // Not all at once: a browser's second starts whenever its page did.
  await sleep(Math.random() * 1000);
  let wholeAt = -Infinity, springsAt = -Infinity, foragedAt = -Infinity, reconcileAt = -Infinity, settleAt = performance.now() / 1000;
  while (!until() && !b.stopped) {
    const second = performance.now();
    const t = second / 1000 - t0;
    const now = second / 1000;
    const whole = now - wholeAt >= 20 || !b.cs;
    const r = await b.ask(b.near(whole));
    note(whole ? 'near_whole' : 'near', r);
    if (!r.failed && r.lines[0]) {
      const [, cs, gs, ids] = r.lines[0].split('|');
      b.cs = cs ?? '';
      b.gs = gs ?? '';
      if (whole) {
        wholeAt = now;
        b.have = `{${ids ?? ''}}`;
      }
    }
    if (b.walker) note('move', await b.ask(b.step(t)));
    if (now - springsAt >= 4) { springsAt = now; note('springs', await b.ask(b.springs())); }
    if (now - foragedAt >= 5) { foragedAt = now; note('foraged', await b.ask(b.foraged())); }
    if (now - reconcileAt >= 20) { reconcileAt = now; note('reconcile', await b.ask(b.reconcile())); }
    if (now - settleAt >= 60) { settleAt = now; note('settle', await b.ask(b.settle())); }
    const left = 1000 - (performance.now() - second);
    if (left > 0) await sleep(left);
  }
}

/* ---- The island, the country nobody is near, and the people put there ------- */

function pickIsland(): { id: string; name: string; size: number } {
  const name = process.env.ISLAND ?? '';
  const where = name ? `w.name = ${lit(name)}` : 'w.lasts_until is null';
  const [row] = admin(`select w.id || '|' || w.name || '|' || w.size from world w where ${where}
    order by (select count(*) from player p where p.world_id = w.id) desc limit 1`);
  if (!row) throw new Error(`no island ${name ? `called ${name}` : 'that lasts'}`);
  const [id, n, size] = row.split('|');
  return { id, name: n, size: Number(size) };
}

/**
 * Spots on land at least `FAR` tiles from everybody who has ever stood on the
 * island, from its spawn and from every settlement, one for each knot: on a
 * grid, tried in a shuffled order, each far from the ones already taken too.
 */
function pickSpots(world: string, size: number, knots: number): Array<[number, number]> {
  const FAR = 300;
  const rows = admin(`with g as (
      select x, y from generate_series(64, ${size - 64}, 128) x, generate_series(64, ${size - 64}, 128) y),
    near as (select x::double precision as x, y::double precision as y from player where world_id = ${lit(world)} and uid::text not like ${lit(`${UID_HEAD}%`)}
             union all select spawn_x, spawn_y from world where id = ${lit(world)}
             union all select x::double precision, y::double precision from deed where world_id = ${lit(world)})
    select g.x || ',' || g.y from g
     where centre_height(${lit(world)}, g.x, g.y) >= 2
       and not exists (select 1 from near n where greatest(abs(n.x - g.x), abs(n.y - g.y)) < ${FAR})
     order by md5(g.x || ',' || g.y)`);
  const spots: Array<[number, number]> = [];
  for (const r of rows) {
    const [x, y] = r.split(',').map(Number);
    if (spots.every(([sx, sy]) => Math.max(Math.abs(sx - x), Math.abs(sy - y)) >= 256)) spots.push([x, y]);
    if (spots.length >= knots) break;
  }
  // Fewer far spots than knots: the knots share them, a block apart within each.
  for (let i = 0; spots.length < knots && rows.length; i++) spots.push(spots[i % Math.max(1, spots.length)]);
  return spots;
}

function putPeople(world: string, spots: Array<[number, number]>, n: number): Body[] {
  const bodies: Body[] = [];
  const values: string[] = [];
  for (let i = 0; i < n; i++) {
    const [sx, sy] = spots[Math.floor(i / KNOT) % spots.length];
    // Each knot within ten tiles of its spot; each knot on a shared spot a block over.
    const shift = Math.floor(i / KNOT / spots.length) * 256;
    const x = Math.min(sx + shift + (i % KNOT) * 2 + 0.5, sx + 250), y = sy + ((i % KNOT) % 2) * 3 + 0.5;
    const uid = uidOf(i + 1);
    values.push(`(${lit(world)}, ${lit(uid)}, ${lit(`Load test ${i + 1}`)}, ${x}, ${y}, false, now())`);
    bodies.push(new Body(uid, world, x, y, i % 2 === 0));
  }
  admin(`insert into player (world_id, uid, name, x, y, away, seen_at) values ${values.join(',\n')}
    on conflict (world_id, uid) do update set away = false, seen_at = now(), x = excluded.x, y = excluded.y`);
  return bodies;
}

/** Every row anywhere that names one of the simulated people, gone; and what was taken, said. */
function cleanUp(world: string): string {
  const said = admin(`do $$
declare r record; n bigint; total bigint := 0; said text := '';
begin
  for r in select c.table_schema s, c.table_name t, c.column_name k
             from information_schema.columns c join information_schema.tables tb
               on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
            where c.table_schema in ('public', 'private') and c.data_type = 'uuid'
  loop
    execute format('delete from %I.%I where %I::text like %L', r.s, r.t, r.k, '${UID_HEAD}%');
    get diagnostics n = row_count;
    if n > 0 then total := total + n; said := said || format('%s.%s %s; ', r.s, r.t, n); end if;
  end loop;
  raise notice 'taken away: % rows (%)', total, said;
end $$;
select count(*) from player where uid::text like ${lit(`${UID_HEAD}%`)};`);
  return `simulated people left on the island: ${said[said.length - 1] ?? '?'}`;
}

/** The database's own count of the time it has spent, and asks run, since it was last reset. */
function dbTime(): { ms: number; calls: number } {
  try {
    const [row] = admin(`select coalesce(sum(total_exec_time), 0) || '|' || coalesce(sum(calls), 0) from extensions.pg_stat_statements`);
    const [ms, calls] = row.split('|').map(Number);
    return { ms, calls };
  } catch {
    return { ms: NaN, calls: NaN };
  }
}

/** How long the island's clock took each go during a step, by pg_cron's own log. */
function clockTook(from: Date): string {
  try {
    const rows = admin(`select j.jobname || '|' || count(*) || '|' ||
        round((percentile_cont(0.5) within group (order by extract(epoch from d.end_time - d.start_time) * 1000))::numeric, 1) || '|' ||
        round((percentile_cont(0.95) within group (order by extract(epoch from d.end_time - d.start_time) * 1000))::numeric, 1)
      from cron.job_run_details d join cron.job j on j.jobid = d.jobid
     where d.start_time >= ${lit(from.toISOString())} and d.end_time is not null and j.jobname in ('world-tick', 'stock-tick', 'tree-tick')
     group by j.jobname order by j.jobname`);
    return rows.map((r) => {
      const [job, n, p50, p95] = r.split('|');
      return `${job} ${p50} ms (p95 ${p95}, ${n} goes)`;
    }).join(', ');
  } catch (e) {
    return `(the clock's log: ${String(e).split('\n')[0]})`;
  }
}

/** The CPU the project's metrics say, as a share busy, averaged over the cores; null when they do not answer. */
async function cpuBusy(): Promise<{ busy: number; at: number } | null> {
  const url = process.env.METRICS_URL, key = process.env.METRICS_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`service_role:${key}`).toString('base64')}` } });
    if (!res.ok) return null;
    let idle = 0, all = 0;
    for (const line of (await res.text()).split('\n')) {
      const m = /^node_cpu_seconds_total\{([^}]*)\}\s+([0-9.eE+-]+)/.exec(line);
      if (!m) continue;
      const v = Number(m[2]);
      all += v;
      if (/mode="idle"/.test(m[1])) idle += v;
    }
    return all > 0 ? { busy: all - idle, at: all } : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (!DB_URL) throw new Error('DB_URL is not set');
  const isle = pickIsland();
  const most = Math.max(...STEPS);
  const spots = pickSpots(isle.id, isle.size, Math.ceil(most / KNOT));
  console.log(`island ${isle.name} (${isle.size} tiles); ${spots.length} spots at least 300 tiles from anybody; steps ${STEPS.join(', ')} of ${STEP_SECS} s`);
  if (!spots.length) throw new Error('no country on this island far enough from everybody');
  const report: string[] = ['| People | Asks/s | p50 ms | p95 ms | Failed | DB time/s | DB cores busy | CPU busy | Clock |', '|---|---|---|---|---|---|---|---|---|'];
  const detail: string[] = [];
  let bodies: Body[] = [];
  let stop = false;
  const end = (): void => { stop = true; };
  process.on('SIGINT', end);
  process.on('SIGTERM', end);
  try {
    for (const n of STEPS) {
      if (stop) break;
      for (const b of bodies) b.close();
      await sleep(500);
      took.clear();
      asked = 0;
      failed = 0;
      failures.length = 0;
      bodies = putPeople(isle.id, spots, n);
      // Joined, and a few seconds for every connection to be made before anything is counted.
      await sleep(5000);
      const from = new Date();
      const db0 = dbTime();
      const cpu0 = await cpuBusy();
      const t0 = performance.now();
      const until = (): boolean => stop || performance.now() - t0 >= STEP_SECS * 1000;
      const keepAwake = setInterval(() => {
        try { admin(`update player set seen_at = now(), away = false where uid::text like ${lit(`${UID_HEAD}%`)}`); } catch { /* next time */ }
      }, 60_000);
      await Promise.all(bodies.map((b) => live(b, until)));
      clearInterval(keepAwake);
      const secs = (performance.now() - t0) / 1000;
      const db1 = dbTime();
      const cpu1 = await cpuBusy();
      const all = [...took.values()].flat();
      const p95 = pct(all, 0.95);
      const dbPerSec = (db1.ms - db0.ms) / secs;
      const cpu = cpu0 && cpu1 && cpu1.at > cpu0.at ? (cpu1.busy - cpu0.busy) / (cpu1.at - cpu0.at) : NaN;
      const share = asked ? failed / asked : 0;
      report.push(`| ${n} | ${(asked / secs).toFixed(0)} | ${pct(all, 0.5).toFixed(0)} | ${p95.toFixed(0)} | ${(share * 100).toFixed(1)}% | ${dbPerSec.toFixed(0)} ms | ${(dbPerSec / 1000 / CORES * 100).toFixed(0)}% | ${Number.isNaN(cpu) ? '—' : `${(cpu * 100).toFixed(0)}%`} | ${clockTook(from)} |`);
      detail.push(`${n} people: ${[...took].map(([k, xs]) => `${k} p50 ${pct(xs, 0.5).toFixed(0)} / p95 ${pct(xs, 0.95).toFixed(0)} ms (${xs.length})`).join('; ')}`);
      if (failures.length) detail.push(`  failed, the first of them: ${failures.join(' | ')}`);
      console.log(report[report.length - 1]);
      console.log(detail[detail.length - 1]);
      const why = p95 > MAX_P95_MS ? `p95 ${p95.toFixed(0)} ms is past ${MAX_P95_MS}`
        : share > MAX_FAILED ? `${(share * 100).toFixed(1)}% failed, past ${MAX_FAILED * 100}%`
          : cpu > MAX_CPU ? `CPU ${(cpu * 100).toFixed(0)}% busy, past ${MAX_CPU * 100}%` : '';
      if (why) {
        detail.push(`Stopped after ${n}: ${why}.`);
        console.log(detail[detail.length - 1]);
        break;
      }
    }
  } finally {
    for (const b of bodies) b.close();
    await sleep(1000);
    const left = cleanUp(isle.id);
    console.log(left);
    detail.push(left);
  }
  const out = [`### Load on ${isle.name}`, '', ...report, '', ...detail.map((d) => `- ${d}`)].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`, { flag: 'a' });
  console.log(`\n${out}`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
