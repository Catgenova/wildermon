set local lock_timeout = '3s';

-- Reported: "I can't mount what's right next to me", told "Stand next to Moonhare." from storey 2 with it on the
-- ground under them. A mount is mounted from the ground floor only; the refusal now says so, and the storey you are
-- on: "Mount: ground floor only. You: storey 2." (`mountGroundSaid`).

/* Why a mount is not mounted from where you stand (`mountGroundSaid`). */
create or replace function mount_ground_said(p_who text, p_level int) returns text language sql immutable as $$
  select 'Mount: ground floor only. ' || p_who || ': '
    || case when p_level < 0 then 'cellar' else 'storey ' || (p_level + 1) end || '.'
$$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('ride_refusal'::regproc);
  v_old := $$      if not creature_in_reach(p_world, p_uid, c)
         or (select level from player where world_id = p_world and uid = p_uid) <> 0 or c.storey <> 0 then
        return 'Stand next to ' || c.name || '.';
      end if;$$;
  v_new := $$      if not creature_in_reach(p_world, p_uid, c) then return 'Stand next to ' || c.name || '.'; end if;
      if (select level from player where world_id = p_world and uid = p_uid) <> 0 then
        return mount_ground_said('You', (select level from player where world_id = p_world and uid = p_uid));
      end if;
      if c.storey <> 0 then return mount_ground_said(c.name, c.storey); end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'ride_refusal has % of the mount storey check, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
