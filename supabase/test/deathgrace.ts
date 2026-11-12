/**
 * A death grace for a new character (`src/game/deathgrace.ts`; `player.played`, `body_settle`, `death_grace_left`,
 * `player_die` and `rpc_settle`'s `grace` on the island).
 *
 * Asked for: "a grace period after death for new players -- no penalty for dying during a character's first 24 hours
 * of playtime (time actually played, not time since sign-up)". So this asks, of the island:
 *
 *   * the hours, the seconds, the longest stretch counted and the words are the browser's; a new row starts at nought;
 *   * a body under the grace dies and keeps everything: no grave, the pack and the hands as they were, stamina, food
 *     and water no lower; whole on the spawn and offered where to wake; told the grace left, in the browser's words;
 *   * a body at the grace and one past it die as before: what they carried in a grave where they fell, the hands
 *     empty, stamina, food and water at a death's; one a second short of it is still in it;
 *   * the count: `body_settle` adds the stretch while in the game, and nothing while away, not heard from within
 *     `played_gap`, or settled last further back than that; the beat after coming back adds nothing for the time
 *     gone, a beat in the game adds its stretch; and the beat says the grace left, null past it;
 *
 * and of the browser: `graceIn` reads the beat's, `Island` hands it to its hook (null when the beat leaves it out), and the effects row shows it with
 * the island's words while it lasts and not after.
 *
 * Runs against the database the suite leaves behind; the island half is rolled back. Every time is set against the
 * transaction's own `now()`, so nothing rides on the wall clock.
 *
 *   npx esbuild supabase/test/deathgrace.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/deathgrace.mjs && node node_modules/.cache/deathgrace.mjs
 */
import { execFileSync } from 'node:child_process';
import {
  DEATH_GRACE, DEATH_GRACE_HOURS, GRACE_SPARES, graceDeathSaid, graceIn, graceKeptSaid, graceLeft, graceSaid, PLAYED_GAP,
} from '../../src/game/deathgrace';
import { Game } from '../../src/game/game';
import { HEARTBEAT } from '../../src/game/keep';
import { Island } from '../../src/net/island';
import { supabase } from '../../src/net/supabase';
import { effectsOn, shortLeft, SpellsOnYou } from '../../src/ui/effects';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the rule and its words ------------------------------------------------- */

check(`${DEATH_GRACE_HOURS} h, as asked`, DEATH_GRACE_HOURS === 24 && DEATH_GRACE === 24 * 3600);
check('the longest stretch counted is two heartbeats', PLAYED_GAP === 2 * HEARTBEAT, String(PLAYED_GAP));
const LEFTS = [1, 0.4, 59.5, 60, 61, 3599, 3600, 66000, 66000.4, 66400, DEATH_GRACE - 1, DEATH_GRACE];
const rule = psql(`select death_grace_hours() || '|' || death_grace() || '|' || played_gap() || '|'
  || (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'player' and column_name = 'played')
  || '|' || (select string_agg(death_grace_said(s), '#' order by o) from unnest(array[${LEFTS.join(',')}]::double precision[]) with ordinality u(s, o));`);
const [hours, secs, gap, dflt, words] = rule.split('|');
check('the island keeps the same hours, seconds and stretch', Number(hours) === DEATH_GRACE_HOURS && Number(secs) === DEATH_GRACE && Number(gap) === PLAYED_GAP,
  `${hours} ${secs} ${gap}`);
check('a new row starts at nought played', dflt === '0', dflt);
check(`and says the grace left in the browser's words, ${LEFTS.length} times`, words === LEFTS.map(graceSaid).join('#'), words);
check('as asked: "Death grace: 18 h 20 min of 24 h played left; nothing lost."', graceKeptSaid(66000) === 'Death grace: 18 h 20 min of 24 h played left; nothing lost.',
  graceKeptSaid(66000));

/* ---- the island ------------------------------------------------------------- */

const SPAWN = 5;
const NEW = '9ace0000-0000-4000-8000-000000000001';
const OLD = '9ace0000-0000-4000-8000-000000000002';
const EDGE = '9ace0000-0000-4000-8000-000000000003';
const FALL = { x: 40.5, y: 30.5 };
/** What NEW has played when it dies, and what the counting starts from. */
const PLAYED = 20000;
const FROM = 100;
const STATS = { stamina: 0.9, hunger: 0.8, thirst: 0.7 };

const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.as_(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
end $f$;
-- What a body carries that a death may take: everything held but the starting kit, by name, and what is in its hands.
create function pg_temp.kept(w uuid, u uuid) returns text language sql as $f$
  select coalesce((select string_agg(i.def || ':' || coalesce(i.count, 1), ',' order by i.def) from item i
                    where i.world_id = w and i.holder = 'player' and i.holder_uid = u and not i.issued), '-')
      || '|' || coalesce((select p.equipped->>'weapon' is not null from player p where p.world_id = w and p.uid = u)::text, '?')
      || '|' || (select count(*) from placed g where g.world_id = w and g.made_by = u and g.sub = 'grave')
      || '|' || coalesce((select string_agg(i.def, ',' order by i.def) from item i join placed g on g.id = i.placed
                           where g.world_id = w and g.made_by = u and g.sub = 'grave'), '-')
$f$;
-- Fall at FALL, worn down, with a hatchet in the hand and five logs in the pack; then what it kept, the bars, where it
-- woke, the line and whether it is offered where to wake.
create function pg_temp.die(w uuid, u uuid) returns text language plpgsql as $f$
declare v_axe bigint;
begin
  v_axe := give(w, u, 'hatchet', 1, 50, null, null, null, null);
  perform give(w, u, 'log', 5, 30, null, null, null, null);
  update player set x = ${FALL.x}, y = ${FALL.y}, level = 0, equipped = jsonb_build_object('weapon', v_axe),
         stats = jsonb_build_object('health', 0, 'stamina', ${STATS.stamina}, 'hunger', ${STATS.hunger}, 'thirst', ${STATS.thirst})
   where world_id = w and uid = u;
  perform player_die(w, u);
  return pg_temp.kept(w, u)
    || '|' || (select (stats->>'health') || ',' || (stats->>'stamina') || ',' || (stats->>'hunger') || ',' || (stats->>'thirst')
                      || '|' || x || ',' || y from player where world_id = w and uid = u)
    || '|' || (select text from event where world_id = w and uid = u order by n desc limit 1)
    || '|' || (respawn_offer(w, u) is not null)::text;
end $f$;
-- Played, after a body_settle with the body as given: away or not, heard from and settled that many seconds ago.
create function pg_temp.settled(w uuid, u uuid, p_away boolean, p_seen double precision, p_body double precision) returns text language plpgsql as $f$
begin
  update player set played = ${FROM}, away = p_away, seen_at = now() - make_interval(secs => p_seen),
         body_at = now() - make_interval(secs => p_body) where world_id = w and uid = u;
  perform body_settle(w, u);
  return (select played::text from player where world_id = w and uid = u);
end $f$;
-- Played, and the beat's grace, after a beat (rpc_settle) with the body as given.
create function pg_temp.beat(w uuid, u uuid, p_away boolean, p_seen double precision, p_body double precision, p_from double precision) returns text language plpgsql as $f$
declare j jsonb;
begin
  update player set played = p_from, away = p_away, seen_at = now() - make_interval(secs => p_seen),
         body_at = now() - make_interval(secs => p_body) where world_id = w and uid = u;
  perform pg_temp.as_(u);
  j := rpc_settle(null, w, null, false, null);
  return (select played::text from player where world_id = w and uid = u) || '|' || (j ? 'grace')::text || '|' || coalesce(j->>'grace', 'null')
    || '|' || (select away::text from player where world_id = w and uid = u);
end $f$;
do $t$
declare w uuid; j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Graceful', 4249, 256, ${SPAWN}, ${SPAWN}, true) returning id into w;
  perform land_blank(w, 256);
  update land_corner set heights = decode(repeat('0a00', 257), 'hex') where world_id = w;
  perform pg_temp.as_('${OLD}'); perform rpc_join(w, 'Ealdor');
  perform pg_temp.as_('${EDGE}'); perform rpc_join(w, 'Ecg');
  perform pg_temp.as_('${NEW}'); j := rpc_join(w, 'Niwe');
  insert into said values ('JOIN', (select played::text from player where world_id = w and uid = '${NEW}') || '|' || (j->'you'->>'played'));
  -- Nothing but the starting kit's tools on them, so what is counted is what each death is handed.
  delete from item where world_id = w and holder = 'player' and not issued;

  -- 1. Under the grace, at it, and a second short of it.
  update player set played = ${PLAYED} where world_id = w and uid = '${NEW}';
  update player set played = death_grace() where world_id = w and uid = '${OLD}';
  update player set played = death_grace() - 1 where world_id = w and uid = '${EDGE}';
  insert into said values ('LEFT_NEW', coalesce(death_grace_left(w, '${NEW}')::text, 'null'));
  insert into said values ('LEFT_OLD', coalesce(death_grace_left(w, '${OLD}')::text, 'null'));
  insert into said values ('LEFT_EDGE', coalesce(death_grace_left(w, '${EDGE}')::text, 'null'));
  insert into said values ('DIE_NEW', pg_temp.die(w, '${NEW}'));
  insert into said values ('DIE_OLD', pg_temp.die(w, '${OLD}'));
  insert into said values ('DIE_EDGE', pg_temp.die(w, '${EDGE}'));
  -- A second death under the grace keeps everything again: the first left it all on the body.
  insert into said values ('DIE_NEW2', pg_temp.die(w, '${NEW}'));
  -- And past it (played on), as the body at it.
  update player set played = death_grace() + 3600 where world_id = w and uid = '${EDGE}';
  insert into said values ('DIE_EDGE2', pg_temp.die(w, '${EDGE}'));

  -- 2. The count, by body_settle.
  insert into said values ('IN_GAME', pg_temp.settled(w, '${NEW}', false, 10, 30));
  insert into said values ('AWAY', pg_temp.settled(w, '${NEW}', true, 10, 30));
  insert into said values ('UNHEARD', pg_temp.settled(w, '${NEW}', false, ${PLAYED_GAP + 1}, 30));
  insert into said values ('LONG_GAP', pg_temp.settled(w, '${NEW}', false, 10, ${PLAYED_GAP + 1}));
  insert into said values ('AT_GAP', pg_temp.settled(w, '${NEW}', false, ${PLAYED_GAP}, ${PLAYED_GAP}));

  -- 3. And by the beat: back after an hour away, then a beat in the game; and one past the grace.
  insert into said values ('BEAT_BACK', pg_temp.beat(w, '${NEW}', true, 3600, 3600, ${FROM}));
  insert into said values ('BEAT_IN', pg_temp.beat(w, '${NEW}', false, 45, 45, ${FROM}));
  insert into said values ('BEAT_OLD', pg_temp.beat(w, '${OLD}', false, 45, 45, death_grace()));
end $t$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}
const parts = (k: string): string[] => (said.get(k) ?? '').split('|');

check('a new character starts at nought played, and the join hands it over', said.get('JOIN') === '0|0', said.get('JOIN'));
check(`the grace left: ${DEATH_GRACE - PLAYED} s under it, none at it, 1 s a second short of it`,
  said.get('LEFT_NEW') === String(DEATH_GRACE - PLAYED) && said.get('LEFT_OLD') === 'null' && said.get('LEFT_EDGE') === '1',
  `${said.get('LEFT_NEW')} ${said.get('LEFT_OLD')} ${said.get('LEFT_EDGE')}`);

const SPAWN_AT = `${SPAWN + 0.5},${SPAWN + 0.5}`;
const CARRIED = 'hatchet:1,log:5';
const BARS = `1,${STATS.stamina},${STATS.hunger},${STATS.thirst}`;
/** What a death under the grace leaves: everything carried, the hatchet in the hand, no grave, the bars as they were. */
const kept = (k: string, carried: string, left: number): void => {
  const [items, hand, graves, inGrave, bars, at, line, offer] = parts(k);
  check(`${k}: everything carried stays carried (${carried}), the hatchet still in the hand`, items === carried && hand === 'true', `${items} ${hand}`);
  check(`${k}: no grave`, graves === '0' && inGrave === '-', `${graves} ${inGrave}`);
  check(`${k}: whole, stamina, food and water as they were (${BARS})`, bars === BARS, bars);
  check(`${k}: on the spawn, offered where to wake`, at === SPAWN_AT && offer === 'true', `${at} ${offer}`);
  check(`${k}: told the grace left, in the browser's words: ${graceDeathSaid(left)}`, line === graceDeathSaid(left), line);
};
/** What a death past it takes: all of it into a grave where it fell, the hands empty, the bars at a death's. */
const lost = (k: string, graves: number): void => {
  const [items, hand, n, inGrave, bars, at, line, offer] = parts(k);
  check(`${k}: what it carried in a grave, the hands empty`, items === '-' && hand === 'false', `${items} ${hand}`);
  check(`${k}: ${graves} grave${graves === 1 ? '' : 's'} with the hatchet and the logs in it`,
    n === String(graves) && inGrave === Array.from({ length: graves }, () => ['hatchet', 'log']).flat().sort().join(','), `${n} ${inGrave}`);
  check(`${k}: stamina, food and water at a death's: 50%, 60%, 60%`, bars === '1,0.5,0.6,0.6', bars);
  check(`${k}: on the spawn, offered where to wake`, at === SPAWN_AT && offer === 'true', `${at} ${offer}`);
  check(`${k}: told of the grave, as before`, /^You have died\. What you carried is in a grave where you fell/.test(line ?? ''), line);
};
kept('DIE_NEW', CARRIED, DEATH_GRACE - PLAYED);
lost('DIE_OLD', 1);
kept('DIE_EDGE', CARRIED, 1);
kept('DIE_NEW2', 'hatchet:1,hatchet:1,log:10', DEATH_GRACE - PLAYED);
// The edge body's second death: what it kept from the first and what it was given, both in the grave.
{
  const [items, hand, n, inGrave, bars] = parts('DIE_EDGE2');
  check('past the grace, played on: everything it had into a grave, the hands empty, the bars at a death\'s',
    items === '-' && hand === 'false' && n === '1' && inGrave === 'hatchet,hatchet,log' && bars === '1,0.5,0.6,0.6', said.get('DIE_EDGE2'));
}

check('the count: 30 s settled in the game, heard from 10 s ago, adds 30 s', said.get('IN_GAME') === String(FROM + 30), said.get('IN_GAME'));
check('  away: nothing', said.get('AWAY') === String(FROM), said.get('AWAY'));
check(`  not heard from within ${PLAYED_GAP} s: nothing`, said.get('UNHEARD') === String(FROM), said.get('UNHEARD'));
check(`  settled last over ${PLAYED_GAP} s ago: nothing`, said.get('LONG_GAP') === String(FROM), said.get('LONG_GAP'));
check(`  heard from and settled ${PLAYED_GAP} s ago: all of it`, said.get('AT_GAP') === String(FROM + PLAYED_GAP), said.get('AT_GAP'));
const [backPlayed, backHas, backGrace, backAway] = parts('BEAT_BACK');
check('the beat after an hour away: in the game again, nothing added for the hour', backPlayed === String(FROM) && backAway === 'false', said.get('BEAT_BACK'));
check('  and it says the grace left', backHas === 'true' && Number(backGrace) === DEATH_GRACE - FROM, backGrace);
const [inPlayed, , inGrace] = parts('BEAT_IN');
check('a beat in the game, 45 s on: adds 45 s, and says the grace left', inPlayed === String(FROM + 45) && Number(inGrace) === DEATH_GRACE - FROM - 45, said.get('BEAT_IN'));
const [, oldHas, oldGrace] = parts('BEAT_OLD');
check('a beat past the grace says none (left out, as the beat leaves out every null)', oldHas === 'false' && oldGrace === 'null', said.get('BEAT_OLD'));

/* ---- the browser ------------------------------------------------------------ */

check('graceIn: the seconds said, and none for nothing, nought, less or not a number',
  graceIn(66000) === 66000 && graceIn(null) === null && graceIn(0) === null && graceIn(-5) === null && graceIn('1') === null && graceIn(undefined) === null);
check('graceLeft: from what was played, none at the grace', graceLeft(0) === DEATH_GRACE && graceLeft(DEATH_GRACE - 1) === 1 && graceLeft(DEATH_GRACE) === null);

{
  // `Island` over a stand-in keeper answering with the island's own beat: its grace to the hook, and null past it.
  const answers: unknown[] = [{ settled: 0, grace: Number(inGrace) }, { settled: 0, grace: null }, { settled: 0 }];
  const sb = supabase() as unknown as Record<string, unknown>;
  sb.rpc = async () => ({ data: answers.shift(), error: null });
  const heard: Array<number | null | undefined> = [];
  const isl = new Island({ say: () => {}, ground: () => {}, people: () => {}, pack: () => {}, mine: (m) => { heard.push(m.grace); } });
  (isl as unknown as { info: unknown }).info = { id: 'w', size: 256 };
  const pulse = (isl as unknown as { pulse: () => Promise<boolean> }).pulse.bind(isl);
  await pulse();
  await pulse();
  await pulse();
  clearTimeout((isl as unknown as { beat: ReturnType<typeof setTimeout> }).beat);
  check('Island: the beat\'s grace goes to the hook; null past it, or not said',
    heard.length === 3 && heard[0] === DEATH_GRACE - FROM - 45 && heard[1] === null && heard[2] === null, JSON.stringify(heard));
}

{
  const game = Game.create(4242);
  const NOW = 1_000_000;
  const spells = new SpellsOnYou(game);
  const mark = (): ReturnType<typeof effectsOn>[number] | undefined => effectsOn(game, spells, NOW).find((e) => e.id === 'grace');
  game.player.graceEnds = NOW + 66000;
  const m = mark();
  check('the effects row: Death grace, for you, with the time left under it', !!m && m.good && m.name === 'Death grace' && m.caption === shortLeft(66000), JSON.stringify(m));
  check('  and on it the island\'s words and what it spares',
    m?.does[0] === `${graceSaid(66000)}.` && m?.does[1] === GRACE_SPARES && m?.from === `Played time under ${DEATH_GRACE_HOURS} h.`, JSON.stringify(m?.does));
  game.player.graceEnds = NOW - 1;
  check('  gone once it is over', mark() === undefined);
  game.player.graceEnds = null;
  check('  and for a character past it', mark() === undefined);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ndeath grace — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
