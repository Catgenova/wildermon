/**
 * Skill gates, the second set: wagons, boats, quarried stone, and the gates that were there before (seams, taming,
 * fish) moved onto the one rule; veins named by prospecting.
 *
 * Asked for: "Gate using wagons until driving level 30. Gate boat type use by sailing level"; the existing gates on the
 * one rule with their numbers kept ("6 8 12 etc"); quarried stone by mining; "prospecting will still show all glowing
 * veins, but anything above the prospect gates just shows as unidentified metals". Asked of the island and the browser:
 *
 *   * every seam's, kind's and fish's level is the one it had: the table against the numbers the game held before;
 *   * a wagon at driving 29: refused at the reins in the same words on both sides; at 30, allowed; a large cart at
 *     driving 0, allowed; a passenger boards a caravel at sailing 1;
 *   * each boat at its sailing level: refused a step under it, allowed at it;
 *   * an iron vein at mining 2.3, a marble face at 12: refused in the one rule's words on both sides; at the level,
 *     allowed; a Sapgnaw at taming 0.4 and a Logchewer at 1, refused by the stage's name;
 *   * a quarrier (Chiptail) at mining 1 by marble: not taken, and says why; at 30, taken; by rock as well, the rock;
 *   * prospecting 1 over buried iron and copper: copper named, iron "Unidentified metal" with "More prospecting
 *     required to identify this vein." and no level, in the Prospect lines and the ground's reading, on both sides; at
 *     5, iron named; a find marked for two viewers is read by each one's own prospecting;
 *   * decided since: a bare vein is always named, to everybody: on the wire (`mask_rock` leaves a Rock tile alone, a
 *     buried one sent unidentified), in `tile_change` (the rock of a square gone bare), in Prospect's lines standing on
 *     it and in a prospector's find, and its mining refusal names it;
 *   * the Skills window's Unlocks for driving, sailing, mining, taming (one row a level), fishing and prospecting.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { GATHER_SKILL, SPECIES, EVOLVE_AT, levelSkill, type Creature } from '../../src/game/creatures';
import { FISH } from '../../src/game/fishing';
import { furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { idleSays } from '../../src/game/workerlog';
import { groundReading, groundTip } from '../../src/ui/tileinfo';
import {
  gateOf, seenRock, skillGateRefusal, SKILL_GATES, UNIDENTIFIED_METAL, unlockRows, unlocksOf, nextUnlockSaid, veinTip, VEIN_UNREAD,
  UNLOCK_ROW_NAMES,
} from '../../src/game/skillgates';
import { layChange } from '../../src/net/landpack';
import { bedrockAt } from '../../src/world/ore';
import { ROCK_VARIANTS, TileType, UNIDENTIFIED_ROCK } from '../../src/world/tiles';
import { windAt } from '../../src/game/wind';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000b7e01';
const T = 40;
const SEED = 307;
const rockOf = (yields: string): number => ROCK_VARIANTS.findIndex((r) => r.yields === yields);
const IRON = rockOf('iron_ore');
const COPPER = rockOf('copper_ore');
const MARBLE = rockOf('marble_shards');
const PLAIN = rockOf('rock_shards');
/** The harbour: dry corners to `HX`, deep water past it; boats at (`HX` + 1, `HY`), you on the bank. */
const HX = 54;
const HY = 58;
/** The wagon's and the cart's ground, and where you stand by them. */
const WX = 20;
const WY = 20;
const LOGCHEWER_AT = EVOLVE_AT[0];

/* ---- the numbers the game held before the table: ROCK_VARIANTS' levels, each kind's tameLevel, each fish's ---- */

const OLD_SEAMS: Record<string, number> = {
  copper_ore: 1, coal: 1, tin_ore: 10, zinc_ore: 20, lead_ore: 30, silver_ore: 40, gold_ore: 50, adamantine_ore: 60,
  glimmersteel_ore: 70, mithril_ore: 80, seryll_ore: 90, iron_ore: 5,
};
const OLD_TAME: Record<string, number> = {
  rabba: 1, vola: 1, bevere: 1, crawler: 1, noot: 1, embra: 1, quarra: 1, woola: 1, ulva: 30, magga: 1, mola: 1,
  seavic: 1, roxxen: 25, orse: 30, rowl: 1, bogga: 1, sedra: 1, holla: 1, dowse: 15, sappa: 10, snedda: 1, grubba: 1,
  plucka: 1, cobbe: 20, tinka: 25, middun: 8, kemma: 12, sheela: 16, salva: 20, carra: 22, tanna: 18, grista: 14,
  wicka: 24, brambo: 1, grazza: 1, siffa: 20, potta: 14, cindra: 16, hoppa: 18, simma: 16, relka: 28, bedda: 10,
  wurla: 1, sprigga: 1, ambra: 1, petta: 1, scurra: 1, rippa: 14, chissa: 16, mudda: 8, flecha: 20, papra: 18,
  glimmip: 20, glossa: 24, dippa: 1, thumpa: 28, spitta: 26, awla: 24, sparra: 6, lungra: 24, crakka: 28, whirla: 30,
  scorcha: 30, frosta: 28, dulla: 1, stona: 26, leecha: 28, whispet: 28, crumbud: 28, bura: 1, wadd: 1, springlet: 40,
  warda: 30, quill: 12, cudda: 14, vesp: 1, snout: 50,
};
const OLD_FISH: Record<string, number> = { minnow: 1, perch: 1, trout: 15, pike: 35, sturgeon: 60, cod: 20, halibut: 45, bluefin: 70 };

/** Where a piece set down at (`WX` + 1, `WY`) has its middle, as the browser has it (`furnitureCentre`). */
const centre = (kind: string): [number, number] => furnitureCentre({ kind, x: WX + 1, y: WY, sx: 0, sy: 0 } as PlacedFurniture);

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.run(w uuid, p_id int, n int) returns void language plpgsql as $r$
declare i int;
begin
  for i in 1..n loop
    update creature set until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds',
           leg_at = now() - interval '61 seconds', leg_ends = now() - interval '60 seconds', from_x = to_x, from_y = to_y,
           worn = 0, hunger = 1
     where world_id = w and id = p_id and mode = 'deed';
    perform worker_settle(w, p_id);
  end loop;
end $r$;
create function pg_temp.bare(w uuid, x int, y int, rock int) returns void language plpgsql as $b$
declare dx int; dy int;
begin
  perform land_set_rock(w, x, y, rock);
  for dy in 0..1 loop for dx in 0..1 loop
    perform land_set_dirt(w, x + dx, y + dy, 0);
    perform reconcile_around(w, x + dx, y + dy);
  end loop; end loop;
end $b$;
create function pg_temp.quarrier(w uuid, u uuid, skill double precision) returns int language plpgsql as $m$
declare v int; j jsonb;
begin
  v := creature_spawn(w, 'quarra', ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, name = 'Pip',
         skills = jsonb_build_object('mining', skill) where world_id = w and id = v;
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v));
  update creature set job = 'quarry' where world_id = w and id = v;
  return v;
end $m$;
create function pg_temp.idle(w uuid, p_id int) returns text language sql as $i$
  select coalesce(idle_why, '') || '|' || coalesce(round(idle_n::numeric)::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = $1 and id = $2;
$i$;
create function pg_temp.skill(w uuid, u uuid, id text, v real) returns void language sql as $s$
  insert into skill (world_id, uid, id, value) values (w, u, id, v)
    on conflict (world_id, uid, id) do update set value = excluded.value;
$s$;
create function pg_temp.ask(w uuid, u uuid, a text, t jsonb) returns text language sql as $a$
  select coalesce(act_refusal(w, u, a, t), 'ALLOWED');
$a$;
-- A fair breeze: no gale to keep a rowing boat in.
create or replace function world_wind(p_world uuid, out dir double precision, out force double precision) language sql stable
  as 'select 0::double precision, 0.3::double precision';
do $t$
declare w uuid; u uuid := '${U}'; v_m int; v_p bigint; v_c int; i int; t jsonb;
begin
  insert into said select 'GATES', string_agg(kind || ':' || id || ':' || name || ':' || skill || ':' || level, ',' order by kind, id) from skill_gate;
  insert into said select 'ROCK_DEF', string_agg(yields || ':' || level, ',' order by id) from rock_def;
  insert into said select 'TAME_DEF', string_agg(id || ':' || tame_level, ',' order by id) from species_def where id in (select id from skill_gate where kind = 'tame');
  insert into said select 'FISH_DEF', string_agg(id || ':' || level, ',' order by id) from fish_def;
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Gates B', ${SEED}, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform land_set_height(w, x, y, 50) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform land_set_dirt(w, x, y, 14) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform land_set_rock(w, x, y, ${PLAIN}) from generate_series(${T - 8}, ${T + 8}) x, generate_series(${T - 8}, ${T + 8}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Gatestead', ${T}, ${T}, 15, 5, u);
  update player set x = ${T}.5, y = ${T + 1}.5, body_at = now(), seen_at = now(),
         stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;

  /* ---- a wagon and a large cart, each with its team ---- */
  update player set x = ${WX}.5, y = ${WY}.5 where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'wagon', ${WX + 1}, ${WY}, 0, 0, ${centre('wagon')[0]}, ${centre('wagon')[1]}, 50)
    returning id into v_p;
  for i in 1..4 loop
    v_c := creature_spawn(w, 'roxxen', ${WX + 5}.5, ${WY - 1} + i, 'active', now() - interval '60 days', u);
    update creature set hitched_to = v_p, hunger = 1 where world_id = w and id = v_c;
  end loop;
  t := jsonb_build_object('kind', 'furniture', 'id', v_p);
  perform pg_temp.skill(w, u, 'driving', 29);
  insert into said values ('WAGON29', pg_temp.ask(w, u, 'board_vehicle', t));
  perform pg_temp.skill(w, u, 'driving', 30);
  insert into said values ('WAGON30', pg_temp.ask(w, u, 'board_vehicle', t));
  delete from creature where world_id = w and hitched_to = v_p;
  delete from placed where id = v_p;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'large_cart', ${WX + 1}, ${WY}, 0, 0, ${centre('large_cart')[0]}, ${centre('large_cart')[1]}, 50)
    returning id into v_p;
  v_c := creature_spawn(w, 'roxxen', ${WX + 4}.5, ${WY}.5, 'active', now() - interval '60 days', u);
  update creature set hitched_to = v_p, hunger = 1 where world_id = w and id = v_c;
  perform pg_temp.skill(w, u, 'driving', 0);
  insert into said values ('CART0', pg_temp.ask(w, u, 'board_vehicle', jsonb_build_object('kind', 'furniture', 'id', v_p)));
  delete from creature where world_id = w and hitched_to = v_p;
  delete from placed where id = v_p;

  /* ---- boats, in a harbour: dry corners to ${HX}, deep water past it ---- */
  for i in ${HX - 10}..${HX + 12} loop
    for v_c in ${HY - 6}..${HY + 6} loop
      perform land_set_height(w, i, v_c, case when i <= ${HX} then 10 else -10 end);
    end loop;
  end loop;
  update player set x = ${HX - 0.4}, y = ${HY}.5 where world_id = w and uid = u;
  for i in 1..3 loop
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql)
      values (w, 'furniture', (array['rowing_boat', 'sailing_boat', 'caravel'])[i], ${HX + 1}, ${HY}, 0, 0, ${HX + 1.5}, ${HY}.5, 50) returning id into v_p;
    t := jsonb_build_object('kind', 'furniture', 'id', v_p);
    perform pg_temp.skill(w, u, 'sailing', (array[1, 20, 50])[i] - case when i = 1 then 0.5 else 1 end);
    insert into said values ('BOAT' || i || 'UNDER', pg_temp.ask(w, u, 'board_vehicle', t));
    perform pg_temp.skill(w, u, 'sailing', (array[1, 20, 50])[i]);
    insert into said values ('BOAT' || i || 'AT', pg_temp.ask(w, u, 'board_vehicle', t));
    if i = 3 then
      perform pg_temp.skill(w, u, 'sailing', 1);
      insert into said values ('PASSENGER', pg_temp.ask(w, u, 'board_passenger', t));
    end if;
    delete from placed where id = v_p;
  end loop;

  /* ---- you at a bare face: iron at mining 2.3, marble at 12, each at its gate ---- */
  perform give(w, u, 'pickaxe', 1, 40, null);
  perform pg_temp.bare(w, ${T + 4}, ${T}, ${IRON});
  perform pg_temp.bare(w, ${T + 4}, ${T + 3}, ${MARBLE});
  update player set x = ${T + 3}.5, y = ${T + 1}.0 where world_id = w and uid = u;
  perform pg_temp.skill(w, u, 'mining', 2.3);
  insert into said values ('IRON2', pg_temp.ask(w, u, 'mine', jsonb_build_object('kind', 'tile', 'x', ${T + 4}, 'y', ${T}, 'cx', ${T + 4}, 'cy', ${T + 1})));
  perform pg_temp.skill(w, u, 'mining', 5);
  insert into said values ('IRON5', pg_temp.ask(w, u, 'mine', jsonb_build_object('kind', 'tile', 'x', ${T + 4}, 'y', ${T}, 'cx', ${T + 4}, 'cy', ${T + 1})));
  perform pg_temp.skill(w, u, 'mining', 12);
  update player set y = ${T + 2}.0 where world_id = w and uid = u;
  insert into said values ('MARBLE12', pg_temp.ask(w, u, 'mine', jsonb_build_object('kind', 'tile', 'x', ${T + 4}, 'y', ${T + 3}, 'cx', ${T + 4}, 'cy', ${T + 3})));
  insert into said values ('CHIP12', pg_temp.ask(w, u, 'chip_corner', jsonb_build_object('kind', 'tile', 'x', ${T + 4}, 'y', ${T + 3}, 'cx', ${T + 4}, 'cy', ${T + 3})));
  perform pg_temp.skill(w, u, 'mining', 30);
  insert into said values ('MARBLE30', pg_temp.ask(w, u, 'mine', jsonb_build_object('kind', 'tile', 'x', ${T + 4}, 'y', ${T + 3}, 'cx', ${T + 4}, 'cy', ${T + 3})));

  /* ---- a quarrier at mining 1 by the marble (the iron is a miner's, not a quarrier's) ---- */
  update player set x = ${T}.5, y = ${T + 1}.5 where world_id = w and uid = u;
  v_m := pg_temp.quarrier(w, u, 1);
  insert into said select 'Q1_MAY', worker_gatherable(w, ${T + 4}, ${T + 3}, 'quarry', c)::text from creature c where world_id = w and id = v_m;
  perform pg_temp.run(w, v_m, 1);
  insert into said values ('Q1', pg_temp.idle(w, v_m));
  insert into said select 'Q1_SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->'idleWhat'->>0, '') || ',' || coalesce(e->'idleWhat'->>1, '')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = v_m;
  -- With a face of plain rock in reach as well, it goes to the rock.
  perform pg_temp.bare(w, ${T}, ${T + 5}, ${PLAIN});
  perform pg_temp.run(w, v_m, 1);
  insert into said select 'Q1_ROCK', coalesce(work_x::text, '') || ',' || coalesce(work_y::text, '') || '|' || coalesce(carrying->>'def', '')
    from creature where world_id = w and id = v_m;
  delete from creature where world_id = w and id = v_m;
  v_m := pg_temp.quarrier(w, u, 30);
  insert into said select 'Q30_MAY', worker_gatherable(w, ${T + 4}, ${T + 3}, 'quarry', c)::text from creature c where world_id = w and id = v_m;
  delete from creature where world_id = w and id = v_m;

  /* ---- taming: a Sapgnaw at 0.4, a Logchewer at 1 ---- */
  update player set x = ${T}.5, y = ${T + 1}.5 where world_id = w and uid = u;
  v_c := creature_spawn(w, 'bevere', ${T + 1}.5, ${T + 1}.5, 'wild', now() - interval '60 days', null);
  update creature set skills = '{}' where world_id = w and id = v_c;
  perform pg_temp.skill(w, u, 'taming', 0.4);
  insert into said values ('TAME0', pg_temp.ask(w, u, 'tame', jsonb_build_object('kind', 'creature', 'id', v_c)));
  update creature set skills = jsonb_build_object('${levelSkill(SPECIES.bevere)}', ${LOGCHEWER_AT}) where world_id = w and id = v_c;
  perform pg_temp.skill(w, u, 'taming', 1);
  insert into said values ('TAME1', pg_temp.ask(w, u, 'tame', jsonb_build_object('kind', 'creature', 'id', v_c)));
  delete from creature where world_id = w and id = v_c;

  /* ---- prospecting: copper and iron under the soil, read at prospecting 1 and 5 ---- */
  perform land_set_rock(w, ${T + 1}, ${T - 4}, ${IRON});
  perform land_set_rock(w, ${T - 1}, ${T - 4}, ${COPPER});
  update player set x = ${T + 1}.5, y = ${T - 3}.5 where world_id = w and uid = u;
  perform pg_temp.skill(w, u, 'mining', 1);
  for i in 1..2 loop
    perform pg_temp.skill(w, u, 'prospecting', (array[1, 5])[i]);
    delete from event where world_id = w and uid = u;
    perform perform_ground(w, u, 'prospect', jsonb_build_object('kind', 'tile', 'x', ${T + 1}, 'y', ${T - 4}));
    insert into said select 'HERE' || i, e.text from event e where e.world_id = w and e.uid = u and e.text like 'Here: %' order by e.n desc limit 1;
    insert into said select 'SEAMS' || i, e.text from event e where e.world_id = w and e.uid = u and e.text like 'Seams within %' order by e.n desc limit 1;
  end loop;
  insert into said select 'MARKS', (stats->'prospected'->'tiles')::text from player where world_id = w and uid = u;
  -- The land sent at prospecting 1 while they are buried: the iron unidentified.
  perform pg_temp.skill(w, u, 'prospecting', 1);
  insert into said select 'LAND0', encode(decode(j->'rows'->0->>'rock', 'base64'), 'hex')
    from rpc_land_window(w, ${T - 1}, ${T - 4}, ${T + 1}, ${T - 4}) j;
  insert into said select 'CHANGE0', coalesce((select rock::text from tile_change where world_id = w and x = ${T + 1} and y = ${T - 4} order by n desc limit 1), 'none');
  -- A prospector's find, bare, told to its keeper by the keeper's prospecting.
  perform pg_temp.bare(w, ${T + 1}, ${T - 4}, ${IRON});
  perform pg_temp.bare(w, ${T - 1}, ${T - 4}, ${COPPER});
  -- Gone bare: its change carries its rock, named.
  insert into said select 'CHANGE1', coalesce((select rock::text from tile_change where world_id = w and x = ${T + 1} and y = ${T - 4} order by n desc limit 1), 'none');
  -- Standing on the bare iron at prospecting 1: named, in the reading and the tally.
  delete from event where world_id = w and uid = u;
  perform perform_ground(w, u, 'prospect', jsonb_build_object('kind', 'tile', 'x', ${T + 1}, 'y', ${T - 4}));
  insert into said select 'HERE3', e.text from event e where e.world_id = w and e.uid = u and e.text like 'Here: %' order by e.n desc limit 1;
  insert into said select 'SEAMS3', e.text from event e where e.world_id = w and e.uid = u and e.text like 'Seams within %' order by e.n desc limit 1;

  v_c := creature_spawn(w, 'magga', ${T}.5, ${T - 3}.5, 'deed', now() - interval '60 days', u);
  update creature set name = 'Pip' where world_id = w and id = v_c;
  for i in 1..2 loop
    perform pg_temp.skill(w, u, 'prospecting', (array[1, 5])[i]);
    delete from event where world_id = w and uid = u;
    perform read_ground(w, v_c, ${T}, ${T - 4}, 3);
    insert into said select 'FOUND' || i, e.text from event e where e.world_id = w and e.uid = u and e.text like 'Pip found ore: %' order by e.n desc limit 1;
    -- And the land the island sends this reader: the iron's rock kind, or unidentified; the copper's always.
    insert into said select 'LAND' || i, encode(decode(j->'rows'->0->>'rock', 'base64'), 'hex') || '|' || encode(decode(j->'rows'->0->>'data', 'base64'), 'hex')
      from rpc_land_window(w, ${T - 1}, ${T - 4}, ${T + 1}, ${T - 4}) j;
  end loop;
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const said = (k: string): string => isle.get(k) ?? '';

/* ---- the table: the island's is the browser's, and every number is the one it had ---- */

{
  const mine = [...SKILL_GATES].sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : 1)).map((g) => `${g.kind}:${g.id}:${g.name}:${g.skill}:${g.level}`).join(',');
  check('the island\'s skill_gate is the browser\'s SKILL_GATES, row for row', said('GATES') === mine, `island ${said('GATES')} / browser ${mine}`);
  const seams = Object.entries(OLD_SEAMS).filter(([id, lv]) => gateOf('seam', id)?.level !== lv || gateOf('vein', id)?.level !== lv);
  const rocks = ROCK_VARIANTS.filter((r) => !r.yields.endsWith('_shards'));
  check(`seams: every one of the ${rocks.length} at the mining it had (${Object.entries(OLD_SEAMS).map(([id, lv]) => `${id} ${lv}`).join(', ')}), and named by prospecting at the same`,
    !seams.length && rocks.every((r) => gateOf('seam', r.yields)?.name === r.name && OLD_SEAMS[r.yields] !== undefined), seams.map(([id]) => id).join(', '));
  check('and the island\'s rock_def reads them, a plain face its quarry gate',
    said('ROCK_DEF') === ROCK_VARIANTS.map((r) => `${r.yields}:${OLD_SEAMS[r.yields] ?? gateOf('stone', r.yields)!.level}`).join(','), said('ROCK_DEF'));
  const tameable = Object.values(SPECIES).filter((d) => !d.monster && !d.hybrid);
  const tame = tameable.filter((d) => OLD_TAME[d.id] === undefined || gateOf('tame', d.id)?.level !== OLD_TAME[d.id] || d.tameLevel !== OLD_TAME[d.id]);
  check(`taming: every one of the ${tameable.length} kinds at the taming it had, off the ladder where it was (6, 8, 12 …)`,
    !tame.length && tameable.length === Object.keys(OLD_TAME).length && tameable.every((d) => gateOf('tame', d.id)?.name === d.name), tame.map((d) => d.id).join(', '));
  check('and the island\'s species_def reads them',
    said('TAME_DEF') === Object.keys(OLD_TAME).sort().map((id) => `${id}:${OLD_TAME[id]}`).join(','), said('TAME_DEF'));
  const fish = FISH.filter((f) => gateOf('fish', f.id)?.level !== OLD_FISH[f.id] || f.level !== OLD_FISH[f.id]);
  check(`fish: every one of the ${FISH.length} at the fishing it had (${FISH.map((f) => `${f.name.toLowerCase()} ${f.level}`).join(', ')})`,
    !fish.length && FISH.length === Object.keys(OLD_FISH).length, fish.map((f) => f.id).join(', '));
  check('and the island\'s fish_def reads them', said('FISH_DEF') === Object.keys(OLD_FISH).sort().map((id) => `${id}:${OLD_FISH[id]}`).join(','), said('FISH_DEF'));
  check('wagon at driving 30; no gate on either cart; rowing boat 1, sailing boat 20, caravel 50 by sailing',
    gateOf('vehicle', 'wagon')?.level === 30 && gateOf('vehicle', 'wagon')?.skill === 'driving' && !gateOf('vehicle', 'large_cart') && !gateOf('vehicle', 'cart')
      && ['rowing_boat:1', 'sailing_boat:20', 'caravel:50'].every((s) => { const [id, lv] = s.split(':'); return gateOf('boat', id)?.level === Number(lv) && gateOf('boat', id)?.skill === 'sailing'; }));
  check('quarried stone by mining: rock 1, sandstone 10, slate 20, marble 30',
    ['rock_shards:1', 'sandstone_shards:10', 'slate_shards:20', 'marble_shards:30'].every((s) => { const [id, lv] = s.split(':'); return gateOf('stone', id)?.level === Number(lv) && gateOf('stone', id)?.skill === 'mining'; }));
}

/* ---- the browser's ground ------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(SEED, 120);
  const w = g.world;
  w.water = null;
  w.heights.fill(50);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  w.dirt.fill(14);
  for (let y = T - 8; y <= T + 8; y++) for (let x = T - 8; x <= T + 8; x++) buried(g, x, y, PLAIN);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
  g.deed = { name: 'Gatestead', x: T, y: T, radius: 15, level: 5 } as typeof g.deed;
  g.player.x = T + 0.5;
  g.player.y = T + 1.5;
  return g;
};
function buried(g: Game, x: number, y: number, rock: number): void {
  g.world.rockKind(x, y);
  g.world.rock[y * g.world.w + x] = rock;
}
const bare = (g: Game, x: number, y: number, rock: number): void => {
  buried(g, x, y, rock);
  g.world.setTile(x, y, TileType.Rock, rock);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.world.dirt[(y + dy) * g.world.cw + x + dx] = 0;
};
const ask = (g: Game, id: string, t: Target): string => ACTION_BY_ID.get(id)?.check?.(t, g) ?? 'ALLOWED';

/* ---- a wagon and a large cart ---------------------------------------------- */

{
  const g = fresh();
  g.player.x = WX + 0.5;
  g.player.y = WY + 0.5;
  const grown = g.time - 3600 * 24;
  const team = (f: { id: number; team?: number[] }, n: number): void => {
    const cs = Array.from({ length: n }, (_, i) => {
      const c = g.creatures.spawn('roxxen', WX + 5.5, WY + i, 'active', g.rand, grown);
      c.hunger = 1;
      c.traits = [];
      c.hitchedTo = f.id;
      return c;
    });
    f.team = cs.map((c) => c.id);
  };
  const wagon = g.addFurniture('wagon', WX + 1, WY, 0, 0, 50, [], 'Pine');
  team(wagon, 4);
  const reins = { kind: 'furniture', id: wagon.id } as Target;
  const words = skillGateRefusal('Wagon', 'driving', 29, 30)!;
  g.skills.values.set('driving', 29);
  const b29 = ask(g, 'board_vehicle', reins);
  check(`a wagon at driving 29: "${words}" at the reins, the same on both sides (the menu's hint)`,
    b29 === words && said('WAGON29') === words, `island "${said('WAGON29')}" / browser "${b29}"`);
  g.skills.values.set('driving', 30);
  const b30 = ask(g, 'board_vehicle', reins);
  check('and at 30, allowed on both sides', b30 === 'ALLOWED' && said('WAGON30') === 'ALLOWED', `island ${said('WAGON30')} / browser ${b30}`);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.removeFurniture(wagon.id);
  const cart = g.addFurniture('large_cart', WX + 1, WY, 0, 0, 50, [], 'Pine');
  team(cart, 1);
  g.skills.values.set('driving', 0);
  const b0 = ask(g, 'board_vehicle', { kind: 'furniture', id: cart.id } as Target);
  check('a large cart at driving 0: open, on both sides', b0 === 'ALLOWED' && said('CART0') === 'ALLOWED', `island ${said('CART0')} / browser ${b0}`);
}

/* ---- boats ------------------------------------------------------------------ */

{
  const g = fresh();
  for (let x = HX - 10; x <= HX + 12; x++) for (let y = HY - 6; y <= HY + 6; y++) g.world.setHeight(x, y, x <= HX ? 10 : -10);
  g.player.x = HX - 0.4;
  g.player.y = HY + 0.5;
  // A fair breeze: no gale to keep a rowing boat in.
  g.wind = () => ({ ...windAt(SEED, 0), force: 0.3 });
  (['rowing_boat', 'sailing_boat', 'caravel'] as const).forEach((kind, i) => {
    const boat = g.addFurniture(kind, HX + 1, HY, 0, 0, 50);
    const t = { kind: 'furniture', id: boat.id } as Target;
    const gate = gateOf('boat', kind)!;
    const under = gate.level - (i === 0 ? 0.5 : 1);
    g.skills.values.set('sailing', under);
    const words = skillGateRefusal(gate.name, 'sailing', under, gate.level)!;
    const bu = ask(g, 'board_vehicle', t);
    g.skills.values.set('sailing', gate.level);
    const ba = ask(g, 'board_vehicle', t);
    check(`${gate.name.toLowerCase()} at sailing ${under}: "${words}"; at ${gate.level}, allowed; the same on both sides`,
      bu === words && said(`BOAT${i + 1}UNDER`) === words && ba === 'ALLOWED' && said(`BOAT${i + 1}AT`) === 'ALLOWED',
      `island "${said(`BOAT${i + 1}UNDER`)}" ${said(`BOAT${i + 1}AT`)} / browser "${bu}" ${ba}`);
    if (kind === 'caravel') {
      g.skills.values.set('sailing', 1);
      const bp = ask(g, 'board_passenger', t);
      check('and a passenger boards the caravel at sailing 1, on both sides', bp === 'ALLOWED' && said('PASSENGER') === 'ALLOWED', `island ${said('PASSENGER')} / browser ${bp}`);
    }
    g.removeFurniture(boat.id);
  });
}

/* ---- you at a bare face ----------------------------------------------------- */

{
  const g = fresh();
  g.inventory.add('pickaxe', { ql: 40 });
  bare(g, T + 4, T, IRON);
  bare(g, T + 4, T + 3, MARBLE);
  g.player.x = T + 3.5;
  g.player.y = T + 1;
  const iron = { kind: 'tile', x: T + 4, y: T, cx: T + 4, cy: T + 1 } as Target;
  const marble = { kind: 'tile', x: T + 4, y: T + 3, cx: T + 4, cy: T + 3 } as Target;
  g.skills.values.set('mining', 2.3);
  const ironWords = 'Iron vein: needs mining 5; have 2.3.';
  const i2 = ask(g, 'mine', iron);
  // A bare vein, so named whatever the miner's prospecting (here under iron's 5).
  check(`an iron vein at mining 2.3 and prospecting ${g.skills.get('prospecting').toFixed(1)}: "${ironWords}", as it always said, on both sides`,
    i2 === ironWords && said('IRON2') === ironWords && g.skills.get('prospecting') < gateOf('vein', 'iron_ore')!.level,
    `island "${said('IRON2')}" / browser "${i2}"`);
  g.skills.values.set('mining', 5);
  const i5 = ask(g, 'mine', iron);
  check('and at 5, allowed on both sides', i5 === 'ALLOWED' && said('IRON5') === 'ALLOWED', `island ${said('IRON5')} / browser ${i5}`);
  g.setPerks({ 'ore:below': 10 });
  g.skills.values.set('mining', 2.3);
  check('and at 2.3 with Ore Sense (10 less), allowed', ask(g, 'mine', iron) === 'ALLOWED', ask(g, 'mine', iron));
  g.setPerks({});
  g.skills.values.set('mining', 12);
  g.player.y = T + 2;
  const marbleWords = 'Marble: needs mining 30; have 12.0.';
  const m12 = ask(g, 'mine', marble);
  const c12 = ask(g, 'chip_corner', marble);
  check(`a marble face at mining 12: "${marbleWords}" to Mine and Chip corner, on both sides`,
    m12 === marbleWords && c12 === marbleWords && said('MARBLE12') === marbleWords && said('CHIP12') === marbleWords,
    `island "${said('MARBLE12')}" "${said('CHIP12')}" / browser "${m12}" "${c12}"`);
  g.skills.values.set('mining', 30);
  const m30 = ask(g, 'mine', marble);
  check('and at 30, allowed on both sides', m30 === 'ALLOWED' && said('MARBLE30') === 'ALLOWED', `island ${said('MARBLE30')} / browser ${m30}`);
}

/* ---- a quarrier ------------------------------------------------------------- */

const quarrier = (g: Game, skill: number): Creature => {
  const c = g.creatures.spawn('quarra', T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
  c.traits = [];
  c.name = 'Pip';
  c.skills = { [GATHER_SKILL.quarry]: skill };
  c.trade = 'quarry';
  return c;
};
const run = (g: Game, c: Creature, secs: number): void => {
  const stepper = g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void };
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    c.hunger = 1;
    c.worn = 0;
    stepper.updateWorker(c, 0.25, g);
  }
};
{
  const g = fresh();
  bare(g, T + 4, T, IRON);
  bare(g, T + 4, T + 3, MARBLE);
  const c = quarrier(g, 1);
  const may = g.creatures.gatherable(g, T + 4, T + 3, 'quarry', c);
  run(g, c, 2);
  const says = idleSays({ why: 'gate', n: 4, what: ['stone', 'marble_shards'] }, 'quarry', null, 1);
  const line = c.idle ? idleSays(c.idle, 'quarry', null, c.skills[GATHER_SKILL.quarry]) : '';
  check(`a Chiptail at mining 1 by marble: not taken, "${says}", on both sides`,
    !may && said('Q1_MAY') === 'false' && said('Q1') === 'gate|4|stone,marble_shards' && c.idle?.why === 'gate' && line === says,
    `island ${said('Q1_MAY')} ${said('Q1')} / browser ${may} "${line}"`);
  check('and the browser is sent the gate', said('Q1_SENT') === 'gate|stone,marble_shards', said('Q1_SENT'));
  const d = quarrier(g, 30);
  check('at mining 30 it takes the marble, on both sides', said('Q30_MAY') === 'true' && g.creatures.gatherable(g, T + 4, T + 3, 'quarry', d), said('Q30_MAY'));
}

{
  const g = fresh();
  bare(g, T + 4, T, IRON);
  bare(g, T + 4, T + 3, MARBLE);
  bare(g, T, T + 5, PLAIN);
  const c = quarrier(g, 1);
  run(g, c, 2);
  check('with a face of plain rock in reach as well, it goes to the rock, on both sides',
    (said('Q1_ROCK') === `${T},${T + 5}|` || said('Q1_ROCK').endsWith('|rock_shards'))
      && ((c.workX === T && c.workY === T + 5) || c.carrying?.id === 'rock_shards') && c.idle?.why !== 'gate',
    `island ${said('Q1_ROCK')} (work tile | carrying) / browser ${c.workX},${c.workY} ${c.carrying?.id ?? ''} ${c.idle?.why ?? ''}`);
}

/* ---- taming ----------------------------------------------------------------- */

{
  const g = fresh();
  const c = g.creatures.spawn('bevere', T + 1.5, T + 1.5, 'wild', g.rand, g.time - 3600 * 24 * 60);
  c.skills = {};
  const at = { kind: 'creature', id: c.id } as Target;
  g.skills.values.set('taming', 0.4);
  const w0 = 'Sapgnaw: needs taming 1; have 0.4.';
  const t0 = ask(g, 'tame', at);
  check(`a Sapgnaw at taming 0.4: "${w0}", on both sides`, t0 === w0 && said('TAME0') === w0, `island "${said('TAME0')}" / browser "${t0}"`);
  c.skills = { [levelSkill(SPECIES.bevere)!]: LOGCHEWER_AT };
  g.skills.values.set('taming', 1);
  const stage = SPECIES.bevere.stages![0].name;
  const w1 = `${stage}: needs taming ${SPECIES.bevere.tameLevel + 15}; have 1.0.`;
  const t1 = ask(g, 'tame', at);
  check(`a ${stage} at taming 1: "${w1}", its kind's gate and 15 a stage, on both sides`, t1 === w1 && said('TAME1') === w1,
    `island "${said('TAME1')}" / browser "${t1}"`);
}

/* ---- prospecting ------------------------------------------------------------ */

{
  const g = fresh();
  g.inventory.add('pickaxe', { ql: 40 });
  buried(g, T + 1, T - 4, IRON);
  buried(g, T - 1, T - 4, COPPER);
  g.player.x = T + 1.5;
  g.player.y = T - 3.5;
  const at = { kind: 'tile', x: T + 1, y: T - 4 } as Target;
  const said2: string[] = [];
  for (const [i, lv] of [[1, 1], [2, 5]] as const) {
    g.skills.values.set('prospecting', lv);
    g.log.length = 0;
    ACTION_BY_ID.get('prospect')!.perform!(at, g);
    const here = g.log.find((l) => l.text.startsWith('Here: '))?.text ?? '';
    const seams = g.log.find((l) => l.text.startsWith('Seams within '))?.text ?? '';
    said2.push(here, seams);
    // No level: the level would name it.
    const tip = VEIN_UNREAD;
    if (lv === 1) {
      check(`prospecting 1 over buried iron: "${here}", the same on both sides, no number before its quality`,
        here === said(`HERE${i}`) && here.startsWith(`Here: ${UNIDENTIFIED_METAL.toLowerCase()}. ${tip}`) && tip === 'More prospecting required to identify this vein.'
          && !/\d/.test(here.split(' Max QL')[0]), `island "${said(`HERE${i}`)}" / browser "${here}"`);
      check(`and copper named, iron not: "${seams}", the same on both sides`,
        seams === said(`SEAMS${i}`) && seams.includes('copper vein 1') && seams.includes(`${UNIDENTIFIED_METAL.toLowerCase()} 1`) && !seams.includes('iron'),
        `island "${said(`SEAMS${i}`)}" / browser "${seams}"`);
      const reading = groundReading(g, T + 1, T - 4) ?? '';
      check(`the marked tile reads "${reading}", with "${groundTip(g, T + 1, T - 4)}" on hover; copper's its own`,
        reading.startsWith(UNIDENTIFIED_METAL) && !reading.includes('mining') && groundTip(g, T + 1, T - 4) === tip
          && (groundReading(g, T - 1, T - 4) ?? '').startsWith('Copper vein') && groundTip(g, T - 1, T - 4) === null,
        `${reading} / ${groundReading(g, T - 1, T - 4)}`);
      check('and every vein in reach is marked, glowing, named or not, on both sides',
        g.isProspected(T + 1, T - 4) && g.isProspected(T - 1, T - 4)
          && JSON.stringify([...(g.prospected?.tiles ?? [])].sort((a, b) => a - b)) === (said('MARKS') ? JSON.stringify(JSON.parse(said('MARKS')).sort((a: number, b: number) => a - b)) : ''),
        `island ${said('MARKS')} / browser ${JSON.stringify([...(g.prospected?.tiles ?? [])])}`);
    } else {
      check(`at prospecting 5 the iron is named: "${here}", the same on both sides`,
        here === said(`HERE${i}`) && here.startsWith('Here: iron vein. Needs mining 5') && seams === said(`SEAMS${i}`) && seams.includes('iron vein 1'),
        `island "${said(`HERE${i}`)}" "${said(`SEAMS${i}`)}" / browser "${here}" "${seams}"`);
      check('and the tile reads it', (groundReading(g, T + 1, T - 4) ?? '').startsWith('Iron vein · mining 5') && groundTip(g, T + 1, T - 4) === null,
        groundReading(g, T + 1, T - 4) ?? '');
    }
  }
  // One find, marked for two viewers: each reads it at their own prospecting.
  const other = fresh();
  buried(other, T + 1, T - 4, IRON);
  other.showProspected([...(g.prospected?.tiles ?? [])], 60);
  other.skills.values.set('prospecting', 1);
  g.skills.values.set('prospecting', 5);
  check('a find marked for two viewers reads by each one\'s prospecting: named at 5, "Unidentified metal" at 1',
    (groundReading(g, T + 1, T - 4) ?? '').startsWith('Iron vein') && (groundReading(other, T + 1, T - 4) ?? '').startsWith(UNIDENTIFIED_METAL)
      && veinTip(bedrockAt(other.world, T + 1, T - 4), other) !== null,
    `${groundReading(g, T + 1, T - 4)} / ${groundReading(other, T + 1, T - 4)}`);
  // A prospector's find, told to its keeper by the keeper's prospecting, on both sides.
  const k = fresh();
  bare(k, T + 1, T - 4, IRON);
  bare(k, T - 1, T - 4, COPPER);
  const pip = k.creatures.spawn('magga', T + 0.5, T - 3.5, 'deed', () => 0.5, -1e9);
  pip.name = 'Pip';
  pip.noRoomAt = -1e9;
  for (const [i, lv] of [[1, 1], [2, 5]] as const) {
    k.skills.values.set('prospecting', lv);
    k.log.length = 0;
    pip.noRoomAt = -1e9;
    k.readGround(pip, T, T - 4, 3);
    const found = k.log.find((l) => l.text.startsWith('Pip found ore: '))?.text ?? '';
    // Bare, so named at either level.
    const want = 'Pip found ore: copper vein, iron vein.';
    check(`a prospector's find of bare veins told to its keeper at prospecting ${lv}: "${want}", named, on both sides`,
      found === want && said(`FOUND${i}`) === want, `island "${said(`FOUND${i}`)}" / browser "${found}"`);
  }
  // Standing on the bare iron at prospecting 1: named, in the reading and the tally; its mining refusal names it (above).
  k.inventory.add('pickaxe', { ql: 40 });
  k.skills.values.set('prospecting', 1);
  k.player.x = T + 1.5;
  k.player.y = T - 3.5;
  k.log.length = 0;
  ACTION_BY_ID.get('prospect')!.perform!({ kind: 'tile', x: T + 1, y: T - 4 } as Target, k);
  const here = k.log.find((l) => l.text.startsWith('Here: '))?.text ?? '';
  const seams = k.log.find((l) => l.text.startsWith('Seams within '))?.text ?? '';
  check(`a bare iron vein at prospecting 1 is named: "${here}", on both sides`,
    here === said('HERE3') && here.startsWith('Here: iron vein. Needs mining 5') && seams === said('SEAMS3') && seams.includes('iron vein 1') && !seams.includes(UNIDENTIFIED_METAL.toLowerCase()),
    `island "${said('HERE3')}" "${said('SEAMS3')}" / browser "${here}" "${seams}"`);
  check(`and reads named: "${groundReading(k, T + 1, T - 4)}"`, (groundReading(k, T + 1, T - 4) ?? '').startsWith('Iron vein · mining 5') && groundTip(k, T + 1, T - 4) === null,
    groundReading(k, T + 1, T - 4) ?? '');
}

{
  const hex = (n: number): string => n.toString(16).padStart(2, '0');
  const [r1, d1] = said('LAND1').split('|');
  const [r5] = said('LAND2').split('|');
  check(`the land sent at prospecting 1 with both buried: copper as itself, plain rock as itself, iron as UNIDENTIFIED_ROCK (${UNIDENTIFIED_ROCK})`,
    said('LAND0') === `${hex(COPPER)}${hex(PLAIN)}${hex(UNIDENTIFIED_ROCK)}`, said('LAND0'));
  check('with both bare at prospecting 1: iron as itself, named to everybody; and a bare seam\'s data byte not sent',
    r1 === `${hex(COPPER)}${hex(PLAIN)}${hex(IRON)}` && d1 === '000000', said('LAND1'));
  check('and at prospecting 5, iron as itself', r5 === `${hex(COPPER)}${hex(PLAIN)}${hex(IRON)}`, said('LAND2'));
  check(`tile_change carries the rock of a square gone bare (${said('CHANGE1')}), none before (${said('CHANGE0')})`,
    said('CHANGE1') === String(IRON) && (said('CHANGE0') === 'none' || said('CHANGE0') === ''), `${said('CHANGE0')} / ${said('CHANGE1')}`);
  const viewer = (lv: number) => ({ skills: { get: () => lv } });
  check('the browser\'s rule for it is the same (`seenRock`): buried by prospecting, bare always itself',
    seenRock(IRON, viewer(1)) === UNIDENTIFIED_ROCK && seenRock(IRON, viewer(5)) === IRON && seenRock(COPPER, viewer(1)) === COPPER && seenRock(MARBLE, viewer(1)) === MARBLE
      && seenRock(IRON, viewer(1), TileType.Rock) === IRON && seenRock(IRON, viewer(1), TileType.Grass) === UNIDENTIFIED_ROCK);
  {
    // A change that carries a rock lays it: the vein dug out from under the soil comes named.
    const g = fresh();
    g.world.rock[(T - 4) * g.world.w + T + 1] = UNIDENTIFIED_ROCK;
    layChange(g.world, { x: T + 1, y: T - 4, tile: TileType.Rock, data: 0, corners: [50, 50, 50, 50], soil: [0, 0, 0, 0], rock: IRON });
    check(`and the browser lays it (${groundReading(g, T + 1, T - 4)})`, g.world.rockKind(T + 1, T - 4) === IRON && (groundReading(g, T + 1, T - 4) ?? '').startsWith('Iron vein'),
      groundReading(g, T + 1, T - 4) ?? '');
  }
  const g = fresh();
  g.world.rock[(T - 4) * g.world.w + T + 1] = UNIDENTIFIED_ROCK;
  g.world.setTile(T + 1, T - 4, TileType.Rock, 0);
  g.skills.values.set('prospecting', 90);
  check(`a tile sent unidentified reads "${groundReading(g, T + 1, T - 4)}", "${groundTip(g, T + 1, T - 4)}", whatever the reader's level`,
    (groundReading(g, T + 1, T - 4) ?? '').startsWith(UNIDENTIFIED_METAL) && !!groundTip(g, T + 1, T - 4) && g.world.tileName(T + 1, T - 4) === UNIDENTIFIED_METAL,
    `${groundReading(g, T + 1, T - 4)} / ${g.world.tileName(T + 1, T - 4)}`);
}

/* ---- the Skills window's Unlocks ------------------------------------------------ */

{
  const shown = (skill: string, have: number): string => unlocksOf(skill, have).map((u) => `${u.met ? '✓' : '·'}${u.name} ${u.level}`).join(', ');
  check('driving: the wagon at 30, ticked from 30', shown('driving', 29) === '·Wagon 30' && shown('driving', 30) === '✓Wagon 30', shown('driving', 29));
  check('sailing: rowing boat 1, sailing boat 20, caravel 50, ticked by level',
    shown('sailing', 25) === '✓Rowing boat 1, ✓Sailing boat 20, ·Caravel 50', shown('sailing', 25));
  const mining = unlocksOf('mining', 12);
  const rocks = ROCK_VARIANTS.map((r) => r.name);
  check(`mining: every seam and plain face, in level order, ticked at 12 (${shown('mining', 12)})`,
    mining.length === rocks.length && rocks.every((n) => mining.some((u) => u.name === n))
      && mining.every((u, i) => (i === 0 || mining[i - 1].level <= u.level) && u.met === (u.level <= 12)),
    shown('mining', 12));
  const taming = unlocksOf('taming', 14);
  check(`taming: every tameable kind at its own level, ticked at 14 (${taming.filter((u) => u.met).length} of ${taming.length})`,
    taming.length === Object.keys(OLD_TAME).length && taming.every((u, i) => (i === 0 || taming[i - 1].level <= u.level) && u.met === (u.level <= 14))
      && taming.some((u) => u.name === 'Sapgnaw' && u.level === 1 && u.met) && taming.some((u) => u.name === SPECIES.snout.name && u.level === 50 && !u.met),
    shown('taming', 14));
  // Decided since: one row a level, the names joined, the first few and "… (+N)", ticked when reached.
  const rows = unlockRows('taming', 16);
  const levels = [...new Set(taming.map((u) => u.level))];
  const at16 = taming.filter((u) => u.level === 16).map((u) => u.name);
  const row16 = rows.find((r) => r.level === 16);
  const want16 = `16: ${at16.slice(0, UNLOCK_ROW_NAMES).join(', ')}${at16.length > UNLOCK_ROW_NAMES ? `, … (+${at16.length - UNLOCK_ROW_NAMES})` : ''}`;
  check(`taming's Unlocks grouped: ${rows.length} rows for ${taming.length} kinds, "${row16?.label}"`,
    rows.length === levels.length && rows.length < taming.length && row16?.label === want16 && row16.met && row16.names.length === at16.length
      && rows.every((r, i) => (i === 0 || rows[i - 1].level < r.level) && r.met === (r.level <= 16))
      && rows.reduce((n, r) => n + r.names.length, 0) === taming.length && nextUnlockSaid('taming', 16) === `Next: ${taming.find((u) => u.level > 16)!.name} at ${taming.find((u) => u.level > 16)!.level} (yours 16.0)`,
    rows.map((r) => `${r.met ? '✓' : '·'}${r.label}`).join(' | '));
  check('a short list stays a row a gate (sailing)', unlockRows('sailing', 25).map((r) => r.label).join(', ') === 'Rowing boat 1, Sailing boat 20, Caravel 50');
  // The fish among fishing's gates (its crafts are on the list too since batch C).
  const fishShown = unlocksOf('fishing', 20).filter((u) => FISH.some((f) => f.name === u.name)).map((u) => `${u.met ? '✓' : '·'}${u.name} ${u.level}`).join(', ');
  check('fishing: the eight fish at their levels, ticked at 20',
    fishShown === '✓Minnow 1, ✓Perch 1, ✓Trout 15, ✓Cod 20, ·Pike 35, ·Halibut 45, ·Sturgeon 60, ·Bluefin 70', fishShown);
  check('prospecting: every vein at its mining level, next one named',
    unlocksOf('prospecting', 1).length === Object.keys(OLD_SEAMS).length && nextUnlockSaid('prospecting', 1) === 'Next: Iron vein at 5 (yours 1.0)',
    `${shown('prospecting', 1)} / ${nextUnlockSaid('prospecting', 1)}`);
}

finish('Skill gates: wagons, boats, quarried stone; seams, taming and fish on the one rule; veins named by prospecting');
