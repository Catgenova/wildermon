/**
 * Spell timers and the skin over you survive a reload
 * (`what_is_held_on_you_rides_the_beat.sql`).
 *
 * What a spell leaves on you is kept on your row (`player.blessings`), and
 * the skin over you in `stats.aegis` with whoever laid it in
 * `stats.aegisBy`; the browser only ever heard of either at the moment of a
 * cast, so a reload emptied the effects row. What this asks:
 *
 *   * a Thicken, a Ward Link and a Stoneskin cast through the door a browser
 *     uses, and a Ward Other laid over you by somebody else, are on the row
 *     the join hands over, and read back the way the browser reads it
 *     (`heldOf` on the island's clock, `heldFrom`) the effects row lists each
 *     with the seconds the spell gives it, the Thicken's multiplier as the
 *     spell has it, and the skin's size;
 *   * the beat says the same, the skin with the name of whoever laid it, and
 *     the row lists the same; and a little later, the seconds gone by less;
 *   * a Thicken spent by a cast goes from the row at once;
 *   * nothing run out rides along, and nobody else's blessings ever do;
 *   * and every key the island keeps a blessing under is one the effects row
 *     knows the spell of, and every spell it names has a card.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { execFileSync } from 'node:child_process';
// The rulebook first: what the browser's half reads is a part of it and cannot be loaded on its own.
import '../../src/game/actions';
import { Game } from '../../src/game/game';
import { SPELL_BAR, FAITH_SPELL_BY_ID } from '../../src/game/patrons';
import { PERK_BY_ID } from '../../src/game/perks';
import { CLASS_SPELL_BY_ID } from '../../src/game/talents';
import { percent } from '../../src/game/words';
import { heldOf, type HeldSaid } from '../../src/net/island';
import { effectsOn, heldFrom, KEPT_AS, KEPT_ELSEWHERE, shortLeft, skinSaid, SpellsOnYou, type Effect } from '../../src/ui/effects';

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
const near = (a: number | undefined, b: number, by = 0.01): boolean => a !== undefined && Math.abs(a - b) <= by;

const fx = (id: string, k: string): number => {
  const v = CLASS_SPELL_BY_ID.get(id)?.fx[k];
  if (v === undefined) throw new Error(`no ${k} on ${id}`);
  return v;
};
const CLASS_SLOT = SPELL_BAR.indexOf('class');
/** What the three cast on yourself leave, by the key the island keeps each under, and the seconds each gives. */
const MINE: Array<[string, string, number]> = [
  ['thicken', 'warder_thicken', fx('warder_thicken', 'secs')],
  ['ward_link', 'warder_ward_link', fx('warder_ward_link', 'secs')],
  ['stoneskin', 'warder_stoneskin', fx('warder_stoneskin', 'secs')],
];
/** A cast through the door, as a browser makes it: by whom, the spell put in its slot, rested, paid for, and its answer kept. */
const CAST = (key: string, by: string, spell: string, target: string): string => `
  perform set_config('request.jwt.claims', json_build_object('sub', ${by})::text, true);
  update player set used_at = '{}'::jsonb, stats = jsonb_set(stats, '{stamina}', '1') where world_id = w.world_id and uid = ${by};
  delete from caller where uid = ${by};
  perform spell_bar_put(w.world_id, ${by}, ${CLASS_SLOT}, '${spell}');
  r := rpc_cast_spell(w.world_id, ${CLASS_SLOT}, ${target});
  insert into said values ('${key}', coalesce(r->>'why', 'cast'));`;
const ON_ME = `jsonb_build_object('kind', 'self')`;

/* ---- The island's half ------------------------------------------------- */

const out = psql(`
begin;
create temp table said (k text, v text);
do $b$
declare w record; o uuid; v_px double precision; v_py double precision; r jsonb;
begin
  -- An island with land and two people on it: you, and a Warder two tiles off.
  select p.world_id, p.uid, wd.spawn_x, wd.spawn_y into w from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile lt where lt.world_id = wd.id)
     and (select count(*) from player q2 where q2.world_id = p.world_id) >= 2
   order by wd.size desc, p.world_id, p.uid limit 1;
  select uid into o from player where world_id = w.world_id and uid <> w.uid order by uid limit 1;
  v_px := w.spawn_x + peace_reach() + 10.5; v_py := w.spawn_y + 0.5;
  update placed set driver = null where world_id = w.world_id and driver in (w.uid, o);
  update player set x = v_px, y = v_py, level = 0, aboard = null, away = false, act = null, act_target = null,
         act_ends = null, act_queue = '[]', wounds = '[]'::jsonb, blessings = '{}'::jsonb, used_at = '{}'::jsonb,
         body_at = now(), craft_class = null, combat_class = 'warder', class_mul = null, class_level = 0, moved_at = now(),
         spell_bar = (select jsonb_agg('null'::jsonb) from spell_slot),
         stats = (coalesce(stats, '{}'::jsonb) - 'hurtAt' - 'hurtBy' - 'aegisBy')
                 || jsonb_build_object('health', 1, 'hunger', 1, 'thirst', 1, 'stamina', 1, 'aegis', 0, 'hurtSettled', now())
   where world_id = w.world_id and uid in (w.uid, o);
  update player set x = v_px + 2 where world_id = w.world_id and uid = o;
  update player set x = v_px - 60 where world_id = w.world_id and uid not in (w.uid, o);
  insert into skill (world_id, uid, id, value)
    select w.world_id, pp.uid, 'warding', 60 from (select unnest(array[w.uid, o]) as uid) pp
    on conflict (world_id, uid, id) do update set value = excluded.value;
  delete from player_node where world_id = w.world_id and uid in (w.uid, o);
  insert into player_node (world_id, uid, node) select w.world_id, pp.uid, cs.id from class_spell cs
    cross join (select unnest(array[w.uid, o]) as uid) pp where cs.class = 'warder' on conflict do nothing;
  delete from item where world_id = w.world_id and holder = 'player' and holder_uid in (w.uid, o) and def = 'focus';
  perform give(w.world_id, w.uid, 'focus', 1, 80, 'Topaz');
  perform give(w.world_id, o, 'focus', 1, 80, 'Topaz');
  insert into said values ('W', w.uid::text), ('O', o::text), ('ONAME', (select name from player where world_id = w.world_id and uid = o));

  -- A skin laid over you by the other, and a blessing of their own, which is nobody's business but theirs.
  ${CAST('OTHER', 'o', 'warder_ward_other', `jsonb_build_object('kind', 'player', 'uid', w.uid)`)}
  ${CAST('THEIRS', 'o', 'warder_unbreakable', ON_ME)}
  -- Three of your own.
  ${MINE.map(([key, spell]) => CAST(`CAST:${key}`, 'w.uid', spell, ON_ME)).join('\n')}
  -- And one run out a second ago.
  update player set blessings = blessings || jsonb_build_object('decoy', jsonb_build_object('until', now() - interval '1 second'))
   where world_id = w.world_id and uid = w.uid;

  -- Read back as a browser reads it: the join, and then the beat.
  perform set_config('request.jwt.claims', json_build_object('sub', w.uid)::text, true);
  delete from caller where uid = w.uid;
  insert into said select 'JOIN', rpc_join(w.world_id, null)::text;
  delete from caller where uid = w.uid;
  insert into said select 'BEAT', rpc_settle(p_world => w.world_id)::text;

  -- Every key the island keeps a blessing under.
  insert into said select 'KEYS', string_agg(distinct m[1], ',')
    from pg_proc p cross join lateral regexp_matches(p.prosrc, 'blessing_put\\(\\s*[^,]+,\\s*[^,]+,\\s*''([a-z_]+)''', 'g') m
   where p.pronamespace = 'public'::regnamespace;
end $b$;
select k || '=' || v from said;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const W = said.get('W') ?? '';
const O = said.get('O') ?? '';
const ONAME = said.get('ONAME') ?? '';

/* ---- The casts ---------------------------------------------------------- */

check('a Ward Other is laid over you by somebody else', said.get('OTHER') === 'cast', said.get('OTHER'));
check('they cast an Unbreakable on themselves', said.get('THEIRS') === 'cast', said.get('THEIRS'));
for (const [key] of MINE) check(`your ${key} is cast`, said.get(`CAST:${key}`) === 'cast', said.get(`CAST:${key}`));

/* ---- What the browser makes of it ---------------------------------------- */

const join = JSON.parse(said.get('JOIN') ?? '{}') as { world: { epoch: string }; time: number; you: { blessings: unknown; stats: Record<string, unknown> } };
const beat = JSON.parse(said.get('BEAT') ?? '{}') as { blessings?: unknown; skin?: { size?: number; by?: string; name?: string } };

/** A game holding what the island said, as `play.ts` puts it: what is held, and the skin with who laid it. */
const gameWith = (held: Record<string, HeldSaid>, skin: { size: number; by: string | null; name: string | null }): { game: Game; spells: SpellsOnYou } => {
  const game = Game.create(4242);
  game.time = 1000;
  game.player.held = heldFrom(held, game.time);
  game.player.heldAt = game.time;
  game.player.skin = { size: skin.size, mine: skin.by === W, by: skin.name };
  return { game, spells: new SpellsOnYou(game) };
};
const mark = (list: Effect[], id: string): Effect | undefined => list.find((e) => e.id === id);
const SKIN = typeof join.you.stats.aegis === 'number' ? join.you.stats.aegis : 0;
const MORE = fx('warder_thicken', 'more');

/** What the row says of a game: the three of yours with their seconds, the Thicken's multiplier, and the skin. */
const rowSays = (how: string, game: Game, spells: SpellsOnYou, held: Record<string, HeldSaid>, gone: number, layer: string | null): void => {
  const row = effectsOn(game, spells);
  for (const [key, spell, secs] of MINE) {
    const e = mark(row, `spell:${spell}`);
    // The seconds as the browser read them, which on the join's instants are the spell's own to the millisecond (checked above).
    const left = (held[key]?.secs ?? secs) - gone;
    if (left <= 0) {
      check(`${how}: ${key} is gone from the row once its ${secs} s are up`, !e, e?.caption);
      continue;
    }
    check(`${how}: the row lists ${key} with ${shortLeft(left)} left`, e?.caption === shortLeft(left) && !!e?.does.some((d) => d.endsWith(' left.')),
      e ? `${e.caption}: ${e.does.join(' ')}` : 'not listed');
  }
  const thick = mark(row, 'spell:warder_thicken');
  check(`${how}: the Thicken says its multiplier, ×${MORE}, ${percent(MORE - 1)} larger`,
    !!thick?.does.some((d) => d.includes(`Next skin: ×${MORE} (+${percent(MORE - 1)})`)), thick?.does.join(' '));
  check(`${how}: the Thicken is yours, which only you can cast on you`, thick?.from === 'Cast by you: Warder spell.', thick?.from);
  const skin = mark(row, 'skin');
  check(`${how}: the row lists the skin over you at ${skinSaid(SKIN)}`, skin?.caption === skinSaid(SKIN) && skin?.name === `Skin of ${skinSaid(SKIN)}`,
    skin ? `${skin.name} (${skin.caption})` : 'not listed');
  check(`${how}: the skin says who laid it${layer ? `, ${layer}` : ', where nobody has said'}`,
    skin?.from === (layer ? `Laid by ${layer}.` : 'Source: Warder spell, Aegis or Bulwark.'), skin?.from);
  check(`${how}: nothing of anybody else's is on the row`, !mark(row, 'spell:warder_unbreakable'));
};

check('the skin over you is a Ward Other\'s, by the one who laid it', SKIN > 0 && join.you.stats.aegisBy === O, `${SKIN} by ${String(join.you.stats.aegisBy)}`);

// On the join: the row as the island keeps it, its instants read on the island's clock (`Island.held`).
const epoch = Date.parse(join.world.epoch);
const loaded = heldOf(join.you.blessings, (until) => (Date.parse(until) - epoch) / 1000 - join.time);
check('the join hands over yours and nothing run out', Object.keys(loaded).sort().join(',') === MINE.map(([k]) => k).sort().join(','),
  Object.keys(loaded).join(','));
for (const [key, , secs] of MINE) check(`the join says ${key} has its ${secs} s`, near(loaded[key]?.secs, secs), String(loaded[key]?.secs));
const atJoin = gameWith(loaded, { size: SKIN, by: O, name: null });
rowSays('after a reload', atJoin.game, atJoin.spells, loaded, 0, null);
atJoin.game.time += 25;
rowSays('25 s after a reload', atJoin.game, atJoin.spells, loaded, 25, null);

// On the beat: seconds left, and the skin with a name.
const beaten = heldOf(beat.blessings, () => NaN);
check('the beat says yours and nothing run out', Object.keys(beaten).sort().join(',') === MINE.map(([k]) => k).sort().join(','),
  Object.keys(beaten).join(','));
for (const [key, , secs] of MINE) check(`the beat says ${key} has its ${secs} s`, near(beaten[key]?.secs, secs), String(beaten[key]?.secs));
check('the beat says the Thicken\'s multiplier', beaten.thicken?.more === MORE, String(beaten.thicken?.more));
check('the beat says the skin over you and who laid it', near(beat.skin?.size, SKIN, 1e-9) && beat.skin?.by === O && beat.skin?.name === ONAME,
  JSON.stringify(beat.skin));
const onBeat = gameWith(beaten, { size: beat.skin?.size ?? 0, by: beat.skin?.by ?? null, name: beat.skin?.name ?? null });
rowSays('on the beat', onBeat.game, onBeat.spells, beaten, 0, ONAME);

// A Thicken spent by the skin it made larger goes from the row then, not at the next beat.
onBeat.game.events.emit('cast', { spell: 'warder_ward', by: null, at: { kind: 'self' }, told: { hit: [], used: ['warder_thicken'] } });
check('a Thicken spent by a cast goes from the row at once', !mark(effectsOn(onBeat.game, onBeat.spells), 'spell:warder_thicken'));

// Nobody else's, and nothing run out.
const raw = JSON.stringify([join.you.blessings, beat.blessings]);
check('neither the join nor the beat carries anybody else\'s blessings', !raw.includes('unbreakable'), raw);
check('nothing run out is said on the beat', !JSON.stringify(beat.blessings).includes('decoy'));

/* ---- Every key the island keeps, known ------------------------------------ */

const keys = (said.get('KEYS') ?? '').split(',').filter(Boolean);
check('the island keeps blessings under keys at all', keys.length > 20, String(keys.length));
const unknown = keys.filter((k) => !KEPT_AS[k] && !KEPT_ELSEWHERE.test(k));
check('every key the island keeps a blessing under is one the effects row knows', unknown.length === 0, unknown.join(', '));
const stale = Object.keys(KEPT_AS).filter((k) => !keys.includes(k));
check('every key the effects row knows is one the island keeps', stale.length === 0, stale.join(', '));
const noCard = Object.values(KEPT_AS).filter((id) => !CLASS_SPELL_BY_ID.has(id) && !FAITH_SPELL_BY_ID.has(id) && !PERK_BY_ID.has(id));
check('every spell and passive the effects row names is one there is', noCard.length === 0, noCard.join(', '));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`spell timers and the skin over you through a reload — ${ok.length} of ${ok.length}`);
