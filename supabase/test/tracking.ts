/**
 * Tracking: a go of Track from the field guide reads the way to the nearest wild one of a kind.
 *
 * Asked for: "Add a tracking skill. Players can click a Track button in the field guide to cast a tracking action. The
 * action directs towards the nearest of that species, with directions becoming more accurate and specific with a
 * higher tracking level. Can only track discovered wildermon". This asks, of both sides:
 *
 *   * that the skill and the job are there, the job hidden from a tile's menu and in the Naturalist's trade;
 *   * that a kind not marked seen, a monster and no kind at all are refused, in the same words;
 *   * that the nearest wild one of the kind is found, past a kept one and a nearer one of another kind, and that one
 *     out of reach is not: "no sign within" the reach;
 *   * that the reach, the spread and the band are the same at every level on both sides, and the reading and its line
 *     the same over a grid of bearings, distances, levels and rolls;
 *   * that each band says the way and the distance exactly as finely as it should, with the roll forced to nought
 *     error and to either end of it;
 *   * that a go trains Tracking, a full go when it finds one and `TRY_LEARN` of one when it does not;
 *   * that a go asked through `rpc_act` takes its time and is read when the clock settles it, arrow and all;
 *   * and that the field guide offers Track on a seen wildermon's page and on nothing else.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { CRAFT_CLASSES } from '../../src/game/classes';
import { CULL_RANGE, SPECIES } from '../../src/game/creatures';
import { TRY_LEARN } from '../../src/game/learn';
import { ACTION_FLOOR } from '../../src/game/pace';
import { SKILL_BY_ID, SKILL_TOP } from '../../src/game/skills';
import {
  TRACK, TRACK_BANDS, TRACK_ERR_LEAST, TRACK_ERR_MOST, TRACK_FAR, TRACK_RANGE_BASE, TRACK_RANGE_PER, TRACK_TIME, TRACKING,
  trackable, trackBand, trackedArrow, trackErr, trackingSays, trackRange, trackReading, trackRefusal, trackSaid, trackTarget,
  type Trail, type TrackReading,
} from '../../src/game/tracking';

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

const KIND = 'sedra';
const DEF = SPECIES[KIND];
const OTHER = 'rabba';
const MONSTER = Object.values(SPECIES).find((d) => d.monster)!;
const [STAGE1, STAGE2] = DEF.stages!.map((s) => s.name);

/*
 * The ground, the same on both sides, round where you stand (P): a kept one of the kind and a wild one of another kind
 * nearer than anything, the wild one tracked (A) twenty-six tiles out at a bearing of about 67°, another (B) fifty
 * out, and one (C) a hundred and ten due south that only a reach of more than that finds once A and B are gone.
 */
const P = { x: 20.5, y: 20.5 };
const AT = {
  kept: [3, 0], other: [0, -2], A: [24, -10], B: [-40, 30], C: [0, 110],
} as const;

/** The goes, each at a Tracking, a roll, A's level and which of A, B and C are out in the wild. */
interface Go { name: string; skill: number; roll: number; aLevel: number; wild: Array<'A' | 'B' | 'C'> }
const GOES: Go[] = [
  { name: 'low', skill: 10.5, roll: 0.5, aLevel: 3, wild: ['A', 'B'] },
  { name: 'eight', skill: 35, roll: 0.5, aLevel: 3, wild: ['A', 'B'] },
  { name: 'sixteen', skill: 60, roll: 0.5, aLevel: 30, wild: ['A', 'B'] },
  { name: 'degree', skill: 90, roll: 0.5, aLevel: 54, wild: ['A', 'B'] },
  { name: 'degree_low', skill: 90, roll: 0, aLevel: 54, wild: ['A', 'B'] },
  { name: 'degree_high', skill: 90, roll: 0.9999999, aLevel: 54, wild: ['A', 'B'] },
  { name: 'nosign', skill: 1, roll: 0.5, aLevel: 3, wild: ['C'] },
  { name: 'south', skill: 3, roll: 0.5, aLevel: 3, wild: ['C'] },
];

/* ---- the grid the pure rule is held to on both sides ------------------------------------------------------- */

const LEVELS = Array.from({ length: SKILL_TOP + 1 }, (_, i) => i);
const GRID_LEVELS = [0, 1, 10, 19, 20, 35, 49, 50, 65, 79, 80, 91, 92, 100];
const BEARINGS = [0, 10, 44, 46, 67.38, 89.9, 180, 271, 359.7];
const DISTS = [3, 24, 26, 149, 151, 333];
const ROLLS = [0, 0.5, 0.9999999];
const grid = GRID_LEVELS.flatMap((l) => BEARINGS.flatMap((b) => DISTS.flatMap((d) => ROLLS.map((r) => [l, b, d, r] as const))));
const readSays = (r: TrackReading): string => `${r.band}|${r.way}|${r.bearing}|${r.far}|${r.tiles ?? '-'}`;

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-0000000000c1';
const at = (k: keyof typeof AT): string => `${P.x + AT[k][0]}, ${P.y + AT[k][1]}`;
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table grid (n int, l int, b double precision, d double precision, r double precision);
insert into grid values ${grid.map(([l, b, d, r], n) => `(${n}, ${l}, ${b}, ${d}, ${r})`).join(', ')};
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
begin
  return current_setting('wurm.dice')::double precision;
end $f$;
do $t$
declare w uuid; u uuid := '${U}'; v_kept int; v_other int; v_a int; v_b int; v_c int; v_n bigint; v_was double precision; j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Trails', 224, 64, 20, 20, true) returning id into w;
  perform land_blank(w, 64);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 63) x, generate_series(0, 63) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Tracker');
  update player set x = ${P.x}, y = ${P.y} where world_id = w and uid = u;

  insert into said select 'SKILL', name || '|' || start from skill_def where id = tracking_skill();
  insert into said select 'ACTION', label || '|' || verb || '|' || coalesce(skill, '-') || '|' || act_ported('${TRACK}') from action_def where id = '${TRACK}';
  insert into said select 'CLASS', string_agg(class, ',') from class_skill where skill = tracking_skill();
  insert into said select 'INDEX', count(*)::text from pg_indexes where tablename = 'creature' and indexname = 'creature_wild_kind';
  insert into said select 'FORMULA', string_agg(track_range(l) || ':' || track_err(l) || ':' || track_band(l), ',' order by l) from generate_series(0, ${SKILL_TOP}) l;
  insert into said select 'GRID', string_agg(n || '#' || (rd->>'band') || '|' || (rd->>'way') || '|' || (rd->>'bearing') || '|' || (rd->>'far') || '|'
      || coalesce(rd->>'tiles', '-') || '#' || track_said('${DEF.name}', track_range(l), '${STAGE1}', 54, n % 2 = 0, rd), '~' order by n)
    from (select n, l, track_reading(l, b, d, r) as rd from grid) g;
  insert into said select 'NOSIGN', track_said('${DEF.name}', 140, null, null, null, null);

  v_kept := creature_spawn(w, '${KIND}', ${at('kept')}, 'active', now() - interval '30 days', u);
  v_other := creature_spawn(w, '${OTHER}', ${at('other')}, 'wild', now() - interval '30 days', null);
  v_a := creature_spawn(w, '${KIND}', ${at('A')}, 'wild', now() - interval '30 days', null);
  v_b := creature_spawn(w, '${KIND}', ${at('B')}, 'wild', now() - interval '30 days', null);
  v_c := creature_spawn(w, '${KIND}', ${at('C')}, 'wild', now() - interval '30 days', null);

  -- Refused: a kind not seen, a monster, and no kind at all; then seen.
  insert into said values ('UNSEEN', coalesce(track_refusal(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', '${KIND}')), '-'));
  insert into said values ('MONSTER', coalesce(track_refusal(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', '${MONSTER.id}')), '-'));
  insert into said values ('NOKIND', coalesce(track_refusal(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', 'nope')), '-'));
  insert into said values ('ACTUNSEEN', (rpc_act(w, '${TRACK}', jsonb_build_object('kind', 'tile', 'x', 20, 'y', 20, 'cx', 20, 'cy', 20, 'species', '${OTHER}')))::text);
  perform guide_mark(w, u, '${KIND}', 'seen');
  insert into said values ('SEEN', coalesce(track_refusal(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', '${KIND}')), '-'));

  perform set_config('search_path', 'dice, public, pg_catalog', true);
${GOES.map((g) => `
  perform set_config('wurm.dice', '${g.roll}', true);
  insert into skill (world_id, uid, id, value) values (w, u, tracking_skill(), ${g.skill})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  update creature set mode = case when id = any(array[${g.wild.map((k) => `v_${k.toLowerCase()}`).join(', ')}]::int[]) then 'wild' else 'deed' end,
         skills = case when id = v_a then jsonb_build_object('foraging', ${g.aLevel}) else skills end
   where world_id = w and id in (v_a, v_b, v_c);
  select coalesce(max(n), 0) into v_n from event where world_id = w and uid = u;
  perform perform_track(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'x', 20, 'y', 20, 'cx', 20, 'cy', 20, 'species', '${KIND}'));
  insert into said values ('GO_${g.name}', coalesce((select text from event where world_id = w and uid = u and n > v_n and kind = 'event'
    and text not like '%increased by%' order by n limit 1), '-'));
  insert into said values ('ARROW_${g.name}', coalesce((select text from event where world_id = w and uid = u and n > v_n and kind = 'tracked'), '-'));`).join('\n')}

  -- What a go teaches, the luck forced the same: a full go found, try_learn of one not.
  perform set_config('wurm.dice', '0.5', true);
  update creature set mode = 'deed' where world_id = w and id in (v_a, v_b, v_c);
  update skill set value = 10.5 where world_id = w and uid = u and id = tracking_skill();
  perform perform_track(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', '${KIND}'));
  insert into said select 'GAIN_NONE', (value - 10.5)::text from skill where world_id = w and uid = u and id = tracking_skill();
  update creature set mode = 'wild' where world_id = w and id = v_a;
  update skill set value = 10.5 where world_id = w and uid = u and id = tracking_skill();
  perform perform_track(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', '${KIND}'));
  insert into said select 'GAIN_FOUND', (value - 10.5)::text from skill where world_id = w and uid = u and id = tracking_skill();

  -- Through the door: it starts, takes its time, and is read when the clock settles it.
  update skill set value = 10.5 where world_id = w and uid = u and id = tracking_skill();
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null, act_goes = null, act_queue = '[]'::jsonb
   where world_id = w and uid = u;
  j := rpc_act(w, '${TRACK}', jsonb_build_object('kind', 'tile', 'x', 20, 'y', 20, 'cx', 20, 'cy', 20, 'species', '${KIND}'));
  insert into said values ('ACT', (j->>'started') || '|' || (j->>'seconds') || '|' || action_floor());
  select coalesce(max(n), 0) into v_n from event where world_id = w and uid = u;
  update player set act_started = now() - interval '1 minute', act_ends = now() - interval '1 second' where world_id = w and uid = u;
  perform settle(w, u);
  insert into said values ('SETTLED', coalesce((select string_agg(kind || ':' || text, ' / ' order by n) from event
    where world_id = w and uid = u and n > v_n and kind in ('event', 'tracked') and text not like '%increased by%'), '-'));
  perform set_config('search_path', '"$user", public', true);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ------------------------------------------------------------------------------------------- */

const g = Game.create(2240);
const track = ACTION_BY_ID.get(TRACK)!;
const clear = (): void => {
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
};
clear();
g.player.x = P.x;
g.player.y = P.y;
const put = (k: keyof typeof AT, species: string, mode: 'wild' | 'active') => {
  const c = g.creatures.spawn(species, P.x + AT[k][0], P.y + AT[k][1], mode, () => 0.5, g.time);
  c.moving = false;
  return c;
};
put('kept', KIND, 'active');
put('other', OTHER, 'wild');
const A = put('A', KIND, 'wild');
const B = put('B', KIND, 'wild');
const C = put('C', KIND, 'wild');
const T: Target = { kind: 'tile', x: 20, y: 20, cx: 20, cy: 20, species: KIND };

/** A go in the browser on the same ground: the line it says, and the arrow it leaves. */
function browserGo(go: Go): { line: string; arrow: string } {
  g.skills.values.set(TRACKING, go.skill);
  for (const [k, c] of [['A', A], ['B', B], ['C', C]] as const) c.mode = go.wild.includes(k) ? 'wild' : 'deed';
  A.skills = { foraging: go.aLevel };
  g.rand = () => go.roll;
  g.trail = null;
  const before = g.log.length;
  track.perform(T, g);
  const line = g.log.slice(before).find((l) => l.kind === 'event')?.text ?? '-';
  // Read through a fresh type: `perform` set it, which the narrowing above cannot see.
  const t = g.trail as Trail | null;
  return { line, arrow: t ? `${t.name}|${t.bearing}|${t.dist}` : '-' };
}
const islandArrow = (k: string): string => {
  const a = trackedArrow(said(`ARROW_${k}`));
  return a ? `${a.name}|${a.bearing}|${a.dist}` : '-';
};

/* ---- the skill and the job ---------------------------------------------------------------------------------------- */

check('Tracking is a skill on both sides, starting where a trade does', SKILL_BY_ID.get(TRACKING)?.group === 'Skills'
  && said('SKILL') === `Tracking|${SKILL_BY_ID.get(TRACKING)?.start}`, said('SKILL'));
check('Track is a job on both sides, of Tracking, that the island does',
  said('ACTION') === `${track.label}|${track.verb}|${TRACKING}|true` && !!track.hidden, said('ACTION'));
check('Tracking is in the Naturalist\'s trade on both sides, and no other',
  CRAFT_CLASSES.filter((c) => c.skills.includes(TRACKING)).map((c) => c.id).join() === 'naturalist' && said('CLASS') === 'naturalist', said('CLASS'));
check('the island searches one kind\'s wild rows by their own index', said('INDEX') === '1', said('INDEX'));
check(`a go takes ${TRACK_TIME} seconds at nought, at the pace, and no less than the floor, on both sides`,
  g.duration(track) <= TRACK_TIME && g.duration(track) >= ACTION_FLOOR - 1e-9, `${g.duration(track).toFixed(2)} s`);

/* ---- refused -------------------------------------------------------------------------------------------------- */

const seen = new Set<string>();
check('a kind not seen is refused, in the same words on both sides',
  said('UNSEEN') === trackRefusal(DEF, seen) && track.check?.(T, g) === said('UNSEEN'), said('UNSEEN'));
check('a monster is refused, in the same words', said('MONSTER') === trackRefusal(MONSTER, seen), said('MONSTER'));
check('and no kind at all', said('NOKIND') === trackRefusal(undefined, seen), said('NOKIND'));
check('asked through the door for a kind not seen, it does not start, and says why',
  said('ACTUNSEEN').includes('"started": false') && said('ACTUNSEEN').includes(trackRefusal(SPECIES[OTHER], seen)!), said('ACTUNSEEN'));
g.guide.mark(KIND, 'seen');
check('a kind marked seen is not refused, on both sides', said('SEEN') === '-' && track.check?.(T, g) === null, said('SEEN'));

/* ---- the field guide's button --------------------------------------------------------------------------------- */

check('a seen wildermon\'s page has a Track button', trackable(DEF, g.guide.seen));
check('a wildermon not seen has none', !trackable(SPECIES[OTHER], g.guide.seen));
check('a monster has none, seen or not', !trackable(MONSTER, new Set([MONSTER.id])));
check('the button asks for Track at the kind, from where you stand, and no tile menu offers it',
  JSON.stringify(trackTarget(g, KIND)) === JSON.stringify({ kind: 'tile', x: g.player.tileX, y: g.player.tileY, cx: g.player.tileX, cy: g.player.tileY, species: KIND })
    && track.applies(trackTarget(g, KIND), g) && !track.applies({ kind: 'tile', x: 1, y: 1, cx: 1, cy: 1 }, g) && !!track.hidden);
check('the bar says what is tracked', track.doing?.(T, g) === `Tracking a ${DEF.name}`, track.doing?.(T, g));

/* ---- the rule, the same on both sides --------------------------------------------------------------------------- */

{
  const browser = LEVELS.map((l) => `${trackRange(l)}:${trackErr(l)}:${trackBand(l)}`).join(',');
  const differ = LEVELS.filter((l, i) => browser.split(',')[i] !== said('FORMULA').split(',')[i]);
  check(`the reach, the spread and the band agree at all ${LEVELS.length} levels`, browser === said('FORMULA'), differ.slice(0, 4).join(' '));
  check(`the reach is ${TRACK_RANGE_BASE} and ${TRACK_RANGE_PER} a level: ${trackRange(0)} at nought, ${trackRange(SKILL_TOP)} at ${SKILL_TOP}`,
    trackRange(0) === 100 && trackRange(50) === 300 && trackRange(100) === 500);
  check(`the spread is ±${TRACK_ERR_MOST}° at nought, ±30° at 50 and ±${TRACK_ERR_LEAST}° from 92`,
    trackErr(0) === 60 && trackErr(50) === 30 && trackErr(91) > 5 && trackErr(92) === 5 && trackErr(100) === 5,
    `${trackErr(91)} ${trackErr(92)}`);
  check('the bands start at 20, 50 and 80',
    trackBand(19) === 0 && trackBand(20) === 1 && trackBand(49) === 1 && trackBand(50) === 2 && trackBand(79) === 2 && trackBand(80) === 3 && TRACK_BANDS.length === 4);
}
{
  const rows = said('GRID').split('~').map((r) => r.split('#'));
  const wrong = grid.filter(([l, b, d, r], n) => {
    const rd = trackReading(l, b, d, r);
    return rows[n]?.[1] !== readSays(rd) || rows[n]?.[2] !== trackSaid(DEF.name, trackRange(l), { stageName: STAGE1, level: 54, moving: n % 2 === 0 }, rd);
  });
  check(`the reading and its line agree over ${grid.length} levels, bearings, distances and rolls`, rows.length === grid.length && wrong.length === 0,
    wrong.slice(0, 2).map(([l, b, d, r]) => `${l}/${b}/${d}/${r}: ${readSays(trackReading(l, b, d, r))} vs ${rows[grid.findIndex((x) => x[0] === l && x[1] === b && x[2] === d && x[3] === r)]?.slice(1).join(' ')}`).join(' / '));
  check('no sign says so in the same words', said('NOSIGN') === trackSaid(DEF.name, 140, null, null), said('NOSIGN'));
}

/* ---- each band, exactly ----------------------------------------------------------------------------------------- */

{
  const rd = (l: number, b: number, d: number, r = 0.5): TrackReading => trackReading(l, b, d, r);
  // No error: the true bearing, said to the band's points; the distance to the band's step.
  check('below 20, the way to four points and far off or not',
    rd(10, 44, 300).way === 'north' && rd(10, 46, 300).way === 'east' && rd(10, 200, 151).way === 'south' && rd(10, 290, 10).way === 'west'
      && rd(10, 0, TRACK_FAR + 1).far && !rd(10, 0, TRACK_FAR).far && rd(10, 0, 300).tiles === null,
    `${rd(10, 44, 300).way} ${rd(10, 46, 300).way}`);
  check('from 20, to eight points and the nearest 50 tiles, never below 50',
    rd(20, 22, 0).way === 'north' && rd(20, 23, 0).way === 'north-east' && rd(49, 315, 0).way === 'north-west'
      && rd(20, 0, 74).tiles === 50 && rd(20, 0, 75).tiles === 100 && rd(20, 0, 10).tiles === 50,
    `${rd(20, 23, 0).way} ${rd(20, 0, 75).tiles}`);
  check('from 50, to sixteen points and the nearest 20 tiles',
    rd(50, 22.5, 0).way === 'north-north-east' && rd(60, 67.38, 0).way === 'east-north-east' && rd(79, 337.5, 0).way === 'north-north-west'
      && rd(50, 0, 129).tiles === 120 && rd(50, 0, 130).tiles === 140 && rd(50, 0, 5).tiles === 20,
    `${rd(60, 67.38, 0).way} ${rd(50, 0, 129).tiles}`);
  check('from 80, to the degree and the nearest 5 tiles',
    rd(80, 47.2, 0).way === 'bearing 47°' && rd(90, 359.6, 0).way === 'bearing 0°' && rd(80, 0, 84).tiles === 85 && rd(80, 0, 82.4).tiles === 80,
    `${rd(80, 47.2, 0).way} ${rd(80, 0, 84).tiles}`);
  // The error at its bounds: the whole spread one way and the other.
  check('with the roll at nought, the way is off by the whole spread one way: ±60° at nought turns north to west',
    rd(0, 0, 50, 0).way === 'west' && rd(50, 90, 50, 0).way === 'east-north-east' && rd(100, 90, 50, 0).way === 'bearing 85°',
    `${rd(0, 0, 50, 0).way} ${rd(50, 90, 50, 0).way} ${rd(100, 90, 50, 0).way}`);
  check('and with it at the top, the other way',
    rd(0, 0, 50, 0.9999999).way === 'east' && rd(50, 90, 50, 0.9999999).way === 'east-south-east' && rd(100, 90, 50, 0.9999999).way === 'bearing 95°',
    `${rd(0, 0, 50, 0.9999999).way} ${rd(50, 90, 50, 0.9999999).way} ${rd(100, 90, 50, 0.9999999).way}`);
  check('the arrow points along the way as said, not the true bearing', rd(10, 44, 300).bearing === 0 && rd(60, 67.38, 0).bearing === 67.5 && rd(90, 47.2, 0).bearing === 47);
}

/* ---- the goes ------------------------------------------------------------------------------------------------- */

const want: Record<string, string> = {
  low: `Tracks: ${DEF.name}, east, not far off.`,
  eight: `Tracks: ${DEF.name}, north-east, about 50 tiles.`,
  sixteen: `Tracks: ${STAGE1}, east-north-east, about 20 tiles.`,
  degree: `Tracks: ${STAGE2}, level 54, bearing 67°, about 25 tiles, still.`,
  degree_low: `Tracks: ${STAGE2}, level 54, bearing 61°, about 25 tiles, still.`,
  degree_high: `Tracks: ${STAGE2}, level 54, bearing 73°, about 25 tiles, still.`,
  nosign: `No ${DEF.name.toLowerCase()} within ${trackRange(1)} tiles.`,
  south: `Tracks: ${DEF.name}, south, not far off.`,
};
/*
 * Alone, the wild past what is out (`CULL_RANGE`) is a count and not creatures, so a track there reaches no further:
 * C, out past that, is no sign in the browser at any level, and the line names the reach it had.
 */
const SOLO_FAR = ['nosign', 'south'];
for (const go of GOES) {
  const b = browserGo(go);
  check(`${go.name}: the island finds the nearest wild one, past a kept one and another kind, and says "${want[go.name]}"`,
    said(`GO_${go.name}`) === want[go.name], said(`GO_${go.name}`));
  if (SOLO_FAR.includes(go.name)) {
    const reach = Math.min(CULL_RANGE, trackRange(Math.floor(go.skill)));
    check(`${go.name}: alone, one ${AT.C[1]} tiles out is past what is out, and the line says the reach of ${reach} tiles`,
      b.line === trackSaid(DEF.name, reach, null, null) && b.arrow === '-', b.line);
  } else {
    check(`${go.name}: the browser says the same and leaves the same arrow`,
      b.line === said(`GO_${go.name}`) && b.arrow === islandArrow(go.name), `${b.line} / ${b.arrow} vs ${islandArrow(go.name)}`);
  }
}
{
  // And within what is out, due south.
  C.y = P.y + CULL_RANGE - 5;
  const b = browserGo(GOES.find((x) => x.name === 'south')!);
  check('alone, one due south within what is out is found south', b.line === want.south && b.arrow === `${DEF.name}|180|not far off`, b.line);
  C.y = P.y + AT.C[1];
}
check('no sign leaves no arrow', said('ARROW_nosign') === '-' && browserGo(GOES.find((x) => x.name === 'nosign')!).arrow === '-');
check('the arrow is labelled with the name the line used and the distance as said',
  islandArrow('sixteen') === `${STAGE1}|67.5|about 20 tiles` && islandArrow('low') === `${DEF.name}|90|not far off`, `${islandArrow('sixteen')} ${islandArrow('low')}`);

/* ---- what a go teaches -------------------------------------------------------------------------------------------- */

{
  const none = Number(said('GAIN_NONE'));
  const found = Number(said('GAIN_FOUND'));
  check(`on the island a go trains Tracking, a full go found and ${TRY_LEARN} of one not`,
    none > 0 && found > 0 && Math.abs(none / found - TRY_LEARN) < 1e-9, `${none} / ${found}`);
  // And in the browser, a go run through to its end.
  const run = (wild: boolean): number => {
    const h = Game.create(2241);
    for (const c of [...h.creatures.list.values()]) h.creatures.list.delete(c.id);
    h.guide.mark(KIND, 'seen');
    h.skills.values.set(TRACKING, 10.5);
    if (wild) h.creatures.spawn(KIND, h.player.x + 5, h.player.y, 'wild', () => 0.5, h.time);
    h.rand = () => 0.5;
    h.player.stats.stamina = 1;
    h.requestAction(track, trackTarget(h, KIND), 1);
    for (let i = 0; i < 100 && h.action; i++) h.update(0.2);
    return h.skills.standing(TRACKING) - 10.5;
  };
  const bNone = run(false);
  const bFound = run(true);
  check(`in the browser a go trains Tracking the same way, run through to its end`,
    bNone > 0 && bFound > 0 && Math.abs(bNone / bFound - TRY_LEARN) < 1e-6, `${bNone} / ${bFound}`);
}

/* ---- through the door -------------------------------------------------------------------------------------------- */

{
  const [started, secs, floor] = said('ACT').split('|');
  check(`asked through rpc_act it starts and takes its time: no more than ${TRACK_TIME} s and no less than the floor`,
    started === 'true' && Number(secs) <= TRACK_TIME && Number(secs) >= Number(floor) - 1e-9, said('ACT'));
  check('and settled by the clock, it says its line and hands over its arrow',
    said('SETTLED') === `event:${want.low} / tracked:{"far": false, "name": "${DEF.name}", "tiles": null, "bearing": 90}`, said('SETTLED'));
}

/* ---- what the Skills window says ------------------------------------------------------------------------------ */

{
  const [short, long] = trackingSays(50);
  check('the Skills window says the reach, the spread and the points at the level you are at',
    short === '300 tiles · ±30° · 16 points' && long.includes('(300 now)') && long.includes('(±30° now)'), short);
  check('and every band, off the table', TRACK_BANDS.every((b) => long.includes(`${b.at} `)) && long.includes(`over ${TRACK_FAR} tiles`)
    && long.includes('to 1°') && long.includes('nearest 5 tiles'), long);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ntracking — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
