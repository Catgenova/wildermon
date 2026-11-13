-- A helm can be hidden: the head slot left off your body as everybody draws it.
--
-- Asked for: a setting to always hide the helm slot, so a player's face and hair show, and what other players see
-- shows the same.
--
-- `player.hide_helm`: null until the browser has said, then what its setting says (`rpc_look_prefs`, the browser's
-- `hideHelm`). What is worn is unchanged: the helm is still on, still soaks the blows that land on the head, still
-- weighs what it weighs. Only the gear the island hands round for drawing leaves it out: `rpc_worn` drops the head slot
-- of anybody who hides it, as the body message from their own browser does.

set local lock_timeout = '3s';

alter table player add column if not exists hide_helm boolean;

create or replace function rpc_look_prefs(p_world uuid, p_hide_helm boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p player;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  update player
     set hide_helm = coalesce(p_hide_helm, hide_helm)
   where world_id = p_world and uid = me
  returning * into p;
  if not found then raise exception 'you are not on that island'; end if;
  return jsonb_build_object('hide_helm', p.hide_helm);
end $$;

create or replace function rpc_worn(p_world uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  perform private.pace(auth.uid(), 'look');
  if me is null then raise exception 'not signed in'; end if;
  if not private.on_island(p_world) then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(p.uid::text, w.gear)
      from player p
      cross join lateral (
        select jsonb_object_agg(e.key, jsonb_build_array(i.def,
                 case i.rare when 'rare' then 1 when 'supreme' then 2 when 'fantastic' then 3 else 0 end,
                 i.extra, i.dye)) as gear
          from jsonb_each(p.equipped) e
          join item i on i.id = case when jsonb_typeof(e.value) = 'number' then (e.value)::text::bigint end
                     and i.world_id = p_world
                     and i.holder = 'player' and i.holder_uid = p.uid
         where not (e.key = 'head' and coalesce(p.hide_helm, false))
      ) w
     where p.world_id = p_world and not p.away and w.gear is not null
  ), '{}'::jsonb);
end $$;

select private.lock_doors();
