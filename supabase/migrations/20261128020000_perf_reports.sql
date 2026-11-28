/*
 * How the Unity client ran, written down where somebody can read it.
 *
 * Asked for: "we need that better way of receiving and breaking down performance reports from normal play". The
 * Unity client times every frame (PerfOverlay.cs); a frame that spikes, and each minute, were written only to the log
 * of the machine it ran on. Now every ten minutes it sends those minutes and its worst spikes here, with its build,
 * its session and the machine, and tools/perf/report.mjs in the Unity repository breaks them down (by build, the worst
 * spikes, the costliest parts, frames a second over a session), read by the Look workflow's `play_perf`.
 *
 * As `client_error`: nobody reads this table through the API (row level security on, no policy), a player writes a
 * report through `rpc_perf_report` and reads nothing back. Bounded: twelve an hour from one account, sixty minutes
 * and a hundred spikes a report at most, 64 KB of each, texts cut to length, and anything thirty days old let go of
 * now and then by the reports themselves.
 *
 * A report: `minutes`, each {t (minutes into the session), f (frames), fps, avg, med, p99, worst (ms), spikes, gc
 * (collections), top [[part, ms over the minute, worst frame's ms]], ctx, heap, gfx (MB), held [objects, meshes,
 * textures, materials, renderers, colliders, lights, audio]}; `spikes`, each {t, ms, top [[part, ms]], gc, kb, main,
 * render, ctx}.
 */
set local lock_timeout = '3s';

select private.shut($ddl$
  create table if not exists perf_report (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    uid uuid not null,
    world_id uuid,
    session text not null,
    build text not null,
    device text,
    minutes jsonb not null,
    spikes jsonb not null default '[]'::jsonb
  )
$ddl$);
select private.shut('create index if not exists perf_report_at on perf_report (at)');
select private.shut('create index if not exists perf_report_uid on perf_report (uid, at)');
select private.shut('alter table perf_report enable row level security');

create or replace function public.rpc_perf_report(
  p_session text, p_build text, p_device text, p_minutes jsonb, p_spikes jsonb default '[]'::jsonb, p_world uuid default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_spikes jsonb := '[]'::jsonb;
begin
  if me is null or jsonb_typeof(p_minutes) is distinct from 'array' then return; end if;
  if jsonb_array_length(p_minutes) = 0 or jsonb_array_length(p_minutes) > 60 or octet_length(p_minutes::text) > 65536 then
    return;
  end if;
  -- Twelve an hour from one account. A client sends one every ten minutes.
  if (select count(*) from perf_report where uid = me and at > now() - interval '1 hour') >= 12 then
    return;
  end if;
  if jsonb_typeof(p_spikes) = 'array' then
    if jsonb_array_length(p_spikes) <= 100 and octet_length(p_spikes::text) <= 65536 then v_spikes := p_spikes; end if;
  end if;
  insert into perf_report (uid, world_id, session, build, device, minutes, spikes)
  values (me, p_world, left(coalesce(nullif(p_session, ''), '?'), 40), left(coalesce(nullif(p_build, ''), '?'), 40),
          left(p_device, 400), p_minutes, v_spikes);
  -- And the month-old ones, one report in fifty.
  if random() < 0.02 then
    delete from perf_report where at < now() - interval '30 days';
  end if;
end $function$;

-- paced as a deal, as `rpc_report_error` is (`pace_class`, which `lock_doors` guards every door by)
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
                    'rpc_say', 'rpc_report_error', 'rpc_perf_report') then 'deal'
    when p_door in ('rpc_put_land', 'rpc_ready') then 'land'
    else 'act' end
$function$;
select private.lock_doors();
