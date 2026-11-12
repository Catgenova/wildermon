-- A settlement grown large (Solara: 600 walls, 850 floors, 650 things lying about, 50 wildermon), sent and worked for less.
--
-- Measured on a settlement filled to Solara's counts (`tools/perf/sql`): every near read's delta was 20 kB when nothing
-- had changed, half of it the crates (sent whole on every answer) and the rest the companions at heel, whose rows were
-- written on every settle (`leg_at = now()`) and so sent again on every read. The whole answer carried 356 kB of things
-- lying about, each its whole row of 37 columns, most of them null. A worker putting a load away asked every store on
-- the settlement whether it had room before taking the nearest; a worker looking for what a recipe needs read every
-- column of every thing in every store.
--
--   Things lying about: only what the browser reads of them (`packed`), and no null or false column (`private.lying_row`).
--   Crates: a hash of them rides the ground cursor (`c<8 hex>:` before it); while it is the same they are left out of
--     a delta, and the browser keeps the ones it holds (`GroundHeld`).
--   A companion already at its keeper's heel is not written again: not moved (`creature_settle`, `companion_settle`),
--     and its body (health mending, hunger, care, fleece: straight lines in time) left to the next write, within a
--     minute or a fiftieth of its health.
--   `worker_store`: the stores in order (bin, the settlement's own crate, nearest), each asked for room in turn, the
--     first with room taken.
--   `deed_stores`: the stores themselves, once; `deed_store_items` their things whole, `deed_store_stock` only the
--     columns the stock is counted from (`recipe_in_stores`, `take_one_stored`).

set local lock_timeout = '3s';

/** A thing lying on the ground as the browser reads it (`packed`): no null or false column, nothing it does not read. */
create or replace function private.lying_row(i item) returns jsonb
language sql immutable set search_path = public as $fn$
  select jsonb_strip_nulls(jsonb_build_object(
           'id', i.id, 'def', i.def, 'ql', i.ql, 'dmg', i.dmg, 'count', i.count, 'gx', i.gx, 'gy', i.gy,
           'extra', i.extra, 'charges', i.charges, 'rare', i.rare, 'dye', i.dye, 'bless', i.bless,
           'maker', i.maker, 'piece', i.piece, 'creature', i.creature, 'engraving', i.engraving,
           'locked', nullif(i.locked, false), 'issued', nullif(i.issued, false), 'lit', nullif(i.lit, false),
           'lit_at', i.lit_at))
         -- Kept whole: a null inside one of these is the browser's to read.
         || case when i.mark is null then '{}'::jsonb else jsonb_build_object('mark', i.mark) end
         || case when i.enchant is null then '{}'::jsonb else jsonb_build_object('enchant', i.enchant) end
$fn$;
revoke all on function private.lying_row(item) from public, anon, authenticated;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Things lying about, on the grass and on cellar floors.
    ('public', 'rpc_ground', 2,
     $$jsonb_agg(to_jsonb(i) - 'world_id' - array['origin', 'origin_fn', 'origin_uid'] order by i.id)$$,
     $$jsonb_agg(private.lying_row(i) order by i.id)$$),
    -- The crates: read once, and their hash kept.
    ('public', 'rpc_ground', 1,
     $$v_pids bigint[]; v_lids bigint[]; v_cids bigint[]; v_out jsonb;$$,
     $$v_pids bigint[]; v_lids bigint[]; v_cids bigint[]; v_out jsonb; v_crates jsonb; v_ch text; v_had text;$$),
    ('public', 'rpc_ground', 1,
     $$  if p_since is not null then
    -- The same pattern as a yes or no;$$,
     $$  -- The crates' hash as the last answer had them, ahead of the cursor proper.
  if p_since ~ '^c[0-9a-f]{8}:' then
    v_had := substr(p_since, 2, 8);
    p_since := substr(p_since, 11);
  end if;
  if p_since is not null then
    -- The same pattern as a yes or no;$$),
    ('public', 'rpc_ground', 1,
     $$  v_out := jsonb_build_object(
    'placed', v_placed,
    'crates', crates_near(p_world, me, p_range),$$,
     $$  v_crates := crates_near(p_world, me, p_range);
  v_ch := left(md5(v_crates::text), 8);
  v_out := jsonb_build_object(
    'placed', v_placed,
    'crates', v_crates,$$),
    ('public', 'rpc_ground', 1,
     $$  return v_out || jsonb_build_object('at', v_at, 'full', v_snap is null)$$,
     $$  -- The crates as the cursor had them: left out, and the browser keeps the ones it holds (`GroundHeld`).
  if v_snap is not null and v_had = v_ch then v_out := v_out - 'crates'; end if;
  return v_out || jsonb_build_object('at', 'c' || v_ch || ':' || v_at, 'full', v_snap is null)$$),

    -- A companion at heel: not moved, and not written.
    ('public', 'creature_settle', 1,
     $$        v_stunned boolean;
begin$$,
     $$        v_stunned boolean; c0 creature; v_learning boolean := false;
begin$$),
    ('public', 'creature_settle', 1,
     $$  if not found then return false; end if;
  select * into d from species_def where id = c.species;$$,
     $$  if not found then return false; end if;
  c0 := c;
  select * into d from species_def where id = c.species;$$),
    ('public', 'creature_settle', 1,
     $$    for i in 1 .. least(n, 960) loop perform beast_learns(p_world, p_id, d.learns_by); end loop;$$,
     $$    -- Its chance of a lesson is over the time since the row was written, so this one is always written.
    v_learning := true;
    for i in 1 .. least(n, 960) loop perform beast_learns(p_world, p_id, d.learns_by); end loop;$$),
    ('public', 'creature_settle', 1,
     $$    if found and not on_piers(p_world, floor(home.x)::int, floor(home.y)::int) then$$,
     $$    -- Already standing there: nothing moved.
    if found and not on_piers(p_world, floor(home.x)::int, floor(home.y)::int)
       and ((c.from_x, c.from_y, c.to_x, c.to_y) is distinct from (home.x, home.y, home.x, home.y)
            or c.leg_ends > now() or c.until > now()) then$$),
    ('public', 'creature_settle', 1,
     $$      settled_at = now()
    where world_id = p_world and id = p_id;
  -- And then the day's work$$,
     $$      settled_at = now()
    where world_id = p_world and id = p_id
      -- A companion at heel with nothing but its body's slow straight lines to write is left for a minute, so its row
      -- is not sent again on every read (`rpc_creatures`); the next write carries the time since.
      and not coalesce(c.mode = 'active' and not v_learning and elapsed < 60
        and (c.from_x, c.from_y, c.to_x, c.to_y, c.leg_at, c.leg_ends, c.until, c.leg, c.unfed,
             c.hunting, c.hunt_x, c.hunt_y, c.hunt_again, c.fight_blows, c.windup_at, c.bleed_rate, c.bleed_until,
             c.hurt_at, c.pack_lead, c.brawl, c.threat_at, c.home_x, c.home_y)
            is not distinct from
            (c0.from_x, c0.from_y, c0.to_x, c0.to_y, c0.leg_at, c0.leg_ends, c0.until, c0.leg, c0.unfed,
             c0.hunting, c0.hunt_x, c0.hunt_y, c0.hunt_again, c0.fight_blows, c0.windup_at, c0.bleed_rate, c0.bleed_until,
             c0.hurt_at, c0.pack_lead, c0.brawl, c0.threat_at, c0.home_x, c0.home_y)
        and abs(c.health - c0.health) < 0.02 * top
        and abs(c.hunger - c0.hunger) < 0.01 and abs(c.care - c0.care) < 0.01 and abs(c.fleece - c0.fleece) < 0.01, false);
  -- And then the day's work$$),
    ('public', 'companion_settle', 1,
     $$  if c.enemy is null and on_piers(p_world, floor(k.x)::int, floor(k.y)::int) then
    c.from_x := c.to_x; c.from_y := c.to_y;
    c.leg_at := now(); c.leg_ends := now(); c.until := now();
    c.phase := 'idle';
  elsif c.enemy is null then
    -- Nothing to go for: at heel, which is not a walk of its own.
    c.from_x := k.x; c.from_y := k.y; c.to_x := k.x; c.to_y := k.y;
    c.leg_at := now(); c.leg_ends := now(); c.until := now();
    c.phase := 'idle';$$,
     $$  -- Already standing where it would be put, nothing changes: the row is not written (below).
  if c.enemy is null and on_piers(p_world, floor(k.x)::int, floor(k.y)::int) then
    if (c.from_x, c.from_y, c.phase) is distinct from (c.to_x, c.to_y, 'idle') or c.leg_ends > now() or c.until > now() then
      c.from_x := c.to_x; c.from_y := c.to_y;
      c.leg_at := now(); c.leg_ends := now(); c.until := now();
      c.phase := 'idle';
    end if;
  elsif c.enemy is null then
    -- Nothing to go for: at heel, which is not a walk of its own.
    if (c.from_x, c.from_y, c.to_x, c.to_y, c.phase) is distinct from (k.x, k.y, k.x, k.y, 'idle')
       or c.leg_ends > now() or c.until > now() then
      c.from_x := k.x; c.from_y := k.y; c.to_x := k.x; c.to_y := k.y;
      c.leg_at := now(); c.leg_ends := now(); c.until := now();
      c.phase := 'idle';
    end if;$$),
    -- The body's clock is `creature_settle`'s: a companion it left unwritten keeps the time since in `settled_at`.
    ('public', 'companion_settle', 1,
     $$      enemy = c.enemy, settled_at = now()
    where world_id = p_world and id = p_id
      -- Only when it changes the row$$,
     $$      enemy = c.enemy
    where world_id = p_world and id = p_id
      -- Only when it changes the row$$),
    ('public', 'companion_settle', 1,
     $$           or (from_x, from_y, to_x, to_y, leg_at, leg_ends, until, phase, enemy, settled_at)
              is distinct from
              (c.from_x, c.from_y, c.to_x, c.to_y, c.leg_at, c.leg_ends, c.until, c.phase, c.enemy, now()));$$,
     $$           or (from_x, from_y, to_x, to_y, leg_at, leg_ends, until, phase, enemy)
              is distinct from
              (c.from_x, c.from_y, c.to_x, c.to_y, c.leg_at, c.leg_ends, c.until, c.phase, c.enemy));$$)
  ) as t(sch, fn, times, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '%.% has % of the lines to change, not %', r.sch, r.fn, v_n, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

/**
 * The stores a worker may put a load in, round (`p_x`, `p_y`) within `p_r` (a piece or crate at `p_half` past its
 * corner, as each test had it), in the order it would choose them: a bin built for the load, then the settlement's own
 * crate (`p_own`), then the nearest. Each asked whether it will take the load only in its turn, and the first that will
 * is the answer: asking every store first cost a millisecond a piece on a full settlement.
 */
create or replace function private.worker_store_round(p_world uuid, c creature, p_def text, p_count integer,
  p_x double precision, p_y double precision, p_r integer, p_half double precision, p_own boolean)
returns table(kind text, id bigint, cx double precision, cy double precision)
language plpgsql stable set search_path = public as $fn$
declare r record; v_x double precision := creature_x(c); v_y double precision := creature_y(c);
begin
  for r in
    select q.* from (
      select 'crate'::text as s_kind, cr.id::bigint as s_id, crate_centre_x(cr) as s_cx, crate_centre_y(cr) as s_cy,
             p_own and coalesce(cr.deed, false) as s_own, false as s_bin, cr as s_cr, null::placed as s_pl
        from crate cr
       where cr.world_id = p_world
         and cr.x between floor(p_x - p_r)::int - 1 and floor(p_x + p_r)::int + 1
         and cr.y between floor(p_y - p_r)::int - 1 and floor(p_y + p_r)::int + 1
         and abs(cr.x + p_half - p_x) <= p_r and abs(cr.y + p_half - p_y) <= p_r
      union all
      select 'furniture', pl.id, pl.x + 0.5, pl.y + 0.5, false, fd.takes is not null, null::crate, pl
        from placed pl join furniture_def fd on fd.id = pl.sub
       where pl.world_id = p_world and pl.kind = 'furniture'
         and pl.x between floor(p_x - p_r)::int - 1 and floor(p_x + p_r)::int + 1
         and pl.y between floor(p_y - p_r)::int - 1 and floor(p_y + p_r)::int + 1
         and abs(pl.x + p_half - p_x) <= p_r and abs(pl.y + p_half - p_y) <= p_r) q
    order by q.s_bin desc, q.s_own desc, (q.s_cx - v_x) ^ 2 + (q.s_cy - v_y) ^ 2
  loop
    if r.s_kind = 'crate' then
      if not coalesce(private.worker_crate_ok(p_world, c.keeper, r.s_cr), false) then continue; end if;
      if (r.s_cr).level > 0 and not coalesce(storey_reached(p_world, (r.s_cr).x, (r.s_cr).y, (r.s_cr).level), false) then continue; end if;
      if not coalesce(crate_units(p_world, (r.s_cr).id) + p_count <= crate_capacity(r.s_cr), false) then continue; end if;
    else
      if not coalesce(furniture_holds(r.s_pl), false) or furniture_refuses(r.s_pl, p_def) is not null then continue; end if;
      if not coalesce(private.worker_piece_ok(p_world, c.keeper, r.s_pl), false) then continue; end if;
      if (r.s_pl).level > 0 and not coalesce(storey_reached(p_world, (r.s_pl).x, (r.s_pl).y, (r.s_pl).level), false) then continue; end if;
      if not coalesce(p_count <= furniture_room(r.s_pl, p_def), false) then continue; end if;
    end if;
    kind := r.s_kind; id := r.s_id; cx := r.s_cx; cy := r.s_cy;
    return next;
    return;
  end loop;
end $fn$;
revoke all on function private.worker_store_round(uuid, creature, text, integer, double precision, double precision, integer, double precision, boolean)
  from public, anon, authenticated;

create or replace function public.worker_store(p_world uuid, c creature, p_def text, p_count integer)
 returns table(kind text, id bigint, cx double precision, cy double precision)
 language plpgsql
 stable
as $function$
declare v_site record; v_d deed;
begin
  /*
   * A purpose-built bin takes the load first, when the load is what it was built for ("molas should prioritize
   * storing into raw material bins"); then, at home, the settlement's own crate; then the nearest store with room.
   * A bin in the list has been through `furniture_refuses`, so it is the bin built for exactly this thing.
   */
  select * into v_site from work_site(p_world, c);
  if v_site.x is null then return; end if;
  -- Round its keeper: storage in reach of them only (`around_stores`), never the settlement's.
  if c.around is not null then
    return query
    select s.kind, s.id, s.cx, s.cy
      from around_stores(p_world, c.keeper, v_site.x, v_site.y, v_site.radius) s
     where case when s.kind = 'crate'
                then crate_units(p_world, s.id::int) + p_count
                     <= (select crate_capacity(cr) from crate cr where cr.world_id = p_world and cr.id = s.id::int)
                else (select furniture_refuses(pl, p_def) is null and p_count <= furniture_room(pl, p_def)
                        from placed pl where pl.id = s.id) end
     order by s.bin desc, (s.cx - creature_x(c)) ^ 2 + (s.cy - creature_y(c)) ^ 2, s.kind, s.id
     limit 1;
    return;
  end if;
  -- Beside the post first, when it is working off one.
  if v_site.post is not null then
    return query select * from private.worker_store_round(p_world, c, p_def, p_count, v_site.x, v_site.y, v_site.radius, 0.5, false);
    if found then return; end if;
  end if;
  -- Then home: the settlement's own crate while it has room, and the nearest thing on the deed that will take it after.
  select * into v_d from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if v_d.world_id is null then return; end if;
  return query select * from private.worker_store_round(p_world, c, p_def, p_count, v_d.x, v_d.y, v_d.radius, 0, true);
end $function$;

/**
 * The stores of `p_uid`'s settlements (or round them, `around_scope`): each crate and each piece of furniture that
 * holds things and has something in it, once. What is in them is `deed_store_items` (whole) or `deed_store_stock`.
 */
create or replace function public.deed_stores(p_world uuid, p_uid uuid)
 returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision)
 language sql
 stable
as $function$
  with sc as materialized (
    select q.a from (select around_scope(p_uid) as a) q where q.a is not null
  ),
  -- Round its keeper: storage in reach of them (`around_stores`) in place of the settlement's.
  ar as materialized (
    select s.* from sc cross join lateral around_stores(p_world, p_uid, (sc.a->>'x')::int, (sc.a->>'y')::int, (sc.a->>'r')::int) s
  ),
  dd as materialized (
    select d.x, d.y, d.radius from my_deed(p_world, p_uid) d where d.world_id is not null and not exists (select 1 from sc)
  ),
  bb as materialized (
    select min(dd.x - dd.radius) as x0, max(dd.x + dd.radius) as x1, min(dd.y - dd.radius) as y0, max(dd.y + dd.radius) as y1 from dd
  ),
  -- Furniture on one of those settlements with something in it: cheap to find, before anything is reckoned.
  pp as materialized (
    select p from placed p
     where p.world_id = p_world
       and p.x between (select x0 from bb) and (select x1 from bb) and p.y between (select y0 from bb) and (select y1 from bb)
       and p.kind = 'furniture'
       and exists (select 1 from dd where abs(p.x - dd.x) <= dd.radius and abs(p.y - dd.y) <= dd.radius)
       and exists (select 1 from item i where i.placed = p.id and i.holder = 'furniture')
  ),
  -- And of that, what is a store: `furniture_holds`, worked out here from the piece's own columns.
  ph as materialized (
    select pp.p from pp
      join furniture_def fd on fd.id = (pp.p).sub
      cross join lateral (select mat_hold((pp.p).material) * mark_of((pp.p).mark, 'hold') * room_mul((pp.p).enchant) as m) k
     where coalesce(fd.trash, 0) = 0
       and (room_for(coalesce(fd.capacity, fd.hive, fd.pond, 0) * k.m, (pp.p).rare) > 0
            or room_for(coalesce(fd.heft, 0) * k.m, (pp.p).rare) > 0)
  ),
  cc as materialized (
    select cr from crate cr
     where cr.world_id = p_world
       and cr.x between (select x0 from bb) and (select x1 from bb) and cr.y between (select y0 from bb) and (select y1 from bb)
       and exists (select 1 from dd where abs(cr.x - dd.x) <= dd.radius and abs(cr.y - dd.y) <= dd.radius)
  )
  select 'crate', (cc.cr).id::bigint, (cc.cr).x, (cc.cr).y, crate_centre_x(cc.cr), crate_centre_y(cc.cr) from cc
  union all
  select 'furniture', (ph.p).id, (ph.p).x, (ph.p).y, (ph.p).cx, (ph.p).cy from ph
  union all
  select ar.kind, ar.id, ar.x, ar.y, ar.cx, ar.cy from ar where ar.kind in ('crate', 'furniture')
$function$;

create or replace function public.deed_store_items(p_world uuid, p_uid uuid)
 returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision, it item)
 language sql
 stable
as $function$
  with s as materialized (select * from deed_stores(p_world, p_uid))
  select s.kind, s.sid, s.x, s.y, s.cx, s.cy, i
    from s join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = s.sid::int
   where s.kind = 'crate'
  union all
  select s.kind, s.sid, s.x, s.y, s.cx, s.cy, i
    from s join item i on i.placed = s.sid and i.holder = 'furniture'
   where s.kind = 'furniture'
$function$;

/** What is in the stores (`deed_stores`), only as much as a count of the stock needs: a third less to read than whole rows. */
create or replace function public.deed_store_stock(p_world uuid, p_uid uuid)
 returns table(kind text, sid bigint, x integer, y integer, cx double precision, cy double precision,
               iid bigint, def text, n integer, locked boolean)
 language sql
 stable
as $function$
  with s as materialized (select * from deed_stores(p_world, p_uid))
  select s.kind, s.sid, s.x, s.y, s.cx, s.cy, i.id, i.def, i.count, i.locked
    from s join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = s.sid::int
   where s.kind = 'crate'
  union all
  select s.kind, s.sid, s.x, s.y, s.cx, s.cy, i.id, i.def, i.count, i.locked
    from s join item i on i.placed = s.sid and i.holder = 'furniture'
   where s.kind = 'furniture'
$function$;

create or replace function public.recipe_in_stores(p_world uuid, p_uid uuid, p_recipes text[])
 returns table(rid text, x integer, y integer, cx double precision, cy double precision)
 language plpgsql
 stable
as $function$
declare r recipe; v_id text; v_have jsonb; v_first jsonb;
begin
  -- What the settlement's stores hold, read once: for each thing not locked away, how many (`stores_count`) and the
  -- store it is first found in (by kind, then id).
  select coalesce(jsonb_object_agg(q.def, jsonb_build_object('n', q.n, 'x', q.x, 'y', q.y, 'cx', q.cx, 'cy', q.cy)), '{}'::jsonb)
    into v_have
    from (select s.def, coalesce(sum(s.n), 0) as n,
                 (array_agg(s.x order by s.kind, s.sid))[1] as x, (array_agg(s.y order by s.kind, s.sid))[1] as y,
                 (array_agg(s.cx order by s.kind, s.sid))[1] as cx, (array_agg(s.cy order by s.kind, s.sid))[1] as cy
            from deed_store_stock(p_world, p_uid) s
           where not coalesce(s.locked, false)
           group by s.def) q;
  foreach v_id in array p_recipes loop
    select * into r from recipe where id = v_id;
    if r.id is null then continue; end if;
    if exists (select 1 from recipe_input ri where ri.recipe = r.id and case when ri.litres is not null then stores_litres(p_world, p_uid, ri.item) < ri.litres
                                                                            else coalesce((v_have->ri.item->>'n')::bigint, 0) < ri.count end) then continue; end if;
    v_first := v_have->(select ri.item from recipe_input ri where ri.recipe = r.id order by ri.ord limit 1);
    if v_first is null then continue; end if;
    rid := r.id; x := (v_first->>'x')::int; y := (v_first->>'y')::int;
    cx := (v_first->>'cx')::double precision; cy := (v_first->>'cy')::double precision;
    return next;
    return;
  end loop;
end $function$;

create or replace function public.take_one_stored(p_world uuid, p_uid uuid, p_defs text[], p_x integer default null, p_y integer default null)
 returns jsonb
 language plpgsql
as $function$
declare v item; v_id bigint;
begin
  select s.iid into v_id from deed_store_stock(p_world, p_uid) s
   where s.def = any(p_defs) and s.n > 0 and not coalesce(s.locked, false)
   order by (p_x is not null and s.x = p_x and s.y = p_y) desc, s.kind, s.sid, s.iid limit 1;
  if v_id is null then return null; end if;
  select * into v from item where id = v_id;
  if v.id is null then return null; end if;
  if not item_take_units(v, 1) then return null; end if;
  return jsonb_build_object('def', v.def, 'count', 1, 'ql', v.ql, 'extra', v.extra);
end $function$;

select private.lock_doors();
