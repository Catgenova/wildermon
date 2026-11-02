-- Asked: "Show purple squares on the map for settlements". Every settlement on the island, its token tile and its
-- border, for the map (`minimap.ts`): its name, and whether it is yours (founded, or on its roll) as the ground read
-- says it. The ground read only brings the settlements in reach; this is all of them, asked for when the map is open.
create or replace function public.rpc_settlements(p_world uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid();
begin
  perform private.pace(auth.uid(), 'look');
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  return jsonb_build_object('deeds', coalesce((select jsonb_agg(jsonb_build_object(
      'name', d.name, 'x', d.x, 'y', d.y, 'radius', d.radius,
      'mine', d.founded_by = me or exists (select 1 from deed_member m where m.world_id = p_world
                                             and m.uid = me and m.founder = d.founded_by))
    order by d.founded_at, d.name)
    from deed d where d.world_id = p_world), '[]'::jsonb));
end $fn$;

select private.lock_doors();
