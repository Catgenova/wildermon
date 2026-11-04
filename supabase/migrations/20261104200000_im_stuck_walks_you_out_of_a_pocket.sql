-- I'm stuck, on the ground: out of a pocket no walk leaves.
--
-- Reported: "every time I move I rubber band back ... my position may have desynced onto a cliff. Mounted or unmounted
-- now i cant ascend or descend due to grade of the cliff." catgenova, at 578, 2707 on the live island: a walk from
-- there reached one tile more (577, 2707) and every other neighbour was held short by the step up, the drop or a tile
-- too steep to stand on (`walk_share`). A body can come to stand somewhere no walk leaves: a mount's legs taken
-- away, a lagged word that landed it on a ledge, ground changed round it. `rpc_unstick` (Settings, "I'm stuck") put a
-- body on the ground floor of its tile and said "On the ground floor already." on the ground.
--
-- On the ground it now asks where a walk from the body's tile gets to, tile centre to tile centre on its own feet or
-- legs (`walk_share`), as far as `unstick_reach` tiles out. When a walk gets that far there is a way off: refused,
-- "Not stuck: a walk gets off this ground." When none does, the body goes to the nearest tile within `unstick_search`
-- outside that pocket from which a walk gets `unstick_reach` out; with none, to its settlement's totem or where
-- newcomers come ashore, as a keeper's move puts it. On a saddle or the reins: refused, the step being the beast's.
-- The browser hears it as a keeper's move (`moved`) and from the answer (`unstick`, src/net/island.ts).

set local lock_timeout = '3s';

create or replace function public.unstick_reach() returns integer language sql immutable as $$ select 4 $$;
create or replace function public.unstick_search() returns integer language sql immutable as $$ select 8 $$;

/*
 * Where a walk from tile (p_x, p_y) gets, tile centre to tile centre through the eight neighbours, on the ground and
 * the body's own feet or legs (`walk_share` the whole way). `escaped` once it reaches a tile `p_reach` out; `pocket`
 * the tiles it reached (x * 8192 + y), all of them when it did not escape.
 */
create or replace function private.walks_out(p_world uuid, p_uid uuid, p_x integer, p_y integer, p_reach integer,
                                            out escaped boolean, out pocket bigint[])
language plpgsql stable as $f$
declare v_size int; q bigint[]; i int := 1; cx int; cy int; nx int; ny int; k bigint;
begin
  escaped := false;
  select size into v_size from world where id = p_world;
  q := array[p_x::bigint * 8192 + p_y];
  pocket := q;
  while i <= array_length(q, 1) loop
    cx := (q[i] / 8192)::int; cy := (q[i] % 8192)::int;
    i := i + 1;
    if greatest(abs(cx - p_x), abs(cy - p_y)) >= p_reach then escaped := true; return; end if;
    for dx in -1 .. 1 loop
      for dy in -1 .. 1 loop
        continue when dx = 0 and dy = 0;
        nx := cx + dx; ny := cy + dy;
        continue when nx < 0 or ny < 0 or nx >= v_size or ny >= v_size;
        k := nx::bigint * 8192 + ny;
        continue when k = any(pocket);
        if walk_share(p_world, p_uid, 0, cx + 0.5, cy + 0.5, nx + 0.5, ny + 0.5) >= 1 then
          pocket := pocket || k;
          q := q || k;
        end if;
      end loop;
    end loop;
  end loop;
end $f$;

create or replace function public.rpc_unstick(p_world uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare me uuid := auth.uid(); p player; w world; d deed; v_out record; v_x int; v_y int; v_to double precision[];
        v_where text; c record;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('why', 'You are not on this island.'); end if;
  if p.aboard is not null then return jsonb_build_object('why', 'Aboard: step ashore first.'); end if;
  if p.level <> 0 then
    update player set level = 0, level_h = null, moved_at = now()
     where world_id = p_world and uid = me;
    perform tell(p_world, me, 'Moved: ground floor, ' || floor(p.x)::int || ', ' || floor(p.y)::int || '.', 'system');
    return jsonb_build_object('level', 0);
  end if;

  -- On the ground: out of a pocket no walk leaves, on your own feet.
  if (mount_of(p_world, me)).id is not null then return jsonb_build_object('why', 'Riding: dismount first.'); end if;
  if (driving(p_world, me)).id is not null then return jsonb_build_object('why', 'Driving: let go of the reins first.'); end if;
  v_x := floor(p.x)::int; v_y := floor(p.y)::int;
  select * into v_out from private.walks_out(p_world, me, v_x, v_y, unstick_reach());
  if v_out.escaped then return jsonb_build_object('why', 'Not stuck: a walk gets off this ground.'); end if;

  -- The nearest tile outside the pocket, within `unstick_search`, from which a walk gets out.
  select * into w from world where id = p_world;
  for c in select v_x + dx as x, v_y + dy as y
             from generate_series(-unstick_search(), unstick_search()) dx, generate_series(-unstick_search(), unstick_search()) dy
            where (dx <> 0 or dy <> 0) and v_x + dx between 0 and w.size - 1 and v_y + dy between 0 and w.size - 1
            order by dx * dx + dy * dy, dy, dx loop
    continue when (c.x::bigint * 8192 + c.y) = any(v_out.pocket);
    continue when water_over(p_world, c.x, c.y);
    if (private.walks_out(p_world, me, c.x, c.y, unstick_reach())).escaped then
      v_to := array[c.x + 0.5, c.y + 0.5];
      v_where := c.x || ', ' || c.y;
      exit;
    end if;
  end loop;
  -- None near: home, as a keeper's move puts a body (`rpc_owner_move`).
  if v_to is null then
    select * into d from deed where world_id = p_world and founded_by = me;
    if found then
      v_to := array[d.x + 0.5, d.y + 0.5];
      v_where := 'totem of ' || d.name || ', ' || d.x || ', ' || d.y;
    else
      v_to := array[w.spawn_x + 0.5, w.spawn_y + 0.5];
      v_where := 'landing, ' || w.spawn_x || ', ' || w.spawn_y;
    end if;
  end if;
  update player set x = v_to[1], y = v_to[2], level = 0, level_h = null, moved_at = now(), walk_ahead = 0
   where world_id = p_world and uid = me;
  perform drag_along(p_world, me, v_to[1], v_to[2]);
  perform tell(p_world, me, 'Moved: ' || v_where || '.', 'system');
  if private.here(p_world, me) then
    perform private.send('own:' || p_world || ':' || me, 'moved', jsonb_build_object('x', v_to[1], 'y', v_to[2], 'level', 0));
  end if;
  return jsonb_build_object('x', v_to[1], 'y', v_to[2], 'level', 0);
end $f$;

revoke execute on function private.walks_out(uuid, uuid, integer, integer, integer) from public;

select private.lock_doors();
