-- Work around me: a wildermon works its trade within its work range of its keeper, into storage in reach.
--
-- Asked for: "Allow wildermon to Work Around Me, provided there is storage nearby (carts and wagons and accessible
-- boats included)", and then: "It is an action of the player. The player is the focal point, not a work post or the
-- settlement totem ... It ends when the player cancels the action, or goes offline ... Each wildermon that was
-- working around them then goes back to where it came from."
--
-- A worker set to it is a worker as one at a post is (`mode` 'deed', the one mode every worker's step, its hunger, its
-- learning and its card are written for), with `around` set and no `post`: it is on no settlement's roll
-- (`workers_on_deed`), takes no settlement slot, and its ground is its keeper's tile, read each settle (`work_site`).
-- `around` records where it came from, so it goes back exactly: `{"was": "crate", "item": <crate in the pack>}`,
-- `{"was": "crate", "placed": <crate standing>}` or `{"was": "follow"}`.
--
--   * Storage in reach (`around_stores`): crates and storing furniture within its work range of its keeper that the
--     keeper may put into (`crate_put_shut`, `store_shut_piece`: a settlement store by its rule, a padlock by its key),
--     every cart, wagon and boat among them by the same rule, and the cart or wagon the keeper pulls or drives and the
--     boat they steer or ride in wherever the row last put it. Not a stall, a trash crate, a mailbox, a hive, a pond
--     or a barrel.
--   * With none, it does not work: idle `nostore`. A load goes to the bin that takes it first, then the nearest store
--     with room (`worker_store`); with no room it holds the load, idle `full`, as any worker does.
--   * Trades (`around_trade`): every trade that walks out to the ground and carries its loads home, as at a post; and of
--     the errands, the thirteen worked at the stores (tanning to pressing cheese), their makings out of storage in
--     reach (`deed_store_items`, scoped by `wildermon.around` while it settles) and only with room there for what they make.
--     Guarding, sparring and every errand tied to the settlement's own buildings, stations or creatures are refused:
--     those find their work through the settlement (`errand_step`'s `my_deed`, `on_my_deed`), at a post too.
--   * It ends at Stop (`stop_work_around`), or when its keeper is offline (away, or not seen for `idle_logout`): in the
--     clock (`around_sweep`) and at its own settle. Back into the crate it came out of while that is in the pack or
--     standing, and empty; back to following while nothing else follows; otherwise where a worker off a post goes
--     (`worker_return`, which `post_release` now uses too). What is in its arms goes into storage in reach, else the
--     keeper's pack.

set local lock_timeout = '3s';

alter table creature add column if not exists around jsonb;
create index if not exists creature_around on creature (world_id) where around is not null;

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

-- ---- Where it came from goes when it stops being a worker round its keeper -----------------------------------------

-- Into a crate, following, wild, onto a post or to somebody else: no longer round its keeper.
create or replace function around_off() returns trigger language plpgsql as $$
begin
  new.around := null;
  return new;
end $$;
create trigger creature_around_off before update on creature for each row
  when (new.around is not null and (new.mode <> 'deed' or new.post is not null or new.keeper is distinct from old.keeper))
  execute function around_off();

-- ---- What may be worked round its keeper ---------------------------------------------------------------------------

/** The trades worked at the stores: a recipe, its makings out of them and what it makes back in. */
create or replace function store_recipe_trade(p_kind text) returns boolean language sql immutable as $$
  select p_kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'concrete', 'mortar', 'timber', 'shaft',
                    'bandage', 'cheese')
$$;

/**
 * A trade worked round its keeper: one that walks out to the ground and carries its loads home, and of the errands the
 * ones worked at the stores. Not guarding, and not an errand tied to the settlement's own buildings, stations or
 * creatures.
 */
create or replace function around_trade(p_kind text) returns boolean language sql immutable as $$
  select p_kind is not null and p_kind <> 'guard' and (not worker_errand(p_kind) or store_recipe_trade(p_kind))
$$;

/** Its keeper awake: on the island, not away, seen within `idle_logout`. The workers' own sweep's test. */
create or replace function keeper_awake(p_world uuid, p_uid uuid) returns boolean language sql stable as $$
  select exists (select 1 from player p where p.world_id = p_world and p.uid = p_uid and not p.away
                   and p.seen_at > now() - make_interval(secs => idle_logout()))
$$;

-- ---- Storage in reach ------------------------------------------------------------------------------------------------

/**
 * Every store within `p_r` tiles (a square, measured from its middle) of the tile (`p_x`, `p_y`) that `p_uid` may put
 * into: crates (`crate_put_shut`), and furniture that holds things (`store_shut_piece`), carts, wagons and boats among
 * it; and the cart or wagon they pull or drive and the boat they steer or ride in, wherever its row last put it. Read
 * off `crate_near` and `placed_near` inside the square, and `placed_pulled`, `placed_driven` and the body's row.
 */
create or replace function around_stores(p_world uuid, p_uid uuid, p_x integer, p_y integer, p_r integer)
 returns table(kind text, id bigint, x integer, y integer, cx double precision, cy double precision, bin boolean)
 language sql stable as $$
  with aboard as materialized (
    select a.aboard from player a where a.world_id = p_world and a.uid = p_uid and a.aboard is not null
  ),
  crates as materialized (
    select cr from crate cr
     where cr.world_id = p_world
       and cr.x between p_x - p_r - 1 and p_x + p_r + 1 and cr.y between p_y - p_r - 1 and p_y + p_r + 1
     order by cr.ctid
  ),
  ids as materialized (
    select p.id from placed p
     where p.world_id = p_world and p.kind = 'furniture'
       and p.x between p_x - p_r - 4 and p_x + p_r + 1 and p.y between p_y - p_r - 4 and p_y + p_r + 1
    union
    select p.id from placed p where p.world_id = p_world and p.puller = p_uid
    union
    select p.id from placed p where p.world_id = p_world and p.driver = p_uid
    union
    select ab.aboard from aboard ab
  ),
  box as materialized (
    select p from placed p join ids on ids.id = p.id where p.world_id = p_world and p.kind = 'furniture'
  )
  select 'crate'::text, (k.cr).id::bigint, (k.cr).x, (k.cr).y, crate_centre_x(k.cr), crate_centre_y(k.cr), false
    from crates k
   where greatest(abs(crate_centre_x(k.cr) - (p_x + 0.5)), abs(crate_centre_y(k.cr) - (p_y + 0.5))) <= p_r
     and ((k.cr).level <= 0 or storey_reached(p_world, (k.cr).x, (k.cr).y, (k.cr).level))
     and crate_put_shut(p_world, p_uid, k.cr) is null
  union all
  select 'furniture', (b.p).id, (b.p).x, (b.p).y, (b.p).cx, (b.p).cy, fd.takes is not null
    from box b join furniture_def fd on fd.id = (b.p).sub
   where (greatest(abs((b.p).cx - (p_x + 0.5)), abs((b.p).cy - (p_y + 0.5))) <= p_r
          or (b.p).puller = p_uid or (b.p).driver = p_uid or (b.p).id in (select ab.aboard from aboard ab))
     and furniture_holds(b.p) and coalesce(fd.trash, 0) = 0 and not fd.stall and (b.p).sub <> 'mailbox'
     and fd.hive is null and fd.pond is null and not holds_liquid(b.p)
     and ((b.p).level <= 0 or storey_reached(p_world, (b.p).x, (b.p).y, (b.p).level))
     and store_shut_piece(p_world, p_uid, b.p) is null
$$;

/** The scope of the stores a worker round its keeper reads while it settles (`wildermon.around`): its keeper's, or null. */
create or replace function around_scope(p_uid uuid) returns jsonb language sql stable as $$
  select q.s from (select nullif(current_setting('wildermon.around', true), '')::jsonb as s) q where q.s->>'uid' = p_uid::text
$$;

/** Room in storage in reach of a worker round its keeper for what this recipe makes. */
create or replace function around_room(p_world uuid, c creature, p_recipe text) returns boolean language sql stable as $$
  select exists (select 1 from recipe r cross join lateral worker_store(p_world, c, r.result, r.count + perk_n(c, 'more')::int) w
                  where r.id = p_recipe and w.id is not null)
$$;

-- Its ground: its keeper's tile, read each settle, and its own range.
create or replace function public.work_site(p_world uuid, c creature)
 returns table(x integer, y integer, radius integer, post bigint)
 language plpgsql
 stable
as $function$
declare p placed; dd deed;
begin
  -- Round its keeper: the tile they stand on now, wherever that is.
  if c.around is not null then
    select floor(pl.x)::int, floor(pl.y)::int into x, y from player pl where pl.world_id = p_world and pl.uid = c.keeper;
    if x is null then return; end if;
    radius := work_range(c); post := null;
    return next;
    return;
  end if;
  if c.post is not null then
    select * into p from placed where id = c.post and kind = 'post';
    if found then
      x := p.x; y := p.y;
      radius := least(work_range(c), post_radius(p.ql));
      post := p.id;
      return next;
      return;
    end if;
  end if;
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if not found then return; end if;
  x := dd.x; y := dd.y; radius := work_range(c); post := null;
  return next;
end $function$;

-- A load round its keeper: the bin that takes it, then the nearest store with room, of storage in reach only.
select pg_temp.patch_fn('worker_store(uuid, creature, text, integer)',
$o$  select * into v_site from work_site(p_world, c);
  if v_site.x is null then return; end if;
$o$,
$o$  select * into v_site from work_site(p_world, c);
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
$o$);

-- The stores' items, scoped to storage in reach while a worker round its keeper settles.
select pg_temp.patch_fn('deed_store_items(uuid, uuid)',
$o$  with dd as materialized (
    select d.x, d.y, d.radius from my_deed(p_world, p_uid) d where d.world_id is not null
  ),$o$,
$o$  with sc as materialized (
    select q.a from (select around_scope(p_uid) as a) q where q.a is not null
  ),
  -- Round its keeper: storage in reach of them (`around_stores`) in place of the settlement's.
  ar as materialized (
    select s.* from sc cross join lateral around_stores(p_world, p_uid, (sc.a->>'x')::int, (sc.a->>'y')::int, (sc.a->>'r')::int) s
  ),
  dd as materialized (
    select d.x, d.y, d.radius from my_deed(p_world, p_uid) d where d.world_id is not null and not exists (select 1 from sc)
  ),$o$);
select pg_temp.patch_fn('deed_store_items(uuid, uuid)',
$o$  from ph join item i on i.placed = (ph.p).id and i.holder = 'furniture'
$o$,
$o$  from ph join item i on i.placed = (ph.p).id and i.holder = 'furniture'
  union all
  select 'crate', ar.id, ar.x, ar.y, ar.cx, ar.cy, i
  from ar join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = ar.id::int
  where ar.kind = 'crate'
  union all
  select 'furniture', ar.id, ar.x, ar.y, ar.cx, ar.cy, i
  from ar join item i on i.placed = ar.id and i.holder = 'furniture'
  where ar.kind = 'furniture'
$o$);

-- ---- Its step ----------------------------------------------------------------------------------------------------

-- Offline keeper: it goes back. The stores it reads are scoped to storage in reach while it settles, and no longer.
select pg_temp.patch_fn('worker_settle(uuid, integer)',
$o$  if not found or c.mode <> 'deed' then return 0; end if;
$o$,
$o$  if not found or c.mode <> 'deed' then return 0; end if;
  perform set_config('wildermon.around', '', true);
  -- Round a keeper who is offline: back where it came from (`around_end`).
  if c.around is not null and not keeper_awake(p_world, c.keeper) then
    perform around_end(p_world, p_id, 'Work around me stopped (offline)');
    return 0;
  end if;
$o$);
select pg_temp.patch_fn('worker_settle(uuid, integer)',
$o$  select * into v_site from work_site(p_world, c);
$o$,
$o$  select * into v_site from work_site(p_world, c);
  if c.around is not null and v_site.x is not null then
    perform set_config('wildermon.around', jsonb_build_object('uid', c.keeper, 'x', v_site.x, 'y', v_site.y, 'r', v_site.radius)::text, true);
  end if;
$o$);
select pg_temp.patch_fn('worker_settle(uuid, integer)',
$o$  return done;
end$o$,
$o$  perform set_config('wildermon.around', '', true);
  return done;
end$o$);
-- No storage in reach: it does not set out.
select pg_temp.patch_fn('worker_settle(uuid, integer)',
$o$    if worker_errand(kind) then
      -- Everything an errand asks about is on the row, so the row goes down
$o$,
$o$    if c.around is not null and c.phase = 'idle' and c.carrying is null
       and not exists (select 1 from around_stores(p_world, c.keeper, v_site.x, v_site.y, v_site.radius)) then
      c.from_x := cx; c.from_y := cy; c.to_x := cx; c.to_y := cy;
      c.idle_what := null; c.idle_why := 'nostore'; c.idle_n := v_site.radius;
      c.leg_at := now(); c.leg_ends := now();
      c.until := now() + interval '4 seconds';
      -- Off its ground, it wanders back in round its keeper while it waits, as an errand with nothing to run does.
      if greatest(abs(v_site.x + 0.5 - cx), abs(v_site.y + 0.5 - cy)) > v_site.radius then
        c.to_x := v_site.x + 0.5 + (hash_tile(p_id, guard, 601) * 2 - 1) * 3;
        c.to_y := v_site.y + 0.5 + (hash_tile(p_id, guard, 701) * 2 - 1) * 3;
        if not creature_tile_ok(p_world, floor(c.to_x)::int, floor(c.to_y)::int) then
          c.to_x := cx; c.to_y := cy;
        end if;
        c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, sqrt((c.to_x - cx) ^ 2 + (c.to_y - cy) ^ 2) / greatest(0.1, pace)));
        c.until := c.leg_ends + interval '4 seconds';
      end if;
      exit settle;
    end if;

    if worker_errand(kind) then
      -- Everything an errand asks about is on the row, so the row goes down
$o$);
-- A fetcher round its keeper sorts no settlement's stores.
select pg_temp.patch_fn('worker_settle(uuid, integer)',
$o$if spot.x is null and kind = 'fetch' and v_site.post is null then$o$,
$o$if spot.x is null and kind = 'fetch' and v_site.post is null and c.around is null then$o$);

-- An errand round its keeper: no settlement needed, the trades at the stores only, and room for what it makes.
select pg_temp.patch_fn('errand_step(uuid, integer, text)',
$o$  if not found then return; end if;
  kind := coalesce(p_kind, d.gathers);
$o$,
$o$  if not found and c.around is null then return; end if;
  kind := coalesce(p_kind, d.gathers);
  if c.around is not null and not around_trade(kind) then return; end if;
$o$);
select pg_temp.patch_fn('errand_step(uuid, integer, text)',
$o$      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
$o$,
$o$      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      if c.around is not null and not around_room(p_world, c, v_r.rid) then why := 'full'; why_n := null; return next; return; end if;
$o$);
select pg_temp.patch_fn('errand_do(uuid, integer, boolean, text)',
$o$    -- (a healing cover's herb).
    declare v_r record; r recipe; ri record; v_i int;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
$o$,
$o$    -- (a healing cover's herb).
    declare v_r record; r recipe; ri record; v_i int;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      -- Round its keeper, only with room in storage in reach for what it makes.
      if c.around is not null and not around_room(p_world, c, r.id) then return false; end if;
$o$);
-- What it makes round its keeper goes into storage in reach, never onto a tile's store or the ground: the pack after.
select pg_temp.patch_fn('worker_put(uuid, creature, text, integer, double precision, integer, integer, text, text)',
$o$     where cr.world_id = p_world and cr.x = p_x and cr.y = p_y
$o$,
$o$     where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and c.around is null
$o$);
select pg_temp.patch_fn('worker_put(uuid, creature, text, integer, double precision, integer, integer, text, text)',
$o$     where p.world_id = p_world and p.kind = 'furniture' and p.x = p_x and p.y = p_y
$o$,
$o$     where p.world_id = p_world and p.kind = 'furniture' and p.x = p_x and p.y = p_y and c.around is null
$o$);
select pg_temp.patch_fn('worker_put(uuid, creature, text, integer, double precision, integer, integer, text, text)',
$o$  perform drop_on_ground(p_world, p_x, p_y, p_def, p_ql, p_extra, p_count, p_cast);
end$o$,
$o$  if c.around is not null and c.keeper is not null then
    perform give(p_world, c.keeper, p_def, p_count, p_ql, p_extra, null, null, p_cast);
    return;
  end if;
  perform drop_on_ground(p_world, p_x, p_y, p_def, p_ql, p_extra, p_count, p_cast);
end$o$);

-- What its keeper is told: of them rather than the totem, and storage in reach rather than the settlement's.
select pg_temp.patch_fn('worker_idle(uuid, creature, text, integer, integer, integer, bigint)',
$o$case when p_post is not null then 'its work post' else 'the totem' end$o$,
$o$case when p_post is not null then 'its work post' when c.around is not null then 'you' else 'the totem' end$o$);
select pg_temp.patch_fn('worker_nowhere(uuid, creature)',
$o$|| ': settlement storage full.'$o$,
$o$|| case when c.around is not null then ': storage in reach full.' else ': settlement storage full.' end$o$);

-- ---- Its settlement slot ---------------------------------------------------------------------------------------------

-- Round its keeper, it takes no place on the settlement's roll.
create or replace function public.workers_on_deed(p_world uuid, p_uid uuid)
 returns integer
 language sql
 stable
as $function$
  select count(*)::int from creature c
   where c.world_id = p_world and c.keeper = p_uid and c.mode = 'deed' and c.post is null and c.around is null
$function$;

-- And one off it assigned to the settlement takes a place, as one off a post does, and is round its keeper no more.
select pg_temp.patch_fn('creature_refusal(uuid, uuid, text, jsonb)',
$o$    if c.mode <> 'deed' or c.post is not null then
      working := workers_on_deed(p_world, p_uid);$o$,
$o$    if c.mode <> 'deed' or c.post is not null or c.around is not null then
      working := workers_on_deed(p_world, p_uid);$o$);
select pg_temp.patch_fn('perform_creature(uuid, uuid, text, jsonb)',
$o$    update creature set mode = 'deed', keeper = p_uid, phase = 'idle',
        job = coalesce(nullif(p_target->>'job', ''), d.gathers),$o$,
$o$    update creature set mode = 'deed', keeper = p_uid, phase = 'idle', around = null,
        job = coalesce(nullif(p_target->>'job', ''), d.gathers),$o$);

-- ---- Going back ------------------------------------------------------------------------------------------------------

/**
 * Where a worker taken off its ground goes when it has nowhere of its own: into an empty wildermon crate in its
 * keeper's pack; else to their side, if nothing follows them; else to their settlement while it has a slot; else the
 * wild. `p_lead` begins what they are told: "Post pulled up", "Work around me stopped".
 */
create or replace function worker_return(p_world uuid, c creature, p_lead text) returns void
language plpgsql as $function$
declare dd deed; v_crate bigint; pl player;
begin
  if c.keeper is null then
    update creature set post = null, around = null, mode = 'wild', phase = 'idle' where world_id = p_world and id = c.id;
    return;
  end if;
  v_crate := empty_crate(p_world, c.keeper);
  if v_crate is not null then
    update creature set post = null, around = null, phase = 'idle', enemy = null, hunting = null where world_id = p_world and id = c.id;
    perform crate_shut_in(p_world, c.id, v_crate, null);
    perform wtell(p_world, c.keeper, p_lead || ': ' || c.name || ' into the wildermon crate in your pack.', 'system');
    return;
  end if;
  select * into pl from player where world_id = p_world and uid = c.keeper;
  if companion_of(p_world, c.keeper) is null and pl.uid is not null then
    update creature set post = null, around = null, mode = 'active', phase = 'idle', enemy = null, hunting = null,
        from_x = pl.x, from_y = pl.y, to_x = pl.x, to_y = pl.y,
        leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
      where world_id = p_world and id = c.id;
    perform wtell(p_world, c.keeper, p_lead || ': ' || c.name || ' returns to you.', 'system');
    return;
  end if;
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if dd.world_id is not null and workers_on_deed(p_world, c.keeper) < worker_cap(p_world, c.keeper) then
    update creature set post = null, around = null, mode = 'deed', phase = 'idle', enemy = null, hunting = null,
        from_x = dd.x + 0.5, from_y = dd.y + 1.5, to_x = dd.x + 0.5, to_y = dd.y + 1.5,
        leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
      where world_id = p_world and id = c.id;
    perform wtell(p_world, c.keeper, p_lead || ': ' || c.name || ' back to work at ' || dd.name || '.', 'system');
  else
    update creature set post = null, around = null, mode = 'wild', phase = 'idle' where world_id = p_world and id = c.id;
    perform wtell(p_world, c.keeper, p_lead || ': no empty wildermon crate, active slot taken, no settlement slot free. '
      || c.name || ' went wild.', 'error');
  end if;
end $function$;

create or replace function public.post_release(p_world uuid, p placed, p_why text)
 returns void
 language plpgsql
as $function$
declare c creature;
begin
  for c in select * from creature where world_id = p_world and post = p.id for update loop
    perform worker_return(p_world, c, 'Post ' || p_why);
  end loop;
end $function$;

/**
 * A worker round its keeper back where it came from. What is in its arms goes into storage in reach of its keeper,
 * else into their pack. Then into the crate it came out of, while that is empty and in their pack or standing; or to
 * following them, while nothing else does; or where a worker off a post goes (`worker_return`). False when it was
 * not round its keeper.
 */
create or replace function around_end(p_world uuid, p_id integer, p_lead text) returns boolean
language plpgsql as $function$
declare c creature; v_was jsonb; v_load jsonb; v_store record; v_in boolean; v_item bigint; v_placed bigint; pl player;
begin
  select * into c from creature where world_id = p_world and id = p_id for update;
  if not found or c.around is null then return false; end if;
  v_was := c.around;
  v_load := c.carrying;
  while v_load is not null loop
    select * into v_store from worker_store(p_world, c, v_load->>'def', coalesce((v_load->>'count')::int, 1));
    v_in := false;
    if v_store.id is not null and v_store.kind = 'crate' then
      v_in := crate_add(p_world, v_store.id::int, v_load->>'def', coalesce((v_load->>'count')::int, 1),
                        coalesce((v_load->>'ql')::double precision, 1), v_load->>'extra');
    elsif v_store.id is not null then
      v_in := furniture_add(p_world, v_store.id, v_load->>'def', coalesce((v_load->>'count')::int, 1),
                            coalesce((v_load->>'ql')::double precision, 1), v_load->>'extra');
    end if;
    if not v_in and c.keeper is not null then
      perform give(p_world, c.keeper, v_load->>'def', coalesce((v_load->>'count')::int, 1),
                   coalesce((v_load->>'ql')::double precision, 1), v_load->>'extra');
    end if;
    v_load := load_next(v_load);
  end loop;
  if c.bed is not null then update placed set sleeper = null where id = c.bed and sleeper = c.id; end if;
  update creature set carrying = null, fetching = null, work_x = null, work_y = null, way = null, bed = null,
      phase = 'idle', enemy = null, hunting = null, idle_why = null, idle_what = null, idle_n = null, idle_since = null
    where world_id = p_world and id = p_id;
  select * into c from creature where world_id = p_world and id = p_id;

  if v_was->>'was' = 'crate' then
    select i.id into v_item from item i
     where i.world_id = p_world and i.id = (v_was->>'item')::bigint and i.def = 'creature_crate' and i.creature is null
       and i.holder = 'player' and i.holder_uid = c.keeper and i.inside is null;
    select pc.id into v_placed from placed pc
     where pc.world_id = p_world and pc.id = (v_was->>'placed')::bigint and pc.kind = 'furniture'
       and pc.sub = 'creature_crate' and pc.creature is null;
    if v_item is not null or v_placed is not null then
      perform crate_shut_in(p_world, p_id, v_item, case when v_item is null then v_placed end);
      perform wtell(p_world, c.keeper, p_lead || ': ' || c.name || ' into its crate.', 'system');
      return true;
    end if;
  elsif v_was->>'was' = 'follow' and companion_of(p_world, c.keeper) is null then
    select * into pl from player where world_id = p_world and uid = c.keeper;
    if pl.uid is not null then
      update creature set mode = 'active', around = null,
          from_x = pl.x, from_y = pl.y, to_x = pl.x, to_y = pl.y,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        where world_id = p_world and id = p_id;
      perform wtell(p_world, c.keeper, p_lead || ': ' || c.name || ' follows you.', 'system');
      return true;
    end if;
  end if;
  perform worker_return(p_world, c, p_lead);
  return true;
end $function$;

/** Every worker round a keeper who is offline, back where it came from: a round's worth, off `creature_around`. */
create or replace function around_sweep(p_world uuid) returns integer language plpgsql as $function$
declare r record; n int := 0;
begin
  for r in
    select c.id from creature c
     where c.world_id = p_world and c.around is not null and not keeper_awake(p_world, c.keeper)
     order by c.id limit worker_sweep_most()
  loop
    begin
      if around_end(p_world, r.id, 'Work around me stopped (offline)') then n := n + 1; end if;
    exception when lock_not_available or deadlock_detected then null; -- held, or a ring: the next round's
    end;
  end loop;
  return n;
end $function$;

select pg_temp.patch_fn('world_tick()',
$o$trap_sweep(w.id) + post_sweep(w.id);$o$,
$o$trap_sweep(w.id) + post_sweep(w.id) + around_sweep(w.id);$o$);

-- ---- The two actions ---------------------------------------------------------------------------------------------------

create or replace function public.creature_action(p_action text)
 returns boolean
 language sql
 immutable
as $function$
  select p_action in ('examine_creature', 'tame', 'feed', 'groom', 'shear', 'milk_creature',
                      'set_stance', 'order_attack', 'order_heel', 'rename_creature', 'take_creature', 'crate_creature',
                      'crate_follow', 'crate_work',
                      'release_creature', 'cull_creature', 'assign_deed',
                      -- Work around me, and its Stop (`around_refusal`).
                      'work_around', 'stop_work_around')
      -- An ancient comb, file or pot used on one (`artifact_action`).
      or artifact_action(p_action)
      -- Wildermon gear fitted and taken off (`gear_action`).
      or gear_action(p_action)
$function$;

/**
 * Why a wildermon may not be set to work round you, or Stop asked of nothing: as a post takes one, one following you
 * within `post_follow_reach`, or one in a crate in your pack or standing within reach; of a trade worked round you.
 */
create or replace function around_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql as $function$
declare c creature; d species_def; v_kind text;
begin
  if p_action = 'stop_work_around' then
    if not exists (select 1 from creature q where q.world_id = p_world and q.keeper = p_uid and q.around is not null) then
      return 'Nothing works around you.';
    end if;
    return null;
  end if;
  c := target_creature(p_world, p_target);
  if c.world_id is null then return 'Gone.'; end if;
  select * into d from species_def where id = c.species;
  if c.mode = 'wild' or c.keeper is distinct from p_uid then return c.name || ' is not yours to set to work.'; end if;
  if c.hitched_to is not null or c.rider is not null then return c.name || ' is in harness.'; end if;
  if c.around is not null then return c.name || ' already works around you.'; end if;
  if c.mode = 'stored' then
    if not crate_to_hand(p_world, p_uid, c) then return c.name || ' is in a crate out of reach.'; end if;
  elsif c.mode <> 'active' then
    return c.name || ' is not following you.';
  elsif not creature_in_reach(p_world, p_uid, c, 4) then
    return c.name || ' is too far.';
  end if;
  v_kind := coalesce(c.job, d.gathers);
  if v_kind is null then return d.name || ': no task.'; end if;
  if not worker_job_ported(v_kind) then
    return 'Not on islands yet: ' || (select verb from gather_def where id = v_kind) || '.';
  end if;
  if not around_trade(v_kind) then
    return 'Settlement only: ' || (select verb from gather_def where id = v_kind) || '.';
  end if;
  return null;
end $function$;

/** Set one to work round you, out of its crate or off your heels; or Stop: every one round you back where it came from. */
create or replace function perform_around(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $function$
declare c creature; v_was jsonb; r record;
begin
  if p_action = 'stop_work_around' then
    for r in select q.id from creature q where q.world_id = p_world and q.keeper = p_uid and q.around is not null order by q.id loop
      perform around_end(p_world, r.id, 'Work around me stopped');
    end loop;
    return;
  end if;
  c := target_creature(p_world, p_target);
  if c.world_id is null then return; end if;
  if c.mode = 'stored' then
    v_was := jsonb_strip_nulls(jsonb_build_object('was', 'crate',
      'item', (select i.id from item i where i.world_id = p_world and i.creature = c.id and i.def = 'creature_crate' order by i.id limit 1),
      'placed', (select pc.id from placed pc where pc.world_id = p_world and pc.creature = c.id order by pc.id limit 1)));
    perform crate_let_out(p_world, c.id);
    select * into c from creature where world_id = p_world and id = c.id;
  else
    v_was := jsonb_build_object('was', 'follow');
  end if;
  update creature set mode = 'deed', around = v_was, post = null, phase = 'idle', enemy = null, hunting = null,
      work_x = null, work_y = null, fetching = null, way = null,
      idle_why = null, idle_what = null, idle_n = null, idle_since = null,
      from_x = creature_x(c), from_y = creature_y(c), to_x = creature_x(c), to_y = creature_y(c),
      leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
    where world_id = p_world and id = c.id;
  select * into c from creature where world_id = p_world and id = c.id;
  perform wtell(p_world, p_uid, 'Work around me: ' || c.name || ', '
    || (select g.verb from gather_def g where g.id = coalesce(c.job, (select s.gathers from species_def s where s.id = c.species)))
    || ' within ' || work_range(c) || ' tiles of you.', 'system');
end $function$;

select pg_temp.patch_fn('creature_refusal(uuid, uuid, text, jsonb)',
$o$  if p_action in ('crate_follow', 'crate_work') then
    return crate_open_refusal(p_world, p_uid, p_action, p_target);
  end if;
$o$,
$o$  if p_action in ('crate_follow', 'crate_work') then
    return crate_open_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- Work around me, and its Stop (`around_refusal`).
  if p_action in ('work_around', 'stop_work_around') then
    return around_refusal(p_world, p_uid, p_action, p_target);
  end if;
$o$);
select pg_temp.patch_fn('perform_creature(uuid, uuid, text, jsonb)',
$o$  if p_action in ('crate_follow', 'crate_work') then
    perform perform_crate_open(p_world, p_uid, p_action, p_target);
    return;
  end if;
$o$,
$o$  if p_action in ('crate_follow', 'crate_work') then
    perform perform_crate_open(p_world, p_uid, p_action, p_target);
    return;
  end if;
  if p_action in ('work_around', 'stop_work_around') then
    perform perform_around(p_world, p_uid, p_action, p_target);
    return;
  end if;
$o$);

-- ---- What its keeper's browser is told ------------------------------------------------------------------------------

select pg_temp.patch_fn('rpc_creatures(uuid, double precision, text, integer[], boolean)',
$o$'phase', c.phase, 'carrying', c.carrying,$o$,
$o$'phase', c.phase, 'carrying', c.carrying, 'around', c.around,$o$);
select pg_temp.patch_fn('rpc_creatures(uuid, double precision, text, integer[], boolean)',
$o$else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null,$o$,
$o$else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null, 'idleAround', c.around is not null,$o$);

select private.lock_doors();
