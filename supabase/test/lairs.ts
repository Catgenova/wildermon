/**
 * Monster lairs: monsters come only from lairs, leashed to them; a boss after its garrison; a hoard for each who dealt
 * a tenth of the boss's health; a cleared lair's safe ring; restocks, the dragon's day, and a lair that moves.
 *
 * Asked for: "Monsters come only from lairs. No wandering monster spawns and no raiding patrols." Four goblin warrens
 * on a forest edge, two orc camps on open grass, an ogre cave on a rocky hillside and a dragon roost on the highest
 * ground, each kept from every settlement token; three to five goblins, two or three orcs, an ogre and two goblin
 * thralls, and a dragon; a warren chief, a warlord and an ogre king with twice the health (the king's blow half again),
 * the dragon its own boss; one back every thirty minutes, an hour or three hours, and the dragon a day after its kill;
 * a hoard on the boss's kill with no silver and no rare, a quarter of the shares holding a Recipe or a Formula; the
 * cleared lair's ring safe with half again the wildermon; three clears in seven days and it moves; Track points to it;
 * the field guide says whether it has been found. Asked of the island, on an island of its own made for the purpose
 * (every rule here is the island's), and of the browser's words for the same numbers:
 *
 *   * every lair kind, garrison and number is the same on both sides;
 *   * the island sites every lair on its kind's ground, kept from every token and from every other lair, and the dragon
 *     on Volcano Isle's highest ground; a settlement is refused that near a lair, in the browser's words;
 *   * each stands up with its garrison, or the dragon out; no monster stands up out of the wild anywhere, and none of a
 *     lair's ever goes past its leash, however it is moved, hunts nobody past it and lets go of anybody who gets past it;
 *   * the last of a garrison sends its boss out, at its health and blow, told to whoever is within the announce and to
 *     nobody further;
 *   * a hoard share for each who dealt a tenth of the boss's health and none for one who dealt less; every share holds
 *     the trophy and, for the dragon, the hoard scales; never silver and never rare; the map at its kind's odds and the
 *     book at a quarter, each roll held at either side of its line and over a seeded draw;
 *   * a cleared lair's ring counts as the safe ring and is stocked to half again the usual, with nothing the ring keeps
 *     out;
 *   * each kind restocks a second after its time and not a second before, one a restock, the dragon after its day;
 *   * three clears in seven days and it comes back somewhere else, two (or old ones) and it stays;
 *   * Track from a monster's page reads its kind's nearest lair, in the browser's words, and none past its reach;
 *     a body within sight of one has seen it, the ground read lists it, and Examine says it;
 *   * nobody moves or works a lair; and hoard scales alone make scale armour to the raised cap.
 *
 * Every timed rule is asked by moving the lair's own clock, never the wall's: it holds in every season and at any hour.
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { SPECIES } from '../../src/game/creatures';
import {
  EDGE_TREES, HILL_SLOPE, HOARD_BOOK, HOARD_SCALE, HOARD_SCALE_CAP, HOARD_SHARE, LAIR_ANNOUNCE, LAIR_APART, LAIR_KINDS, LAIR_LEASH,
  LAIR_MOVE_CLEARS, LAIR_MOVE_DAYS, LAIR_RING, LAIR_RING_WILD, LAIR_SIGHT, LAIR_TRACK, lairFoundingRefusal, lairFoundSays, lairRingWant,
  OPEN_CLEAR, OPEN_SLOPE, type LairSeen,
} from '../../src/game/lairs';
import { PER_REGION, REGION } from '../../src/game/creatures';
import { bearingTo, lairTrackSaid, trackable, trackReading, trackRefusal } from '../../src/game/tracking';
import { psql, check, finish } from './harness';

const U = { p: '1a170000-0000-4000-8000-0000000000a1', q: '1a170000-0000-4000-8000-0000000000a2', r: '1a170000-0000-4000-8000-0000000000a3' };
const SIZE = 512;
/** Volcano Isle's middle on a 512 island, where the cone is raised. */
const PEAK = { x: 258, y: 64 };
const DEED = { x: 300, y: 300 };

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
declare w uuid; l lair; k record; c creature; v_id int; v_ids int[]; i int; j int; v_x int; v_y int; v_n int; v_max bigint;
        v_war int; v_camp int; v_cave int; v_roost int; v_boss int; v_top double precision; v_ev bigint; v_r jsonb; s record;
        v_before int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Lairs', 4242, ${SIZE}, 20, 500, true) returning id into w;
  insert into said values ('WORLD', w::text);
  perform land_blank(w, ${SIZE});
  -- Every corner ten metres up; the hillside's corners rising three metres a tile; Volcano Isle's cone, its summit one tile.
  update land_corner set heights = decode(repeat('6400', ${SIZE + 1}), 'hex') where world_id = w;
  for j in 380 .. 501 loop
    for i in 380 .. 501 loop perform land_set_height(w, i, j, 100 + (i - 380) * 30); end loop;
  end loop;
  for j in ${PEAK.y - 40} .. ${PEAK.y + 41} loop
    for i in ${PEAK.x - 40} .. ${PEAK.x + 41} loop
      perform land_set_height(w, i, j, 100 + greatest(0, 400 - floor(8 * sqrt((i - ${PEAK.x} - 0.5) ^ 2 + (j - ${PEAK.y} - 0.5) ^ 2))::int));
    end loop;
  end loop;
  -- Trees down every eighth column of the west, bare rock on the hillside, grass everywhere else.
  update land_tile t set tiles = (select decode(string_agg(lpad(to_hex(case
      when gx < 240 and gx % 8 = 0 then 16 when gx between 380 and 500 and t.y between 380 and 500 then 4 else 0 end), 2, '0'), '' order by gx), 'hex')
    from generate_series(0, ${SIZE - 1}) gx) where t.world_id = w;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Token', ${DEED.x}, ${DEED.y}, 5, 1, '1a170000-0000-4000-8000-0000000000ff');

  -- Both sides' numbers.
  insert into said select 'KINDS', string_agg(id || ':' || name || ':' || species || ':' || site || ':' || count || ':' || coalesce(boss, '-') || ':'
    || boss_health || ':' || boss_attack || ':' || restock || ':' || keep_off || ':' || map || ':' || trophy || ':' || scales, '|' order by id) from lair_kinds();
  insert into said select 'GARRISON', string_agg(kind || ':' || ord || ':' || species || ':' || least_n || ':' || most_n, '|' order by kind, ord) from lair_garrison();
  insert into said values ('NUMS', lair_leash() || '|' || lair_ring() || '|' || lair_ring_wild() || '|' || lair_announce() || '|' || hoard_share() || '|'
    || hoard_book() || '|' || hoard_scale_cap() || '|' || hoard_scale() || '|' || lair_move_clears() || '|' || lair_move_days() || '|' || lair_track() || '|'
    || lair_sight() || '|' || lair_apart() || '|' || lair_ring_want() || '|' || edge_trees() || '|' || open_clear() || '|' || open_slope() || '|' || hill_slope());

  -- ---- Siting -------------------------------------------------------------------------------------------------------
  for k in select * from lair_kinds() order by keep_off desc loop
    for i in 1 .. k.count loop
      if lair_stand(w, k.id, 4000) is null then insert into said values ('NOSITE', k.id); end if;
    end loop;
  end loop;
  -- And the clock adds none past the counts.
  perform lair_tick(w);
  insert into said select 'COUNT', string_agg(kind || ':' || n, '|' order by kind) from (select kind, count(*) n from lair where world_id = w group by kind) x;
  for l in select * from lair where world_id = w order by id loop
    select * into k from lair_kinds() lk where lk.id = l.kind;
    insert into said values ('SITE', l.kind || '|' || l.x || '|' || l.y || '|' || land_tile(w, l.x, l.y) || '|'
      || near_tile(w, l.x, l.y, 'trees', edge_trees()::int) || '|' || near_tile(w, l.x, l.y, 'trees', open_clear()::int) || '|'
      || (select max(h) - min(h) from (values (land_height(w, l.x, l.y)), (land_height(w, l.x + 1, l.y)), (land_height(w, l.x + 1, l.y + 1)), (land_height(w, l.x, l.y + 1))) v (h)) || '|'
      || floor(sqrt((l.x - ${DEED.x}) ^ 2 + (l.y - ${DEED.y}) ^ 2))::int || '|' || k.keep_off || '|'
      || coalesce((select floor(min(sqrt((o.x - l.x) ^ 2 + (o.y - l.y) ^ 2)))::int from lair o where o.world_id = w and o.id <> l.id), 9999) || '|'
      || on_deed(w, l.x, l.y) || '|' || coalesce(region_at(w, l.x + 0.5, l.y + 0.5), -1) || '|' || centre_height(w, l.x, l.y) || '|'
      || (select pl.sub || ':' || pl.x || ':' || pl.y from placed pl where pl.id = l.placed));
  end loop;
  insert into said select 'ISLE', coalesce(monster_isle('dragon'), -1)::text;
  -- The highest ground of Volcano Isle, over every tile of it.
  insert into said select 'HIGHEST', max(centre_height(w, a, b))::text from generate_series(${PEAK.x - 45}, ${PEAK.x + 45}) a, generate_series(${PEAK.y - 45}, ${PEAK.y + 45}) b
   where region_at(w, a + 0.5, b + 0.5) = monster_isle('dragon');

  select id into v_war from lair where world_id = w and kind = 'goblin_warren' order by id limit 1;
  select id into v_camp from lair where world_id = w and kind = 'orc_camp' order by id limit 1;
  select id into v_cave from lair where world_id = w and kind = 'ogre_cave' order by id limit 1;
  select id into v_roost from lair where world_id = w and kind = 'dragon_roost' order by id limit 1;
  insert into said values ('IDS', v_war || '|' || v_camp || '|' || v_cave || '|' || v_roost);

  -- ---- Garrisons ----------------------------------------------------------------------------------------------------
  for l in select * from lair where world_id = w order by id loop
    insert into said select 'GARR', l.kind || '|' || l.state || '|' || l.size || '|'
      || coalesce((select string_agg(c2.species || ':' || c2.boss, ',' order by c2.species, c2.boss) from creature c2 where c2.world_id = w and c2.lair = l.id), '-') || '|'
      || (select count(*) from creature c2 where c2.world_id = w and c2.lair = l.id and (c2.leash_x is distinct from l.x + 0.5 or c2.home_x is distinct from l.x + 0.5))::text;
  end loop;

  -- ---- Bodies -------------------------------------------------------------------------------------------------------
  select * into l from lair where world_id = w and id = v_war;
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.p}')::text, true);
  perform rpc_join(w, 'Hunter');
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.q}')::text, true);
  perform rpc_join(w, 'Helper');
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.r}')::text, true);
  perform rpc_join(w, 'Watcher');
  update player set body_at = now(), x = 480.5, y = 20.5, away = false where world_id = w;

  -- ---- No monster out of the wild -----------------------------------------------------------------------------------
  insert into said select 'WILDPICK', coalesce(string_agg(distinct got, ','), '-') from (
    select pick_wild(w, (a * 37) % ${SIZE}, (a * 91) % ${SIZE}) as got from generate_series(1, 600) a) x
   where got in (select id from species_def where monster);
  -- Monster country and Volcano Isle, on the island the suite leaves behind: what the wild puts down there is a wildermon.
  insert into said select 'COUNTRY', coalesce(string_agg(distinct p.got, ','), '-') from (
    select pick_wild(wd.id, floor(r.x * wd.size)::int, floor(r.y * wd.size)::int) as got
      from (select * from world order by size desc limit 1) wd, (values (0.8378, 0.2728), (0.5039, 0.1258)) r (x, y), generate_series(1, 150)) p
   where p.got in (select id from species_def where monster);
  select coalesce(max(id), 0) into v_max from creature where world_id = w;
  for i in 0 .. 3 loop for j in 0 .. 3 loop perform creature_stock_block(w, i, j); end loop; end loop;
  insert into said select 'STOCKED', count(*) || '|' || count(*) filter (where s2.monster) from creature c2 join species_def s2 on s2.id = c2.species
   where c2.world_id = w and c2.id > v_max;

  -- ---- The leash ----------------------------------------------------------------------------------------------------
  select c2.* into c from creature c2 where c2.world_id = w and c2.lair = v_war and not c2.boss order by c2.id limit 1;
  -- Moved a hundred tiles off: held on its leash.
  update creature set to_x = l.x + 100.5, to_y = l.y + 0.5, from_x = l.x + 60.5, from_y = l.y + 0.5 where world_id = w and id = c.id;
  insert into said select 'HELD', round(sqrt((to_x - l.x - 0.5) ^ 2 + (to_y - l.y - 0.5) ^ 2)::numeric, 3) || '|'
    || round(sqrt((from_x - l.x - 0.5) ^ 2 + (from_y - l.y - 0.5) ^ 2)::numeric, 3) from creature where world_id = w and id = c.id;
  -- Somebody past its leash, well within its notice: no hunt.
  update creature set from_x = l.x + 15.5, from_y = l.y + 0.5, to_x = l.x + 15.5, to_y = l.y + 0.5, hunting = null, hunt_again = null,
      leg_at = now() - interval '2 seconds', leg_ends = now() - interval '2 seconds', until = now() - interval '1 second', settled_at = now() - interval '1 second'
    where world_id = w and id = c.id;
  update player set x = l.x + 23.5, y = l.y + 0.5 where world_id = w and uid = '${U.p}';
  perform creature_settle(w, c.id);
  insert into said select 'PAST', coalesce(hunting::text, '-') from creature where world_id = w and id = c.id;
  -- Within it: hunted.
  update creature set from_x = l.x + 15.5, from_y = l.y + 0.5, to_x = l.x + 15.5, to_y = l.y + 0.5, until = now() - interval '1 second', settled_at = now() - interval '1 second'
    where world_id = w and id = c.id;
  update player set x = l.x + 12.5, y = l.y + 0.5 where world_id = w and uid = '${U.p}';
  perform creature_settle(w, c.id);
  insert into said select 'WITHIN', coalesce(hunting::text, '-') from creature where world_id = w and id = c.id;
  -- And let go when they get past it, back to its lair.
  update creature set until = now() - interval '1 second', settled_at = now() - interval '1 second' where world_id = w and id = c.id;
  update player set x = l.x + 34.5, y = l.y + 0.5 where world_id = w and uid = '${U.p}';
  perform creature_settle(w, c.id);
  insert into said select 'LOST', coalesce(hunting::text, '-') || '|' || round(sqrt((to_x - l.x - 0.5) ^ 2 + (to_y - l.y - 0.5) ^ 2)::numeric, 2)
    from creature where world_id = w and id = c.id;
  -- An hour of wandering for every lair's own: none past its leash.
  update creature set until = now() - interval '1 hour', settled_at = now() - interval '1 hour', leg_ends = now() - interval '1 hour', hunting = null
    where world_id = w and lair is not null;
  update player set x = 480.5, y = 20.5 where world_id = w;
  for c in select * from creature where world_id = w and lair is not null loop perform creature_settle(w, c.id); end loop;
  insert into said select 'LEASH', count(*) || '|' || coalesce(round(max(sqrt((creature_x(c2) - l2.x - 0.5) ^ 2 + (creature_y(c2) - l2.y - 0.5) ^ 2))::numeric, 3), 0)
    || '|' || coalesce(round(max(sqrt((c2.to_x - l2.x - 0.5) ^ 2 + (c2.to_y - l2.y - 0.5) ^ 2))::numeric, 3), 0)
    from creature c2 join lair l2 on l2.world_id = c2.world_id and l2.id = c2.lair where c2.world_id = w;

  -- ---- Seen, Examine, the ground read, nobody moves it ----------------------------------------------------------------
  update player set x = l.x + 3.5, y = l.y + 0.5 where world_id = w and uid = '${U.p}';
  update player set x = l.x + ${LAIR_SIGHT + 5}.5, y = l.y + 0.5 where world_id = w and uid = '${U.r}';
  perform lair_tick(w);
  insert into said select 'SEEN', coalesce(string_agg(uid::text || ':' || lair, ',' order by uid, lair), '-') from lair_seen where world_id = w;
  insert into said values ('EXAMINE', examine_tile_text(w, l.x, l.y, '${U.p}'::uuid));
  insert into said values ('MOVEIT', coalesce(act_refusal(w, '${U.p}', 'pick_up_furniture', jsonb_build_object('kind', 'furniture', 'id', l.placed)), '-'));
  perform set_config('request.jwt.claims', json_build_object('sub', '${U.p}')::text, true);
  begin
    insert into said select 'GROUND', coalesce((rpc_ground(w, 20, true, null)->'lairs')::text, '-');
  exception when others then insert into said values ('GROUND', 'error: ' || sqlerrm);
  end;

  -- ---- A settlement keeps off ---------------------------------------------------------------------------------------
  perform give(w, '${U.p}', 'deed_stake', 1, 50);
  -- On open grass ten tiles or so off it (a warren's tree columns are no place for a totem).
  select min(dx) into v_n from generate_series(10, 30) dx where land_tile(w, l.x + dx, l.y) = 0;
  update player set x = l.x + v_n + 0.5, y = l.y + 0.5 where world_id = w and uid = '${U.p}';
  insert into said values ('DEEDNEAR', v_n || '|' || coalesce(deed_refusal(w, '${U.p}', 'found_settlement', '{}'::jsonb), '-'));

  -- ---- The boss after the garrison ----------------------------------------------------------------------------------
  update player set x = l.x + ${LAIR_ANNOUNCE - 6}.5, y = l.y + 0.5 where world_id = w and uid = '${U.p}';
  update player set x = l.x + ${LAIR_ANNOUNCE + 10}.5, y = l.y + 0.5 where world_id = w and uid = '${U.r}';
  select coalesce(max(n), 0) into v_ev from event where world_id = w;
  v_ids := array(select c2.id from creature c2 where c2.world_id = w and c2.lair = v_war and not c2.boss order by c2.id);
  for i in 1 .. cardinality(v_ids) loop
    insert into said select 'BEFORE', state || '|' || (select count(*) from creature c2 where c2.world_id = w and c2.lair = v_war and c2.boss) from lair where world_id = w and id = v_war;
    perform wound_beast(w, v_ids[i], 1e9, null, null, '${U.p}', null);
  end loop;
  insert into said select 'BOSS', l2.state || '|' || c2.name || '|' || c2.species || '|' || max_health(c2) || '|' || attack_of(c2) || '|' || c2.health
    from lair l2 join creature c2 on c2.world_id = l2.world_id and c2.lair = l2.id and c2.boss where l2.world_id = w and l2.id = v_war;
  insert into said select 'TOLD', coalesce(string_agg(uid::text || ':' || text, ',' order by uid), '-') from event where world_id = w and n > v_ev and text like '% out: %';

  -- The ogre king's blow, and the dragon its own boss at its kind's health.
  v_ids := array(select c2.id from creature c2 where c2.world_id = w and c2.lair = v_cave and not c2.boss order by c2.id);
  for i in 1 .. cardinality(v_ids) loop perform wound_beast(w, v_ids[i], 1e9, null, null, '${U.p}', null); end loop;
  -- Its blood rolled as any wild one's is: put aside, so the boss's own multiples are what is measured.
  update creature set traits = '{}' where world_id = w and lair in (v_war, v_cave, v_roost) and boss;
  insert into said select 'BOSSMAX', max_health(c2) || '|' || attack_of(c2) from creature c2 where c2.world_id = w and c2.lair = v_war and c2.boss;
  insert into said select 'KING', c2.name || '|' || max_health(c2) || '|' || attack_of(c2) from creature c2 where c2.world_id = w and c2.lair = v_cave and c2.boss;
  insert into said select 'DRAGON', c2.name || '|' || max_health(c2) || '|' || attack_of(c2) from creature c2 where c2.world_id = w and c2.lair = v_roost and c2.boss;

  -- ---- The hoard ----------------------------------------------------------------------------------------------------
  select c2.* into c from creature c2 where c2.world_id = w and c2.lair = v_war and c2.boss;
  update creature set traits = '{}' where world_id = w and id = c.id;
  select * into c from creature where world_id = w and id = c.id;
  v_top := max_health(c);
  select coalesce(max(id), 0) into v_max from item;
  perform wound_beast(w, c.id, v_top * 0.5, null, null, '${U.p}', null);
  perform wound_beast(w, c.id, v_top * ${HOARD_SHARE} + 0.5, null, null, '${U.q}', null);
  perform wound_beast(w, c.id, v_top * ${HOARD_SHARE} - 0.5, null, null, '${U.r}', null);
  insert into said select 'DEALT', string_agg(uid || ':' || round((dealt / v_top)::numeric, 4), ',' order by uid) from lair_blow where world_id = w and lair = v_war;
  perform wound_beast(w, c.id, 1e9, null, null, '${U.p}', null);
  insert into said select 'HOARD', u.uid || '|' || coalesce((select string_agg(i2.def || ':' || coalesce(i2.extra, '-') || ':' || i2.count || ':' || coalesce(i2.rare, '-'), ',' order by i2.def)
      from item i2 where i2.id > v_max and i2.holder = 'player' and i2.holder_uid = u.uid::uuid), '-')
    from (values ('${U.p}'), ('${U.q}'), ('${U.r}')) u (uid);
  insert into said select 'CORPSE', count(*)::text from item where id > v_max and holder = 'ground' and def = 'corpse';
  insert into said select 'CLEARED', state || '|' || cardinality(clears) || '|' || moving || '|' || (select count(*) from lair_blow b where b.world_id = w and b.lair = v_war)
    from lair where world_id = w and id = v_war;
  -- A share given whole, a map and a book in it: the dragon's, with its hoard scales.
  select coalesce(max(id), 0) into v_max from item;
  v_r := lair_hoard_give(w, '${U.q}', v_roost, hoard_roll('dragon_roost', 0, 0), 60);
  insert into said select 'FULL', v_r::text || '#' || coalesce((select string_agg(i2.def || ':' || coalesce(i2.extra, '-') || ':' || i2.count || ':' || coalesce(i2.rare, '-'), ',' order by i2.def)
      from item i2 where i2.id > v_max and i2.holder = 'player' and i2.holder_uid = '${U.q}'), '-');
  -- The rolls at either side of their lines, every kind.
  insert into said select 'ROLLS', string_agg(id || ':' || (hoard_roll(id, map - 1e-9, ${HOARD_BOOK} - 1e-9)->>'map') || (hoard_roll(id, map, ${HOARD_BOOK})->>'map')
    || (hoard_roll(id, 0.5, ${HOARD_BOOK} - 1e-9)->>'book') || (hoard_roll(id, 0.5, ${HOARD_BOOK})->>'book') || ':' || (hoard_roll(id, 0, 0) - 'map' - 'book')::text, '|' order by id) from lair_kinds();
  -- And over a seeded draw, as the hoard rolls them.
  perform setseed(0.4242);
  insert into said select 'DRAW', string_agg(id || ':' || m || ':' || b, '|' order by id) from (
    select k2.id, round(avg(((hoard_roll(k2.id, random(), random()))->>'map')::boolean::int)::numeric, 4) as m,
           round(avg(((hoard_roll(k2.id, random(), random()))->>'book')::boolean::int)::numeric, 4) as b
      from lair_kinds() k2, generate_series(1, 4000) group by k2.id) x;

  -- ---- The cleared ring -----------------------------------------------------------------------------------------------
  select * into l from lair where world_id = w and id = v_war;
  insert into said values ('RING', in_safe_ring(w, l.x + 0.5, l.y + 0.5) || '|' || in_safe_ring(w, l.x + 0.5 + ${LAIR_RING - 1}, l.y + 0.5) || '|'
    || in_safe_ring(w, l.x + 0.5 + ${LAIR_RING + 1}, l.y + 0.5) || '|' || at_peace(w, l.x + 0.5, l.y + 0.5));
  insert into said select 'RINGPICK', coalesce(string_agg(distinct got, ','), '-') from (
    select pick_wild(w, l.x + (a % 21) - 10, l.y + (a / 21) % 21 - 10) as got from generate_series(1, 400) a) x where ring_keeps_out(got);
  delete from creature c2 where c2.world_id = w and c2.lair is null
    and (c2.to_x - l.x - 0.5) ^ 2 + (c2.to_y - l.y - 0.5) ^ 2 <= ${(LAIR_RING + 2) ** 2};
  for i in 1 .. 4 loop perform lair_turn(w, v_war); end loop;
  insert into said select 'RINGWILD', count(*) || '|' || count(*) filter (where ring_keeps_out(c2.species) or s2.monster) from creature c2 join species_def s2 on s2.id = c2.species
   where c2.world_id = w and c2.lair is null and (c2.to_x - l.x - 0.5) ^ 2 + (c2.to_y - l.y - 0.5) ^ 2 <= ${LAIR_RING ** 2};

  -- ---- Restocks -----------------------------------------------------------------------------------------------------
  for k in select * from lair_kinds() loop
    select * into l from lair where world_id = w and kind = k.id order by id limit 1;
    -- Cleared, every one, its boss and garrison gone.
    delete from creature where world_id = w and lair = l.id;
    update lair set state = 'cleared', cleared_at = now() - make_interval(secs => k.restock - 1), clears = '{}', moving = false where world_id = w and id = l.id;
    perform lair_turn(w, l.id);
    insert into said select 'EARLY', k.id || '|' || state || '|' || lair_garrison_up(w, l.id) from lair where world_id = w and id = l.id;
    update lair set cleared_at = now() - make_interval(secs => k.restock + 1) where world_id = w and id = l.id;
    perform lair_turn(w, l.id);
    insert into said select 'BACK', k.id || '|' || state || '|' || lair_garrison_up(w, l.id) || '|'
      || (select count(*) from creature c2 where c2.world_id = w and c2.lair = l.id and c2.boss) || '|' || size from lair where world_id = w and id = l.id;
    if k.id <> 'dragon_roost' then
      update lair set stocked_at = now() - make_interval(secs => k.restock - 1) where world_id = w and id = l.id;
      perform lair_turn(w, l.id);
      insert into said select 'NEXTEARLY', k.id || '|' || lair_garrison_up(w, l.id) from lair where world_id = w and id = l.id;
      update lair set stocked_at = now() - make_interval(secs => k.restock + 1) where world_id = w and id = l.id;
      perform lair_turn(w, l.id);
      insert into said select 'NEXT', k.id || '|' || lair_garrison_up(w, l.id) from lair where world_id = w and id = l.id;
      update lair set stocked_at = now() - make_interval(secs => k.restock * 10 + 1) where world_id = w and id = l.id;
      perform lair_turn(w, l.id);
      insert into said select 'FULLUP', k.id || '|' || lair_garrison_up(w, l.id) || '|' || size from lair where world_id = w and id = l.id;
    end if;
  end loop;

  -- ---- Moving -------------------------------------------------------------------------------------------------------
  for i in 1 .. 2 loop
    select * into l from lair where world_id = w and kind = 'orc_camp' order by id offset i - 1 limit 1;
    delete from creature where world_id = w and lair = l.id;
    insert into lair_seen (world_id, uid, lair) values (w, '${U.p}', l.id) on conflict do nothing;
    select count(*) into v_before from lair_seen where world_id = w and lair = l.id;
    update lair set state = 'boss', clears = case when i = 1 then array[now() - interval '2 days', now() - interval '6 days']
                                                   else array[now() - interval '8 days', now() - interval '9 days'] end where world_id = w and id = l.id;
    v_id := lair_spawn(w, l.id, 'orc', true);
    insert into said select 'FIRE', i || '|held|' || placed_lit(pl) from placed pl where pl.id = l.placed;
    perform wound_beast(w, v_id, 1e9, null, null, '${U.q}', null);
    insert into said select 'FIRE', i || '|cleared|' || placed_lit(pl) from placed pl where pl.id = l.placed;
    update lair set cleared_at = now() - interval '2 hours' where world_id = w and id = l.id;
    perform lair_turn(w, l.id);
    insert into said select 'FIRE', i || '|back|' || placed_lit(pl) from placed pl where pl.id = l.placed;
    insert into said select 'MOVED', i || '|' || l.x || ',' || l.y || '|' || l2.x || ',' || l2.y || '|' || l2.moving || '|' || cardinality(l2.clears) || '|'
      || (select pl.x || ',' || pl.y from placed pl where pl.id = l2.placed) || '|' || (select count(*) from lair_seen s2 where s2.world_id = w and s2.lair = l.id) || '|'
      || lair_site_ok(w, l2.kind, l2.x, l2.y, l2.id) || '|' || v_before
      from lair l2 where l2.world_id = w and l2.id = l.id;
  end loop;

  -- ---- Track --------------------------------------------------------------------------------------------------------
  select * into l from lair where world_id = w and kind = 'goblin_warren' order by id limit 1;
  update player set x = l.x + 60.5, y = l.y + 30.5 where world_id = w and uid = '${U.p}';
  select coalesce(max(n), 0) into v_ev from event where world_id = w;
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wildermon.dice', '0.5', true);
  perform perform_track(w, '${U.p}', 'track', jsonb_build_object('kind', 'tile', 'x', 1, 'y', 1, 'cx', 1, 'cy', 1, 'species', 'goblin'));
  perform set_config('search_path', 'public, pg_catalog', true);
  insert into said select 'TRACK', p.x || '|' || p.y || '|' || coalesce((select string_agg(e.kind || '#' || e.text, '~' order by e.n) from event e where e.world_id = w and e.n > v_ev and e.uid = p.uid), '-')
    || '#' || (select string_agg(l3.x || ',' || l3.y, ';' order by l3.id) from lair l3 where l3.world_id = w and l3.kind = 'goblin_warren')
    from player p where p.world_id = w and p.uid = '${U.p}';
  insert into said values ('TRACKREFUSE', coalesce(track_refusal(w, '${U.p}', 'track', jsonb_build_object('kind', 'tile', 'species', 'goblin')), '-'));
  update player set x = 500.5, y = 20.5 where world_id = w and uid = '${U.p}';
  select coalesce(max(n), 0) into v_ev from event where world_id = w;
  perform perform_track(w, '${U.p}', 'track', jsonb_build_object('kind', 'tile', 'x', 1, 'y', 1, 'cx', 1, 'cy', 1, 'species', 'goblin'));
  insert into said select 'TRACKNONE', coalesce(string_agg(text, '~' order by n), '-') from event where world_id = w and n > v_ev and uid = '${U.p}' and kind = 'event';

  -- ---- Hoard scales ---------------------------------------------------------------------------------------------------
  insert into skill (world_id, uid, id, value) values (w, '${U.r}', 'leatherworking', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  delete from item where holder = 'player' and holder_uid = '${U.r}' and def in ('dragon_scale', 'leather', 'ribbon', 'awl', 'scale_helm');
  perform give(w, '${U.r}', 'awl', 1, 90);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wildermon.dice', '0', true);
  for i in 1 .. 2 loop
    perform give(w, '${U.r}', 'leather', 2, 50);
    perform give(w, '${U.r}', 'ribbon', 1, 50);
    perform give(w, '${U.r}', 'dragon_scale', 3, 50, case when i = 1 then null else hoard_scale() end);
    perform perform_craft(w, '${U.r}', 'make_scale_helm', '{}'::jsonb);
    insert into said select 'HELM', i || '|' || coalesce((select round(ql::numeric, 2)::text from item where holder = 'player' and holder_uid = '${U.r}' and def = 'scale_helm' order by id desc limit 1), '-');
  end loop;
  perform set_config('search_path', 'public, pg_catalog', true);
end $t$;
select k || '=' || v from said;
rollback;
`);
const lines = out.split('\n').filter((l) => l.includes('='));
const said = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
const one = (k: string): string => said(k)[0] ?? '';

/* ---- both sides' numbers ------------------------------------------------------------------------------------------- */

check('every lair kind is the same on both sides: name, kind, site, count, boss, restock, distance and hoard',
  one('KINDS') === [...LAIR_KINDS].sort((a, b) => (a.id < b.id ? -1 : 1)).map((k) => [k.id, k.name, k.species, k.site, k.count, k.boss ?? '-', k.bossHealth, k.bossAttack,
    k.restock, k.keepOff, k.map, k.trophy, k.scales].join(':')).join('|'), one('KINDS'));
check('and every garrison', one('GARRISON') === [...LAIR_KINDS].sort((a, b) => (a.id < b.id ? -1 : 1))
  .flatMap((k) => k.garrison.map(([s, lo, hi], i) => `${k.id}:${i}:${s}:${lo}:${hi}`)).join('|'), one('GARRISON'));
check('and every number a lair keeps to',
  one('NUMS') === [LAIR_LEASH, LAIR_RING, LAIR_RING_WILD, LAIR_ANNOUNCE, HOARD_SHARE, HOARD_BOOK, HOARD_SCALE_CAP, HOARD_SCALE, LAIR_MOVE_CLEARS, LAIR_MOVE_DAYS,
    LAIR_TRACK, LAIR_SIGHT, LAIR_APART, lairRingWant(PER_REGION, REGION), EDGE_TREES, OPEN_CLEAR, OPEN_SLOPE, HILL_SLOPE].map(String).join('|'), one('NUMS'));
check('the numbers asked for: 4, 2, 1 and 1 lairs, 40, 60, 80 and 120 tiles off a token, a 20-tile leash, a 30-tile ring',
  LAIR_KINDS.map((k) => `${k.count}/${k.keepOff}`).join(',') === '4/40,2/60,1/80,1/120' && LAIR_LEASH === 20 && LAIR_RING === 30 && LAIR_RING_WILD === 1.5
    && HOARD_SHARE === 0.1 && HOARD_BOOK === 0.25 && LAIR_MOVE_CLEARS === 3 && LAIR_MOVE_DAYS === 7 && LAIR_TRACK === 100);

/* ---- siting --------------------------------------------------------------------------------------------------------- */

const ISLE = Number(one('ISLE'));
check('every lair was sited', !said('NOSITE').length, said('NOSITE').join(','));
check('and no more than each kind\'s count, the clock adding none', one('COUNT') === [...LAIR_KINDS].sort((a, b) => (a.id < b.id ? -1 : 1)).map((k) => `${k.id}:${k.count}`).join('|'), one('COUNT'));
for (const s of said('SITE')) {
  const [kind, x, y, tile, edgeTrees, openTrees, slope, deed, keep, apart, onDeed, region, height, piece] = s.split('|');
  const ground = kind === 'goblin_warren' ? tile === '0' && edgeTrees === 'true'
    : kind === 'orc_camp' ? tile === '0' && openTrees === 'false' && Number(slope) <= OPEN_SLOPE
      : kind === 'ogre_cave' ? tile === '4' && Number(slope) >= HILL_SLOPE
        : Number(region) === ISLE && Number(height) === Number(one('HIGHEST'));
  check(`${kind} at ${x},${y}: on its ground, ${deed} tiles off the token (≥ ${keep}), ${apart} off the next lair (≥ ${LAIR_APART}), on no deed, drawn there`,
    ground && Number(deed) >= Number(keep) && Number(apart) >= LAIR_APART && onDeed === 'false' && piece === `${kind}:${x}:${y}`, s);
}

/* ---- garrisons ------------------------------------------------------------------------------------------------------- */

for (const g of said('GARR')) {
  const [kind, state, size, who, unleashed] = g.split('|');
  const k = LAIR_KINDS.find((x) => x.id === kind)!;
  const members = who === '-' ? [] : who.split(',');
  const of = (sp: string, boss: boolean): number => members.filter((m) => m === `${sp}:${boss}`).length;
  const lo = k.garrison.reduce((n, [, a]) => n + a, 0), hi = k.garrison.reduce((n, [, , b]) => n + b, 0);
  const ok = k.garrison.length
    ? state === 'held' && Number(size) >= lo && Number(size) <= hi && members.length === Number(size) && members.every((m) => m.endsWith(':false'))
      && k.garrison.every(([sp, a, b]) => k.garrison.length === 1 ? of(sp, false) === Number(size) : of(sp, false) >= a && of(sp, false) <= b)
    : state === 'boss' && of(k.species, true) === 1 && members.length === 1;
  check(`${k.name} stands up with ${k.garrison.length ? `its garrison, ${size} of ${lo}–${hi}` : 'its dragon out'}, every one leashed and at home there`, ok && unleashed === '0', g);
}

/* ---- no monster out of the wild --------------------------------------------------------------------------------------- */

check('the wild\'s roll puts down no monster anywhere on this island', one('WILDPICK') === '-', one('WILDPICK'));
check('nor in the monster country that was, nor on Volcano Isle', one('COUNTRY') === '-', one('COUNTRY'));
check('and the stocking stands up wildermon and no monster', Number(one('STOCKED').split('|')[0]) > 0 && one('STOCKED').split('|')[1] === '0', one('STOCKED'));

/* ---- the leash ------------------------------------------------------------------------------------------------------- */

check(`moved a hundred tiles off, one of a lair's is held at its leash, ${LAIR_LEASH} tiles, both ends of its leg`,
  one('HELD').split('|').every((d) => Number(d) <= LAIR_LEASH + 1e-6 && Number(d) >= LAIR_LEASH - 1e-3), one('HELD'));
check('it hunts nobody past its leash, however near', one('PAST') === '-', one('PAST'));
check('and does hunt somebody within it', one('WITHIN') === U.p, one('WITHIN'));
check('and lets go of them once they are past it, its leg back toward its lair', one('LOST').split('|')[0] === '-' && Number(one('LOST').split('|')[1]) <= LAIR_LEASH, one('LOST'));
check(`after an hour's wandering, no monster of any lair is past its leash, where it is or where it is going`,
  Number(one('LEASH').split('|')[0]) > 0 && Number(one('LEASH').split('|')[1]) <= LAIR_LEASH + 1e-6 && Number(one('LEASH').split('|')[2]) <= LAIR_LEASH + 1e-6, one('LEASH'));

/* ---- seen, examined, kept to ----------------------------------------------------------------------------------------- */

const [war] = one('IDS').split('|');
check(`a body within ${LAIR_SIGHT} tiles has seen the lair, one further has not`,
  one('SEEN').split(',').includes(`${U.p}:${war}`) && !one('SEEN').split(',').includes(`${U.r}:${war}`), one('SEEN'));
check('the ground read lists the lairs a body has seen', /"kind": "goblin_warren"/.test(one('GROUND')) && one('GROUND').includes(`"id": ${war}`), one('GROUND'));
const seen: LairSeen[] = [{ id: Number(war), kind: 'goblin_warren', x: 0, y: 0 }];
check('the field guide says found for a kind whose lair was seen, not found for one not',
  lairFoundSays('goblin', seen) === 'Lair (goblin warren): found' && lairFoundSays('orc', seen) === 'Lair (orc camp): not found' && lairFoundSays('rabba', seen) === null);
check('Examine on the lair says it, its garrison and its size', /Lair: Goblin warren: garrison \d\/\d\./.test(one('EXAMINE')), one('EXAMINE'));
check('nobody picks a lair up', one('MOVEIT') === 'Goblin warren: cannot be moved, taken, used or worked.', one('MOVEIT'));
{
  const [dx, refusal] = one('DEEDNEAR').split('|');
  check(`a settlement is refused ${dx} tiles from a goblin warren, nearer than its 40, in the browser's words`,
    refusal === lairFoundingRefusal(Number(dx), 0, [{ id: 1, kind: 'goblin_warren', x: 0, y: 0 }]) && refusal.startsWith(`Too close to a goblin warren: ${dx} tiles; 40 needed`), one('DEEDNEAR'));
}

/* ---- the boss after the garrison -------------------------------------------------------------------------------------- */

const before = said('BEFORE');
check('while any of the garrison stands, the lair is held and no boss is out', before.length > 0 && before.every((b) => b === 'held|0'), before.join(','));
const [bState, bName, bKind, bMax, bAttack, bHealth] = one('BOSS').split('|');
check('the last of it killed, the warren chief is out at twice a goblin\'s health and at it',
  bState === 'boss' && bName === 'Warren chief' && bKind === 'goblin' && Number(one('BOSSMAX').split('|')[0]) === 2 * SPECIES.goblin.health
    && Number(one('BOSSMAX').split('|')[1]) === SPECIES.goblin.attack && Number(bHealth) === Number(bMax), `${one('BOSS')} ${one('BOSSMAX')}`);
check(`and told to whoever is within ${LAIR_ANNOUNCE} tiles, and to nobody further`,
  one('TOLD') === `${U.p}:Warren chief out: Goblin warren.`, one('TOLD'));
const [, kMax, kAttack] = one('KING').split('|');
check('the ogre king: twice an ogre\'s health, half again its blow', one('KING').startsWith('Ogre king|') && Number(kMax) === 2 * SPECIES.ogre.health
  && Math.abs(Number(kAttack) - 1.5 * SPECIES.ogre.attack) < 1e-6, one('KING'));
check('the dragon is its own boss, at a dragon\'s health and blow', one('DRAGON').startsWith(`${SPECIES.dragon.name}|`)
  && Number(one('DRAGON').split('|')[1]) === SPECIES.dragon.health, one('DRAGON'));
void bAttack;

/* ---- the hoard -------------------------------------------------------------------------------------------------------- */

const dealt = Object.fromEntries(one('DEALT').split(',').map((d) => d.split(':')));
check(`what each dealt the boss is kept: half, just over a tenth, just under`, Number(dealt[U.p]) === 0.5 && Number(dealt[U.q]) > HOARD_SHARE && Number(dealt[U.r]) < HOARD_SHARE, one('DEALT'));
const hoard = Object.fromEntries(said('HOARD').map((h) => h.split('|')));
const parts = (s: string): string[] => (s === '-' ? [] : s.split(','));
const allowed = new Set(['treasure_map', 'chief_ear', 'cooking_recipe']);
check(`a share for the one who dealt half and the one who dealt over a tenth: the goblin chief's ear each`,
  parts(hoard[U.p]).some((i) => i.startsWith('chief_ear:-:1:')) && parts(hoard[U.q]).some((i) => i.startsWith('chief_ear:-:1:')), JSON.stringify(hoard));
check('none for the one who dealt under a tenth', hoard[U.r] === '-', hoard[U.r]);
check('nothing in a share but a map, the trophy and a Recipe; no silver, nothing rare',
  [hoard[U.p], hoard[U.q]].flatMap(parts).every((i) => allowed.has(i.split(':')[0]) && i.endsWith(':-')), JSON.stringify(hoard));
check('the carcass is dropped to be butchered as usual', Number(one('CORPSE')) >= 1, one('CORPSE'));
check('the lair is cleared, its first clear counted, the blows put away', one('CLEARED') === 'cleared|1|false|0', one('CLEARED'));
const [fullRoll, fullItems] = one('FULL').split('#');
const full = parts(fullItems);
check(`a dragon's share with both rolls under their lines: a map, the great dragon scale, ${LAIR_KINDS[3].scales} hoard scales and a Formula; nothing else, nothing rare`,
  /"map": true/.test(fullRoll) && /"book":/.test(fullRoll) && full.length === 4 && full.every((i) => i.endsWith(':-'))
    && full.some((i) => i.startsWith(`dragon_scale:${HOARD_SCALE}:${LAIR_KINDS[3].scales}:`)) && full.some((i) => i.startsWith('great_dragon_scale:-:1:'))
    && full.some((i) => i.startsWith('enchant_formula:')) && full.some((i) => i.startsWith('treasure_map:')),
  one('FULL'));
for (const r of one('ROLLS').split('|')) {
  const [id, flags, ...rest] = r.split(':');
  const k = LAIR_KINDS.find((x) => x.id === id)!;
  check(`${k.name}: a map under ${k.map} and none at it, a book under ${HOARD_BOOK} and none at it; the trophy and scales always; nothing else in the roll`,
    flags === 'truefalsetruefalse' && rest.join(':') === JSON.stringify({ scales: k.scales, trophy: k.trophy }).replace(/":/g, '": ').replace(/,"/g, ', "'), r);
}
for (const d of one('DRAW').split('|')) {
  const [id, m, b] = d.split(':');
  const k = LAIR_KINDS.find((x) => x.id === id)!;
  check(`${k.name}, 4000 seeded shares: the map in ${m} (${k.map}), a Recipe or a Formula in ${b} (${HOARD_BOOK})`,
    Math.abs(Number(m) - k.map) <= 0.03 && Math.abs(Number(b) - HOARD_BOOK) <= 0.03, d);
}

/* ---- the cleared ring ------------------------------------------------------------------------------------------------- */

check(`a cleared lair's ring is the safe ring out to ${LAIR_RING} tiles and no further`, one('RING') === 'true|true|false|true', one('RING'));
check('the wild\'s roll in it puts down nothing the ring keeps out', one('RINGPICK') === '-', one('RINGPICK'));
const [ringN, ringBad] = one('RINGWILD').split('|');
check(`and it is stocked to ${lairRingWant(PER_REGION, REGION)} wildermon, ${LAIR_RING_WILD}× the usual, nothing the ring keeps out among them`,
  Number(ringN) >= lairRingWant(PER_REGION, REGION) && ringBad === '0', one('RINGWILD'));

/* ---- restocks --------------------------------------------------------------------------------------------------------- */

for (const k of LAIR_KINDS) {
  const early = said('EARLY').find((e) => e.startsWith(`${k.id}|`));
  const back = said('BACK').find((e) => e.startsWith(`${k.id}|`));
  check(`${k.name}: still empty a second before its ${k.restock / 60} minutes`, early === `${k.id}|cleared|0`, early);
  check(k.garrison.length ? `${k.name}: the first of its garrison back a second after, its boss inside` : `${k.name}: its dragon out again a second after its day`,
    k.garrison.length ? back?.startsWith(`${k.id}|held|1|0|`) === true : back?.startsWith(`${k.id}|boss|0|1|`) === true, back);
  if (!k.garrison.length) continue;
  const ne = said('NEXTEARLY').find((e) => e.startsWith(`${k.id}|`));
  const nx = said('NEXT').find((e) => e.startsWith(`${k.id}|`));
  const full = said('FULLUP').find((e) => e.startsWith(`${k.id}|`))?.split('|');
  check(`${k.name}: no second one a second short of a restock, one a second past it`, ne === `${k.id}|1` && nx === `${k.id}|2`, `${ne} ${nx}`);
  check(`${k.name}: ten restocks owed fill it to its size and no further`, !!full && full[1] === full[2], full?.join('|'));
}

/* ---- moving ----------------------------------------------------------------------------------------------------------- */

const [m1, m2] = said('MOVED').map((m) => m.split('|'));
check(`cleared ${LAIR_MOVE_CLEARS} times in ${LAIR_MOVE_DAYS} days, a camp restocks at a new site that takes it, its piece with it, seen by nobody yet`,
  !!m1 && m1[1] !== m1[2] && m1[3] === 'false' && m1[4] === '0' && m1[5] === m1[2] && m1[6] === '0' && m1[7] === 'true', m1?.join('|'));
check(`cleared once with two clears older than ${LAIR_MOVE_DAYS} days, the other stays where it was, still seen by whoever had seen it`,
  !!m2 && m2[1] === m2[2] && m2[4] === '1' && m2[6] === m2[8], m2?.join('|'));

check('an orc camp\'s fire burns while it is held, is out once it is cleared, and burns again when it restocks',
  said('FIRE').join(',') === '1|held|true,1|cleared|false,1|back|true,2|held|true,2|cleared|false,2|back|true', said('FIRE').join(','));

/* ---- Track ------------------------------------------------------------------------------------------------------------ */

check('a monster\'s page is never refused Track: its trail is its lair\'s, on both sides',
  one('TRACKREFUSE') === '-' && trackRefusal(SPECIES.goblin, new Set()) === null && trackable(SPECIES.goblin, new Set()));
{
  const [px, py, rest] = one('TRACK').split('|');
  const [events, lairsAt] = rest.split('#').length > 2 ? [rest.split('#').slice(0, -1).join('#'), rest.split('#').at(-1)!] : [rest.split('#')[0], rest.split('#')[1]];
  const near = lairsAt.split(';').map((p) => p.split(',').map(Number)).map(([x, y]) => ({ x, y, d: Math.hypot(x + 0.5 - Number(px), y + 0.5 - Number(py)) }))
    .sort((a, b) => a.d - b.d)[0];
  const r = trackReading(0, bearingTo(Number(px), Number(py), near.x + 0.5, near.y + 0.5), near.d, 0.5);
  check(`Track from the goblin's page reads the nearest warren, ${Math.round(near.d)} tiles, in the browser's words, with its arrow`,
    near.d <= LAIR_TRACK && events.includes(`event#${lairTrackSaid('Goblin warren', r)}`) && events.includes('tracked#{"far"'), `${events} / ${lairTrackSaid('Goblin warren', r)}`);
}
check(`and none past ${LAIR_TRACK} tiles`, one('TRACKNONE').includes(lairTrackSaid('Goblin warren', null)), one('TRACKNONE'));

/* ---- hoard scales ------------------------------------------------------------------------------------------------------ */

const helm = Object.fromEntries(said('HELM').map((h) => h.split('|')));
check(`a scale helm of plain dragon scales comes off at the skill, of hoard scales alone at ${HOARD_SCALE_CAP}× it`,
  helm['1'] !== '-' && helm['2'] !== '-' && Math.abs(Number(helm['2']) / Number(helm['1']) - HOARD_SCALE_CAP) < 0.01, JSON.stringify(helm));

finish('monster lairs');
