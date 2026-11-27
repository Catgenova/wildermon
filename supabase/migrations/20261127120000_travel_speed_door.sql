-- Your pace, for a client that walks the body itself between words (`rpc_move`): the pace the island lets your body go
-- now (`travel_speed`: on foot, up on a mount by its kind, age, feeding, shoes and tack, at a cart's reins or a boat's
-- helm), for your own body only.
--
-- Asked for: "mount speed is what should perform when mounted, same with driving/sailing". The Unity client walked a
-- mounted, driving or sailing body at a walk; `travel_speed` is not a door (a client may not call it), so this is one:
--   * read only, for the body signed in (no uid is taken: nobody else's pace is told);
--   * paced as a look, and refused when asked too quickly.

create or replace function public.rpc_travel_speed(p_world uuid)
 returns double precision
 language plpgsql

 security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
begin
  perform private.pace(auth.uid(), 'look');
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  return travel_speed(p_world, me);
end $function$;

-- read as a look (`pace_class`, which `lock_doors` guards every door by)
create or replace function private.pace_class(p_door text)
 returns text
 language sql
 immutable
as $function$
  select case
    when p_door = 'rpc_move' then 'move'
    when p_door in ('rpc_barter', 'rpc_boards', 'rpc_built_window', 'rpc_chat', 'rpc_classes', 'rpc_clock', 'rpc_creatures', 'rpc_deals',
                    'rpc_faith', 'rpc_fog', 'rpc_ground', 'rpc_guide', 'rpc_guide_seen', 'rpc_join', 'rpc_land_window',
                    'rpc_letters', 'rpc_market', 'rpc_my_look', 'rpc_my_name', 'rpc_name_free', 'rpc_notices_ashore',
                    'rpc_orders', 'rpc_owner_am_i', 'rpc_owner_online', 'rpc_parcels', 'rpc_prices', 'rpc_sales',
                    'rpc_rune_gate_folk', 'rpc_settle', 'rpc_settlement', 'rpc_social', 'rpc_spells', 'rpc_springs',
                    'rpc_store_log', 'rpc_swirls', 'rpc_treasure_map', 'rpc_treasure_warm', 'rpc_travel_speed', 'rpc_tree',
                    'rpc_unported', 'rpc_worn') then 'look'
    when p_door in ('rpc_abandon', 'rpc_barter_accept', 'rpc_barter_answer', 'rpc_barter_ask', 'rpc_barter_cancel',
                    'rpc_barter_offer', 'rpc_buy', 'rpc_collect', 'rpc_deal', 'rpc_deal_answer', 'rpc_found',
                    'rpc_friend', 'rpc_unfriend', 'rpc_invite', 'rpc_invite_answer', 'rpc_join_answer', 'rpc_join_ask',
                    'rpc_join_withdraw', 'rpc_leave_deed', 'rpc_letter', 'rpc_parcel', 'rpc_notice_post',
                    'rpc_notice_drop', 'rpc_order', 'rpc_order_cancel', 'rpc_order_fill', 'rpc_price', 'rpc_takings',
                    'rpc_say', 'rpc_report_error') then 'deal'
    when p_door in ('rpc_put_land', 'rpc_ready') then 'land'
    else 'act' end
$function$;
select private.lock_doors();
