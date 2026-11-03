/**
 * Skill gain below ten.
 *
 * Asked for: "faster skill gain below level 10, ×2". This asks, of both sides,
 * that the mark and the multiplier are the browser's (`EARLY_SKILL_BELOW`,
 * `EARLY_SKILL_MUL`); that a go below the mark is worth `EARLY_SKILL_MUL` of
 * the curve's gain; that a go that would carry a skill past the mark with the
 * multiplier ends at it, or at the go's own gain if that is more; that a go at
 * the mark and above is the curve's gain alone; that a raise on the island
 * (`skill_raise`) and one in the browser (`Skills.gain`) come to the same
 * number at every one of those; and that the watch counts the goes a rise took
 * at the rate the rule makes (`watch_goes`).
 *
 * Every raise is seeded (`setseed`), its roll read back off the same seed, and
 * its base chosen on the island for the gain it is to make before the rule, so
 * each case lands in the branch it is there for. Runs against the database the
 * suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Skills, EARLY_SKILL_BELOW, EARLY_SKILL_MUL, earlyGain, playerGain, skillGain } from '../../src/game/skills';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));

/*
 * The raises: the level each starts at and the curve's gain it is to make
 * there, before the rule. Below the mark and clear of it; below it and carried
 * past it doubled, so ending at it; just below it with a gain of its own past
 * it; at it; and above it.
 */
interface Case { what: string; v: number; g: number }
const CASES: Case[] = [
  { what: 'at 1', v: 1, g: 0.3 },
  { what: 'at 5', v: 5, g: 0.4 },
  { what: 'at 9.5, doubled past the mark', v: 9.5, g: 0.4 },
  { what: 'at 9.8, doubled past the mark', v: 9.8, g: 0.15 },
  { what: 'at 9.95, its own gain past the mark', v: 9.95, g: 0.2 },
  { what: `at ${EARLY_SKILL_BELOW}`, v: EARLY_SKILL_BELOW, g: 0.2 },
  { what: 'at 10.5', v: 10.5, g: 0.2 },
  { what: 'at 50', v: 50, g: 0.1 },
];
const GRID: Array<[number, number]> = [[1, 0.5], [9, 0.3], [9, 0.6], [9.9, 0.05], [9.9, 0.2], [10, 0.3], [12, 0.3]];
const RISES: Array<[number, number]> = [[1, 9], [5, 12], [10, 15]];

/* ---- on the island ----------------------------------------------------------------- */

const ROSA = '7e5b0000-0000-4000-8000-0000000004a6';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${ROSA}'; c record; r double precision; m double precision; b double precision; got double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Below ten', 466, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Rosa');
  insert into said values ('NUMBERS', early_skill_below() || '|' || early_skill_mul());
  insert into said select 'GRID', string_agg(early_gain(t.v, t.g)::text, '|' order by t.o)
    from (values ${GRID.map(([v, g], i) => `(${i}, ${v}::double precision, ${g}::double precision)`).join(', ')}) as t(o, v, g);
  insert into said select 'WATCH', string_agg(private.watch_goes(t.a, t.z, 1)::text, '|' order by t.o)
    from (values ${RISES.map(([a, z], i) => `(${i}, ${a}::double precision, ${z}::double precision)`).join(', ')}) as t(o, a, z);
  for c in select * from (values ${CASES.map((k, i) => `(${i}, ${k.v}::double precision, ${k.g}::double precision)`).join(', ')}) as t(i, v, g) order by i loop
    insert into skill (world_id, uid, id, value) values (w, u, 'mining', c.v)
      on conflict (world_id, uid, id) do update set value = excluded.value;
    m := skill_mult(w, u, 'mining') * path_first(w, u, 'mining');
    perform setseed(0.466);
    r := random();
    -- The base that makes the curve's gain \`c.g\` at this roll.
    b := c.g / (skill_room(c.v) * (0.6 + 0.8 * r) * gain_rate() * m);
    perform setseed(0.466);
    got := skill_raise(w, u, 'mining', b);
    insert into said values ('CASE' || c.i, c.v || '|' || b || '|' || m || '|' || r || '|' || got || '|' || skill_standing(w, u, 'mining'));
  end loop;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check(`the mark is ${EARLY_SKILL_BELOW} and the multiplier ${EARLY_SKILL_MUL}, on both sides`, at('NUMBERS') === `${EARLY_SKILL_BELOW}|${EARLY_SKILL_MUL}`, at('NUMBERS'));
const grid = at('GRID').split('|').map(Number);
check('the rule on a gain is the same on both sides, below, across and above the mark (`early_gain`, `earlyGain`)',
  grid.length === GRID.length && GRID.every(([v, g], i) => near(grid[i], earlyGain(v, g))),
  `${grid.join(',')} / ${GRID.map(([v, g]) => earlyGain(v, g)).join(',')}`);

for (const [i, k] of CASES.entries()) {
  const [v, base, mult, r, got, after] = at(`CASE${i}`).split('|').map(Number);
  const roll = 0.6 + 0.8 * r;
  const curve = skillGain(v, base * mult, roll);
  const want = playerGain(v, base * mult, roll);
  // The same go in the browser, at the same roll.
  const s = new Skills();
  s.values.set('mining', v);
  const there = s.gain('mining', base * mult, () => r);
  check(`${k.what}: the island and the browser give the same gain`, near(got, want) && near(there, want),
    `island ${got}, browser ${there}, rule ${want}`);
  check(`${k.what}: the curve's gain is the one asked for`, near(curve, k.g), `${curve} vs ${k.g}`);
  const below = v < EARLY_SKILL_BELOW;
  if (below && v + EARLY_SKILL_MUL * curve <= EARLY_SKILL_BELOW) {
    check(`${k.what}: ×${EARLY_SKILL_MUL}`, near(got, EARLY_SKILL_MUL * curve), `${got} vs ${curve}`);
  } else if (below && v + curve < EARLY_SKILL_BELOW) {
    check(`${k.what}: the doubling stops at ${EARLY_SKILL_BELOW}`, near(after, EARLY_SKILL_BELOW) && got < EARLY_SKILL_MUL * curve && got > curve,
      `${v} + ${got} = ${after}; doubled ${EARLY_SKILL_MUL * curve}`);
  } else {
    check(`${k.what}: the curve's gain alone`, near(got, curve), `${got} vs ${curve}`);
  }
}
check('every branch was asked: doubled, stopped at the mark, and the curve alone below and at the mark',
  CASES.some((k) => k.v + EARLY_SKILL_MUL * k.g <= EARLY_SKILL_BELOW)
  && CASES.some((k) => k.v + EARLY_SKILL_MUL * k.g > EARLY_SKILL_BELOW && k.v + k.g < EARLY_SKILL_BELOW)
  && CASES.some((k) => k.v < EARLY_SKILL_BELOW && k.v + k.g >= EARLY_SKILL_BELOW)
  && CASES.some((k) => k.v === EARLY_SKILL_BELOW));

// The watch's count of goes: sixteen slices, each at its middle, at the best roll, at the rate the rule makes there.
const BEST = 1.4;
const goes = (from: number, to: number): number => {
  let n = 0;
  for (let k = 0; k < 16; k++) {
    const mid = from + ((to - from) * (k + 0.5)) / 16;
    n += (to - from) / 16 / (skillGain(mid, 1, BEST) * (mid < EARLY_SKILL_BELOW ? EARLY_SKILL_MUL : 1));
  }
  return n;
};
const watch = at('WATCH').split('|').map(Number);
check('the watch counts the goes a rise took at the rate below the mark and above it, as the rule makes them',
  watch.length === RISES.length && RISES.every(([a, z], i) => Math.abs(watch[i] - goes(a, z)) <= 1e-9 * goes(a, z)),
  `${watch.join(',')} / ${RISES.map(([a, z]) => goes(a, z)).join(',')}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nskill gain below ${EARLY_SKILL_BELOW} — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
