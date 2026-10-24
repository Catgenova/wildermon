set local lock_timeout = '3s';

-- Asked for: "Mounts and carts can go up staircases, but not single staircases". A mount goes where wheels go
-- (`Game.rideRule`, which walks the rider; the island trusts the walk to the share it allows, as it does a wagon's
-- up a wide staircase): indoors through an arch, a double door or a gate, up a finished wide staircase from its foot
-- and on the finished floors of a storey. A wildermon has no storey of its own, so the one it stands on is its
-- rider's; it is mounted and dismounted on the ground floor only, so nothing unridden is ever left up there.

/* Why a rider a storey up does not get down there (`MOUNT_STOREY_SAID`). */
create or replace function mount_storey_said() returns text language sql immutable as $$
  select 'Ride to the ground floor first: mount and dismount on the ground only.'::text
$$;

-- Mounted from the ground floor only, and dismounted there only.
do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('ride_refusal'::regproc);
  v_old := $$      if c.hitched_to is not null then return c.name || ' is in the traces.'; end if;
      if not creature_in_reach(p_world, p_uid, c) then return 'Stand next to ' || c.name || '.'; end if;
      if (driving(p_world, p_uid)).id is not null then$$;
  v_new := $$      if c.hitched_to is not null then return c.name || ' is in the traces.'; end if;
      -- From the ground floor only: nothing unridden stands a storey up (`Game.creatureStorey`).
      if not creature_in_reach(p_world, p_uid, c)
         or (select level from player where world_id = p_world and uid = p_uid) <> 0 then
        return 'Stand next to ' || c.name || '.';
      end if;
      if (driving(p_world, p_uid)).id is not null then$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'ride_refusal has % of the mount reach check, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $$    elsif p_action = 'hitch_creature' then$$;
  v_new := $$    elsif p_action = 'dismount_creature' then
      -- Not a storey up a wide staircase: the mount's storey is its rider's (`Game.creatureStorey`).
      if c.rider is not null and coalesce((select level from player where world_id = p_world and uid = c.rider), 0) > 0 then
        return mount_storey_said();
      end if;

    elsif p_action = 'hitch_creature' then$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'ride_refusal has % of the hitch branch, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- And the storey a ridden one is on, its rider's, for whoever draws it (`Creature.storey`): sent only under a rider.
do $do$
declare v_def text; v_old text := $$'hitchedTo', c.hitched_to)$$; v_n int;
begin
  v_def := pg_get_functiondef('rpc_creatures'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_creatures has % of hitchedTo, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || $$
      -- And the storey its rider rides it on, up a wide staircase (`Game.rideRule`).
      || case when c.rider is null then '{}'::jsonb
              else jsonb_build_object('storey', (select greatest(0, r.level) from player r where r.world_id = p_world and r.uid = c.rider)) end$$);
end $do$;

select private.lock_doors();
