set local lock_timeout = '3s';

-- Asked for: "add a button in Settings called "I'm stuck" that will teleport the player to the ground floor". Your
-- body to the ground floor of the tile it stands on: from any storey up, and from a cellar. Not across the island:
-- the same tile, the ground under it. Aboard a boat, refused: a deck is no storey.

create or replace function rpc_unstick(p_world uuid) returns jsonb
  language plpgsql security definer set search_path = public as $function$
declare me uuid := auth.uid(); p player;
begin
  perform private.pace(auth.uid(), 'act');
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('why', 'You are not on this island.'); end if;
  if p.aboard is not null then return jsonb_build_object('why', 'Aboard: step ashore first.'); end if;
  if p.level = 0 then return jsonb_build_object('why', 'On the ground floor already.'); end if;
  update player set level = 0, level_h = null, moved_at = now()
   where world_id = p_world and uid = me;
  perform tell(p_world, me, 'Moved: ground floor, ' || floor(p.x)::int || ', ' || floor(p.y)::int || '.', 'system');
  return jsonb_build_object('level', 0);
end $function$;

select private.lock_doors();
