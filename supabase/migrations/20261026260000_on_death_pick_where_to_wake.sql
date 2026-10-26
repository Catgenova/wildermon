/*
 * On death, pick where to wake: a Runestone or a settlement of yours.
 *
 * Asked for: "show that screen [the first join's Runestone picker] on death,
 * with an indicator of how far each rune is from your corpse, or an option to
 * respawn at your deed token or one you belong to".
 *
 * Death is as it was: `player_die` buries what was carried where the body
 * fell, wakes it whole on the island's spawn and says so. Now it also keeps
 * where the body fell, and the tile it woke on, in `private.fallen`. While the
 * body is still on that tile -- on the ground floor, aboard nothing -- it may
 * pick, once (`respawn_fall`):
 *
 *   * every beat's answer carries the offer (`rpc_settle`'s `fallen`,
 *     `respawn_offer`): where the body fell, and each settlement it may wake
 *     at (`deeds_of`: the one it founded, then each it is a citizen of), by
 *     name, token and level. A body that has left that tile has its offer
 *     taken away there, so walking back onto it brings none;
 *   * `rpc_respawn(p_world, p_at)` takes the pick: a Runestone's id, `deed:`
 *     and a founder's id, or `stay`. Anything else is refused at the door
 *     (`private.bad_request`). A body with no offer is refused, and so is a
 *     settlement it neither founded nor is a citizen of. A stone puts it on
 *     the first free tile of the ring a first join starts on round that stone
 *     (`start_landing`); a settlement, on the first free tile of
 *     `respawn_ring` round its token (`respawn_landing`), free by the same
 *     terms. With none free the pick is refused and the offer stays. `stay`
 *     takes the offer away and leaves the body where it is. The pick is said
 *     in the log and to the body's other tabs, as a Telestone's journey is.
 *
 * Never picking -- a closed tab, a step off the tile -- leaves the body on the
 * spawn, as before. What death takes and gives back is unchanged.
 */
set local lock_timeout = '3s';

/* Where each body fell last, and the tile death woke it on. Read by the doors only. */
create table if not exists private.fallen (
  world_id uuid not null,
  uid uuid not null,
  -- Where the body fell.
  x double precision not null,
  y double precision not null,
  -- The tile death woke it on: the island's spawn.
  wx int not null,
  wy int not null,
  at timestamptz not null default now(),
  primary key (world_id, uid)
);
alter table private.fallen enable row level security;
revoke all on table private.fallen from public, anon, authenticated;

/** The body's fall, while it may still pick where to wake: on the tile death woke it on, on the ground floor, aboard nothing. */
create or replace function private.respawn_fall(p_world uuid, p_uid uuid) returns private.fallen
  language sql stable as $$
  select f.* from private.fallen f
    join player p on p.world_id = f.world_id and p.uid = f.uid
   where f.world_id = p_world and f.uid = p_uid
     and floor(p.x)::int = f.wx and floor(p.y)::int = f.wy and coalesce(p.level, 0) = 0 and p.aboard is null
$$;

/**
 * Where a body waking at a settlement wakes: the first tile of `respawn_ring`
 * round its token free by `telestone_landing`'s terms -- on the map, a tile a
 * body can stand on, no stone's, dry, no steeper than `landing_stand` and
 * under no building. None when there is none.
 */
create or replace function respawn_landing(p_world uuid, p_x int, p_y int) returns table (x int, y int)
  language sql stable as $$
  select p_x + r.dx, p_y + r.dy
    from world w
    cross join respawn_ring() r
   where w.id = p_world
     and passable(p_world, p_x + r.dx, p_y + r.dy)
     and runestone_on(w.size, p_x + r.dx, p_y + r.dy) is null
     and not has_water(p_world, p_x + r.dx, p_y + r.dy)
     and tile_slope(p_world, p_x + r.dx, p_y + r.dy) <= landing_stand()
     and building_at(p_world, p_x + r.dx, p_y + r.dy) is null
   order by r.k
   limit 1
$$;
revoke all on function respawn_landing(uuid, int, int) from public, anon, authenticated;

/**
 * The offer, for the beat: where the body fell and each settlement it may
 * wake at, or null when it has none. A fall whose body has left the tile it
 * woke on is taken away here.
 */
create or replace function respawn_offer(p_world uuid, p_uid uuid) returns jsonb
  language plpgsql as $$
declare f private.fallen;
begin
  if not exists (select 1 from private.fallen where world_id = p_world and uid = p_uid) then return null; end if;
  f := private.respawn_fall(p_world, p_uid);
  if f.uid is null then
    delete from private.fallen where world_id = p_world and uid = p_uid;
    return null;
  end if;
  return jsonb_build_object('x', f.x, 'y', f.y, 'deeds', coalesce((
    select jsonb_agg(jsonb_build_object('id', d.founded_by, 'name', d.name, 'x', d.x, 'y', d.y, 'level', d.level,
                                        'own', d.founded_by = p_uid))
      from deeds_of(p_world, p_uid) d), '[]'::jsonb));
end $$;
revoke all on function respawn_offer(uuid, uuid) from public, anon, authenticated;

/**
 * Where a body that died wakes, picked: `p_at` a Runestone's id, `deed:` and a
 * founder's id, or `stay`. The answer is where the body is, or `why` not.
 */
create or replace function rpc_respawn(p_world uuid, p_at text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f private.fallen; d deed; v_x int; v_y int; v_name text; p player;
begin
  if p_at is null or not (p_at = 'stay'
       or exists (select 1 from runestones() r where r.id = p_at)
       or p_at ~* '^deed:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    perform private.bad_request('rpc_respawn', 'p_at: not a Runestone, a settlement or stay');
  end if;
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  perform 1 from private.fallen where world_id = p_world and uid = me for update;
  f := private.respawn_fall(p_world, me);
  if f.uid is null then
    return jsonb_build_object('why', 'Respawn: only after a death, before moving.');
  end if;
  if p_at = 'stay' then
    delete from private.fallen where world_id = p_world and uid = me;
    select * into p from player where world_id = p_world and uid = me;
    return jsonb_build_object('x', p.x, 'y', p.y, 'level', coalesce(p.level, 0));
  end if;
  if p_at like 'deed:%' then
    select * into d from deeds_of(p_world, me) o where o.founded_by::text = lower(substr(p_at, 6));
    if d.founded_by is null then
      return jsonb_build_object('why', 'Respawn: not your settlement.');
    end if;
    select l.x, l.y into v_x, v_y from respawn_landing(p_world, d.x, d.y) l;
    v_name := d.name;
  else
    select l.x, l.y into v_x, v_y from start_landing(p_world, p_at) l;
    v_name := (select r.name from runestones() r where r.id = p_at);
  end if;
  if v_x is null then
    return jsonb_build_object('why', 'Respawn: no free tile at ' || v_name || '.');
  end if;
  update player set x = v_x + 0.5, y = v_y + 0.5, level = 0, moved_at = now(), seen_at = now(), away = false
   where world_id = p_world and uid = me;
  delete from private.fallen where world_id = p_world and uid = me;
  perform tell(p_world, me, 'Respawned: ' || v_name || '.', 'event');
  if private.here(p_world, me) then
    perform private.send('own:' || p_world || ':' || me, 'moved',
      jsonb_build_object('x', v_x + 0.5, 'y', v_y + 0.5, 'level', 0));
  end if;
  return jsonb_build_object('x', v_x + 0.5, 'y', v_y + 0.5, 'level', 0);
end $$;

/* `player_die` keeps where the body fell, and the tile it wakes on, before anything moves it. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.player_die(uuid,uuid)'::regprocedure);
  -- Run once already.
  if position('private.fallen' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$  v_said := bury(p_world, p_uid);
$$, $$  insert into private.fallen as f (world_id, uid, x, y, wx, wy, at)
  select p_world, p_uid, p.x, p.y, w.spawn_x, w.spawn_y, now()
    from player p where p.world_id = p_world and p.uid = p_uid
  on conflict (world_id, uid) do update set x = excluded.x, y = excluded.y, wx = excluded.wx, wy = excluded.wy, at = excluded.at;
  v_said := bury(p_world, p_uid);
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'player_die: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* The beat carries the offer. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.rpc_settle(bigint,uuid,bigint,boolean,jsonb)'::regprocedure);
  if position('respawn_offer' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$    'skin', skin_said(v_world, p.stats)));
$$, $$    'skin', skin_said(v_world, p.stats))
    -- Where the body fell and the settlements it may wake at, while it may pick (`respawn_offer`).
    || jsonb_build_object('fallen', respawn_offer(v_world, me)));
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'rpc_settle: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
