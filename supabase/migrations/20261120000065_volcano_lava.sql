-- Volcano Isle's lava: a maze laid at every dawn across its upper slopes, and the heat of being up there.
--
-- Asked for: "a shifting labyrinth pattern daily of lava" across the upper slopes of Volcano Isle, and a heat meter
-- to prepare for (`src/game/lava.ts`, which says the same rules in the browser's words and numbers).
--
-- The lava is never written into the ground: `lava_at` works it out, off the world's seed and the day (`lava_day_of`,
-- the daily reset at dawn). The cone's box (`lava_box`, thousandths of the map) is cut into blocks of `lava_cell`
-- tiles; every other block both ways is a room, between two rooms a wall, where walls meet a pillar. The day's maze is
-- the spanning tree of the rooms Kruskal's rule takes off walls weighed by `hash_tile(wall, day, seed)`
-- (`lava_passes_make`), kept a day at a time in `lava_day` (`lava_ready`, on the clock, today's and tomorrow's).
-- A wall the tree goes through, and every room, is never lava; any other wall and every pillar is lava where its
-- middle tile is Volcano Isle's ground from `lava_foot` to under `lava_caldera` -- unless it holds caldera ground, a
-- lair's piece or a seryll seam (`lava_must_reach`), when it is open, and so is the wall east of such a pillar. A
-- settlement, a road or laid path, a building, a foundation or anything set down spares its tile (`lava_spared`).
--
-- On it: `lava_burn` of your health a second (`body_settle`), nothing dug, built, set down or founded
-- (`lava_ground_refusal`, before whose ground it is), and no creature steps onto it (`creature_tile_ok`).
--
-- The heat, held on the player (`stats.heat`) and settled with the body: filling at `heat_fill` a second in the heat
-- (`lava_heat_on`), `heat_near` times that beside lava, `heat_burn` of your health a second when full, draining at
-- `heat_drain` below the band; slowed by every dragon-scale piece and ice infusion worn and by a cooling draught
-- (`heat_mul`), which also takes `draught_drop` off as it goes down (`perform_item`).

set local lock_timeout = '3s';

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

/* ---- The day's maze -------------------------------------------------------------------------------------------- */

/** The day the maze is laid for at a moment: whole days since the first dawn of 1970 (`lavaDay`). */
create or replace function lava_day_of(p_at timestamptz) returns int language sql immutable as $$
  select floor((extract(epoch from p_at) - tree_dawn_utc() * 3600) / 86400)::int
$$;

/** Where the rooms are on a world this size: the block of the first, and how many across and down (`lavaGrid`). */
create or replace function lava_grid(p_size int, out bx0 int, out by0 int, out cols int, out rows int) language sql immutable as $$
  select a.x0, a.y0, greatest(1, (a.x1 - a.x0) / 2 + 1), greatest(1, (a.y1 - a.y0) / 2 + 1)
    from (select (b[1] * p_size) / (1000 * lava_cell()) as x0, (b[2] * p_size) / (1000 * lava_cell()) as y0,
                 (b[3] * p_size) / (1000 * lava_cell()) as x1, (b[4] * p_size) / (1000 * lava_cell()) as y1
            from lava_box() b) a
$$;

/** A world's seed as the maze's hash takes it, nought up to 2^31 (`lavaSalt`). */
create or replace function lava_salt(p_seed bigint) returns bigint language sql immutable as $$
  select ((p_seed % 2147483648) + 2147483648) % 2147483648
$$;

/**
 * The day's maze, worked out: a byte a room, `lava_pass_east` and `lava_pass_south` for its open walls (`lavaPasses`).
 * Wall `k` is room `k / 2`'s east wall when even and its south wall when odd; lightest first by
 * `hash_tile(k, day, salt)`, the wall number between two of a weight, each taken where it joins two rooms not yet
 * joined. With every weight told apart the tree is the one tree, so it is the browser's.
 */
create or replace function lava_passes_make(p_seed bigint, p_size int, p_day int) returns bytea language plpgsql immutable as $$
declare g record; n int; up int[]; bits int[]; k int; a int; b int; ra int; rb int; v_salt bigint := lava_salt(p_seed);
begin
  select * into g from lava_grid(p_size);
  n := g.cols * g.rows;
  up := array(select generate_series(0, n - 1));
  bits := array_fill(0, array[n]);
  for k in
    select e.k from generate_series(0, 2 * n - 1) e(k)
     where case when e.k % 2 = 0 then (e.k / 2) % g.cols < g.cols - 1 else (e.k / 2) / g.cols < g.rows - 1 end
     order by floor(hash_tile(e.k, p_day, v_salt) * 4294967296), e.k
  loop
    a := k / 2;
    b := case when k % 2 = 0 then a + 1 else a + g.cols end;
    ra := a;
    while up[ra + 1] <> ra loop up[ra + 1] := up[up[ra + 1] + 1]; ra := up[ra + 1]; end loop;
    rb := b;
    while up[rb + 1] <> rb loop up[rb + 1] := up[up[rb + 1] + 1]; rb := up[rb + 1]; end loop;
    continue when ra = rb;
    up[ra + 1] := rb;
    bits[a + 1] := bits[a + 1] | case when k % 2 = 0 then lava_pass_east() else lava_pass_south() end;
  end loop;
  return decode(array_to_string(array(select lpad(to_hex(u.v), 2, '0') from unnest(bits) with ordinality u(v, o) order by u.o), ''), 'hex');
end $$;

/** The day's maze of each island, kept: worked out once, on the clock, the day before it is wanted (`lava_ready`). */
create table if not exists lava_day (
  world_id uuid not null references world on delete cascade,
  day int not null,
  passes bytea not null,
  primary key (world_id, day)
);
alter table lava_day enable row level security;

/** An island's maze for a day: kept, or worked out where it is not (a world nobody's clock has come round yet). */
create or replace function lava_passes(p_world uuid, p_day int) returns bytea language plpgsql stable as $$
declare v bytea; w world;
begin
  select d.passes into v from lava_day d where d.world_id = p_world and d.day = p_day;
  if v is not null then return v; end if;
  select * into w from world where id = p_world;
  return lava_passes_make(w.seed, w.size, p_day);
end $$;

/** Today's maze and tomorrow's kept for an island, each once; the days before yesterday let go. */
create or replace function lava_ready(p_world uuid) returns int language plpgsql as $$
declare v_day int := lava_day_of(now()); w world; v_n int := 0; d int;
begin
  select * into w from world where id = p_world;
  if not found then return 0; end if;
  for d in v_day .. v_day + 1 loop
    continue when exists (select 1 from lava_day ld where ld.world_id = p_world and ld.day = d);
    insert into lava_day (world_id, day, passes) values (p_world, d, lava_passes_make(w.seed, w.size, d))
      on conflict do nothing;
    v_n := v_n + 1;
  end loop;
  delete from lava_day ld where ld.world_id = p_world and ld.day < v_day - 1;
  return v_n;
end $$;

-- On the clock that comes round every island: before its lairs.
select pg_temp.patch_fn('lair_tick(uuid)',
  $o$declare k record; v_l record; v_stood int := 0;
begin
$o$,
  $n$declare k record; v_l record; v_stood int := 0;
begin
  -- Today's and tomorrow's lava kept (`lava_ready`).
  perform lava_ready(p_world);
$n$);

/* ---- Where it lies --------------------------------------------------------------------------------------------- */

/** A tile's middle height four times over, the sum of its corners; null off the island. */
create or replace function lava_sum4(p_world uuid, p_x int, p_y int) returns int language sql stable as $$
  select b_i16(h0.heights, p_x) + b_i16(h0.heights, p_x + 1) + b_i16(h1.heights, p_x + 1) + b_i16(h1.heights, p_x)
    from land_corner h0 join land_corner h1 on h1.world_id = h0.world_id and h1.y = p_y + 1
   where h0.world_id = p_world and h0.y = p_y
$$;

/** Whether a tile's middle is on Volcano Isle at or over a height (`upAt`). */
create or replace function lava_up(p_world uuid, p_x int, p_y int, p_h int) returns boolean language sql stable as $$
  select coalesce(region_at(p_world, p_x + 0.5, p_y + 0.5) = lava_isle() and lava_sum4(p_world, p_x, p_y) >= 4 * p_h, false)
$$;

/** Whether a tile is in the cone's box the maze lies in (`lavaInBox`). */
create or replace function lava_in_box(p_size int, p_x int, p_y int) returns boolean language sql immutable as $$
  select p_x >= g.bx0 * lava_cell() and p_y >= g.by0 * lava_cell()
     and p_x < (g.bx0 + 2 * g.cols - 1) * lava_cell() and p_y < (g.by0 + 2 * g.rows - 1) * lava_cell()
    from lava_grid(p_size) g
$$;

/** Whether a tile is in the heat: in the box, Volcano Isle at the band's foot or above (`inHeat`). */
create or replace function lava_heat_on(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select coalesce((select lava_in_box(w.size, p_x, p_y) from world w where w.id = p_world), false)
     and lava_up(p_world, p_x, p_y, lava_foot())
$$;

/** Whether a block holds what must be reached: caldera ground at its middle, a lair's piece, a seryll seam (`lavaMustReach`). */
create or replace function lava_must_reach(p_world uuid, p_bx int, p_by int) returns boolean language sql stable as $$
  select lava_up(p_world, p_bx * lava_cell() + 1, p_by * lava_cell() + 1, lava_caldera())
      or exists (select 1 from land_tile t cross join generate_series(p_bx * lava_cell(), p_bx * lava_cell() + lava_cell() - 1) x
                  where t.world_id = p_world and t.y between p_by * lava_cell() and p_by * lava_cell() + lava_cell() - 1
                    and x < length(t.rock) and get_byte(t.rock, x) = lava_seam())
      or exists (select 1 from placed pl where pl.world_id = p_world and pl.kind = 'furniture'
                  and pl.sub in (select k.id from lair_kinds() k)
                  and pl.x between p_bx * lava_cell() and p_bx * lava_cell() + lava_cell() - 1
                  and pl.y between p_by * lava_cell() and p_by * lava_cell() + lava_cell() - 1)
$$;

/** Whether a whole block is lava on a day, but for what is spared tile by tile (`lavaBlock`). The cheapest asked first. */
create or replace function lava_block(p_world uuid, p_size int, p_bx int, p_by int, p_day int) returns boolean
language plpgsql stable as $$
declare g record; i int; j int; v_room int; c int := lava_cell();
begin
  select * into g from lava_grid(p_size);
  i := p_bx - g.bx0; j := p_by - g.by0;
  if i < 0 or j < 0 or i > 2 * (g.cols - 1) or j > 2 * (g.rows - 1) then return false; end if;
  if i % 2 = 0 and j % 2 = 0 then return false; end if;
  v_room := (j / 2) * g.cols + (i / 2);
  if i % 2 = 1 and j % 2 = 0 then
    if get_byte(lava_passes(p_world, p_day), v_room) & lava_pass_east() <> 0 then return false; end if;
  elsif i % 2 = 0 and j % 2 = 1 then
    if get_byte(lava_passes(p_world, p_day), v_room) & lava_pass_south() <> 0 then return false; end if;
  end if;
  if not lava_up(p_world, p_bx * c + 1, p_by * c + 1, lava_foot()) or lava_up(p_world, p_bx * c + 1, p_by * c + 1, lava_caldera()) then
    return false;
  end if;
  if lava_must_reach(p_world, p_bx, p_by) then return false; end if;
  -- The wall east of a pillar that must be reached is its way out.
  if i % 2 = 0 and j % 2 = 1 and i > 0 and lava_must_reach(p_world, p_bx - 1, p_by) then return false; end if;
  return true;
end $$;

/** Whether lava spares a tile: a road or laid path, a settlement, a building, a foundation, anything set down (`gameLava`). */
create or replace function lava_spared(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select coalesce(land_tile(p_world, p_x, p_y) = any (lava_spared_tiles()), false)
      or on_deed(p_world, p_x, p_y)
      or exists (select 1 from building_tile b where b.world_id = p_world and b.x = p_x and b.y = p_y)
      or exists (select 1 from foundation f where f.world_id = p_world and f.x = p_x and f.y = p_y)
      or exists (select 1 from placed pl where pl.world_id = p_world and pl.x = p_x and pl.y = p_y
                   and pl.kind in ('crate', 'campfire', 'smelter', 'kiln', 'furniture', 'anvil', 'post', 'trap'))
$$;

/** Whether a tile of a world this size is lava on a day, today unless told (`lavaAt`): off the box at once. */
create or replace function lava_on(p_world uuid, p_size int, p_x int, p_y int, p_day int default null) returns boolean
language plpgsql stable as $$
declare c int := lava_cell();
begin
  if p_x < 0 or p_y < 0 or p_x >= p_size or p_y >= p_size or not lava_in_box(p_size, p_x, p_y) then return false; end if;
  if not lava_block(p_world, p_size, p_x / c, p_y / c, coalesce(p_day, lava_day_of(now()))) then return false; end if;
  return not lava_spared(p_world, p_x, p_y);
end $$;

/** Whether a tile is lava today. */
create or replace function lava_at(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select coalesce((select lava_on(p_world, w.size, p_x, p_y) from world w where w.id = p_world), false)
$$;

/** Whether lava is on a tile or one of the eight round it (`lavaBeside`). */
create or replace function lava_near(p_world uuid, p_x int, p_y int) returns boolean language sql stable as $$
  select exists (select 1 from generate_series(-1, 1) dx cross join generate_series(-1, 1) dy
                  where lava_at(p_world, p_x + dx, p_y + dy))
$$;

/* ---- What it refuses ------------------------------------------------------------------------------------------- */

/** Why a job will not be done on lava, or null: asked of the tiles a stone's ground is (`lavaGroundRefusal`). */
create or replace function lava_ground_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $$
begin
  if not lava_guarded(p_action) then return null; end if;
  if exists (select 1 from stone_job_tiles(p_world, p_uid, p_action, p_target) t where lava_at(p_world, t.x, t.y)) then
    return lava_said();
  end if;
  return null;
end $$;

select pg_temp.patch_fn('act_refusal_rules(uuid, uuid, text, jsonb)',
  $o$  aimed := stone_ground_refusal(p_world, p_uid, p_action, p_target);
  if aimed is not null then return aimed; end if;$o$,
  $n$  aimed := stone_ground_refusal(p_world, p_uid, p_action, p_target);
  if aimed is not null then return aimed; end if;
  -- And the day's lava on Volcano Isle, which nothing digs, builds, sets down or founds on (`lava_ground_refusal`).
  aimed := lava_ground_refusal(p_world, p_uid, p_action, p_target);
  if aimed is not null then return aimed; end if;$n$);

-- No creature steps onto it.
select pg_temp.patch_fn('creature_tile_ok(uuid, integer, integer)',
  $o$     and runestone_on(q.size, p_x, p_y) is null$o$,
  $n$     and runestone_on(q.size, p_x, p_y) is null
     -- Nor onto the day's lava (`lava_on`).
     and not lava_on(p_world, q.size, p_x, p_y)$n$);

/* ---- The heat -------------------------------------------------------------------------------------------------- */

/**
 * The meter and health after a stretch (`heatStep`): filling in the heat, `heat_near` times beside lava, health off
 * for the part of the stretch it was full; draining below; and lava's own burn on top.
 */
create or replace function heat_step(p_heat double precision, p_health double precision, p_secs double precision,
  p_up boolean, p_near boolean, p_on boolean, p_mul double precision,
  out heat double precision, out health double precision, out at_full boolean) language plpgsql immutable as $$
declare s double precision := greatest(0, p_secs); v_lava double precision; v_rate double precision; v_to double precision;
begin
  v_lava := case when p_on then s * lava_burn() else 0 end;
  if not p_up then
    heat := greatest(0, p_heat - s * heat_drain()); health := greatest(0, p_health - v_lava); at_full := false;
    return;
  end if;
  v_rate := heat_fill() * case when p_near then heat_near() else 1 end * p_mul;
  v_to := case when v_rate > 0 then greatest(0, (1 - p_heat) / v_rate) else 'infinity'::double precision end;
  heat := least(1, p_heat + v_rate * s);
  health := greatest(0, p_health - greatest(0, s - v_to) * heat_burn() - v_lava);
  at_full := s > v_to;
end $$;

/** The fill's multiplier for what is worn and drunk: dragon-scale pieces, ice infusions, a draught until `p_cool` (`heatMul`). */
create or replace function heat_mul(p_world uuid, p_uid uuid, p_cool double precision) returns double precision language sql stable as $$
  select power(1 - heat_scale(), count(*) filter (where i.def = any (heat_scale_pieces())))
       * exp(coalesce(sum(ln(1 - heat_ice() * infuse_on(i.infuse, 'ice'))) filter (where infuse_on(i.infuse, 'ice') > 0), 0))
       * case when p_cool > extract(epoch from now()) then draught_fill() else 1 end
    from player p cross join lateral jsonb_each_text(coalesce(p.equipped, '{}'::jsonb)) e
    join item i on i.world_id = p.world_id and i.holder = 'player' and i.holder_uid = p.uid
                and e.value ~ '^[0-9]+$' and i.id = e.value::bigint
   where p.world_id = p_world and p.uid = p_uid
$$;

select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$        v_upkeep double precision; v_free double precision; v_drain double precision;$o$,
  $n$        v_upkeep double precision; v_free double precision; v_drain double precision;
        v_heat double precision; v_hsaid double precision; v_hs record; v_tx int; v_ty int; v_on boolean;$n$);
select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$  -- Nothing knits while you are trying not to drown.$o$,
  $n$  /*
   * Volcano Isle's heat and lava (`lava.ts`): the meter fills in the heat, beside lava the faster, and takes health
   * once full; it drains below; lava underfoot burns. Nothing of it for a body away.
   */
  v_heat := coalesce((p.stats->>'heat')::double precision, 0);
  v_hsaid := (p.stats->>'heatSaid')::double precision;
  v_tx := floor(p.x)::int; v_ty := floor(p.y)::int;
  if not p.away and (v_heat > 0 or lava_heat_on(p_world, v_tx, v_ty)) then
    v_on := coalesce(p.level, 0) = 0 and p.aboard is null and lava_at(p_world, v_tx, v_ty);
    select * into v_hs from heat_step(v_heat, hp, secs, lava_heat_on(p_world, v_tx, v_ty),
      v_on or (coalesce(p.level, 0) = 0 and p.aboard is null and lava_near(p_world, v_tx, v_ty)), v_on,
      heat_mul(p_world, p_uid, (p.stats->>'cool')::double precision));
    v_heat := v_hs.heat;
    hp := v_hs.health;
    if (v_on or v_hs.at_full) and (v_hsaid is null or extract(epoch from now()) - v_hsaid > heat_warn()) then
      perform tell(p_world, p_uid, case when v_on then heat_lava_said() else heat_full_said() end, 'error');
      v_hsaid := extract(epoch from now());
    end if;
  end if;

  -- Nothing knits while you are trying not to drown.$n$);
select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$      '{stamina}', to_jsonb(w)), '{health}', to_jsonb(hp))$o$,
  $n$      '{stamina}', to_jsonb(w)), '{health}', to_jsonb(hp))
      -- And the heat (`lava.ts`), and when its warning was last said.
      || jsonb_build_object('heat', v_heat) || case when v_hsaid is null then '{}'::jsonb else jsonb_build_object('heatSaid', v_hsaid) end$n$);

/* ---- The cooling draught --------------------------------------------------------------------------------------- */

create or replace function item_action(p_action text) returns boolean language sql immutable as $$
  select p_action in ('improve_item', 'repair_item', 'patch_item', 'eat', 'drink', 'drink_skin', 'quench_item',
                      'drink_tea', 'take_tincture', 'apply_salve', 'mend_kit', 'seal_item', 'set_in_circlet', 'glaze_item',
                      -- A cooling draught (`lava.ts`).
                      'drink_draught')
$$;

select pg_temp.patch_fn('item_refusal(uuid, uuid, text, jsonb)',
  $o$  elsif p_action = 'take_tincture' then
    if v_it.def <> 'tincture' then return 'That is not a tincture.'; end if;$o$,
  $n$  -- A cooling draught (`lava.ts`), which anybody may drink.
  elsif p_action = 'drink_draught' then
    if v_it.def <> cooling_draught() then return draught_not_said(); end if;
    return null;

  elsif p_action = 'take_tincture' then
    if v_it.def <> 'tincture' then return 'That is not a tincture.'; end if;$n$);

select pg_temp.patch_fn('perform_item(uuid, uuid, text, jsonb)',
  $o$  -- A tincture is taken no more: it gave a meal boost, and only a dish off a shut recipe gives one.
  elsif p_action = 'take_tincture' then$o$,
  $n$  -- A cooling draught (`lava.ts`): the heat down by `draught_drop`, and its fill ×`draught_fill` for `draught_secs`.
  elsif p_action = 'drink_draught' then
    if not consume(p_world, p_uid, v_it.def, 1, v_it.id) then return; end if;
    update player set stats = coalesce(stats, '{}'::jsonb)
        || jsonb_build_object('heat', greatest(0, coalesce((v_p.stats->>'heat')::double precision, 0) - draught_drop()),
                              'cool', extract(epoch from now()) + draught_secs())
      where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, draught_said(), 'event');

  -- A tincture is taken no more: it gave a meal boost, and only a dish off a shut recipe gives one.
  elsif p_action = 'take_tincture' then$n$);

select private.lock_doors();
