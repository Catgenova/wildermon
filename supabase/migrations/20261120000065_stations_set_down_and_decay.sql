/*
 * The stations -- a campfire, a smelter, a kiln and an anvil -- set down as a
 * piece of furniture is, and decaying off a settlement (`src/game/stations.ts`).
 *
 * Set down: the browser lays one out as a ghost that follows the cursor and
 * turns with Q and E, and asks the job it always had (`build_campfire`,
 * `place_smelter`, `place_kiln`, `place_anvil`) with the spot and the way it
 * faces. What changes here:
 *
 *   * a campfire and an anvil keep the way they face (`placed.facing`), as a
 *     smelter and a kiln already did (`perform_fire`, `perform_forge`);
 *   * a campfire is refused on water and where anything stands, in the
 *     browser's words (`Game.firePlaceReason`; `block_taken`, as every piece);
 *   * an anvil is refused where anything stands as every piece is: a crate or
 *     a column in its corner as well as another thing set down (`block_taken`);
 *   * a smelter goes down only on a settlement of yours, which the browser
 *     always refused and this island never asked (`fire_refusal`).
 *
 * Nothing is stored differently: all four were rows of `placed` with a facing
 * already, so every one standing stays where it is, facing south.
 *
 * Decay: off any settlement a station takes damage at its item's rate on the
 * ground (`ground_decay_rate`; a campfire at its shafts'), under a roof at the
 * share a roof keeps (`decay_multiplier`), and goes at a hundred. On a
 * settlement it takes none. Charged on the ground's clock (`ground_step`,
 * `ground_rows`) by `station_sweep` in the world's round, and to now whenever
 * it is read (`station_dmg`): the ground read sends it, and picking one up
 * carries it into the pack. `placed.decay_at` is when its `dmg` was last true;
 * every station standing starts from this migration, with nothing owed.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

/** When a thing's `dmg` was last charged for decay: a station's (`station_sweep`). */
alter table placed add column if not exists decay_at timestamptz not null default now();
/** The stations due, oldest first, without reading the rest of what is set down. */
create index if not exists placed_station_due on placed (world_id, decay_at)
  where kind in ('campfire', 'smelter', 'kiln', 'anvil');

/* ---- what decays, and how fast ------------------------------------------------------------------ */

/** The placed things that are stations: the ones that decay off a settlement (`STATIONS`). */
create or replace function station_kind(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('campfire', 'smelter', 'kiln', 'anvil')
$fn$;

/** The item a station decays as on the ground: its own, and a campfire the shafts it is laid from (`StationDef.decaysAs`). */
create or replace function station_decays_as(p_kind text) returns text language sql immutable as $fn$
  select case p_kind when 'campfire' then 'shaft' else p_kind end
$fn$;

/**
 * Damage an hour where it stands (`stationDecayRate`): none on any settlement;
 * off one, its item's on the ground at its quality, rarity and, for an anvil,
 * its metal (`ground_decay_rate`), at the share a roof keeps under one
 * (`decay_multiplier`).
 */
create or replace function station_decay_rate(p placed) returns double precision language sql stable as $fn$
  select case when on_deed(p.world_id, p.x, p.y) then 0
    else ground_decay_rate(jsonb_populate_record(null::item, jsonb_build_object(
           'def', station_decays_as(p.kind), 'ql', p.ql, 'rare', p.rare,
           'extra', case when p.kind = 'anvil' then p.sub end)))
         * decay_multiplier(p.world_id, p.x, p.y) end
$fn$;

/** Its damage now: what was charged, and its rate since (`stationCondition`). */
create or replace function station_dmg(p placed) returns double precision language sql stable as $fn$
  select least(100, p.dmg + station_decay_rate(p) * greatest(0, extract(epoch from (now() - p.decay_at))) / 3600)
$fn$;

/**
 * The stations whose charge is due, charged to now, on the ground's step and
 * as many at a time as the ground's (`ground_sweep`); those at a hundred are
 * gone, with whatever was in them. Returns how many were charged.
 */
create or replace function station_sweep(p_world uuid) returns integer language plpgsql as $fn$
declare v_n int; v_gone bigint[]; r record;
begin
  with due as (
    select pl.id from placed pl
     where pl.world_id = p_world and pl.kind in ('campfire', 'smelter', 'kiln', 'anvil')
       and pl.decay_at <= now() - ground_step()
     order by pl.decay_at
     limit ground_rows()
  ), charged as (
    update placed p set dmg = station_dmg(p), decay_at = now()
      from due where p.id = due.id
    returning p.id, p.dmg
  )
  select count(*), array_agg(id) filter (where dmg >= 100) into v_n, v_gone from charged;
  if v_gone is not null then
    for r in delete from placed where id = any (v_gone) returning x, y loop
      perform land_announce(p_world, r.x, r.y);
    end loop;
  end if;
  return v_n;
end $fn$;

-- In the world's round, with what lies on the ground.
select pg_temp.patch_fn('world_tick()',
  $o$      v_rotted := v_rotted + ground_sweep(w.id);$o$,
  $n$      v_rotted := v_rotted + ground_sweep(w.id) + station_sweep(w.id);$n$);

-- The ground read sends a station's damage as it is now, and not the column it was last charged to.
select pg_temp.patch_fn('rpc_ground(uuid, double precision, boolean, text)',
  $o$- 'cx' - 'cy' - 'crumbles_at')$o$,
  $n$- 'cx' - 'cy' - 'crumbles_at' - 'decay_at')$n$);
select pg_temp.patch_fn('rpc_ground(uuid, double precision, boolean, text)',
  $o$'lit', placed_lit(pl), 'mine', coalesce(pl.made_by = me, false),$o$,
  $n$'lit', placed_lit(pl), 'mine', coalesce(pl.made_by = me, false),
                              'dmg', case when station_kind(pl.kind) then station_dmg(pl) else pl.dmg end,$n$);

-- Picked up, its damage to now goes into the pack with it.
select pg_temp.patch_fn('perform_fire(uuid, uuid, text, jsonb)',
  $o$    update item set enchant = p.enchant, dmg = p.dmg, infuse = p.infuse where id = made;$o$,
  $n$    update item set enchant = p.enchant, dmg = case when station_kind(p.kind) then station_dmg(p) else p.dmg end,
        infuse = p.infuse where id = made;$n$);
select pg_temp.patch_fn('perform_forge(uuid, uuid, text, jsonb)',
  $o$    update item set enchant = p.enchant, dmg = p.dmg where id = v_made;$o$,
  $n$    update item set enchant = p.enchant, dmg = station_dmg(p) where id = v_made;$n$);

/* ---- set down as a piece is --------------------------------------------------------------------- */

-- A campfire: on dry ground, where nothing stands (`Game.firePlaceReason`), and a smelter on a settlement of yours.
select pg_temp.patch_fn('fire_refusal(uuid, uuid, text, jsonb)',
  $o$    if pack_count(p_world, p_uid, 'shaft') < 2 then return 'A campfire takes 2 shafts.'; end if;
    return null;$o$,
  $n$    if pack_count(p_world, p_uid, 'shaft') < 2 then return 'A campfire takes 2 shafts.'; end if;
    if has_water(p_world, (p_target->>'x')::int, (p_target->>'y')::int) then return 'Fire needs dry, open ground.'; end if;
    sz := placed_size('campfire', null);
    if block_taken(p_world, (p_target->>'x')::int, (p_target->>'y')::int,
                   least(subtiles() - sz[1], greatest(0, (p_target->>'sx')::int)),
                   least(subtiles() - sz[2], greatest(0, (p_target->>'sy')::int)), sz[1], sz[2]) then
      return 'Something is already standing there.';
    end if;
    return null;$n$);
select pg_temp.patch_fn('fire_refusal(uuid, uuid, text, jsonb)',
  $o$    if p_action = 'place_smelter' and it.def <> 'smelter' then return 'That is not a smelter.'; end if;$o$,
  $n$    if p_action = 'place_smelter' and it.def <> 'smelter' then return 'That is not a smelter.'; end if;
    if p_action = 'place_smelter' and not on_my_deed(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int) then
      return 'Set down only on a settlement of yours.';
    end if;$n$);

-- A campfire keeps the way it was laid.
select pg_temp.patch_fn('perform_fire(uuid, uuid, text, jsonb)',
  $o$    insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by)
    values (p_world, 'campfire', (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + 1.0) / subtiles(), (p_target->>'y')::int + (ay + 1.0) / subtiles(),
            120, p_uid);$o$,
  $n$    insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by, facing)
    values (p_world, 'campfire', (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + 1.0) / subtiles(), (p_target->>'y')::int + (ay + 1.0) / subtiles(),
            120, p_uid, case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end);$n$);

-- And an anvil the way it was set down.
select pg_temp.patch_fn('perform_forge(uuid, uuid, text, jsonb)',
  $o$    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, rare, enchant, dmg)$o$,
  $n$    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, rare, enchant, dmg, facing)$n$);
select pg_temp.patch_fn('perform_forge(uuid, uuid, text, jsonb)',
  $o$            (p_target->>'y')::int + (v_sy + 1.0) / subtiles(), it.ql, p_uid, it.rare, it.enchant, it.dmg)$o$,
  $n$            (p_target->>'y')::int + (v_sy + 1.0) / subtiles(), it.ql, p_uid, it.rare, it.enchant, it.dmg,
            case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end)$n$);

/** Why an anvil will not go down on spot (sx, sy) of tile (x, y), or null: on land, where nothing stands (`block_taken`). */
create or replace function anvil_place_reason(p_world uuid, p_x integer, p_y integer, p_sx integer, p_sy integer)
returns text language plpgsql stable as $fn$
begin
  if not in_bounds(p_world, p_x, p_y) then return 'That is off the edge of the world.'; end if;
  if has_water(p_world, p_x, p_y) then return 'Not in the water.'; end if;
  if block_taken(p_world, p_x, p_y, p_sx, p_sy, anvil_subtiles(), anvil_subtiles()) then
    return 'Something is already standing there.';
  end if;
  return null;
end $fn$;

select private.lock_doors();
