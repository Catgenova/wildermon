/**
 * Every trade takes about as long to evolve.
 *
 * Asked for: "Even out the time to evolve across trades". A deed worker learns its level skill on the curve a player
 * does, a gain a go, but a go comes round at its own rate in each trade: a mender stands at the stores, a water
 * carrier fills at the shore and pours at the barrel for every gain, a kind that learns by being out gains every
 * `OUT_EVERY`. `LEARN_PACE` multiplies each trade's gains so that its minutes from level 1 to the first of `EVOLVE_AT`
 * and from there to the second come near the median trade's.
 *
 * The measuring is here, so that it can be done again. It is a model of each trade's go on the island, which runs the
 * live world, step by step as `worker_settle` takes it (`errand_step`, `errand_do`, `worker_do`): the walk to where it
 * works at its kind's pace (`stepToward`, the island's `pace`), `workDuration` at its stage, the second the island
 * rests after every go and the half second after a fetch, which steps teach and what, and for a trade that walks a
 * load home, the share of its goes that bring one; and its rest, `REST_FOR` after every `TIRE_GOES` goes, which is the
 * same for every trade a go and so is spread over its goes, a `TIRE_GOES`th of it on each (a go being what the ledger
 * counts: every step of a trade's round but a fetch out of the stores). With no bed, as the factors are worked out;
 * `--table` also gives the minutes with a bed of its size on the settlement (`BED_REST`). It assumes a typical deed: the stores at the token, the ground a
 * trade works `FIELD` tiles out and the next tile of it `NEXT` on, a piece of yours (a fire, a press, a barrel, a
 * lantern, a planter, one of your wildermon) `NEAR` from the stores, and the water `SHORE` from the barrels; a worker
 * kept (care full), with no traits, grown, fed, and with all it needs to work on at hand. A kind with no trade: out
 * all the time, out after dark at the share of the day that is night, tended by a Sheela each time its fleece is
 * `DAIRY_FULL` back, sparred with by somebody swinging the median weapon at 20, and pulling a large cart alone, fed,
 * with a driver of no skill.
 *
 * Checked: each trade's factor is what this model makes of it, to within `DRIFT`; and with it, each trade's minutes
 * to the first stage and to the second are within `WITHIN` of the median's, unless its factor is held at
 * `LEARN_PACE_LEAST` or `LEARN_PACE_MOST`. And on both sides: the island's `learn_pace_def` is `LEARN_PACE`, its
 * `learn_pace` multiplies the same skill for the same trade as `learnPace`, and a gain at the same roll comes out the
 * same in the browser's `gainSkill` and the island's `worker_learn`.
 *
 *   --table  prints the minutes, before and after, as a table, and each trade's minutes with no rest at all (the rules
 *            before rest), resting where it stands, and resting in a bed.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import {
  CARE_BONUS, DAIRY_FULL, EVOLVE_AT, footing, LEARN_PACE, LEARN_PACE_LEAST, LEARN_PACE_MOST, learnPace,
  LEARNS_GAIN, OUT_EVERY, PULL_LEARN, restFor, SPECIES, STAGE_LOADS, STAGE_MUL, TIRE_GOES, workDuration, type GatherKind, type LearnsBy,
} from '../../src/game/creatures';
import { skillGain } from '../../src/game/skills';
import { TREE_AGES } from '../../src/world/tiles';
import { RIPE } from '../../src/game/farming';
import { findChance } from '../../src/game/archaeology';
import { panFind } from '../../src/game/creatures';
import { NIGHT_ENDS, NIGHT_STARTS } from '../../src/game/game';
import { WEAPONS } from '../../src/game/gear';
import { swingSeconds } from '../../src/game/fight';
import { MAX_VEHICLE_SPEED } from '../../src/game/game';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the model ------------------------------------------------------------------------------------------------- */

/** The typical deed, in tiles: stores to the ground a trade works; one tile of it to the next; stores to a piece of yours; to the water. */
const FIELD = 5;
const NEXT = 1.5;
const NEAR = 3;
const SHORE = 6;
/** What the island's `worker_settle` adds after a go at work, and after a fetch out of the stores. */
const REST = 1;
const FETCH = 0.5;
/** A worker kept: its care full. */
const CARE = 1 + CARE_BONUS;
/** How far a trade's factor may be from what the model makes of it now, and each trade's minutes from the median's. */
const DRIFT = 0.05;
const WITHIN = 0.35;

/**
 * A step of a trade's go: seconds, the base of what it teaches (nought for a step that teaches nothing), and whether it
 * is a go its stamina pays for (`TIRE_GOES`): every step a trade worked on a deed counts to its ledger, which is every
 * one but a fetch out of the stores, and none of a kind with no trade's.
 */
type Step = { secs: number; base: number; go?: boolean };
/** How it rests: not at all (the rules before rest), where it stands, or in a bed of its size. */
type Rest = 'none' | 'stands' | 'bed';
/** A go's share of its rest. */
const restPerGo = (rest: Rest): number => (rest === 'none' ? 0 : restFor(rest === 'bed') / TIRE_GOES);
/** At a skill and a stage, with so many loads a trip: the steps of one round of the trade. */
type Round = (skill: number, stage: number, loads: number) => Step[];

const W = STAGE_MUL.work ?? 1;
const S = STAGE_MUL.speed ?? 1;
const G = STAGE_MUL.grow ?? 1;
/** The kind that works each trade, or learns each way: its pace, and whether it evolves. */
const kindOf = (at: GatherKind | LearnsBy): string => {
  const all = Object.values(SPECIES).filter((d) => d.gathers === at || (!d.gathers && d.learns?.by === at));
  return (all.find((d) => d.stages) ?? all[0])?.id ?? 'rabba';
};
const work = (skill: number, stage: number): number => workDuration(skill) / (CARE * W ** stage);
const walk = (at: GatherKind | LearnsBy, tiles: number, skill: number, stage: number): number =>
  tiles / (SPECIES[kindOf(at)].speed * S ** stage * (1 + Math.max(1, skill) / 500));

/**
 * A trade that walks out to a tile, works it and carries a load home (`worker_settle`'s own round, `worker_do`): a
 * go is the walk to the tile, the work and the rest. `p` of its goes bring a load; with room for another it walks on
 * to the next tile, `NEXT`, and with its arms full it walks home and out again, twice `FIELD`. A go that brings
 * nothing walks `idle` to the next (nought where it works the same tile or tree again).
 */
const gathers = (at: GatherKind, base: number, p: (skill: number) => number, idle = NEXT, next = NEXT): Round =>
  (skill, stage, loads) => {
    const q = p(skill);
    const tiles = q * ((2 * FIELD) / loads + (1 - 1 / loads) * next) + (1 - q) * idle;
    return [{ secs: walk(at, tiles, skill, stage) + work(skill, stage) + REST, base, go: true }];
  };
/** An errand: steps that walk so far and work (a go, then the rest) or fetch (half a second), each teaching its base. */
const errand = (at: GatherKind, steps: Array<[tiles: number | ((skill: number) => number), how: 'work' | 'fetch', base: number]>): Round =>
  (skill, stage) => steps.map(([tiles, how, base]) => ({
    secs: walk(at, typeof tiles === 'number' ? tiles : tiles(skill), skill, stage) + (how === 'work' ? work(skill, stage) + REST : FETCH),
    base,
    go: how === 'work',
  }));
/** A kind with no trade: a go every so many seconds. */
const every = (secs: (skill: number, stage: number) => number, base: number): Round => (skill, stage) => [{ secs: secs(skill, stage), base }];

const forageChance = (skill: number): number => 0.8 * Math.min(0.98, Math.max(0.3, 0.6 + (skill / 100) * 0.38 - 5 / 150));
const MEDIAN_SWING = [...WEAPONS].map((w) => w.swing).sort((a, b) => a - b)[Math.floor(WEAPONS.length / 2)];
const NIGHT = (24 - NIGHT_STARTS + NIGHT_ENDS) / 24;
const rox = SPECIES.roxxen;
const towing = (skill: number, stage: number): number =>
  Math.min(MAX_VEHICLE_SPEED, rox.speed * S ** stage * (0.75 + (rox.pull ?? 0)) * footing(skill));

/** Every trade and every way of learning, as the island takes it; a keeping watch and a hunt are left out (`LEARN_PACE`). */
const ROUNDS: Partial<Record<GatherKind | LearnsBy, Round>> = {
  forage: gathers('forage', 0.225, forageChance),
  botanize: gathers('botanize', 0.225, forageChance),
  // A swing at the tree, its bites a mature tree's, the log home when it falls.
  woodcut: gathers('woodcut', 0.225, () => 1 / TREE_AGES[1].hits, 0),
  // Sown, tended once a stage until it is ripe, and harvested: the harvest is the load.
  farm: gathers('farm', 0.225, () => 1 / (RIPE + 2)),
  mine: gathers('mine', 0.225, () => 1, NEXT, 0),
  quarry: gathers('quarry', 0.225, () => 1, NEXT, 0),
  sand: gathers('sand', 0.225, () => 1, NEXT, 0),
  clay: gathers('clay', 0.225, () => 1, NEXT, 0),
  peat: gathers('peat', 0.225, () => 1),
  reed: gathers('reed', 0.225, () => 1),
  fetch: gathers('fetch', 0.225, () => 1),
  compost: gathers('compost', 0.225, () => 1),
  fruit: gathers('fruit', 0.225, () => 1),
  bush: gathers('bush', 0.225, () => 1),
  grass: gathers('grass', 0.225, () => 1),
  sprout: gathers('sprout', 0.225, () => 1),
  resin: gathers('resin', 0.225, () => 1),
  flower: gathers('flower', 0.225, () => 1),
  // Now and again none turned up.
  worm: gathers('worm', 0.225, () => 2 / 3),
  fish: gathers('fish', 0.225, (s) => Math.min(0.9, 0.3 + s / 190)),
  seek: gathers('seek', 0.225, (s) => findChance(s, 30)),
  // A pan comes up empty where it stands and is dipped again.
  pan: gathers('pan', 0.225, panFind, 0, 0),
  prune: gathers('prune', 0.225, () => 0),
  stump: gathers('stump', 0.225, () => 0),
  scrub: gathers('scrub', 0.225, () => 0),
  hive: gathers('hive', 0.225, () => 0, 0),
  // At the stores, one thing after another where it stands.
  mend: errand('mend', [[0, 'work', 0.2]]),
  butcher: errand('butcher', [[0, 'work', 0.3]]),
  restore: errand('restore', [[0, 'work', 0.3]]),
  glaze: errand('glaze', [[0, 'work', 0.2]]),
  tan: errand('tan', [[0, 'work', 0.25]]),
  mill: errand('mill', [[0, 'work', 0.25]]),
  saw: errand('saw', [[0, 'work', 0.25]]),
  chisel: errand('chisel', [[0, 'work', 0.25]]),
  brick: errand('brick', [[0, 'work', 0.25]]),
  rope: errand('rope', [[0, 'work', 0.25]]),
  fletch: errand('fletch', [[0, 'work', 0.25]]),
  // At a fire or a press of yours, its makings out of the stores where they are.
  cook: errand('cook', [[0, 'work', 0.25]]),
  paper: errand('paper', [[0, 'work', 0.25]]),
  // A hearth raked, and the ashes leached into lye at the stores.
  ash: errand('ash', [[NEAR, 'work', 0.2], [NEAR, 'work', 0.25]]),
  // A barrel set going, and on to the next.
  brew: errand('brew', [[NEXT, 'work', 0.3]]),
  // One of yours brushed or shorn, and on to the next; a dressing out of the stores before each hurt.
  groom: errand('groom', [[NEAR, 'work', 0.25]]),
  dairy: errand('dairy', [[NEAR, 'work', 0.25]]),
  heal: errand('heal', [[NEAR, 'work', 0], [NEAR, 'work', 0.25]]),
  // A candle out of the stores, and into a lantern.
  lamp: errand('lamp', [[NEAR, 'work', 0], [NEAR, 'work', 0.2]]),
  // What a furnace made, out; what it takes, fetched; and put in.
  smelt: errand('smelt', [[NEAR, 'work', 0.25], [NEAR, 'work', 0], [NEAR, 'work', 0.25]]),
  kiln: errand('kiln', [[NEAR, 'work', 0.25], [NEAR, 'work', 0], [NEAR, 'work', 0.25]]),
  // A seed out of the stores, sown, tended once a stage, and harvested.
  patch: errand('patch', [[NEAR, 'work', 0], [NEAR, 'work', 0.25], ...Array.from({ length: RIPE }, () => [NEXT, 'work', 0.25] as [number, 'work', number]), [0, 'work', 0.25]]),
  // An empty bucket out of the stores, filled at the water, and put back.
  fill: errand('fill', [[0, 'work', 0], [SHORE, 'work', 0.2], [SHORE, 'work', 0]]),
  // Filled at the water, and poured into a barrel.
  water: errand('water', [[SHORE, 'work', 0], [SHORE, 'work', 0.2]]),
  // Fetched out of the stores, and fitted, or fed to a hearth, or planted.
  hod: errand('hod', [[FIELD, 'fetch', 0], [FIELD, 'work', 0.25]]),
  stoke: errand('stoke', [[NEAR, 'fetch', 0], [NEAR, 'work', 0.2]]),
  plant: errand('plant', [[FIELD, 'fetch', 0], [FIELD, 'work', 0.25]]),
  // The ground read round it, and on past what it read.
  prospect: errand('prospect', [[(s) => 3 + Math.floor(s / 20), 'work', 0.22]]),
  out: every(() => OUT_EVERY, LEARNS_GAIN.out),
  dark: every(() => OUT_EVERY / NIGHT, LEARNS_GAIN.dark),
  tended: every((_s, stage) => DAIRY_FULL / ((SPECIES[kindOf('tended')].fleece ?? 1) * G ** stage), LEARNS_GAIN.tended),
  spar: every((s) => swingSeconds(MEDIAN_SWING, 20), LEARNS_GAIN.spar),
  pull: every((s, stage) => 1 / towing(s, stage), PULL_LEARN),
};
const MEASURED = Object.keys(ROUNDS) as Array<GatherKind | LearnsBy>;
/** Whether the kind that works it evolves, and so works at its stage, and carries its stage's loads, past the first. */
const evolves = (at: GatherKind | LearnsBy): boolean => !!SPECIES[kindOf(at)].stages;
/** The loads a trip at a stage: its stage's for a kind that evolves now, one before there were stages that carried more. */
const loadsAt = (at: GatherKind | LearnsBy, stage: number, now: boolean): number => (now && evolves(at) ? STAGE_LOADS[stage] : 1);

/** Minutes from one level to another, round after round at the mean of the roll, at this pace, resting so. */
function minutes(at: GatherKind | LearnsBy, from: number, to: number, pace: number, now: boolean, rest: Rest = 'stands'): number {
  const round = ROUNDS[at]!;
  const stage = evolves(at) && from >= EVOLVE_AT[0] ? 1 : 0;
  let v = from;
  let t = 0;
  for (let n = 0; v < to && n < 1e7; n++) {
    const steps = round(v, stage, loadsAt(at, stage, now));
    for (const s of steps) t += s.secs + (s.go ? restPerGo(rest) : 0);
    for (const s of steps) if (s.base > 0) v += skillGain(v, s.base * CARE * pace, 1);
  }
  return t / 60;
}

type Row = { at: GatherKind | LearnsBy; before: [number, number]; plain: [number, number]; after: [number, number]; derived: number };
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const span = (at: GatherKind | LearnsBy, pace: number, now: boolean, rest: Rest = 'stands'): [number, number] =>
  [minutes(at, 1, EVOLVE_AT[0], pace, now, rest), minutes(at, EVOLVE_AT[0], EVOLVE_AT[1], pace, now, rest)];
// Before: the rules as they were, every trade at 1 and a load a trip. The mark: the median trade then.
const before = new Map(MEASURED.map((at) => [at, span(at, 1, false)]));
const MARK: [number, number] = [median(MEASURED.map((at) => before.get(at)![0])), median(MEASURED.map((at) => before.get(at)![1]))];
const ROWS: Row[] = MEASURED.map((at) => {
  // The rules as they are now, at 1: what the factor is worked out from.
  const plain = span(at, 1, true);
  const derived = Math.min(LEARN_PACE_MOST, Math.max(LEARN_PACE_LEAST, Math.sqrt((plain[0] / MARK[0]) * (plain[1] / MARK[1]))));
  return { at, before: before.get(at)!, plain, after: span(at, LEARN_PACE[at], true), derived };
});

if (process.argv.includes('--table')) {
  const f = (m: number): string => (m >= 600 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);
  console.log(`Mark (median trade, before): ${f(MARK[0])} to level ${EVOLVE_AT[0]}, ${f(MARK[1])} from ${EVOLVE_AT[0]} to ${EVOLVE_AT[1]}.\n`);
  console.log(`| Trade | Kind | Before: 1–${EVOLVE_AT[0]} | Before: ${EVOLVE_AT[0]}–${EVOLVE_AT[1]} | vs mark | Derived | LEARN_PACE | After: 1–${EVOLVE_AT[0]} | After: ${EVOLVE_AT[0]}–${EVOLVE_AT[1]} |`);
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of [...ROWS].sort((a, b) => a.derived - b.derived)) {
    const vs = Math.sqrt((r.before[0] / MARK[0]) * (r.before[1] / MARK[1]));
    console.log(`| ${r.at} | ${SPECIES[kindOf(r.at)].name}${evolves(r.at) ? ' (evolves)' : ''} | ${f(r.before[0])} | ${f(r.before[1])} | ×${vs.toFixed(2)} | ${r.derived.toFixed(2)} | ${LEARN_PACE[r.at]} | ${f(r.after[0])} | ${f(r.after[1])} |`);
  }
  const none = MEASURED.map((at) => span(at, 1, false, 'none'));
  console.log(`\nThe mark with no rest at all, as it was: ${f(median(none.map((m) => m[0])))} and ${f(median(none.map((m) => m[1])))}.`);
  console.log(`\nEach trade at its factor: with no rest (the rules before rest), resting where it stands, and resting in a bed of its size:\n`);
  console.log(`| Trade | No rest: 1–${EVOLVE_AT[0]} | ${EVOLVE_AT[0]}–${EVOLVE_AT[1]} | Rest: 1–${EVOLVE_AT[0]} | ${EVOLVE_AT[0]}–${EVOLVE_AT[1]} | Bed: 1–${EVOLVE_AT[0]} | ${EVOLVE_AT[0]}–${EVOLVE_AT[1]} |`);
  console.log('|---|---|---|---|---|---|---|');
  for (const at of MEASURED) {
    const [n, r, b] = (['none', 'stands', 'bed'] as const).map((how) => span(at, LEARN_PACE[at], true, how));
    console.log(`| ${at} | ${f(n[0])} | ${f(n[1])} | ${f(r[0])} | ${f(r[1])} | ${f(b[0])} | ${f(b[1])} |`);
  }
  console.log('\nDerived, for the table in creatures.ts:');
  console.log(MEASURED.map((at) => `${at}: ${+ROWS.find((r) => r.at === at)!.derived.toFixed(2)}`).join(', '));
}

for (const r of ROWS) {
  check(`${r.at}: its factor is what its measured go rate makes of it (${r.derived.toFixed(2)})`,
    Math.abs(LEARN_PACE[r.at] - r.derived) <= DRIFT * r.derived, `${LEARN_PACE[r.at]}`);
  const held = r.derived <= LEARN_PACE_LEAST || r.derived >= LEARN_PACE_MOST;
  const near = r.after.every((m, i) => Math.abs(m / MARK[i] - 1) <= WITHIN);
  check(`${r.at}: ${held ? `held at ${r.derived}, as far toward the mark as it may go` : `to level ${EVOLVE_AT[0]} and on to ${EVOLVE_AT[1]} within ${WITHIN * 100}% of the median trade's`}`,
    held ? Math.abs(r.after[0] / MARK[0] - 1) < Math.abs(r.before[0] / MARK[0] - 1) || near : near,
    `${r.after.map((m) => Math.round(m)).join(' and ')} minutes against ${MARK.map((m) => Math.round(m)).join(' and ')}`);
}
check('every trade and way of learning is measured but a keeping watch and a hunt, which are 1',
  (Object.keys(LEARN_PACE) as Array<GatherKind | LearnsBy>).every((at) => MEASURED.includes(at) || ((at === 'guard' || at === 'hunt') && LEARN_PACE[at] === 1)),
  (Object.keys(LEARN_PACE) as Array<GatherKind | LearnsBy>).filter((at) => !MEASURED.includes(at)).join(', '));

/* ---- the same on both sides ------------------------------------------------------------------------------------ */

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

const table = new Map(psql('select id || \'=\' || pace from learn_pace_def order by id').split('\n').filter(Boolean)
  .map((l) => l.split('=') as [string, string]).map(([k, v]) => [k, Number(v)]));
check('the island\'s learn_pace_def is LEARN_PACE, every trade and way of learning',
  Object.entries(LEARN_PACE).every(([k, v]) => Math.abs((table.get(k) ?? NaN) - v) < 1e-6) && table.size === Object.keys(LEARN_PACE).length,
  Object.entries(LEARN_PACE).filter(([k, v]) => Math.abs((table.get(k) ?? NaN) - v) >= 1e-6).map(([k, v]) => `${k} ${v}/${table.get(k)}`).join(', '));

// A few kinds, each asked about its own level skill and another: the factor on both sides, and a gain at the same roll.
const CASES: Array<[species: string, skill: string]> = [
  ['tinka', 'repair'], ['tinka', 'foraging'], ['holla', 'carrying'], ['sedra', 'foraging'], ['cobbe', 'masonry'], ['magga', 'foraging'],
  ['warda', 'awareness'], ['lume', 'awareness'], ['woola', 'animal_husbandry'], ['roxxen', 'driving'], ['roxxen', 'climbing'],
  ['sparra', 'fighting'], ['ulva', 'body_strength'], ['embra', 'smelting'], ['crawler', 'digging'],
];
const MIRA = '7e5b0000-0000-4000-8000-0000000000e1';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; c creature; g double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Learn', 177, 20, 8, 8, true) returning id into w;
  perform land_blank(w, 20);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  ${CASES.map(([sp, skill], i) => `
  a := creature_spawn(w, '${sp}', 9, 8.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, skills = skills || jsonb_build_object('${skill}', 10) where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  perform setseed(0.25);
  g := worker_learn(w, a, '${skill}', 0.2);
  insert into said values ('CASE${i}', learn_pace(c, '${skill}') || '|' || g);`).join('')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const roll = Number(psql('select setseed(0.25); select 0.6 + 0.8 * random();').split('\n').pop());
CASES.forEach(([sp, skill], i) => {
  const [pace, gain] = (isle.get(`CASE${i}`) ?? '|').split('|').map(Number);
  const mine = learnPace({ species: sp, trade: null }, skill);
  const want = skillGain(10, 0.2 * mine, roll);
  check(`a ${SPECIES[sp].name}'s ${skill} is learned at ${mine} on both sides, and a gain at the same roll is the same`,
    Math.abs(pace - mine) < 1e-9 && Math.abs(gain - want) < 1e-9, `island ${pace} ${gain}, browser ${mine} ${want}`);
});

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nlearning evened out across trades — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
