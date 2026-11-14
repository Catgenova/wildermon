-- Monsters come only from lairs.
--
-- Asked for: no wandering monster spawns and no raiding patrols. A goblin, an orc, an ogre or a dragon stands up only
-- at its kind's lair (`lairs.ts`, `lair_kinds`): four goblin warrens on a forest edge, two orc camps on open grass, an
-- ogre cave on a rocky hillside and a dragon roost on the highest ground of Volcano Isle, each sited by the island off
-- the ground (`lair_site_ok`, `lair_site`), never nearer a settlement token than its kind keeps (`keep_off`) and never
-- on a deed; and a deed is never founded that near a lair (`deed_refusal`). A deed's token does not move as it grows
-- and its border at the top level is 13 tiles, so growing one never comes near: only founding is refused.
--
-- Its garrison stands up with it, leashed to it: no monster of a lair is ever further than `lair_leash` from it
-- (`lair_leash_hold`), none hunts anybody past its leash, and one that loses its quarry there walks back. With the
-- garrison dead its boss comes out, told to everybody within `lair_announce`; the boss's death opens its hoard, a share
-- for every body that dealt it `hoard_share` of its health (their companions' blows counted): a treasure map at its
-- kind's odds, its trophy, a dragon's hoard scales, and a Recipe or a Formula at `hoard_book` -- no silver and no rare.
-- Then the lair is empty, and safe ground (`in_safe_ring`) with half again the usual wildermon round it
-- (`lair_ring_stock`), until it restocks; cleared `lair_move_clears` times in `lair_move_days` days it comes back
-- somewhere else.
--
-- The monsters already roaming when this lands came from the old free spawn and belong to no lair: they are taken off
-- the island here. The lairs are sited by the stocking clock (`lair_tick`) the first time it comes round each island.

set local lock_timeout = '3s';

create function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
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

/* ---- The lairs ------------------------------------------------------------------------------------------------- */

create table if not exists lair (
  world_id uuid not null references world on delete cascade,
  id int not null,
  /** Which kind (`lair_kinds`), which is also the piece it is drawn as. */
  kind text not null,
  /** The tile it stands on. */
  x int not null,
  y int not null,
  /** The piece it is drawn as (`placed`). */
  placed bigint,
  /** held: its garrison is out; boss: its boss is out; cleared: empty until `cleared_at` and its restock. */
  state text not null default 'held' check (state in ('held', 'boss', 'cleared')),
  /** Its garrison when full, rolled each time it stands up. */
  size int not null default 0,
  /** When one of its garrison last came back, or when it was last full. */
  stocked_at timestamptz not null default now(),
  cleared_at timestamptz,
  /** When it was cleared, within `lair_move_days`. */
  clears timestamptz[] not null default '{}',
  /** Cleared often enough to come back somewhere else. */
  moving boolean not null default false,
  primary key (world_id, id)
);
create index if not exists lair_cleared on lair (world_id) where state = 'cleared';

/** What each body has dealt a lair's boss, their companions' blows counted. */
create table if not exists lair_blow (
  world_id uuid not null,
  lair int not null,
  uid uuid not null,
  dealt double precision not null default 0,
  primary key (world_id, lair, uid),
  foreign key (world_id, lair) references lair on delete cascade
);

/** Who has seen which lair: its pin on their map, and "found" in their field guide. */
create table if not exists lair_seen (
  world_id uuid not null,
  uid uuid not null,
  lair int not null,
  at timestamptz not null default now(),
  primary key (world_id, uid, lair),
  foreign key (world_id, lair) references lair on delete cascade
);

/** When a kind was last looked for a site for on an island, so a crowded one is not searched every round. */
create table if not exists lair_look (
  world_id uuid not null references world on delete cascade,
  kind text not null,
  at timestamptz not null default now(),
  primary key (world_id, kind)
);

alter table lair enable row level security;
alter table lair_blow enable row level security;
alter table lair_seen enable row level security;
alter table lair_look enable row level security;
revoke all on lair, lair_blow, lair_seen, lair_look from anon, authenticated;

/** A creature's lair, whether it is that lair's boss, and the point its leash is tied to. */
alter table creature add column if not exists lair int;
alter table creature add column if not exists boss boolean not null default false;
alter table creature add column if not exists leash_x double precision;
alter table creature add column if not exists leash_y double precision;
create index if not exists creature_lair on creature (world_id, lair) where lair is not null;

/* ---- The leash ------------------------------------------------------------------------------------------------- */

/**
 * No further than `lair_leash` from its lair, whatever moves it: a leg, a chase, a push, a flight. Every write of a
 * leashed one's legs is held inside the circle, so where it is along a leg is too.
 */
create or replace function lair_leash_hold() returns trigger language plpgsql as $$
declare v_r double precision := lair_leash(); v_d double precision;
begin
  v_d := sqrt((new.to_x - new.leash_x) ^ 2 + (new.to_y - new.leash_y) ^ 2);
  if v_d > v_r then
    new.to_x := new.leash_x + (new.to_x - new.leash_x) * v_r / v_d;
    new.to_y := new.leash_y + (new.to_y - new.leash_y) * v_r / v_d;
  end if;
  v_d := sqrt((new.from_x - new.leash_x) ^ 2 + (new.from_y - new.leash_y) ^ 2);
  if v_d > v_r then
    new.from_x := new.leash_x + (new.from_x - new.leash_x) * v_r / v_d;
    new.from_y := new.leash_y + (new.from_y - new.leash_y) * v_r / v_d;
  end if;
  return new;
end $$;
drop trigger if exists creature_leash on creature;
create trigger creature_leash before insert or update on creature for each row
  when (new.leash_x is not null) execute function lair_leash_hold();

-- None hunts anybody past its leash, and one whose quarry gets past it lets go and walks back (`hunt_settle`).
select pg_temp.patch_fn('hunt_settle(uuid, creature, species_def, age_def)',
  $o$in_safe_ring(p_world, v_cx, v_cy))) then$o$,
  $n$in_safe_ring(p_world, v_cx, v_cy)))
       -- Or, for one of a lair's, the one it is after past its leash (`lair_leash`).
       or (c.leash_x is not null and (p.x - c.leash_x) ^ 2 + (p.y - c.leash_y) ^ 2 > lair_leash() ^ 2) then$n$);
select pg_temp.patch_fn('hunt_settle(uuid, creature, species_def, age_def)',
  $o$    if at_peace(p_world, p.x, p.y) or in_safe_ring(p_world, v_cx, v_cy) then return c; end if;$o$,
  $n$    if at_peace(p_world, p.x, p.y) or in_safe_ring(p_world, v_cx, v_cy) then return c; end if;
    -- Nor, for one of a lair's, on somebody past its leash (`lair_leash`).
    if c.leash_x is not null and (p.x - c.leash_x) ^ 2 + (p.y - c.leash_y) ^ 2 > lair_leash() ^ 2 then return c; end if;$n$);

/* ---- A boss's blood -------------------------------------------------------------------------------------------- */

/** A lair's boss's health and blow, as its kind's multiples (`lair_kinds`); one for anything else. */
create or replace function lair_boss_mul(c creature, p_channel text) returns double precision language sql stable as $$
  select coalesce((select case p_channel when 'hardy' then k.boss_health when 'tough' then k.boss_attack else 1 end
                     from lair l join lair_kinds() k on k.id = l.kind
                    where l.world_id = c.world_id and l.id = c.lair), 1)
$$;
select pg_temp.patch_fn('beast_mul(creature, text)',
  $o$       * case when c.form_size is null then 1 else form_mul(c, p_channel) end$o$,
  $n$       * case when c.form_size is null then 1 else form_mul(c, p_channel) end
       -- And a lair's boss's (`lair_boss_mul`).
       * case when not c.boss then 1 else lair_boss_mul(c, p_channel) end$n$);

/* ---- Where a lair stands --------------------------------------------------------------------------------------- */

/**
 * Whether a kind of lair may stand on a tile: on its kind's island where it is kept to one (`monster_isle`); on dry
 * standing ground its leash in from the edge with nothing built or set down on or beside it and no deed over it; its kind's
 * `keep_off` from every settlement token and `lair_apart` from every other lair; its leash nowhere in the safe ring or
 * a Sanctuary; and on its site's ground (`lair_kinds.site`). A peak's height is `lair_site`'s to choose.
 */
create or replace function lair_site_ok(p_world uuid, p_kind text, p_x int, p_y int, p_self int default null)
returns boolean language plpgsql stable as $$
declare k record; v_size int; v_isle int; v_t int; v_lo int; v_hi int; i int; v_a double precision;
begin
  select * into k from lair_kinds() lk where lk.id = p_kind;
  if k.id is null then return false; end if;
  select w.size into v_size from world w where w.id = p_world;
  -- Its whole leash on the island.
  if v_size is null or least(p_x, p_y) < lair_leash() or greatest(p_x, p_y) > v_size - 1 - lair_leash() then return false; end if;
  v_isle := monster_isle(k.species);
  if v_isle is not null and region_at(p_world, p_x + 0.5, p_y + 0.5) is distinct from v_isle then return false; end if;
  if not creature_tile_ok(p_world, p_x, p_y) or has_water(p_world, p_x, p_y) or centre_height(p_world, p_x, p_y) < 2 then
    return false;
  end if;
  if on_deed(p_world, p_x, p_y) or building_at(p_world, p_x, p_y) is not null then return false; end if;
  if exists (select 1 from placed pl where pl.world_id = p_world
               and pl.x between p_x - 1 and p_x + 1 and pl.y between p_y - 1 and p_y + 1
               -- Its own piece, for a lair asked whether it may stay where it is.
               and pl.id is distinct from (select l.placed from lair l where l.world_id = p_world and l.id = p_self)) then
    return false;
  end if;
  if exists (select 1 from deed d where d.world_id = p_world and (d.x - p_x) ^ 2 + (d.y - p_y) ^ 2 < k.keep_off ^ 2) then
    return false;
  end if;
  if exists (select 1 from lair l where l.world_id = p_world and l.id is distinct from p_self
               and (l.x - p_x) ^ 2 + (l.y - p_y) ^ 2 < lair_apart() ^ 2) then
    return false;
  end if;
  if at_peace(p_world, p_x + 0.5, p_y + 0.5) then return false; end if;
  for i in 0 .. 7 loop
    v_a := i * pi() / 4;
    if at_peace(p_world, p_x + 0.5 + cos(v_a) * lair_leash(), p_y + 0.5 + sin(v_a) * lair_leash()) then return false; end if;
  end loop;
  v_t := land_tile(p_world, p_x, p_y);
  select min(h), max(h) into v_lo, v_hi from (values (land_height(p_world, p_x, p_y)), (land_height(p_world, p_x + 1, p_y)),
    (land_height(p_world, p_x + 1, p_y + 1)), (land_height(p_world, p_x, p_y + 1))) v (h);
  return case k.site
    when 'forest_edge' then coalesce((select td.forage from tile_def td where td.id = v_t), false)
                            and near_tile(p_world, p_x, p_y, 'trees', edge_trees()::int)
    when 'open_grass' then v_t in (tile_id('Grass'), tile_id('Steppe'))
                           and not near_tile(p_world, p_x, p_y, 'trees', open_clear()::int) and v_hi - v_lo <= open_slope()
    when 'hillside' then v_t = tile_id('Rock') and v_hi - v_lo >= hill_slope()
    else true end;
end $$;

/**
 * A tile for a kind of lair, or none: up to `p_looks` tiles at random that `lair_site_ok` takes, the first; for a
 * peak, the highest ground of its island that it takes, off a grid of the island and then round the highest of that.
 */
create or replace function lair_site(p_world uuid, p_kind text, p_self int default null, p_looks int default 400,
                                     out x int, out y int)
returns record language plpgsql volatile as $$
declare k record; v_size int; v_step int; v_fine int; i int; gx int; gy int; c record; f record; v_isle int;
begin
  select * into k from lair_kinds() lk where lk.id = p_kind;
  select w.size into v_size from world w where w.id = p_world;
  if k.id is null or v_size is null then return; end if;
  if k.site <> 'peak' then
    for i in 1 .. p_looks loop
      gx := 2 + floor(random() * (v_size - 4))::int;
      gy := 2 + floor(random() * (v_size - 4))::int;
      if lair_site_ok(p_world, p_kind, gx, gy, p_self) then x := gx; y := gy; return; end if;
    end loop;
    return;
  end if;
  v_isle := monster_isle(k.species);
  v_step := greatest(1, v_size / 128);
  v_fine := greatest(1, v_step / 4);
  for c in
    select g.gx, g.gy from (
      select a as gx, b as gy from generate_series(2, v_size - 3, v_step) a cross join generate_series(2, v_size - 3, v_step) b
       where v_isle is null or region_at(p_world, a + 0.5, b + 0.5) = v_isle) g
     order by centre_height(p_world, g.gx, g.gy) desc, g.gx, g.gy limit 12
  loop
    for f in
      select a as fx, b as fy from generate_series(greatest(2, c.gx - v_step), least(v_size - 3, c.gx + v_step), v_fine) a
        cross join generate_series(greatest(2, c.gy - v_step), least(v_size - 3, c.gy + v_step), v_fine) b
       order by centre_height(p_world, a, b) desc, a, b
    loop
      if lair_site_ok(p_world, p_kind, f.fx, f.fy, p_self) then x := f.fx; y := f.fy; return; end if;
    end loop;
  end loop;
end $$;

/** A garrison's size when full: each of its kinds' fewest and up to its most. */
create or replace function lair_size_roll(p_kind text) returns int language sql volatile as $$
  select coalesce(sum(g.least_n + floor(random() * (g.most_n - g.least_n + 1))::int), 0)::int
    from lair_garrison() g where g.kind = p_kind
$$;

/** The garrison a lair of this size wants, kind by kind in restock order: a single kind all of it, more than one each its most. */
create or replace function lair_wants(p_kind text, p_size int) returns table (species text, n int, ord int) language sql stable as $$
  select g.species, case when (select count(*) from lair_garrison() h where h.kind = p_kind) = 1 then p_size else g.most_n end, g.ord
    from lair_garrison() g where g.kind = p_kind order by g.ord
$$;

/**
 * Whether a kind of lair's piece burns while it is held: an orc camp's fire. It burns on what it was given when the camp
 * stood up or restocked, more than it will ever need, and is put out when the camp is cleared (`lair_fire`).
 */
create or replace function lair_burns(p_kind text) returns boolean language sql immutable as $$ select p_kind = 'orc_camp' $$;

/** A lair's fire lit or put out, for a kind whose piece burns. */
create or replace function lair_fire(p_world uuid, p_lair int, p_lit boolean) returns void language sql as $$
  update placed pl set lit = p_lit, fuel = case when p_lit then 1e9 else 0 end, since = now()
    from lair l where l.world_id = p_world and l.id = p_lair and pl.id = l.placed and lair_burns(l.kind)
$$;

/** The piece a lair is drawn as, a whole tile, set down on its tile: an orc camp's fire burning. */
create or replace function lair_piece(p_world uuid, p_kind text, p_x int, p_y int) returns bigint language sql as $$
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, lit, fuel, since)
    values (p_world, 'furniture', p_kind, p_x, p_y, 0, 0, p_x + 0.5, p_y + 0.5, 50, lair_burns(p_kind),
            case when lair_burns(p_kind) then 1e9 else 0 end, now())
  returning id
$$;

/** One of a lair's, stood up beside it, leashed to it and at home there; its boss called what its kind calls it, at its full health. */
create or replace function lair_spawn(p_world uuid, p_lair int, p_species text, p_boss boolean) returns int
language plpgsql as $$
declare l lair; k record; v_id int; v_x double precision; v_y double precision; i int; v_a double precision; v_r double precision;
begin
  select * into l from lair where world_id = p_world and id = p_lair;
  if l.id is null then return null; end if;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  for i in 1 .. 16 loop
    v_a := random() * 2 * pi();
    v_r := 1.5 + random() * 3;
    v_x := l.x + 0.5 + cos(v_a) * v_r;
    v_y := l.y + 0.5 + sin(v_a) * v_r;
    exit when creature_tile_ok(p_world, floor(v_x)::int, floor(v_y)::int) and not has_water(p_world, floor(v_x)::int, floor(v_y)::int);
    v_x := null;
  end loop;
  if v_x is null then v_x := l.x + 0.5; v_y := l.y + 1.5; end if;
  v_id := creature_spawn(p_world, p_species, v_x, v_y, 'wild');
  if v_id is null then return null; end if;
  update creature set lair = l.id, boss = p_boss, leash_x = l.x + 0.5, leash_y = l.y + 0.5,
      home_x = l.x + 0.5, home_y = l.y + 0.5, name = case when p_boss and k.boss is not null then k.boss else name end
    where world_id = p_world and id = v_id;
  if p_boss then update creature c set health = max_health(c) where c.world_id = p_world and c.id = v_id; end if;
  return v_id;
end $$;

/** Up to `p_n` more of a lair's garrison, the first kind short of what it wants first. */
create or replace function lair_restock(p_world uuid, p_lair int, p_n int) returns int language plpgsql as $$
declare l lair; w record; v_have int; v_put int := 0;
begin
  select * into l from lair where world_id = p_world and id = p_lair;
  for w in select * from lair_wants(l.kind, l.size) order by ord loop
    select count(*) into v_have from creature c
     where c.world_id = p_world and c.lair = p_lair and not c.boss and c.species = w.species;
    while v_have < w.n and v_put < p_n loop
      exit when lair_spawn(p_world, p_lair, w.species, false) is null;
      v_have := v_have + 1;
      v_put := v_put + 1;
    end loop;
  end loop;
  return v_put;
end $$;

/** How many of a lair's garrison are standing. */
create or replace function lair_garrison_up(p_world uuid, p_lair int) returns int language sql stable as $$
  select count(*)::int from creature c where c.world_id = p_world and c.lair = p_lair and not c.boss
$$;

/** Its boss, out, and everybody within `lair_announce` told. */
create or replace function lair_boss_out(p_world uuid, p_lair int) returns int language plpgsql as $$
declare l lair; k record; v_id int; p record;
begin
  select * into l from lair where world_id = p_world and id = p_lair for update;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  update lair set state = 'boss' where world_id = p_world and id = p_lair;
  v_id := lair_spawn(p_world, p_lair, k.species, true);
  for p in select pl.uid from player pl where pl.world_id = p_world
             and (pl.x - l.x - 0.5) ^ 2 + (pl.y - l.y - 0.5) ^ 2 <= lair_announce() ^ 2 loop
    perform tell(p_world, p.uid, coalesce(k.boss, (select sd.name from species_def sd where sd.id = k.species)) || ' out: '
      || k.name || '.', 'fight');
  end loop;
  return v_id;
end $$;

/**
 * A lair of a kind, sited and stood up with its garrison full (`lair_size_roll`), or its boss out where it has none.
 * Null when no site was found.
 */
create or replace function lair_stand(p_world uuid, p_kind text, p_looks int default 400) returns int language plpgsql as $$
declare s record; v_id int;
begin
  select * into s from lair_site(p_world, p_kind, null, p_looks);
  if s.x is null then return null; end if;
  select coalesce(max(id), 0) + 1 into v_id from lair where world_id = p_world;
  insert into lair (world_id, id, kind, x, y, placed, state, size, stocked_at)
    values (p_world, v_id, p_kind, s.x, s.y, lair_piece(p_world, p_kind, s.x, s.y), 'held', lair_size_roll(p_kind), now());
  perform lair_restock(p_world, v_id, 1000);
  if lair_garrison_up(p_world, v_id) = 0 then perform lair_boss_out(p_world, v_id); end if;
  return v_id;
end $$;

/* ---- Its turn -------------------------------------------------------------------------------------------------- */

/** Whether a point is in a cleared lair's ring, which counts as the safe ring until it restocks. */
create or replace function lair_ring_on(p_world uuid, p_x double precision, p_y double precision) returns boolean language sql stable as $$
  select exists (select 1 from lair l where l.world_id = p_world and l.state = 'cleared'
                   and (p_x - l.x - 0.5) ^ 2 + (p_y - l.y - 0.5) ^ 2 <= lair_ring() ^ 2)
$$;

/** A cleared lair's ring topped up to `lair_ring_want` wildermon, off the wild's roll for the ring (`pick_wild`). */
create or replace function lair_ring_stock(p_world uuid, p_lair int) returns int language plpgsql as $$
declare l lair; v_have int; v_want int := lair_ring_want(); v_put int := 0; v_tries int := 0; v_a double precision;
        v_r double precision; gx int; gy int; v_got text;
begin
  select * into l from lair where world_id = p_world and id = p_lair;
  select count(*) into v_have from creature c
   where c.world_id = p_world and c.mode = 'wild' and c.lair is null and not ring_keeps_out(c.species)
     and (c.to_x - l.x - 0.5) ^ 2 + (c.to_y - l.y - 0.5) ^ 2 <= lair_ring() ^ 2;
  while v_have + v_put < v_want and v_tries < v_want * 24 loop
    v_tries := v_tries + 1;
    v_a := random() * 2 * pi();
    v_r := lair_ring() * sqrt(random());
    gx := floor(l.x + 0.5 + cos(v_a) * v_r)::int;
    gy := floor(l.y + 0.5 + sin(v_a) * v_r)::int;
    if not creature_tile_ok(p_world, gx, gy) or centre_height(p_world, gx, gy) < 2 or on_deed(p_world, gx, gy) then continue; end if;
    v_got := pick_wild(p_world, gx, gy);
    if v_got is null or not suits(p_world, v_got, gx, gy) then continue; end if;
    perform wild_form_put(p_world, wild_stage_put(p_world, creature_spawn(p_world, v_got, gx + 0.5, gy + 0.5, 'wild',
      now() - make_interval(secs => random() * old_at() * 1.6))));
    v_put := v_put + 1;
  end loop;
  return v_put;
end $$;

/**
 * A lair's turn: a cleared one comes back after its restock -- somewhere else when it is moving -- with the first of
 * its garrison, or its boss where it has none; a held one with none of its garrison standing sends its boss out, and
 * one short of its garrison gets one back every restock; one whose boss is gone without being killed sends another.
 */
create or replace function lair_turn(p_world uuid, p_lair int) returns void language plpgsql as $$
declare l lair; k record; v_up int; v_due int; s record;
begin
  select * into l from lair where world_id = p_world and id = p_lair for update skip locked;
  if l.id is null then return; end if;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  if l.state = 'cleared' then
    if now() < l.cleared_at + make_interval(secs => k.restock) then
      perform lair_ring_stock(p_world, p_lair);
      return;
    end if;
    update lair set state = 'held', size = lair_size_roll(l.kind), stocked_at = now(), cleared_at = null
      where world_id = p_world and id = p_lair;
    -- And an orc camp's fire lit again.
    perform lair_fire(p_world, p_lair, true);
    if l.moving then
      select * into s from lair_site(p_world, l.kind, p_lair);
      if s.x is not null then
        update placed set x = s.x, y = s.y, cx = s.x + 0.5, cy = s.y + 0.5 where world_id = p_world and id = l.placed;
        update lair set x = s.x, y = s.y where world_id = p_world and id = p_lair;
        delete from lair_seen where world_id = p_world and lair = p_lair;
      end if;
      update lair set moving = false, clears = '{}' where world_id = p_world and id = p_lair;
    end if;
    perform lair_restock(p_world, p_lair, 1);
    if lair_garrison_up(p_world, p_lair) = 0 then perform lair_boss_out(p_world, p_lair); end if;
    return;
  end if;
  if l.state = 'boss' then
    if not exists (select 1 from creature c where c.world_id = p_world and c.lair = p_lair and c.boss) then
      perform lair_boss_out(p_world, p_lair);
    end if;
    return;
  end if;
  v_up := lair_garrison_up(p_world, p_lair);
  if v_up = 0 then
    perform lair_boss_out(p_world, p_lair);
  elsif v_up >= l.size then
    update lair set stocked_at = now() where world_id = p_world and id = p_lair;
  else
    v_due := floor(extract(epoch from (now() - l.stocked_at)) / k.restock)::int;
    if v_due > 0 then
      perform lair_restock(p_world, p_lair, least(v_due, l.size - v_up));
      update lair set stocked_at = case when lair_garrison_up(p_world, p_lair) >= l.size then now()
                                        else l.stocked_at + make_interval(secs => k.restock * v_due) end
        where world_id = p_world and id = p_lair;
    end if;
  end if;
end $$;

/**
 * The lairs of an island, on the stocking clock: each kind up to its count (a kind looked for no more than every
 * `lair_look_every`, so a crowded island does not pay for a search every round), every lair's turn, and who has come
 * within `lair_sight` of one.
 */
create or replace function lair_tick(p_world uuid) returns int language plpgsql as $$
declare k record; v_l record; v_stood int := 0;
begin
  for k in select * from lair_kinds() order by keep_off desc loop
    continue when (select count(*) from lair where world_id = p_world and kind = k.id) >= k.count;
    continue when exists (select 1 from lair_look lk where lk.world_id = p_world and lk.kind = k.id
                            and lk.at > now() - make_interval(secs => lair_look_every()));
    insert into lair_look (world_id, kind, at) values (p_world, k.id, now())
      on conflict (world_id, kind) do update set at = excluded.at;
    if lair_stand(p_world, k.id) is not null then v_stood := v_stood + 1; end if;
  end loop;
  for v_l in select id from lair where world_id = p_world order by id loop
    perform lair_turn(p_world, v_l.id);
  end loop;
  insert into lair_seen (world_id, uid, lair)
    select p_world, p.uid, lr.id from lair lr join player p on p.world_id = lr.world_id
     where lr.world_id = p_world and (p.x - lr.x - 0.5) ^ 2 + (p.y - lr.y - 0.5) ^ 2 <= lair_sight() ^ 2
  on conflict do nothing;
  return v_stood;
end $$;

/* ---- The hoard ------------------------------------------------------------------------------------------------- */

/**
 * One body's share of a lair's hoard, off two rolls in [0, 1): a treasure map when the first is under its kind's
 * odds, its trophy, its hoard dragon scales, and a book when the second is under `hoard_book`. Nothing else: no silver
 * and no rare.
 */
create or replace function hoard_roll(p_kind text, p_map double precision, p_book double precision) returns jsonb
language sql immutable as $$
  select jsonb_build_object('map', p_map < k.map, 'trophy', k.trophy, 'scales', k.scales, 'book', p_book < hoard_book())
    from lair_kinds() k where k.id = p_kind
$$;

/** A share of a hoard into a body's pack, and what it held told to them. */
create or replace function lair_hoard_give(p_world uuid, p_uid uuid, p_lair int, p_roll jsonb, p_ql double precision)
returns jsonb language plpgsql as $$
declare l lair; k record; v_said text[] := '{}'; v_book text; v_got text; v_title text; v_out jsonb := '{}'::jsonb;
begin
  select * into l from lair where world_id = p_world and id = p_lair;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  if (p_roll->>'map')::boolean and bury_treasure(p_world, p_uid, p_ql, l.x + 0.5, l.y + 0.5) is not null then
    v_said := v_said || 'treasure map'::text;
    v_out := v_out || '{"map": true}';
  end if;
  perform give(p_world, p_uid, k.trophy, 1, p_ql);
  v_said := v_said || lower((select d.name from item_def d where d.id = k.trophy));
  v_out := v_out || jsonb_build_object('trophy', k.trophy);
  if k.scales > 0 then
    perform give(p_world, p_uid, 'dragon_scale', k.scales, p_ql, hoard_scale());
    v_said := v_said || (k.scales || ' hoard dragon scales');
    v_out := v_out || jsonb_build_object('scales', k.scales);
  end if;
  if (p_roll->>'book')::boolean then
    v_book := (select bd.book from book_drops() bd where bd.kind = k.species);
    v_got := private.recipe_to_drop(p_world, p_uid, v_book);
    if v_got is not null then
      v_title := (select lr.title from locked_recipes() lr where lr.id = v_got);
      perform give(p_world, p_uid, book_item(v_book), 1, p_ql, v_title);
      v_said := v_said || (lower((select d.name from item_def d where d.id = book_item(v_book))) || ' (' || lower(v_title) || ')');
      v_out := v_out || jsonb_build_object('book', v_got);
    end if;
  end if;
  perform tell(p_world, p_uid, 'Hoard (' || lower(k.name) || '): ' || listed(v_said) || '.', 'event');
  return v_out;
end $$;

/**
 * A lair's boss killed: a share of its hoard for every body that dealt it `hoard_share` of its health, each off its
 * own rolls; and the lair empty until its restock, and moving once it has been cleared `lair_move_clears` times in
 * `lair_move_days` days.
 */
create or replace function lair_cleared(p_world uuid, p_lair int, p_top double precision) returns int language plpgsql as $$
declare b record; v_n int := 0; v_clears timestamptz[];
begin
  for b in select * from lair_blow where world_id = p_world and lair = p_lair and dealt >= hoard_share() * p_top order by uid loop
    perform lair_hoard_give(p_world, b.uid, p_lair, hoard_roll((select kind from lair where world_id = p_world and id = p_lair),
      random(), random()), map_ql_beast(p_top));
    v_n := v_n + 1;
  end loop;
  delete from lair_blow where world_id = p_world and lair = p_lair;
  select array(select t from unnest(l.clears) t where t > now() - make_interval(days => lair_move_days()::int)) || now()
    into v_clears from lair l where l.world_id = p_world and l.id = p_lair;
  update lair set state = 'cleared', cleared_at = now(), clears = v_clears,
      moving = moving or cardinality(v_clears) >= lair_move_clears()
    where world_id = p_world and id = p_lair;
  -- An orc camp's fire out.
  perform lair_fire(p_world, p_lair, false);
  return v_n;
end $$;

/** One of a lair's killed: its boss clears it; the last of its garrison sends the boss out. */
create or replace function lair_lost(p_world uuid, c creature) returns void language plpgsql as $$
begin
  if c.boss then
    perform lair_cleared(p_world, c.lair, max_health(c));
  elsif (select l.state from lair l where l.world_id = p_world and l.id = c.lair) = 'held'
        and lair_garrison_up(p_world, c.lair) = 0 then
    perform lair_boss_out(p_world, c.lair);
  end if;
end $$;

select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$declare c creature; d species_def;$o$,
  $n$declare v_dealer uuid; c creature; d species_def;$n$);
select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$
  if c.health - v_taken > 0 then
$o$,
  $n$
  -- A lair's boss: what each body dealt it, its companion's blows counted to its keeper, and no more than it had left.
  if c.boss and c.lair is not null then
    v_dealer := coalesce(p_teller, (select k.keeper from creature k where k.world_id = p_world and k.id = p_by and k.mode = 'active'));
    if v_dealer is not null then
      insert into lair_blow (world_id, lair, uid, dealt) values (p_world, c.lair, v_dealer, greatest(0, least(v_taken, c.health)))
        on conflict (world_id, lair, uid) do update set dealt = lair_blow.dealt + excluded.dealt;
    end if;
  end if;

  if c.health - v_taken > 0 then
$n$);
select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$    (15 + random() * 35) * v_size, d.name);
$o$,
  $n$    (15 + random() * 35) * v_size, d.name);
  -- One of a lair's: its boss clears it, the last of its garrison sends the boss out (`lair_lost`).
  if c.lair is not null then perform lair_lost(p_world, c); end if;
$n$);
-- A boss's map is in its hoard, not off its kill.
select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$if p_teller is not null and d.monster and random() < map_chance_beast(d.health) then$o$,
  $n$if p_teller is not null and d.monster and not c.boss and random() < map_chance_beast(d.health) then$n$);
select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$'Killed: ' || lower(d.name)
$o$,
  $n$'Killed: ' || lower(case when c.boss then c.name else d.name end)
$n$);

/* ---- The ring round a cleared lair ----------------------------------------------------------------------------- */

select pg_temp.patch_fn('in_safe_ring(uuid, double precision, double precision)',
  $o$  return coalesce(safe_ring_on(v_size, v_sx, v_sy, p_x, p_y), false);$o$,
  $n$  -- And round a cleared lair until it restocks (`lair_ring_on`).
  return coalesce(safe_ring_on(v_size, v_sx, v_sy, p_x, p_y), false) or lair_ring_on(p_world, p_x, p_y);$n$);

/* ---- No monster out of the wild -------------------------------------------------------------------------------- */

/** What the wild puts down on a tile: a wildermon off the weights, and in the safe ring none of the kinds it keeps out. */
create or replace function pick_wild(p_world uuid, p_x int, p_y int) returns text language plpgsql stable as $$
declare got text; v_ring boolean;
begin
  v_ring := in_safe_ring(p_world, p_x + 0.5, p_y + 0.5);
  select species into got from wild_table where not monster
    -- In the safe ring, none of the kinds it keeps out (`ring_keeps_out`).
    and not (v_ring and ring_keeps_out(species))
  order by random() / greatest(1e-9, weight) limit 1;
  return got;
end $$;
drop function if exists pick_monster(uuid, integer, integer);
drop function if exists monster_share();
drop function if exists region_monsters(integer);

-- The ones roaming now came from the free spawn and belong to no lair.
delete from creature c using species_def s
 where s.id = c.species and s.monster and c.mode = 'wild' and c.lair is null;

/* ---- A settlement keeps off a lair ----------------------------------------------------------------------------- */

select pg_temp.patch_fn('deed_refusal(uuid, uuid, text, jsonb)',
  $o$declare p player;$o$,
  $n$declare v_lair record; p player;$n$);
select pg_temp.patch_fn('deed_refusal(uuid, uuid, text, jsonb)',
  $o$  return null;
end$o$,
  $n$  -- And no nearer a lair than its kind keeps from a token (`lair_kinds.keep_off`).
  select k.name, k.keep_off, sqrt((tx - l.x) ^ 2 + (ty - l.y) ^ 2) as d into v_lair
    from lair l join lair_kinds() k on k.id = l.kind
   where l.world_id = p_world and (tx - l.x) ^ 2 + (ty - l.y) ^ 2 < k.keep_off ^ 2
   order by 3, l.id limit 1;
  if v_lair.name is not null then
    return 'Too close to a ' || lower(v_lair.name) || ': ' || floor(v_lair.d)::int || ' tiles; ' || v_lair.keep_off || ' needed.';
  end if;
  return null;
end$n$);

/* ---- Nobody moves, takes or works a lair ----------------------------------------------------------------------- */

create or replace function lair_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $$
declare v_kind text;
begin
  if p_target->>'kind' = 'furniture' then
    select l.kind into v_kind from lair l
     where l.world_id = p_world and l.placed = nullif(p_target->>'id', '')::bigint;
  elsif p_target ? 'into' then
    select l.kind into v_kind from lair l
     where l.world_id = p_world and l.placed = nullif(p_target->>'into', '')::bigint;
  end if;
  if v_kind is null then return null; end if;
  return (select k.name from lair_kinds() k where k.id = v_kind) || ': cannot be moved, taken, used or worked.';
end $$;
select pg_temp.patch_fn('act_refusal(uuid, uuid, text, jsonb)',
  $o$  why := grave_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;$o$,
  $n$  why := grave_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;
  -- A lair is the island's, and nobody's to do anything with (`lair_refusal`).
  why := lair_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then return why; end if;$n$);

/* ---- Examine: the lair a tile is by ---------------------------------------------------------------------------- */

/** " Lair: Goblin warren (12 tiles): garrison 3/5." for a tile within `lair_leash` of one, or nothing. */
create or replace function lair_says(p_world uuid, p_x int, p_y int) returns text language plpgsql stable as $$
declare l lair; k record; v_d double precision;
begin
  select lr.* into l from lair lr where lr.world_id = p_world
     and (p_x - lr.x) ^ 2 + (p_y - lr.y) ^ 2 <= lair_leash() ^ 2
   order by (p_x - lr.x) ^ 2 + (p_y - lr.y) ^ 2, lr.id limit 1;
  if l.id is null then return ''; end if;
  select * into k from lair_kinds() lk where lk.id = l.kind;
  v_d := sqrt((p_x - l.x) ^ 2 + (p_y - l.y) ^ 2);
  return ' Lair: ' || k.name || case when v_d >= 1 then ' (' || floor(v_d)::int || ' tiles)' else '' end || ': '
    || case l.state
         when 'held' then 'garrison ' || lair_garrison_up(p_world, l.id) || '/' || l.size
         when 'boss' then coalesce(k.boss, (select sd.name from species_def sd where sd.id = k.species)) || ' out'
         else 'cleared, safe ring ' || lair_ring()::int || ' tiles, restock in '
              || wait_words(greatest(1, extract(epoch from (l.cleared_at + make_interval(secs => k.restock) - now())))) end
    || '.';
end $$;
select pg_temp.patch_fn('examine_tile_text(uuid, integer, integer, uuid)',
  $o$  return v_out || v_extra;
end$o$,
  $n$  -- And the lair it is by (`lair_says`).
  v_extra := v_extra || lair_says(p_world, p_x, p_y);
  return v_out || v_extra;
end$n$);

/* ---- Track: a monster's trail is its lair's -------------------------------------------------------------------- */

select pg_temp.patch_fn('track_refusal(uuid, uuid, text, jsonb)',
  $o$  if sd.monster then
    return sd.name || ': not a wildermon, no trail.';
  end if;$o$,
  $n$  -- A monster's trail is its lair's, seen or not (`lair_track`).
  if sd.monster then return null; end if;$n$);

/** Track, from a monster's page: the nearest lair of its kind within `lair_track`, read as a wildermon's trail is. */
create or replace function lair_track_go(p_world uuid, p_uid uuid, p_species text, p_level int) returns void language plpgsql as $$
declare p player; k record; l record; v_r jsonb;
begin
  select * into p from player pl where pl.world_id = p_world and pl.uid = p_uid;
  select * into k from lair_kinds() lk where lk.species = p_species;
  if k.id is not null then
    select lr.id, lr.x, lr.y, sqrt((lr.x + 0.5 - p.x) ^ 2 + (lr.y + 0.5 - p.y) ^ 2) as d into l from lair lr
     where lr.world_id = p_world and lr.kind = k.id and (lr.x + 0.5 - p.x) ^ 2 + (lr.y + 0.5 - p.y) ^ 2 <= lair_track() ^ 2
     order by 4, lr.id limit 1;
  end if;
  if l.id is null then
    perform tell(p_world, p_uid, 'No ' || lower(coalesce(k.name, 'lair')) || ' within ' || lair_track()::int || ' tiles.', 'event');
    perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(false));
    perform char_told(p_world, p_uid, 'awareness', track_aware());
    return;
  end if;
  v_r := track_reading(p_level, track_bearing(p.x, p.y, l.x + 0.5, l.y + 0.5), l.d, random());
  perform tell(p_world, p_uid, 'Lair: ' || k.name || ', ' || (v_r->>'way') || ', ' || track_dist_says(v_r) || '.', 'event');
  perform tell(p_world, p_uid, jsonb_build_object('name', k.name, 'bearing', v_r->'bearing', 'far', v_r->'far', 'tiles', v_r->'tiles')::text, 'tracked');
  perform journal_note(p_world, p_uid, 'tracked');
  perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(true));
  perform char_told(p_world, p_uid, 'awareness', track_aware());
end $$;
select pg_temp.patch_fn('perform_track(uuid, uuid, text, jsonb)',
  $o$  v_level := track_level(skill_of(p_world, p_uid, tracking_skill()));$o$,
  $n$  v_level := track_level(skill_of(p_world, p_uid, tracking_skill()));
  -- A monster's: its kind's nearest lair (`lair_track_go`).
  if sd.monster then
    perform lair_track_go(p_world, p_uid, sd.id, v_level);
    return;
  end if;$n$);

/* ---- Hoard dragon scales raise scale armour's cap -------------------------------------------------------------- */

select pg_temp.patch_fn('perform_craft(uuid, uuid, text, jsonb)',
  $o$declare r recipe;$o$,
  $n$declare v_scales int := 0; v_hoard int := 0; r recipe;$n$);
select pg_temp.patch_fn('perform_craft(uuid, uuid, text, jsonb)',
  $o$  v_used := craft_units_held(p_world, p_uid, p_recipe, prefer);$o$,
  $n$  -- The dragon scales at hand before the go, all and hoard (`hoard_scale`), for what it spends of each.
  v_scales := craft_count(p_world, p_uid, 'dragon_scale', null, prefer);
  v_hoard := craft_count(p_world, p_uid, 'dragon_scale', hoard_scale(), prefer);
  v_used := craft_units_held(p_world, p_uid, p_recipe, prefer);$n$);
select pg_temp.patch_fn('perform_craft(uuid, uuid, text, jsonb)',
  $o$  v_used := rarity_tally_less(v_used, craft_units_held(p_world, p_uid, p_recipe, prefer));$o$,
  $n$  v_used := rarity_tally_less(v_used, craft_units_held(p_world, p_uid, p_recipe, prefer));
  v_scales := v_scales - craft_count(p_world, p_uid, 'dragon_scale', null, prefer);
  v_hoard := v_hoard - craft_count(p_world, p_uid, 'dragon_scale', hoard_scale(), prefer);$n$);
-- Made of hoard scales alone: its QL capped at `hoard_scale_cap` times the skill rather than the skill.
select pg_temp.patch_fn('perform_craft(uuid, uuid, text, jsonb)',
  $o$    made_ql := product_ql(s, tq);$o$,
  $n$    made_ql := product_ql(case when v_scales > 0 and v_hoard = v_scales then s * hoard_scale_cap() else s end, tq);$n$);

/* ---- The browser: the lairs a body has seen, for its map and its field guide ----------------------------------- */

select pg_temp.patch_fn('rpc_ground(uuid, double precision, boolean, text)',
  $o$    'graves', coalesce(($o$,
  $n$    -- And every lair you have seen (`lair_seen`), wherever it is: a pin on your map, "found" in your field guide.
    'lairs', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'x', l.x, 'y', l.y) order by l.id)
      from lair_seen s join lair l on l.world_id = s.world_id and l.id = s.lair
      where s.world_id = p_world and s.uid = me), '[]'::jsonb),
    'graves', coalesce(($n$);

-- And a boss says which lair's it is, for the health and blow the browser reckons with (`bossMul`).
select pg_temp.patch_fn('rpc_creatures(uuid, double precision, text, integer[], boolean)',
  $o$         else '{}'::jsonb end
      as more) v$o$,
  $n$         else '{}'::jsonb end
      || case when c.boss then jsonb_build_object('boss', (select l.kind from lair l where l.world_id = c.world_id and l.id = c.lair)) else '{}'::jsonb end
      as more) v$n$);

/* ---- On the stocking clock ------------------------------------------------------------------------------------- */

select pg_temp.patch_fn('stock_tick()',
  $o$  perform pg_advisory_unlock(hashtext('stock_tick')::bigint);$o$,
  $n$  -- And the lairs of every island it came round to (`lair_tick`), each on its own: a fault in one is noted and passed.
  for i in 1 .. coalesce(v_worlds, 0) loop
    begin
      perform lair_tick(v_ids[i]);
    exception
      when lock_not_available or deadlock_detected or serialization_failure then null;
      when others then
        declare v_err text; v_state text; v_where text;
        begin
          get stacked diagnostics v_err = message_text, v_state = returned_sqlstate, v_where = pg_exception_context;
          perform fault_note(v_ids[i], null, 'lairs', null, v_err, v_state, v_where);
        end;
    end;
  end loop;
  perform pg_advisory_unlock(hashtext('stock_tick')::bigint);$n$);

select private.lock_doors();
