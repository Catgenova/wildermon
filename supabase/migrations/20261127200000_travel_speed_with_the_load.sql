-- Your pace with your load: rpc_travel_speed as rpc_move reckons a body's pace (`travel_speed`, and a crawl, `carry_crawl`,
-- past half again over what it carries, `carry_stop`, outside a Surge). A client that walks the body itself between
-- words walked an overladen body at its full pace, and the island held it back to a crawl word by word: pulled back
-- again and again. Asked for: "I Got Down from my mount and still move at mounted speed, which is causing rubberbanding".

create or replace function public.rpc_travel_speed(p_world uuid)
 returns double precision
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  p player;
begin
  perform private.pace(auth.uid(), 'look');
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  return travel_speed(p_world, me)
    * case when over_carry(p_world, me) > carry_stop() and not coalesce((p.blessings->'path_surge'->>'until')::timestamptz > now(), false)
           then carry_crawl() else 1 end;
end $function$;

select private.lock_doors();
