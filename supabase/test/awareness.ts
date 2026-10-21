/**
 * Awareness: more uses, more sources, a start at 20.
 *
 * Asked for: "1 add those [uses], 2 add those [sources], 3 start at 20, 4 keep
 * [the curve], 5 add both [Skills window line and Help numbers]". Asked of both
 * sides, at awareness 20, 60 and 100:
 *
 *   * a hunter notices you from closer (`awareNotice`, `aware_notice` in
 *     `hunt_settle`): one just inside and one just outside the range;
 *   * a track reaches further (`trackReach`, `perform_track`);
 *   * a swing lands more often in full dark, and not in a dark under
 *     `NIGHT_EYES_FROM` (`hitChance`, `hit_chance`);
 *   * a rare trait reads on less husbandry (`traitReadNeeds`, `blood_seen`);
 *
 * and, at one in the morning and at noon, that a tile walked, a go of Track
 * and a go of Forage teach awareness the same amount on both sides, and
 * walking and foraging nothing by day; and that a newcomer's awareness is 20.
 *
 * The island half runs in one transaction that is rolled back, in a world of
 * its own; what awareness is taught is read off `char_told`, replaced inside
 * that transaction by one that writes down what it was asked.
 */
import { execFileSync } from 'node:child_process';
import { CHAR_START, DAY_SECONDS, DUSK, Game, TWILIGHT } from '../../src/game/game';
import { SKILL_BY_ID, SKILL_TOP } from '../../src/game/skills';
import { DARK_WALK, DARK_WORK, NIGHT_EYES_FROM, TRACK_AWARE } from '../../src/game/learn';
import { SPECIES } from '../../src/game/creatures';
import { hitChance, WEAPONS } from '../../src/game/gear';
import { TRACK, trackLevel, trackReach, trackSaid } from '../../src/game/tracking';
import { traitReadNeeds } from '../../src/game/husbandry';
import { TRAITS } from '../../src/game/traits';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

const LEVELS = [CHAR_START, 60, SKILL_TOP];
const NIGHT = 1;
const NOON = 12;
/** An hour of dusk dark enough to be dusk and not dark enough to teach: a fifth of the way down. */
const DUSKY = DUSK - TWILIGHT + 2 * TWILIGHT * 0.2;
const TRACKING_AT = 50;
const HUNTER = 'goblin';
const NOTICE = SPECIES[HUNTER].notice!;
const RARE = TRAITS.find((t) => t.tier === 'rare' && !t.family)!.id;
const sword = WEAPONS.find((w) => w.kind === 'swords')!;
const KIND = 'sedra';

/* ---- the browser ---------------------------------------------------------- */
const g = Game.create(4242);
check(`a newcomer's awareness is ${CHAR_START} in the browser`, g.skills.get('awareness') === CHAR_START && SKILL_BY_ID.get('awareness')?.start === CHAR_START,
  String(g.skills.get('awareness')));
const at = (hour: number): Game => {
  g.time = (hour / 24) * DAY_SECONDS;
  return g;
};
check(`the dusk hour asked about is dark, and under ${NIGHT_EYES_FROM}`, at(DUSKY).darkness() > 0 && at(DUSKY).darkness() < NIGHT_EYES_FROM, String(at(DUSKY).darkness()));
check('one in the morning is full dark, noon none', at(NIGHT).darkness() === 1 && at(NOON).darkness() === 0);

const mine = LEVELS.map((L) => {
  g.skills.values.set('awareness', L);
  at(NOON);
  const reach = NOTICE * g.shadowNotice() * g.awareNotice();
  const track = trackReach(trackLevel(TRACKING_AT), g.awareShare());
  const dark = hitChance(at(NIGHT), sword, null);
  const dusky = hitChance(at(DUSKY), sword, null);
  const day = hitChance(at(NOON), sword, null);
  return { L, share: g.awareShare(), reach, track, dark, dusky, day, needs: traitReadNeeds('rare', L) };
});
check(`the share is 0 at ${CHAR_START} and a tenth at ${SKILL_TOP}`, near(mine[0].share, 0) && near(mine[2].share, 0.1), mine.map((m) => m.share).join(', '));
check(`full dark adds the share to a swing, a dusk under ${NIGHT_EYES_FROM} nothing`,
  mine.every((m) => near(m.dark, m.day + m.share) && near(m.dusky, m.day)), mine.map((m) => `${m.dark} ${m.dusky} ${m.day}`).join('; '));
check(`a rare trait needs ${mine[0].needs} husbandry at ${CHAR_START} and ${mine[2].needs} at ${SKILL_TOP}`, mine[0].needs === 16 && mine[2].needs === 8);
g.skills.values.set('awareness', CHAR_START);
const teach = (hour: number): { walk: number; forage: number; track: number } => {
  at(hour);
  return { walk: DARK_WALK * g.awareDark(), forage: DARK_WORK * g.awareDark(), track: TRACK_AWARE };
};
const night = teach(NIGHT);
const day = teach(NOON);
check('by day the browser\'s rule teaches walking and foraging nothing, and a track the same as at night',
  day.walk === 0 && day.forage === 0 && day.track === night.track && night.walk === DARK_WALK && night.forage === DARK_WORK);

/* ---- the island ----------------------------------------------------------- */
const U = '44444444-4444-4444-4444-444444444444';
/** The hunter's two places: just inside the range at 60 and just outside it at 100, and just outside it at 60. */
const GAPS = [(mine[1].reach + mine[2].reach) / 2, (mine[0].reach + mine[1].reach) / 2];
const hour = (h: number): string => `update world set epoch = now() - make_interval(secs => ${h} / 24.0 * day_seconds()) where id = w;`;
const out = psql(`
begin;
create temp table said (k text, v text);
create temp table told (k text, id text, base double precision);
create temp table phase (k text);
insert into phase values ('-');
create or replace function char_told(p_world uuid, p_uid uuid, p_id text, p_base double precision) returns double precision
language plpgsql as $r$
begin
  insert into told select k, p_id, p_base from phase;
  return 0;
end $r$;
do $t$
declare w uuid; u uuid := '${U}'; L double precision; r double precision; c int; cr creature; v_n int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Aware', 191, 128, 8, 8, true) returning id into w;
  perform land_blank(w, 128);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Ash');
  insert into said values ('START', skill_of(w, u, 'awareness')::text);
  insert into said values ('UNDER', (select count(*) from skill where id = 'awareness' and value < ${CHAR_START})::text);
  perform guide_mark(w, u, '${KIND}', 'seen');
  insert into skill (world_id, uid, id, value) values (w, u, tracking_skill(), ${TRACKING_AT})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  update player set x = 80.5, y = 80.5, level = 0 where world_id = w and uid = u;

  foreach L in array array[${LEVELS.join(', ')}]::double precision[] loop
    insert into skill (world_id, uid, id, value) values (w, u, 'awareness', L)
      on conflict (world_id, uid, id) do update set value = excluded.value;
    ${hour(NOON)}
    insert into said values ('SHARE' || L, aware_share(w, u)::text);
    -- A hunter at each gap, not yet after anybody.
    foreach r in array array[${GAPS.join(', ')}]::double precision[] loop
      c := creature_spawn(w, '${HUNTER}', 80.5 + r, 80.5, 'wild', now() - interval '1 hour');
      update creature set hunting = null, hunt_again = null where world_id = w and id = c;
      select * into cr from creature where world_id = w and id = c;
      insert into said values ('HUNT' || L || '@' || r,
        ((hunt_settle(w, cr, (select s from species_def s where s.id = '${HUNTER}'), age_row(cr.born))).hunting is not null)::text);
      delete from creature where world_id = w and id = c;
    end loop;
    -- A track with nothing out there: the line names its reach.
    select coalesce(max(e.n), 0) into v_n from event e where e.world_id = w and e.uid = u;
    perform perform_track(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', '${KIND}'));
    insert into said values ('TRACK' || L, coalesce((select text from event e where e.world_id = w and e.uid = u and e.n > v_n and e.kind = 'event' order by e.n limit 1), '-'));
    -- A swing, at noon, at one in the morning and at a dusk not dark enough.
    insert into said values ('DAY' || L, hit_chance(w, u, 'swords')::text);
    ${hour(NIGHT)}
    insert into said values ('DARK' || L, hit_chance(w, u, 'swords')::text);
    ${hour(DUSKY)}
    insert into said values ('DUSKY' || L, hit_chance(w, u, 'swords')::text || '|' || darkness(w)::text);
  end loop;
  insert into skill (world_id, uid, id, value) values (w, u, 'animal_husbandry', 0)
    on conflict (world_id, uid, id) do nothing;
end $t$;
-- A rare trait, on the husbandry it needs and on a little less.
${mine.map((m) => `
update skill set value = ${m.L} where uid = '${U}' and id = 'awareness';
update skill set value = ${m.needs} where uid = '${U}' and id = 'animal_husbandry';
insert into said select 'READ${m.L}', array_to_string(blood_seen(w.id, '${U}', array['${RARE}']), ',') from world w where w.name = 'Aware';
update skill set value = ${m.needs - 0.5} where uid = '${U}' and id = 'animal_husbandry';
insert into said select 'UNREAD${m.L}', array_to_string(blood_seen(w.id, '${U}', array['${RARE}']), ',') from world w where w.name = 'Aware';`).join('')}
update skill set value = ${CHAR_START} where uid = '${U}' and id = 'awareness';
do $t$
declare w uuid; u uuid := '${U}'; h double precision;
begin
  select id into w from world where name = 'Aware';
  foreach h in array array[${NIGHT}, ${NOON}]::double precision[] loop
    update world set epoch = now() - make_interval(secs => h / 24.0 * day_seconds()) where id = w;
    -- A tile walked on your own feet.
    update phase set k = 'WALK' || h;
    update player set x = 40.5, y = 40.5, level = 0, moved_at = now() - interval '10 seconds', away = false where world_id = w and uid = u;
    delete from caller where uid = u;
    perform rpc_move(w, 41.5, 40.5, 0);
    insert into said select 'WENT' || h, x || ',' || y from player where world_id = w and uid = u;
    -- A go of Forage, and a go of Track.
    update phase set k = 'FORAGE' || h;
    perform perform_gather(w, u, 'forage', jsonb_build_object('kind', 'tile', 'x', 41, 'y', 40));
    update phase set k = 'TRACKGO' || h;
    perform perform_track(w, u, '${TRACK}', jsonb_build_object('kind', 'tile', 'species', '${KIND}'));
  end loop;
end $t$;
insert into said values ('FISH', (select (length(prosrc) - length(replace(prosrc, 'aware_dark_told(p_world, p_uid, dark_work())', ''))) / length('aware_dark_told(p_world, p_uid, dark_work())')
  from pg_proc where proname = 'perform_fish')::text);
select k || '=' || v from said;
select 'TOLD:' || k || '=' || coalesce(string_agg(base::text, ',' order by base), '') from told where id = 'awareness' group by k;
rollback;
`);
const lines = out.split('\n').filter((l) => l.includes('='));
const isle = new Map(lines.filter((l) => !l.startsWith('TOLD:')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const told = new Map(lines.filter((l) => l.startsWith('TOLD:')).map((l) => [l.slice(5, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const num = (k: string): number => Number(isle.get(k) ?? NaN);

check(`a newcomer's awareness is ${CHAR_START} on the island`, num('START') === CHAR_START, isle.get('START'));
check(`nobody on the island is under ${CHAR_START}`, num('UNDER') === 0, isle.get('UNDER'));
for (const m of mine) {
  check(`awareness ${m.L}: the same share on both sides`, near(num(`SHARE${m.L}`), m.share), `browser ${m.share}, island ${isle.get(`SHARE${m.L}`)}`);
  for (const r of GAPS) {
    const want = r <= m.reach;
    check(`awareness ${m.L}: a ${HUNTER} ${r.toFixed(3)} tiles off ${want ? 'notices' : 'does not notice'} you (range ${m.reach.toFixed(3)})`,
      isle.get(`HUNT${m.L}@${r}`) === String(want), isle.get(`HUNT${m.L}@${r}`));
  }
  const line = trackSaid(SPECIES[KIND].name, m.track, null, null);
  check(`awareness ${m.L}: a track at tracking ${TRACKING_AT} reaches ${m.track} tiles on both sides`, isle.get(`TRACK${m.L}`) === line, `${isle.get(`TRACK${m.L}`)} / ${line}`);
  const dusky = (isle.get(`DUSKY${m.L}`) ?? '|').split('|').map(Number);
  check(`awareness ${m.L}: the same hit chance by day, in full dark and at dusk on both sides`,
    near(num(`DAY${m.L}`), m.day) && near(num(`DARK${m.L}`), m.dark) && near(dusky[0], m.dusky) && near(dusky[1], at(DUSKY).darkness()),
    `browser ${m.day} ${m.dark} ${m.dusky}, island ${isle.get(`DAY${m.L}`)} ${isle.get(`DARK${m.L}`)} ${isle.get(`DUSKY${m.L}`)}`);
  check(`awareness ${m.L}: a rare trait reads on ${m.needs} husbandry on the island, and not on less`,
    isle.get(`READ${m.L}`) === RARE && isle.get(`UNREAD${m.L}`) === '', `${isle.get(`READ${m.L}`)} / ${isle.get(`UNREAD${m.L}`)}`);
}
const toldOf = (k: string): number[] => (told.get(k) ?? '').split(',').filter(Boolean).map(Number);
const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => near(v, b[i]));
const want = (v: number): number[] => (v > 0 ? [v] : []);
check('the walk went one tile, night and day', isle.get(`WENT${NIGHT}`) === '41.5,40.5' && isle.get(`WENT${NOON}`) === '41.5,40.5', `${isle.get(`WENT${NIGHT}`)} ${isle.get(`WENT${NOON}`)}`);
check('a tile walked at night teaches the same on both sides, and nothing by day',
  same(toldOf(`WALK${NIGHT}`), want(night.walk)) && same(toldOf(`WALK${NOON}`), want(day.walk)), `${told.get(`WALK${NIGHT}`)} / ${told.get(`WALK${NOON}`)}`);
check('a go of Forage at night teaches the same on both sides, and nothing by day',
  same(toldOf(`FORAGE${NIGHT}`), want(night.forage)) && same(toldOf(`FORAGE${NOON}`), want(day.forage)), `${told.get(`FORAGE${NIGHT}`)} / ${told.get(`FORAGE${NOON}`)}`);
check('a go of Track teaches the same on both sides, night and day',
  same(toldOf(`TRACKGO${NIGHT}`), want(night.track)) && same(toldOf(`TRACKGO${NOON}`), want(day.track)), `${told.get(`TRACKGO${NIGHT}`)} / ${told.get(`TRACKGO${NOON}`)}`);
check('every go of fishing, rod or net, teaches it in the dark on the island', num('FISH') === 4, isle.get('FISH'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`awareness: more uses, more sources, a start at ${CHAR_START} — ${ok.length} of ${ok.length}`);
