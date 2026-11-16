/**
 * The Sapgnaw in every body's field guide from the start, so Track takes it at once.
 *
 * Reported: "players are not starting the game with Saginaw discovered in the field guide, so they cant track him".
 * This asks, of both sides:
 *
 *   * that the kinds a book starts with (`GUIDE_START`, the island's `guide_start`) are the same, the Sapgnaw one of
 *     them, and are every kind a Guiding Light step or detour asks to track or tame ("Make sure for those that already
 *     populate as seen in the guide");
 *   * that a new body's book has them seen and nothing more: the browser's (`startGuide`) and the island's, from the
 *     join (`guide_begin`), read back through `rpc_guide`;
 *   * that the migration's backfill gives it to a body already on the island without it, run twice, and changes no
 *     other row of that book (seen, tamed, bred, when it was seen) nor the Guiding Light's notes; and leaves a book
 *     that has it already, tamed and bred, as it was;
 *   * that Track is not refused for it, and a go reads the way to a wild one put down here, past a kept one nearer,
 *     in the same line and arrow on both sides, at two bands;
 *   * that a new body comes ashore with a wild one within `WILD_NEAR` tiles, an ordinary one on ground it lives on,
 *     and a second body coming ashore beside it puts down no other;
 *   * that reaching a Guiding Light tame step (the chiptail's, by its tick kept through the beat) puts a wild quarra
 *     within `WILD_NEAR` of you on rock and marks it seen, once: reached again with none left near, nothing; a taming
 *     detour whose kind is tamed already puts nothing; and the swimmer's (the wadd, `finlet`) lands on ground beside
 *     water, which is where it lives (no kind the Path tames is one of the deep water);
 *   * that reaching the step hands out `PATH_CRATES` issued wildermon crate to a body with none ("enough wildermon
 *     crates to capture the required mons": one follows, so a second is refused without one), once a step; and that
 *     with it the quarra put down is captured on the island, into the crate.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { SPECIES } from '../../src/game/creatures';
import { FieldGuide } from '../../src/game/guide';
import { ASHORE_KINDS, GUIDE_START, PATH_CRATE, PATH_CRATES, PATH_DETOURS, PATH_KINDS, PATH_STEPS, PATH_STOCKS, startGuide, WILD_NEAR } from '../../src/game/path';
import { TRACK, TRACKING, trackable, trackedArrow, trackRefusal, type Trail } from '../../src/game/tracking';
import { psql, check, finish } from './harness';

const KIND = 'bevere';
const DEF = SPECIES[KIND];
/** A kind no book starts with, to show it is the start that does it. */
const OTHER = 'sedra';
const MIGRATION = readFileSync('supabase/migrations/20261120000128_sapgnaw_known_from_the_start.sql', 'utf8');
const BACKFILL = MIGRATION.match(/insert into guide \(world_id, uid, species\)\nselect p\.world_id[\s\S]*?do nothing;/)?.[0] ?? '';

/* Where you stand, a kept one nearer, and the wild one tracked twenty-six tiles out at a bearing of about 67°. */
const P = { x: 20.5, y: 20.5 };
const KEPT = [3, 0] as const;
const WILD = [24, -10] as const;
const WILD_SKILLS = { woodcutting: 12 };
/** The goes: a Tracking, and the roll forced. */
const GOES = [{ name: 'eight', skill: 35, roll: 0.5 }, { name: 'degree', skill: 90, roll: 0.5 }] as const;

const NEW = '7e5b0000-0000-4000-8000-0000000005a1';
/** A second body coming ashore beside the first, and the one the Guiding Light is asked of. */
const BESIDE = '7e5b0000-0000-4000-8000-0000000005a4';
const LIGHT = '7e5b0000-0000-4000-8000-0000000005a5';
/** The wildermon crates in that body's pack, empty or not. */
const CR = `(select count(*) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = '${LIGHT}' and i.def = '${PATH_CRATE}')`;
/** The steps before a step, ticked. */
const ticksBefore = (step: string): string =>
  JSON.stringify(PATH_STEPS.slice(0, PATH_STEPS.findIndex((s) => s.id === step)).map((s) => `path:${s.id}`));
/** The wild ones of a kind within `WILD_NEAR` of a body, nobody's: "id:rare:stage:distance:suits:water:rock", nearest first. */
const NEAR = (uid: string, kind: string): string => `coalesce((select string_agg(c.id || ':' || coalesce(c.rare, '-') || ':' || stage_of(c) || ':'
    || ceil(sqrt(power(creature_x(c) - pl.x, 2) + power(creature_y(c) - pl.y, 2))) || ':' || suits(w, c.species, floor(c.to_x)::int, floor(c.to_y)::int)
    || ':' || near_tile(w, floor(c.to_x)::int, floor(c.to_y)::int, 'water') || ':' || (land_tile(w, floor(c.to_x)::int, floor(c.to_y)::int) = tile_id('Rock')),
    ',' order by sqrt(power(creature_x(c) - pl.x, 2) + power(creature_y(c) - pl.y, 2)))
  from creature c join player pl on pl.world_id = w and pl.uid = '${uid}'
 where c.world_id = w and c.species = '${kind}' and c.mode = 'wild' and c.keeper is null
   and sqrt(power(creature_x(c) - pl.x, 2) + power(creature_y(c) - pl.y, 2)) <= ${WILD_NEAR}), '-')`;
const OLD = '7e5b0000-0000-4000-8000-0000000005a2';
const HAD = '7e5b0000-0000-4000-8000-0000000005a3';
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
/** A book as rows, for asking whether anything in it moved: species, tamed, bred and when it was seen. */
const ROWS = (uid: string): string => `coalesce((select string_agg(species || ':' || tamed || ':' || bred || ':' || seen_at, ',' order by species)
    from guide where world_id = w and uid = '${uid}'), '-')`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
begin
  return current_setting('wildermon.dice')::double precision;
end $f$;
do $t$
declare w uuid; v_n bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Sapfold', 128, 64, 20, 20, true) returning id into w;
  perform land_blank(w, 64);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 63) x, generate_series(0, 63) y;
  -- Ground above the water everywhere, a pond to the east of the spawn and bare rock to its west.
  perform land_set_height(w, x, y, 20) from generate_series(0, 64) x, generate_series(0, 64) y;
  perform land_set_height(w, x, y, -50) from generate_series(27, 30) x, generate_series(18, 21) y;
  perform land_set_tile(w, x, y, tile_id('Rock')) from generate_series(11, 15) x, generate_series(17, 23) y;
  insert into said values ('START', array_to_string(guide_start(), ','));
  insert into said values ('NEAR_FN', wild_near()::text);
  insert into said values ('ASHORE', array_to_string(ashore_kinds(), ','));
  insert into said values ('STOCKS', (select string_agg(id || ':' || species || ':' || beside, ',') from thepath_stocks()));

  -- Two bodies already on the island, from before: one without it, one with it tamed and bred.
  insert into player (world_id, uid, name, x, y, stats) values
    (w, '${OLD}', 'Elder', 30.5, 30.5, ${BODY}), (w, '${HAD}', 'Keeper', 32.5, 30.5, ${BODY});
  insert into guide (world_id, uid, species, seen_at, tamed, bred) values
    (w, '${OLD}', 'rabba', now() - interval '9 days', false, false),
    (w, '${OLD}', 'vola', now() - interval '8 days', true, false),
    (w, '${OLD}', 'cudda', now() - interval '7 days', true, true),
    (w, '${OLD}', 'woola:1', now() - interval '6 days', true, false),
    (w, '${OLD}', 'rabba/colour', now() - interval '5 days', true, false),
    (w, '${HAD}', '${KIND}', now() - interval '4 days', true, true);
  insert into guide_noted (world_id, uid, species, noted_at) values (w, '${OLD}', 'quarra', now() - interval '3 days');
  insert into said values ('OLD_BEFORE', ${ROWS(OLD)});
  insert into said values ('HAD_BEFORE', ${ROWS(HAD)});
  insert into said values ('NOTED_BEFORE', (select string_agg(species || ':' || noted_at, ',') from guide_noted where world_id = w and uid = '${OLD}'));
  insert into said values ('OLD_REFUSED', coalesce(track_refusal(w, '${OLD}', 'track', jsonb_build_object('kind', 'tile', 'species', '${KIND}')), '-'));
end $t$;
-- The migration's backfill, twice: the second finds nothing to do.
${BACKFILL}
${BACKFILL}
do $t$
declare w uuid := (select id from world where name = 'Sapfold'); v_kept int; v_wild int; v_n bigint;
        v_q int; v_qx double precision; v_qy double precision;
begin
  insert into said values ('OLD_AFTER', ${ROWS(OLD)});
  insert into said values ('HAD_AFTER', ${ROWS(HAD)});
  insert into said values ('NOTED_AFTER', (select string_agg(species || ':' || noted_at, ',') from guide_noted where world_id = w and uid = '${OLD}'));
  insert into said values ('OLD_TRACK', coalesce(track_refusal(w, '${OLD}', 'track', jsonb_build_object('kind', 'tile', 'species', '${KIND}')), '-'));

  -- A new body: its book from the join.
  perform set_config('request.jwt.claims', json_build_object('sub', '${NEW}')::text, true);
  perform rpc_join(w, 'Sprout');
  update player set body_at = now(), x = ${P.x}, y = ${P.y} where world_id = w and uid = '${NEW}';
  insert into said values ('NEW_BOOK', rpc_guide(w)::text);
  insert into said values ('NEW_ROWS', (select string_agg(species || ':' || tamed || ':' || bred, ',' order by species) from guide where world_id = w and uid = '${NEW}'));
  insert into said values ('NEW_TRACK', coalesce(track_refusal(w, '${NEW}', 'track', jsonb_build_object('kind', 'tile', 'species', '${KIND}')), '-'));
  insert into said values ('NEW_OTHER', coalesce(track_refusal(w, '${NEW}', 'track', jsonb_build_object('kind', 'tile', 'species', '${OTHER}')), '-'));
  -- Come ashore: a wild one near; and a second body beside it, none more.
  insert into said values ('JOIN_NEAR', ${NEAR(NEW, KIND)});
  perform set_config('request.jwt.claims', json_build_object('sub', '${BESIDE}')::text, true);
  perform rpc_join(w, 'Beside');
  insert into said values ('JOIN2_NEAR', ${NEAR(BESIDE, KIND)});
  insert into said values ('JOIN_ALL', (select count(*)::text from creature where world_id = w and species = '${KIND}' and mode = 'wild')
    || '|' || (select count(*) from creature where world_id = w and species = any (guide_start()) and species <> '${KIND}'));
  perform set_config('request.jwt.claims', json_build_object('sub', '${NEW}')::text, true);
  delete from creature where world_id = w and species = '${KIND}';

  -- The ground: a kept one beside you and a wild one out at 67°.
  v_kept := creature_spawn(w, '${KIND}', ${P.x + KEPT[0]}, ${P.y + KEPT[1]}, 'active', now() - interval '60 days', '${NEW}');
  v_wild := creature_spawn(w, '${KIND}', ${P.x + WILD[0]}, ${P.y + WILD[1]}, 'wild', now() - interval '60 days', null);
  update creature set skills = '${JSON.stringify(WILD_SKILLS)}'::jsonb where world_id = w and id = v_wild;

  perform set_config('search_path', 'dice, public, pg_catalog', true);
${GOES.map((g) => `
  perform set_config('wildermon.dice', '${g.roll}', true);
  insert into skill (world_id, uid, id, value) values (w, '${NEW}', tracking_skill(), ${g.skill})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  select coalesce(max(n), 0) into v_n from event where world_id = w and uid = '${NEW}';
  perform perform_track(w, '${NEW}', 'track', jsonb_build_object('kind', 'tile', 'x', 20, 'y', 20, 'cx', 20, 'cy', 20, 'species', '${KIND}'));
  insert into said values ('GO_${g.name}', coalesce((select text from event where world_id = w and uid = '${NEW}' and n > v_n and kind in ('event', 'error')
    and text not like '%increased by%' order by n limit 1), '-'));
  insert into said values ('ARROW_${g.name}', coalesce((select text from event where world_id = w and uid = '${NEW}' and n > v_n and kind = 'tracked'), '-'));`).join('\n')}
  perform set_config('search_path', '"$user", public', true);
  delete from creature where world_id = w and species = '${KIND}';

  -- The Guiding Light: a body at the spawn, on, with every step before the clay's ticked and the clay's met.
  perform set_config('request.jwt.claims', json_build_object('sub', '${LIGHT}')::text, true);
  perform rpc_join(w, 'Lightfoot');
  delete from creature where world_id = w and species = '${KIND}';
  update player set body_at = now(), x = 20.5, y = 20.5, thepath = '{"on": true, "did": {"clay": 1}}'::jsonb,
         ticked = '${ticksBefore('clay')}'::jsonb
   where world_id = w and uid = '${LIGHT}';
  delete from creature where world_id = w and species = 'quarra';
  -- One follows already: a second is tamed only into an empty crate, and there is none in the pack.
  perform creature_spawn(w, 'woola', 20.5, 21.5, 'active', now() - interval '60 days', '${LIGHT}');
  insert into said values ('ROOM_BEFORE', coalesce(tame_room_refusal(w, '${LIGHT}'), '-') || '|' || ${CR});
  select coalesce(max(n), 0) into v_n from event where world_id = w and uid = '${LIGHT}';
  -- The clay's tick kept through the beat: the chiptail's step is reached.
  perform rpc_settle(null, w, null, false, '["path:clay"]'::jsonb);
  insert into said values ('CHIP_TICKED', (select (ticked ? 'path:clay')::text from player where world_id = w and uid = '${LIGHT}'));
  insert into said values ('CHIP_NEAR', ${NEAR(LIGHT, 'quarra')});
  insert into said values ('CHIP_SEEN', (select count(*)::text from guide where world_id = w and uid = '${LIGHT}' and species = 'quarra' and not tamed));
  insert into said values ('CHIP_STOCKED', coalesce((select thepath->'stocked'->>'chiptail' from player where world_id = w and uid = '${LIGHT}'), '-'));
  insert into said values ('CHIP_SAID', coalesce((select string_agg(text, ' / ' order by n) from event where world_id = w and uid = '${LIGHT}' and n > v_n
    and text like 'Guiding Light:%'), '-'));
  insert into said values ('CRATES', ${CR} || '|' || (select string_agg(i.issued || ':' || coalesce(i.creature::text, '-'), ',') from item i
    where i.world_id = w and i.holder = 'player' and i.holder_uid = '${LIGHT}' and i.def = '${PATH_CRATE}')
    || '|' || coalesce((select (thepath->'crates'->>'chiptail') = (select max(i.id)::text from item i where i.world_id = w and i.holder_uid = '${LIGHT}'
         and i.def = '${PATH_CRATE}') from player where world_id = w and uid = '${LIGHT}')::text, '-'));
  insert into said values ('ROOM_AFTER', coalesce(tame_room_refusal(w, '${LIGHT}'), '-'));
  -- Captured with it: beside the quarra put down, its favourite offered.
  select c.id, c.to_x, c.to_y into v_q, v_qx, v_qy from creature c where c.world_id = w and c.species = 'quarra' and c.mode = 'wild' order by c.id limit 1;
  update player set x = v_qx, y = v_qy where world_id = w and uid = '${LIGHT}';
  insert into item (world_id, holder, holder_uid, def, ql, count) select w, 'player', '${LIGHT}', d.favourite, 20, 3 from species_def d where d.id = 'quarra';
  perform perform_creature(w, '${LIGHT}', 'tame', jsonb_build_object('kind', 'creature', 'id', v_q));
  insert into said values ('CAPTURE', coalesce((select c.mode || '|' || (c.keeper = '${LIGHT}') from creature c where c.world_id = w and c.id = v_q), 'gone')
    || '|' || (select count(*) from item i where i.world_id = w and i.holder_uid = '${LIGHT}' and i.def = '${PATH_CRATE}' and i.creature = v_q));
  update player set x = 20.5, y = 20.5 where world_id = w and uid = '${LIGHT}';
  -- Reached again, none wild left near: skipped and taken back, through the doors.
  perform rpc_thepath_skip(w, 'chiptail', true);
  perform rpc_thepath_skip(w, 'chiptail', false);
  insert into said values ('CHIP_AGAIN', (select count(*)::text from creature where world_id = w and species = 'quarra' and mode = 'wild')
    || '|' || ${CR});
  insert into said values ('CHIP_KEPT', (select (thepath->'stocked')::text || '|' || (thepath->'skip')::text from player where world_id = w and uid = '${LIGHT}'));
  -- A taming detour whose kind is tamed already: the forage step's (the rabba's), nothing.
  update player set ticked = '${ticksBefore('forage')}'::jsonb where world_id = w and uid = '${LIGHT}';
  perform guide_mark(w, '${LIGHT}', 'rabba', 'tamed');
  delete from creature where world_id = w and species = 'rabba';
  perform private.thepath_stock(w, '${LIGHT}');
  insert into said values ('MET_NONE', (select count(*)::text from creature where world_id = w and species = 'rabba')
    || '|' || coalesce((select thepath->'stocked'->>'snufflet' from player where world_id = w and uid = '${LIGHT}'), '-'));
  -- The swimmer's detour, at the fishing step.
  update player set ticked = '${ticksBefore('fish')}'::jsonb where world_id = w and uid = '${LIGHT}';
  delete from creature where world_id = w and species = 'wadd';
  perform private.thepath_stock(w, '${LIGHT}');
  insert into said values ('WADD_NEAR', ${NEAR(LIGHT, 'wadd')});
  insert into said values ('WADD_CRATES', ${CR} || '|' || coalesce((select thepath->'crates' ? 'finlet' from player where world_id = w and uid = '${LIGHT}')::text, '-'));
  insert into said values ('WADD_KINDS', (select string_agg(id || ':' || coalesce(deep_water, false), ',' order by id) from species_def
    where id in (select species from thepath_stocks())));
end $t$;
select k || '=' || coalesce(v, 'NULL') from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the list ------------------------------------------------------------------------------------------------- */

check(`the kinds a book starts with are the same on both sides, the ${DEF.name} among them`,
  said('START') === GUIDE_START.join(',') && GUIDE_START.includes(KIND) && DEF.name === 'Sapgnaw' && !DEF.monster, said('START'));
check(`and they are every kind a Guiding Light step or detour asks to track or tame, ${GUIDE_START.length} of them, once each`,
  [...PATH_STEPS, ...PATH_DETOURS].every((s) => !s.tame || GUIDE_START.includes(s.tame)) && new Set(GUIDE_START).size === GUIDE_START.length
    && [...GUIDE_START].sort().join() === [...PATH_KINDS].sort().join() && GUIDE_START.every((k) => SPECIES[k] && !SPECIES[k].monster),
  GUIDE_START.join());
check(`a wild one is put near a new body of the Track step's kind alone: the ${DEF.name}`, ASHORE_KINDS.join() === KIND && said('ASHORE') === KIND, said('ASHORE'));
check('the migration carries the backfill', BACKFILL.length > 0 && /on conflict \(world_id, uid, species\) do nothing;$/.test(BACKFILL), BACKFILL.slice(0, 80));

/* ---- a new body --------------------------------------------------------------------------------------------------- */

const g = Game.create(1280);
check(`a new body's book in the browser has the ${DEF.name} and every other Guiding Light kind seen, and nothing tamed or bred`,
  g.guide.seen.has(KIND) && [...g.guide.seen].sort().join() === [...GUIDE_START].sort().join() && !g.guide.tamed.size && !g.guide.bred.size && !g.guide.noted.size,
  [...g.guide.seen].join());
check('and a new book is a fresh one each time', startGuide() !== startGuide() && startGuide().seen.has(KIND) && !new FieldGuide().seen.size);
{
  const book = JSON.parse(said('NEW_BOOK')) as { seen: string[]; tamed: string[]; bred: string[]; noted: string[] };
  check(`and on the island, from the join: the same ${GUIDE_START.length} seen, and nothing tamed, bred or noted`,
    book.seen?.join() === [...GUIDE_START].sort().join() && !book.tamed?.length && !book.bred?.length && !book.noted?.length
      && said('NEW_ROWS') === GUIDE_START.map((k) => `${k}:false:false`).sort().join(','), said('NEW_BOOK'));
  const read = FieldGuide.fromJSON(book);
  check('and the browser reads the island\'s book as its own', [...read.seen].sort().join() === [...g.guide.seen].sort().join());
}

/* ---- a body already on the island ------------------------------------------------------------------------------- */

{
  const before = said('OLD_BEFORE').split(',');
  const after = said('OLD_AFTER').split(',');
  const added = after.filter((r) => !before.includes(r));
  check(`a body already on the island without it is refused Track before the backfill`, said('OLD_REFUSED') === trackRefusal(DEF, new Set()), said('OLD_REFUSED'));
  // The rabba it had seen already stays its row; every other start kind is added, seen and nothing more.
  const want = GUIDE_START.filter((k) => !before.some((r) => r.startsWith(`${k}:`))).sort();
  check(`and has the ${DEF.name} and each other start kind it had not seen after it, seen, once, run twice`,
    want.includes(KIND) && !want.includes('rabba') && added.map((r) => r.split(':')[0]).sort().join() === want.join()
      && added.every((r) => /^[a-z_]+:false:false:/.test(r)), added.join(' '));
  check('and every row of the book it had as it was: seen, tamed, bred and when, stages and forms too',
    before.every((r) => after.includes(r)) && after.length === before.length + want.length && before.length === 5, `${said('OLD_BEFORE')} → ${said('OLD_AFTER')}`);
  check('and the Guiding Light\'s notes as they were', said('NOTED_AFTER') === said('NOTED_BEFORE') && said('NOTED_BEFORE').startsWith('quarra:'), said('NOTED_AFTER'));
  check('and Track is not refused for it', said('OLD_TRACK') === '-', said('OLD_TRACK'));
  check(`a body that had it tamed and bred keeps it so, its row untouched`,
    said('HAD_AFTER').split(',').includes(said('HAD_BEFORE')) && said('HAD_BEFORE').startsWith(`${KIND}:true:true:`)
      && said('HAD_AFTER').split(',').length === GUIDE_START.length, `${said('HAD_BEFORE')} → ${said('HAD_AFTER')}`);
}

/* ---- Track ---------------------------------------------------------------------------------------------------- */

const track = ACTION_BY_ID.get(TRACK)!;
const T: Target = { kind: 'tile', x: 20, y: 20, cx: 20, cy: 20, species: KIND };
check(`a new body's ${DEF.name} page has a Track button, and a kind not started with has none`,
  trackable(DEF, g.guide.seen, g.guide.noted) && !trackable(SPECIES[OTHER], g.guide.seen, g.guide.noted));
check('Track is not refused for it on either side; a kind not started with is, in the same words',
  said('NEW_TRACK') === '-' && track.check?.(T, g) === null
    && said('NEW_OTHER') === trackRefusal(SPECIES[OTHER], g.guide.seen, g.guide.noted) && track.check?.({ ...T, species: OTHER }, g) === said('NEW_OTHER'),
  `${said('NEW_TRACK')} / ${said('NEW_OTHER')}`);

for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
g.player.x = P.x;
g.player.y = P.y;
const put = (at: readonly [number, number], mode: 'wild' | 'active') => {
  const c = g.creatures.spawn(KIND, P.x + at[0], P.y + at[1], mode, () => 0.5, g.time);
  c.moving = false;
  return c;
};
put(KEPT, 'active');
put(WILD, 'wild').skills = { ...WILD_SKILLS };
for (const go of GOES) {
  g.skills.values.set(TRACKING, go.skill);
  g.rand = () => go.roll;
  g.trail = null;
  const before = g.log.length;
  track.perform(T, g);
  const line = g.log.slice(before).find((l) => l.kind === 'event')?.text ?? '-';
  const t = g.trail as Trail | null;
  const arrow = t ? `${t.name}|${t.bearing}|${t.dist}` : '-';
  const a = trackedArrow(said(`ARROW_${go.name}`));
  const islandArrow = a ? `${a.name}|${a.bearing}|${a.dist}` : '-';
  check(`Tracking ${go.skill}: the island reads the trail to the wild ${DEF.name}, past the kept one: "${said(`GO_${go.name}`)}"`,
    said(`GO_${go.name}`).startsWith(`Tracks: ${DEF.name}, `) && islandArrow !== '-' && a?.bearing !== undefined, said(`GO_${go.name}`));
  check(`Tracking ${go.skill}: the browser says the same and leaves the same arrow`, line === said(`GO_${go.name}`) && arrow === islandArrow,
    `${line} / ${arrow} vs ${islandArrow}`);
}
check('the degree band names the way to it to the degree, about 67°', said('GO_degree').includes('bearing 67°'), said('GO_degree'));

/* ---- a wild one near ------------------------------------------------------------------------------------------- */

/** "id:rare:stage:distance:suits:water:rock" rows, as `NEAR` says them. */
const rows = (k: string): string[][] => (said(k) === '-' ? [] : said(k).split(',').map((r) => r.split(':')));
check(`the reach and the steps that put one are the same on both sides: ${WILD_NEAR} tiles, ${PATH_STOCKS.length} steps and detours`,
  said('NEAR_FN') === String(WILD_NEAR) && said('STOCKS') === PATH_STOCKS.map((s) => s.join(':')).join(','), `${said('NEAR_FN')} ${said('STOCKS')}`);
{
  const near = rows('JOIN_NEAR');
  check(`a new body comes ashore with one wild ${DEF.name} within ${WILD_NEAR} tiles, of no rarity, at its first stage, on ground it lives on beside water`,
    near.length === 1 && near[0][1] === '-' && near[0][2] === '0' && Number(near[0][3]) <= WILD_NEAR && near[0][4] === 'true' && near[0][5] === 'true',
    said('JOIN_NEAR'));
  check('a second body coming ashore beside it puts down no other', rows('JOIN2_NEAR').length === 1 && rows('JOIN2_NEAR')[0][0] === near[0]?.[0]
    && said('JOIN_ALL') === '1|0', `${said('JOIN2_NEAR')} · ${said('JOIN_ALL')} on the island`);
}
{
  const chip = rows('CHIP_NEAR');
  check('reaching the chiptail\'s step, by the clay\'s tick kept through the beat, puts one wild quarra within reach, ordinary, on rock',
    said('CHIP_TICKED') === 'true' && chip.length === 1 && chip[0][1] === '-' && chip[0][2] === '0' && Number(chip[0][3]) <= WILD_NEAR
      && chip[0][4] === 'true' && chip[0][6] === 'true', said('CHIP_NEAR'));
  check('and marks the quarra seen in the field guide, so Track takes it', said('CHIP_SEEN') === '1', said('CHIP_SEEN'));
  check('and keeps which one, under the step', said('CHIP_STOCKED') === chip[0]?.[0], said('CHIP_STOCKED'));
  check(`and says so: "Guiding Light: wild ${SPECIES.quarra.name}, n tiles. Track: Field guide."`,
    new RegExp(`^Guiding Light: wild ${SPECIES.quarra.name}, \\d+ tiles\\. Track: Field guide\\.$`).test(said('CHIP_SAID')), said('CHIP_SAID'));
  check('with one following and no crate, a second is refused for want of a wildermon crate',
    said('ROOM_BEFORE').endsWith('Need an empty wildermon crate.|0'), said('ROOM_BEFORE'));
  check(`reaching the step hands out ${PATH_CRATES} issued wildermon crate, empty, kept under the step, and the refusal goes`,
    said('CRATES') === `${PATH_CRATES}|true:-|true` && said('ROOM_AFTER') === '-', `${said('CRATES')} · ${said('ROOM_AFTER')}`);
  check('with it the quarra put down is captured on the island: tamed, yours, in the crate', said('CAPTURE') === 'stored|true|1', said('CAPTURE'));
  check('reached again, skipped and taken back with none wild left near, it puts down no other and hands out no other crate: once a step',
    said('CHIP_AGAIN') === `0|${PATH_CRATES}` && said('CHIP_KEPT').startsWith(`{"chiptail": ${chip[0]?.[0]}}|[]`), `${said('CHIP_AGAIN')} · ${said('CHIP_KEPT')}`);
}
check('a taming detour whose kind is tamed already puts nothing down', said('MET_NONE') === '0|-', said('MET_NONE'));
{
  const wadd = rows('WADD_NEAR');
  check(`the swimmer's detour puts its ${SPECIES.wadd.name} within reach on ground it lives on, beside water`,
    wadd.length === 1 && wadd[0][1] === '-' && Number(wadd[0][3]) <= WILD_NEAR && wadd[0][4] === 'true' && wadd[0][5] === 'true', said('WADD_NEAR'));
  check('and a crate for it, the first one being full', said('WADD_CRATES') === `${2 * PATH_CRATES}|true`, said('WADD_CRATES'));
  check('no kind the Guiding Light puts down is one of the deep water', !said('WADD_KINDS').includes(':true') && said('WADD_KINDS').includes('wadd:false'),
    said('WADD_KINDS'));
}

finish('the Sapgnaw known from the start');
