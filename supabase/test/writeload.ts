/**
 * A creature's numbers planned once a session, a settle writing only what changed, a step writing no index: the same
 * island at the end of it.
 *
 * Asked for: cached derived stats, unchanged creature writes skipped, storage for the hot tables
 * (20261101350001..350003). The functions a settle asks for a creature's numbers and its stores' room are PL/pgSQL now,
 * each returning the one query it was as SQL; `worker_settle` and `companion_settle` write their row only when it
 * changes; `player_afoot` gave way to `player_awake`.
 *
 * Each changed function is put back as the SQL it was, built from its own body, in a schema `cw_old` put first in the
 * search path, with `worker_settle` and `companion_settle` put back from their patched lines. Asked, both ways:
 *
 *   * every number, for every creature on the island and one of every kind at every stage, wild, working and at heel,
 *     with traits, rarity, size, pots and braces, care, a keeper's perks, a pedigree line, a meal, a slow and a stun:
 *     its stage, level, health, skill, range, den, name, every trait, stage perk, rarity, aura and `beast_mul` on every
 *     channel, its learning on every skill, its age; and for every piece of furniture of every kind, of every
 *     material, rarity, mark and enchantment, and every crate: room, heft, liquid, what is in it, what it takes of every
 *     thing, where it stands; every thing's weight and kind, every material, every room a rarity makes — the same,
 *     key for key, to the last bit;
 *   * a round of the clock and an hour of nine workers' day leave the island the same, creature for creature (every
 *     column) and item for item;
 *   * and the round writes fewer creature rows to do it (a companion at heel, and every worker and companion settled
 *     a second time in the round, write nothing they had not), every row that changed still written (its row version
 *     moved), so the creatures delta (`rpc_creatures` `p_since`) misses nothing;
 *   * and `player` is indexed on who is awake, not on when they were seen.
 *
 * Runs against the database the suite leaves behind; everything is in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
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

/** The functions 20261101350001 made PL/pgSQL. */
const PLANNED = [
  'stage_of(creature)', 'creature_level(jsonb)', 'trait_mul(text[], text)', 'aura_channel(text)',
  'deed_aura_of(uuid, uuid, bigint, text)', 'evo_perk(creature, text)', 'perk_n(creature, text)', 'task_skill(creature)',
  'work_range(creature)', 'den_class(creature)', 'learn_pace(creature, text)', 'species_health(text)',
  'class_mul(uuid, uuid, text, text)', 'rarity_blood(text, text)', 'companion_quick(creature)', 'kind_name_at(creature)',
  'kind_named(creature)', 'deed_trade_workers(uuid, uuid, text)', 'stun_left(uuid, integer)', 'world_time(uuid)',
  'work_stats_time(jsonb, double precision, text)', 'age_row(timestamp with time zone, double precision)',
  'age_row(timestamp with time zone, double precision, double precision)', 'deed_of(uuid, uuid)',
  'room_for(double precision, text)', 'mat_of(text)', 'furniture_capacity(placed)', 'furniture_heft(placed)',
  'liquid_capacity(placed)', 'furniture_refuses(placed, text)', 'furniture_takes(text, text)', 'item_raw(text)',
  'item_worked(text)', 'furniture_units(placed)', 'crate_units(uuid, integer)', 'crate_capacity(crate)',
  'furniture_kg(placed)', 'item_kg(text)', 'store_markable_refusal(placed)', 'store_reached(uuid, text, bigint)',
  'storey_reached(uuid, integer, integer, integer)',
];

/** The two writes 20261101350002 guarded, as they were and as they are. */
const GUARDS: [string, string, string][] = [
  ['worker_settle',
    `      enemy = c.enemy, spar_with = c.spar_with, spar_at = c.spar_at, storey = c.storey, storey_from = c.storey_from, way = c.way, settled_at = now()
    where world_id = p_world and id = p_id;
  if v_did is not null and c.keeper is not null then`,
    `      enemy = c.enemy, spar_with = c.spar_with, spar_at = c.spar_at, storey = c.storey, storey_from = c.storey_from, way = c.way, settled_at = now()
    where world_id = p_world and id = p_id
      -- Only when it changes the row (\`creature_storey\` asked of one upstairs or on a staircase, which may).
      and (coalesce(c.storey <> 0 or c.storey_from <> 0 or c.way is not null, false)
           or (from_x, from_y, to_x, to_y, leg_at, leg_ends, until, phase, work_x, work_y, carrying, fetching,
               idle_since, idle_why, idle_what, idle_n, ledger, worn, gear, bed, enemy, spar_with, spar_at,
               storey, storey_from, way, settled_at)
              is distinct from
              (c.from_x, c.from_y, c.to_x, c.to_y, c.leg_at, c.leg_ends, c.until, c.phase, c.work_x, c.work_y, c.carrying, c.fetching,
               c.idle_since, c.idle_why, c.idle_what, c.idle_n, c.ledger, c.worn, c.gear, c.bed, c.enemy, c.spar_with, c.spar_at,
               c.storey, c.storey_from, c.way, now()));
  if v_did is not null and c.keeper is not null then`],
  ['companion_settle',
    `      enemy = c.enemy, settled_at = now()
    where world_id = p_world and id = p_id;
  return done;`,
    `      enemy = c.enemy, settled_at = now()
    where world_id = p_world and id = p_id
      -- Only when it changes the row (\`creature_storey\` asked of one upstairs or on a staircase, which may).
      and (coalesce(storey <> 0 or storey_from <> 0 or way is not null, false)
           or (from_x, from_y, to_x, to_y, leg_at, leg_ends, until, phase, enemy, settled_at)
              is distinct from
              (c.from_x, c.from_y, c.to_x, c.to_y, c.leg_at, c.leg_ends, c.until, c.phase, c.enemy, now()));
  return done;`],
];
const dq = (s: string): string => `$q$${s}$q$`;

// A stone wall's bill, from the browser's own rules.
const g = Game.create(4243);
const wall = g.buildings.setWall(g.buildings.create('Hall', 10, 10), 0, 10, 10, 'n', 'solid', 'stone_brick');
const BILL = JSON.stringify(wall.needed);

const A = '7e5b0000-0000-4000-8000-0000000052a1';
const B = '7e5b0000-0000-4000-8000-0000000052a2';
const T = 24;

/**
 * Every number, one line a creature, a piece, a thing: run once as it is and once with `cw_old` first. Values as
 * text, which for a double is its exact value.
 */
const NUMBERS = `(
  select string_agg(line, E'\\n' order by line collate "C") from (
    select 'c ' || c.world_id || ' ' || c.id || ' ' || array_to_string(array[
        stage_of(c)::text, creature_level(c.skills)::text, task_skill(c)::text, work_range(c)::text, den_class(c)::text,
        species_health(c.species)::text, max_health(c)::text, kind_name_at(c), kind_named(c)::text, companion_quick(c)::text,
        stun_left(c.world_id, c.id)::text, age_row(c.born, old_of(c), age_pace(c))::text, age_row(c.born, old_of(c))::text,
        class_mul(c.world_id, c.keeper, 'hide', 'soul_strength')::text, class_mul(c.world_id, c.keeper, 'speed', 'body_strength')::text,
        deed_trade_workers(c.world_id, c.keeper, coalesce(c.job, sd.gathers))::text,
        (select string_agg(array_to_string(array[ch, trait_mul(c.traits, ch)::text, evo_perk(c, ch)::text, beast_mul(c, ch)::text,
                                                 aura_channel(ch)::text, deed_aura_of(c.world_id, c.keeper, c.post, ch)::text,
                                                 rarity_blood(c.rare, ch)::text], ',', '-'), ';' order by ch)
           from unnest(v_channels) ch),
        (select string_agg(pk || ',' || coalesce(perk_n(c, pk)::text, '-'), ';' order by pk) from unnest(v_perks) pk),
        (select string_agg(s || ',' || coalesce(learn_pace(c, s)::text, '-'), ';' order by s) from unnest(v_skills) s)], '|', '-') as line
      from creature c left join species_def sd on sd.id = c.species
    union all
    select 'p ' || p.id || ' ' || array_to_string(array[furniture_capacity(p)::text, furniture_heft(p)::text, liquid_capacity(p)::text,
        furniture_units(p)::text, furniture_kg(p)::text, store_markable_refusal(p), store_reached(p.world_id, 'furniture', p.id)::text,
        storey_reached(p.world_id, p.x, p.y, p.level)::text], '|', '-')
      from placed p
    union all
    select 'r ' || s.sub || ' ' || (select string_agg(d.id || ',' || coalesce(furniture_refuses(p, d.id), '-'), ';' order by d.id) from item_def d)
      from (select distinct on (sub) sub, id from placed where sub is not null order by sub, id) s join placed p on p.id = s.id
    union all
    select 'i ' || d.id || ' ' || array_to_string(array[item_raw(d.id)::text, item_worked(d.id)::text, item_kg(d.id)::text,
        (select string_agg(t || ',' || coalesce(furniture_takes(t, d.id), '-'), ';' order by t)
           from unnest(array['raw', 'worked', 'food', 'seed', 'sprout', 'other']) t)], '|', '-')
      from item_def d
    union all
    select 'm ' || coalesce(x, '-') || ' ' || coalesce(mat_of(x)::text, '-')
      from (select id from material_def union all select unnest(array[null, 'OAK', 'nonsense'])) m(x)
    union all
    select 'o ' || b || ' ' || coalesce(rr, '-') || ' ' || coalesce(room_for(b, rr)::text, '-')
      from unnest(array[-1, 0, 0.4, 0.5, 1, 7.5, 40, 333.3]::double precision[]) b,
           unnest(array[null, 'rare', 'supreme', 'fantastic', 'nonsense']) rr
    union all
    select 'k ' || cr.world_id || ' ' || cr.id || ' ' || array_to_string(array[crate_capacity(cr)::text, crate_units(cr.world_id, cr.id)::text,
        store_reached(cr.world_id, 'crate', cr.id)::text], '|', '-')
      from crate cr
    union all
    select 'u ' || pl.world_id || ' ' || pl.uid || ' ' || array_to_string(array[deed_of(pl.world_id, pl.uid)::text, world_time(pl.world_id)::text,
        class_mul(pl.world_id, pl.uid, 'hide', 'soul_strength')::text], '|', '-')
      from player pl
    union all
    select 'w ' || coalesce(s::text, '-') || ' ' || n || ' ' || coalesce(y, '-') || ' ' || coalesce(work_stats_time(s, n, y)::text, '-')
      from unnest(array[null, '{"goes": 1, "work": 4.5, "rest": 2, "idle": {"range": 3}}']::jsonb[]) s,
           unnest(array[-1, 0, 2.5]::double precision[]) n, unnest(array[null, 'rest', 'bed', 'range']) y
  ) q)`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- The round's budget, long enough on any machine for both to finish what is near (supabase/test/stirload.ts).
create or replace function settle_budget() returns interval language sql immutable as $$ select interval '60 seconds' $$;
create schema cw_old;

-- Each function as the SQL it was: its own body, out of \`return (...)\`, a row of a table read as \`select *\`.
do $p$
declare r record; v_body text; v_def text; v_n int;
begin
  for r in select p.oid, p.oid::regprocedure::text as sig, p.prosrc, l.lanname
             from pg_proc p join pg_language l on l.oid = p.prolang
            where p.oid = any (array[${PLANNED.map((f) => `'public.${f}'`).join(', ')}]::regprocedure[]) loop
    if r.lanname <> 'plpgsql' then raise exception '% is %, not plpgsql', r.sig, r.lanname; end if;
    v_body := (regexp_match(r.prosrc, E'^\\nbegin\\n  return \\\\(\\n(.*)\\n  \\\\);\\nend $'))[1];
    if v_body is null then raise exception '% is not one query returned', r.sig; end if;
    v_body := regexp_replace(v_body, '^select cw_row from ([a-z_]+(\\([a-z_, ]*\\))?) cw_row', 'select * from \\1');
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'AS $function$' || r.prosrc || '$function$', 'AS $function$ ' || v_body || ' $function$');
    v_def := replace(v_def, E'\\n LANGUAGE plpgsql\\n', E'\\n LANGUAGE sql\\n');
    v_n := (length(v_def) - length(replace(v_def, 'FUNCTION public.', ''))) / length('FUNCTION public.');
    if v_n <> 1 then raise exception '%: % headers', r.sig, v_n; end if;
    execute replace(v_def, 'FUNCTION public.', 'FUNCTION cw_old.');
  end loop;
end $p$;
-- And the two writes, unguarded.
do $p$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values ${GUARDS.map(([fn, was, now]) => `('${fn}', ${dq(was)}, ${dq(now)})`).join(', ')}) t(fn, was, now) loop
    v_def := replace(pg_get_functiondef(('public.' || r.fn)::regproc), 'FUNCTION public.', 'FUNCTION cw_old.');
    v_n := (length(v_def) - length(replace(v_def, r.now, ''))) / length(r.now);
    if v_n <> 1 then raise exception 'cw_old.%: % of the lines to put back, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.now, r.was);
  end loop;
end $p$;

-- What the island is: every creature (every column, a double to its last bit), every item but its id, the wall, what is foraged.
create function pg_temp.snap(w uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'creatures', (select jsonb_agg(c::text order by c.id) from creature c where c.world_id = w),
    'items', (select jsonb_agg(t order by t collate "C")
                from (select (to_jsonb(i) - 'id' - 'origin' - 'origin_fn' - 'origin_uid')::text as t from item i where i.world_id = w) q),
    'wall', (select jsonb_agg(needed order by x) from wall where world_id = w),
    'foraged', (select jsonb_agg(jsonb_build_array(x, y, kind) order by x, y, kind) from foraged where world_id = w))
$f$;
-- Each creature's row version (\`xmin\`) and row, to find the ones written and the ones changed.
create temp table seen (id int, xmin_was text, row_was text, xmin_now text, row_now text);
create function pg_temp.creature_writes() returns bigint language sql as $f$
  select coalesce(sum(n_tup_upd), 0) from pg_stat_xact_user_tables where relid = 'public.creature'::regclass
$f$;
-- An hour of every worker's day: its clock put back an hour, and settled until none is due (stirload.ts).
create function pg_temp.work_hour(w uuid) returns int language plpgsql as $f$
declare r record; i int; v_any boolean; n int := 0;
begin
  update creature set settled_at = settled_at - interval '3600 seconds', until = until - interval '3600 seconds',
         leg_at = leg_at - interval '3600 seconds', leg_ends = leg_ends - interval '3600 seconds'
   where world_id = w and mode = 'deed';
  for i in 1..400 loop
    v_any := false;
    for r in select id from creature where world_id = w and mode = 'deed' and until <= now() order by id loop
      perform creature_settle(w, r.id); v_any := true; n := n + 1;
    end loop;
    exit when not v_any;
  end loop;
  return n;
end $f$;

do $t$
declare w uuid; v_p bigint; v_c1 int; v_c2 int; sp text; k int; i int := 0; j int := 0; r record; v_lvl int; v_mode text;
        v_path text := current_setting('search_path'); v_round jsonb; v_hour jsonb; v_kept jsonb := '{}'; v_w0 bigint;
        v_channels text[]; v_perks text[]; v_skills text[]; v_mats text[]; v_traits text[]; v_now text; v_was text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Writeload', 516, 128, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 128);
  perform land_set_height(w, x, y, -20) from generate_series(${T + 6}, ${T + 12}) x, generate_series(${T + 2}, ${T + 8}) y;
  perform land_set_tile(w, x, ${T + 6}, tile_id('Tree')), land_set_data(w, x, ${T + 6}, tree_pack(0, 3)) from generate_series(${T - 8}, ${T - 7}) x;
  insert into world_stocked (world_id, bx, by) values (w, 0, 0);
  update player set away = true where world_id <> w;
  perform set_config('request.jwt.claims', json_build_object('sub', '${B}')::text, true);
  perform rpc_join(w, 'Neighbour');
  perform set_config('request.jwt.claims', json_build_object('sub', '${A}')::text, true);
  perform rpc_join(w, 'Keeper');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, away = false, seen_at = now() where world_id = w and uid = '${A}';
  update player set x = ${T + 5} + 0.5, y = ${T} + 0.5, away = false, seen_at = now() where world_id = w and uid = '${B}';
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Writestead', ${T}, ${T}, 12, 5, '${A}');
  -- Its stores.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'larder', ${T + 2}, ${T - 2}, 0, 0, ${T + 2}.375, ${T - 2}.375, 40, '${A}') returning id into v_p;
  insert into item (world_id, holder, placed, def, ql, count) values
    (w, 'furniture', v_p, 'potato', 30, 20), (w, 'furniture', v_p, 'nuts', 30, 20), (w, 'furniture', v_p, 'bread', 30, 10),
    (w, 'furniture', v_p, 'meat', 30, 10), (w, 'furniture', v_p, 'apple', 30, 10), (w, 'furniture', v_p, 'acorn', 30, 10);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T + 3}, ${T - 2}, 0, 0, ${T + 3}.375, ${T - 2}.375, 40, '${A}') returning id into v_p;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_p, 'log', 30, 12);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'craft_bin', ${T + 4}, ${T - 2}, 0, 0, ${T + 4}.375, ${T - 2}.375, 40, '${A}') returning id into v_p;
  insert into item (world_id, holder, placed, def, ql, count) values
    (w, 'furniture', v_p, 'stone_brick', 30, 30), (w, 'furniture', v_p, 'mortar', 30, 15);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bulk_bin', ${T + 5}, ${T - 2}, 0, 0, ${T + 5}.375, ${T - 2}.375, 40, '${A}');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'chest', ${T + 2}, ${T - 4}, 0, 0, ${T + 2}.375, ${T - 4}.375, 40, '${A}');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'cupboard', ${T + 3}, ${T - 4}, 0, 0, ${T + 3}.375, ${T - 4}.375, 40, '${A}');
  insert into crate (world_id, id, kind, x, y, sx, sy, deed) values (w, 9100, 'log', ${T + 5}, ${T + 1}, 0, 0, true);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 9100, 'log', 30, 6);
  insert into item (world_id, holder, gx, gy, def, ql, count) values (w, 'ground', ${T - 4}, ${T + 4}, 'log', 20, 3), (w, 'ground', ${T - 5}, ${T + 3}, 'plank', 20, 2);
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Hall', 1, '${A}');
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
    select w, 0, '${wall.dir}', ${T - 4} + jj, ${T - 4}, 1, 'solid', 'stone_brick', '${BILL}'::jsonb, '${BILL}'::jsonb, '${A}' from generate_series(0, 1) jj;
  -- Nine workers at nine trades, a companion each, a wild one near.
  foreach sp in array array['rabba', 'bevere', 'wadd', 'whispet', 'magga', 'rippa', 'cobbe', 'simma', 'sedra'] loop
    i := i + 1;
    k := creature_spawn(w, sp, ${T} + 0.5 + (i % 3) - 1, ${T} + 0.5 + (i / 3) - 1, 'active', now() - interval '60 days', '${A}');
    update creature set mode = 'deed', traits = '{}', settled_at = now(), until = now() where world_id = w and id = k;
  end loop;
  v_c1 := creature_spawn(w, 'rabba', ${T} + 1.5, ${T} + 0.5, 'active', now() - interval '30 days', '${A}');
  v_c2 := creature_spawn(w, 'bura', ${T + 6} + 0.5, ${T} + 0.5, 'active', now() - interval '30 days', '${B}');
  -- At heel, their turn up, a few seconds since they were settled.
  update creature set traits = '{}', settled_at = now() - interval '5 seconds', until = now() - interval '1 second'
   where world_id = w and id in (v_c1, v_c2);
  perform creature_spawn(w, 'rabba', ${T + 3} + 0.5, ${T + 14} + 0.5, 'wild', now() - interval '30 days', null);
  update creature set until = now() - interval '1 second', settled_at = now() - interval '5 seconds' where world_id = w and mode = 'wild';

  /* ---- a round of the clock, as it is and as it was ---- */
  insert into seen (id, xmin_was, row_was) select c.id, c.xmin::text, c::text from creature c where c.world_id = w;
  begin
    perform set_config('search_path', v_path, true);
    perform setseed(0.37);
    v_w0 := pg_temp.creature_writes();
    perform world_tick();
    -- And every one of them settled a second time in the round, as a stray sweep or a blow would.
    perform creature_settle(w, c.id) from creature c where c.world_id = w and c.mode in ('deed', 'active') order by c.id;
    v_kept := v_kept || jsonb_build_object('ROUNDWRITESNOW', pg_temp.creature_writes() - v_w0);
    v_round := pg_temp.snap(w);
    update seen s set xmin_now = c.xmin::text, row_now = c::text from creature c where c.world_id = w and c.id = s.id;
    v_kept := v_kept || jsonb_build_object(
      'HIDDENNOW', (select count(*) from seen where row_now is distinct from row_was and xmin_now = xmin_was),
      'CHANGEDNOW', (select count(*) from seen where row_now is distinct from row_was));
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('ROUNDNOW', v_round::text);
  begin
    perform set_config('search_path', 'cw_old, ' || v_path, true);
    perform setseed(0.37);
    v_w0 := pg_temp.creature_writes();
    perform world_tick();
    -- And every one of them settled a second time in the round, as a stray sweep or a blow would.
    perform creature_settle(w, c.id) from creature c where c.world_id = w and c.mode in ('deed', 'active') order by c.id;
    v_kept := v_kept || jsonb_build_object('ROUNDWRITESWAS', pg_temp.creature_writes() - v_w0);
    v_round := pg_temp.snap(w);
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('ROUNDWAS', v_round::text);

  /* ---- an hour of work, as it is and as it was ---- */
  begin
    perform set_config('search_path', v_path, true);
    perform setseed(0.61);
    v_w0 := pg_temp.creature_writes();
    v_kept := v_kept || jsonb_build_object('SETTLES', pg_temp.work_hour(w));
    v_kept := v_kept || jsonb_build_object('HOURWRITESNOW', pg_temp.creature_writes() - v_w0);
    v_hour := pg_temp.snap(w);
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('HOURNOW', v_hour::text);
  begin
    perform set_config('search_path', 'cw_old, ' || v_path, true);
    perform setseed(0.61);
    v_w0 := pg_temp.creature_writes();
    perform pg_temp.work_hour(w);
    v_kept := v_kept || jsonb_build_object('HOURWRITESWAS', pg_temp.creature_writes() - v_w0);
    v_hour := pg_temp.snap(w);
    raise exception using errcode = 'P0901', message = 'undone';
  exception when sqlstate 'P0901' then null;
  end;
  insert into said values ('HOURWAS', v_hour::text);
  perform set_config('search_path', v_path, true);

  /* ---- every number, as it is and as it was ---- */
  -- One of every kind at every stage, wild, working and at heel, with everything a number can be moved by.
  select array_agg(id order by id) into v_traits from trait_def;
  i := 0;
  for r in select sd.id, sd.gathers from species_def sd order by sd.id loop
    foreach v_lvl in array array[1, 25, 50] loop
      i := i + 1;
      v_mode := (array['wild', 'deed', 'active'])[1 + i % 3];
      k := creature_spawn(w, r.id, 40.5 + i % 80, 40.5 + i / 80, 'active', now() - make_interval(days => (i * 7) % 120),
                          case when v_mode = 'wild' then null else '${A}'::uuid end);
      update creature set mode = v_mode, keeper = case when v_mode = 'wild' then null else '${A}'::uuid end,
          skills = jsonb_build_object(coalesce((select g.skill from gather_def g where g.id = r.gathers), 'foraging'), v_lvl,
                                      'fighting', least(v_lvl, 30), 'animal_husbandry', v_lvl / 2),
          traits = v_traits[1 + (i * 3) % cardinality(v_traits) : 1 + (i * 3) % cardinality(v_traits) + i % 4],
          rare = (array[null, 'rare', 'supreme', 'fantastic'])[1 + i % 4],
          form_size = (array[null, 'large', 'small'])[1 + (i / 4) % 3],
          boosts = (array[null, '{"hardy": 3, "speed": 2, "work": 1, "tough": 4}', '{"brace": 2, "collar": 1}', '{"work": 5}', '{}'])[1 + i % 5]::jsonb,
          care = (i % 7) / 6.0,
          kept = case when v_mode = 'active' and i % 2 = 0 then '{"kept:hardy": 1.1, "kept:speed": 1.05, "kept:soak": 0.9, "kept:haste": 1.2,
                       "kept:age": 0.8, "kept:old_at": 5000000, "kept:care_bonus": 0.3}'::jsonb else kept end,
          pedigree = case when i % 6 = 0 then '{"line": {"speed": 3, "hardy": 2, "work": 4, "sight": 5}}'::jsonb else pedigree end,
          fed_until = case when i % 4 = 1 then now() + interval '1 hour' end, fed_bonus = case when i % 4 = 1 then 0.2 end,
          slow_until = case when i % 5 = 2 then now() + interval '1 hour' end, slow = case when i % 5 = 2 then 0.5 end,
          job = case when v_mode = 'deed' and i % 4 = 0 then (select id from gather_def order by id offset i % 10 limit 1) end
        where world_id = w and id = k;
      if i % 9 = 0 then insert into class_mark (world_id, creature_id, kind, val, until) values (w, k, 'stun', 1, now() + interval '20 seconds'); end if;
    end loop;
  end loop;
  -- One of every piece of furniture, of every material, rarity, mark and enchantment by turns, with things in it; and crates.
  select array_agg(id order by id) into v_mats from material_def;
  for r in select fd.id from furniture_def fd order by fd.id loop
    j := j + 1;
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, material, rare, mark, enchant, level)
      values (w, 'furniture', r.id, 40 + j % 80, 70 + j / 80, 0, 0, 40 + j % 80 + 0.375, 70 + j / 80 + 0.375, 10 + j % 90, '${B}',
              case when j % 5 = 0 then null else v_mats[1 + j % cardinality(v_mats)] end,
              (array[null, 'rare', 'supreme', 'fantastic'])[1 + j % 4],
              (array[null, '{"hold": 1.25}'])[1 + (j / 2) % 2]::jsonb,
              (array[null, '{"id": "deep_hold", "ql": 40}', '{"id": "bag_of_holding", "ql": 90}', '{"id": "true_axle", "ql": 150}'])[1 + (j / 3) % 4]::jsonb,
              case when j % 7 = 0 then 1 else 0 end)
      returning id into v_p;
    if j % 2 = 0 then
      insert into item (world_id, holder, placed, def, ql, count)
        select w, 'furniture', v_p, d.id, 20, 1 + j % 9 from item_def d order by d.id offset (j * 5) % 500 limit 2;
    end if;
  end loop;
  insert into crate (world_id, id, kind, x, y, sx, sy, material, rare, enchant, level)
    select w, 9200 + n, (array['log', 'plank'])[1 + n % 2], 40 + n, 90, 0, 0, case when n % 3 = 0 then null else v_mats[1 + n % cardinality(v_mats)] end,
           (array[null, 'rare', 'supreme', 'fantastic'])[1 + n % 4], (array[null, '{"id": "deep_hold", "ql": 60}'])[1 + n % 2]::jsonb, n % 2
      from generate_series(0, 11) n;
  insert into item (world_id, holder, crate, def, ql, count) select w, 'crate', 9200 + n, 'plank', 20, 1 + n from generate_series(0, 11, 2) n;

  select array_agg(distinct x order by x) into v_channels from (select id from channel_def union select channel from trait_effect) q(x);
  select array_agg(distinct perk order by perk) into v_perks from species_def where perk is not null;
  select array_agg(distinct x order by x) into v_skills
    from (select skill from gather_def union select learns from species_def where learns is not null union select 'nonsense') q(x);
  v_kept := v_kept || jsonb_build_object('CREATURES', (select count(*) from creature), 'PIECES', (select count(*) from placed),
    'KINDS', (select count(distinct species) from creature), 'CHANNELS', cardinality(v_channels));
  v_now := ${NUMBERS};
  perform set_config('search_path', 'cw_old, ' || v_path, true);
  v_was := ${NUMBERS};
  perform set_config('search_path', v_path, true);
  insert into said values ('NUMBERSNOW', v_now), ('NUMBERSWAS', v_was);
  v_kept := v_kept || jsonb_build_object(
    'AWAKE', (select pg_get_indexdef(indexrelid) from pg_index where indexrelid = to_regclass('public.player_awake')),
    'AFOOT', to_regclass('public.player_afoot') is not null);
  insert into said select key, value #>> '{}' from jsonb_each(v_kept);
end $t$;
select k || '=' || replace(v, E'\\n', '\\n') from said;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const get = (k: string): string => said.get(k) ?? '';

/** Where two snapshots first part, for the failure line. */
const apart = (a: string, b: string): string => {
  if (a === b) return '';
  const x = JSON.parse(a || 'null') as Record<string, unknown[]> | null;
  const y = JSON.parse(b || 'null') as Record<string, unknown[]> | null;
  for (const key of Object.keys(x ?? {})) {
    const xa = (x?.[key] ?? []) as unknown[];
    const ya = (y?.[key] ?? []) as unknown[];
    for (let i = 0; i < Math.max(xa.length, ya.length); i++) {
      const [p, q] = [JSON.stringify(xa[i]) ?? '', JSON.stringify(ya[i]) ?? ''];
      if (p !== q) {
        let at = 0;
        while (at < p.length && p[at] === q[at]) at++;
        return `${key}[${i}] from ${at}: ${p.slice(Math.max(0, at - 120), at + 200)} | ${q.slice(Math.max(0, at - 120), at + 200)}`;
      }
    }
  }
  return 'apart';
};
/** The first line two lists of numbers part on. */
const firstApart = (a: string, b: string): string => {
  const x = a.split('\\n');
  const y = b.split('\\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `${(x[i] ?? '').slice(0, 300)} | ${(y[i] ?? '').slice(0, 300)}`;
  return '';
};

const nums = get('NUMBERSNOW');
check(`every number the same as the SQL it was, key for key: ${get('CREATURES')} creatures of ${get('KINDS')} kinds on ${get('CHANNELS')} channels, ${get('PIECES')} pieces, every thing and material`,
  nums !== '' && nums === get('NUMBERSWAS'), firstApart(nums, get('NUMBERSWAS')));
check('and the numbers are numbers: stages past nought, rarities, auras and perks among them',
  /\|2\|/.test(nums) && nums.split('\\n').length > 900, `${nums.split('\\n').length} lines`);
check('a round of the clock leaves the island the same both ways: every creature, item and the wall',
  get('ROUNDNOW') !== '' && get('ROUNDNOW') === get('ROUNDWAS'), apart(get('ROUNDNOW'), get('ROUNDWAS')));
check('an hour of every worker\'s day leaves the island the same both ways, creature for creature and item for item',
  get('HOURNOW') !== '' && get('HOURNOW') === get('HOURWAS'), apart(get('HOURNOW'), get('HOURWAS')));
check('the round writes fewer creature rows than it did',
  Number(get('ROUNDWRITESNOW')) < Number(get('ROUNDWRITESWAS')), `${get('ROUNDWRITESNOW')} against ${get('ROUNDWRITESWAS')}`);
check('and the hour no more', Number(get('HOURWRITESNOW')) <= Number(get('HOURWRITESWAS')) && Number(get('HOURWRITESNOW')) > 0,
  `${get('HOURWRITESNOW')} against ${get('HOURWRITESWAS')}, in ${get('SETTLES')} settles`);
check('every creature that changed in the round was written, so the delta sends it',
  get('HIDDENNOW') === '0' && Number(get('CHANGEDNOW')) > 0, `${get('HIDDENNOW')} changed and not written, of ${get('CHANGEDNOW')} changed`);
check('player is indexed on who is awake', get('AWAKE') === 'CREATE INDEX player_awake ON public.player USING btree (world_id) WHERE (NOT away)', get('AWAKE'));
check('and not on when they were seen', get('AFOOT') === 'false', get('AFOOT'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a creature's numbers planned once, a settle writing what changed — ${ok.length} of ${ok.length}`);
