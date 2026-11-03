-- A water mote set in an aqueduct: a spring at its head, with no spring dug.
--
-- Asked: "Aqueduct source -- a water mote set in an aqueduct gives a spring at its head, with no dug spring
-- needed." Set a water mote (`set_aqueduct_mote`, the browser's `moteRefusal` and its action in
-- `src/game/aqueducts.ts`), on a finished aqueduct no water runs along yet, from within `bridge_pull_reach` of its
-- head, takes one water mote and puts a spring at the head tile -- rising in its pool, or at the bottom of the hollow
-- it is in (`mote_corner`) -- settled as any spring is (`settle_spring`), so everything an aqueduct fed by a dug
-- spring does -- a fountain kept, a pool or a hollow at its foot filled, the water running on -- it does the same. The spring is kept with the aqueduct (`spring.mote_in`): not one of the
-- springs a body keeps (`springs_each`), not stopped up with a shovel, and gone when the aqueduct is pulled down
-- (or goes any other way: the key cascades). What feeds an aqueduct is said by the spring that does, first by id
-- (`aqueduct_fed_by`): "spring at x, y" or "water mote at x, y".
--
-- `supabase/test/aqueduct.ts` holds the two sides to one another.
set local lock_timeout = '3s';

-- Nullable, no default: no table rewrite. The key is added unchecked and checked after, under the lighter lock.
alter table spring add column if not exists mote_in bigint;
alter table spring drop constraint if exists spring_mote_in_fkey;
alter table spring add constraint spring_mote_in_fkey foreign key (world_id, mote_in) references bridge (world_id, id)
  on delete cascade not valid;
alter table spring validate constraint spring_mote_in_fkey;
create index if not exists spring_mote_in on spring (world_id, mote_in) where mote_in is not null;

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

-- The aqueduct's own family of doors takes the job.
create or replace function aqueduct_action(p_action text) returns boolean language sql immutable as $$
  select p_action in ('plan_aqueduct', 'build_aqueduct', 'set_aqueduct_mote', 'demolish_aqueduct')
$$;

/*
 * What feeds an aqueduct: the first spring by id whose water runs along it, by the tile it is in, a water mote set
 * in an aqueduct by that aqueduct's head; null while none runs. The browser's `fedBy`.
 */
create or replace function aqueduct_fed_by(p_world uuid, p_bridge bigint) returns text language sql stable as $$
  select case when s.mote_in is not null then 'water mote' else 'spring' end || ' at ' || s.x || ', ' || s.y
    from aqueduct_feed f join spring s on s.id = f.spring_id
   where f.world_id = p_world and f.bridge_id = p_bridge
   order by s.id limit 1
$$;

/*
 * The corner a water mote set at an aqueduct's head rises at: in a pool, the tile's lowest (`spring_corner`), as a
 * spring dug there; elsewhere downhill from that corner, to the lowest of its four neighbours lower than it (by y,
 * then x, among equals), until none is: the bottom of the hollow its water stood in. A head is any tile a pond covers
 * a corner of, and a spring dug at a corner with lower ground beside it would only run off. The browser's
 * `Springs.moteCorner`.
 */
create or replace function mote_corner(p_world uuid, p_x int, p_y int) returns int[] language plpgsql stable as $$
declare c int[] := spring_corner(p_world, p_x, p_y); v_slab foundation; v_size int; nxt int[];
begin
  v_slab := slab_at(p_world, p_x, p_y);
  if v_slab.id is not null and v_slab.pool then return c; end if;
  select size into v_size from world where id = p_world;
  loop
    nxt := null;
    select array[v.x, v.y] into nxt from (values (c[1], c[2] - 1), (c[1] - 1, c[2]), (c[1] + 1, c[2]), (c[1], c[2] + 1)) v(x, y)
     where v.x between 0 and v_size and v.y between 0 and v_size
       and land_height(p_world, v.x, v.y) < land_height(p_world, c[1], c[2])
     order by land_height(p_world, v.x, v.y), v.y, v.x limit 1;
    if nxt is null then return c; end if;
    c := nxt;
  end loop;
end $$;

-- Setting a water mote: finished, not fed already, from its head; whose ground, as pulling it down; a water mote to
-- hand; and a spring at its head that would run along it. The browser's `moteRefusal`, in its order.
select pg_temp.patch_fn('public.aqueduct_refusal(uuid,uuid,text,jsonb)'::regprocedure,
$o$declare v_rank text; p player; b bridge; s bridge_span; v_short text;$o$,
$n$declare v_rank text; p player; b bridge; s bridge_span; v_short text; v_c int[]; v_chain jsonb;$n$);
select pg_temp.patch_fn('public.aqueduct_refusal(uuid,uuid,text,jsonb)'::regprocedure,
$o$  if sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach()
     and sqrt($o$,
$n$  if p_action = 'set_aqueduct_mote' then
    if bridge_left(p_world, b.id) > 0 then return 'Finish the aqueduct first.'; end if;
    v_short := aqueduct_fed_by(p_world, b.id);
    if v_short is not null then return 'Already fed: ' || v_short || '.'; end if;
    if sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach() then
      return 'Stand at its head.';
    end if;
  elsif sqrt((b.ax + 0.5 - p.x) ^ 2 + (b.ay + 0.5 - p.y) ^ 2) > bridge_pull_reach()
     and sqrt($n$);
select pg_temp.patch_fn('public.aqueduct_refusal(uuid,uuid,text,jsonb)'::regprocedure,
$o$        || lower((select a.label from action_def a where a.id = p_action)) || ' there.');
  end if;
  return null;$o$,
$n$        || lower((select a.label from action_def a where a.id = p_action)) || ' there.');
  end if;
  if p_action = 'set_aqueduct_mote' then
    if pack_count(p_world, p_uid, water_mote()) < water_motes_each() then return water_mote_need(); end if;
    v_c := mote_corner(p_world, b.ax, b.ay);
    v_chain := settle_water(p_world, v_c[1], v_c[2], b.ax, b.ay);
    if v_chain ? 'refused' or not exists (select 1 from jsonb_array_elements(v_chain->'streams') st
                                           where st ? 'via' and (st->>'via')::bigint = b.id) then
      return 'No water would run along it from its head at ' || metres(b.height) || ' m.';
    end if;
  end if;
  return null;$n$);

-- Set: the mote used up, and a spring at the head kept with the aqueduct, settled as one dug there; said as the last
-- span laid is (`aqueduct_says`). Pulled down: the spring set in it goes with it, and its head spills again only where
-- a spring's water reached it.
select pg_temp.patch_fn('public.perform_aqueduct(uuid,uuid,text,jsonb)'::regprocedure,
$o$declare b bridge; s bridge_span;$o$,
$n$declare b bridge; s bridge_span; v_c int[];$n$);
select pg_temp.patch_fn('public.perform_aqueduct(uuid,uuid,text,jsonb)'::regprocedure,
$o$  -- Pulling it down: half of what went into it back, as with a bridge, and the springs that ran along it settled again.
  v_ran := bridge_left(p_world, b.id) = 0
           and exists (select 1 from aqueduct_feed f where f.world_id = p_world and f.bridge_id = b.id);$o$,
$n$  if p_action = 'set_aqueduct_mote' then
    if aqueduct_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
    if not consume(p_world, p_uid, water_mote(), water_motes_each()) then return; end if;
    v_c := mote_corner(p_world, b.ax, b.ay);
    insert into spring (world_id, x, y, cx, cy, made_by, mote_in) values (p_world, b.ax, b.ay, v_c[1], v_c[2], p_uid, b.id)
      returning id into v_id;
    perform settle_spring(p_world, v_id);
    perform journal_note(p_world, p_uid, 'aqueduct');
    perform tell(p_world, p_uid, 'Water mote set.' || substr(aqueduct_says(p_world, b), length('Last span laid.') + 1), 'event');
    return;
  end if;
  -- Pulling it down: half of what went into it back, as with a bridge, and the springs that ran along it settled again.
  v_ran := bridge_left(p_world, b.id) = 0
           and exists (select 1 from aqueduct_feed f where f.world_id = p_world and f.bridge_id = b.id
                         and not exists (select 1 from spring m where m.id = f.spring_id and m.mote_in = b.id));$n$);
select pg_temp.patch_fn('public.perform_aqueduct(uuid,uuid,text,jsonb)'::regprocedure,
$o$  delete from bridge_span where world_id = p_world and bridge = b.id;
  delete from bridge where world_id = p_world and id = b.id;$o$,
$n$  perform aqueduct_unfeed(p_world, m.id) from spring m where m.world_id = p_world and m.mote_in = b.id;
  delete from spring where world_id = p_world and mote_in = b.id;
  delete from bridge_span where world_id = p_world and bridge = b.id;
  delete from bridge where world_id = p_world and id = b.id;$n$);

-- A water mote in an aqueduct is not stopped up with a shovel, and is not one of the springs a body keeps.
select pg_temp.patch_fn('public.spring_refusal(uuid,uuid,text,jsonb)'::regprocedure,
$o$    if not found then return 'No spring here.'; end if;$o$,
$n$    if not found then return 'No spring here.'; end if;
    if s.mote_in is not null then return 'Water mote in the aqueduct: stops when the aqueduct is pulled down.'; end if;$n$);
select pg_temp.patch_fn('public.spring_refusal(uuid,uuid,text,jsonb)'::regprocedure,
$o$(select count(*) from spring where world_id = p_world and made_by = p_uid)$o$,
$n$(select count(*) from spring where world_id = p_world and made_by = p_uid and mote_in is null)$n$);

-- The browser is told which springs are water motes set in an aqueduct, for its menu (`Spring.moteIn`).
select pg_temp.patch_fn('public.rpc_springs(uuid,double precision,jsonb)'::regprocedure,
$o$'mine', coalesce(s.made_by = me, false), 'ver', s.ver, 'chain', s.chain)$o$,
$n$'mine', coalesce(s.made_by = me, false), 'ver', s.ver, 'chain', s.chain, 'mote_in', s.mote_in)$n$);

select private.lock_doors();
