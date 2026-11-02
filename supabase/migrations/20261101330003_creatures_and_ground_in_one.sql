-- The creatures and the ground in one round trip, when a browser is due both.
--
-- A browser asks the creatures once a second (`MOBS_EVERY`) and the ground once a second while it moves or works
-- (`GROUND_EVERY`), every `GROUND_IDLE` seconds while it stands: two requests a second for most of a session, each
-- its own transaction and its own commit, its own PostgREST round of `set_config`s, its own slot in the pool. Asked
-- together, the two are one: `rpc_near` answers what `rpc_creatures` and `rpc_ground` answer to the same arguments,
-- each as it is, under `creatures` and `ground`. Measured on a test island (pgbench, the requests PostgREST makes):
-- 31-35 ms for the pair in one request against 33-38 ms in two, and half the requests.
--
-- Each read paces and counts itself as it always did (`private.pace`, `too_fast`), so the rate a body may ask at is
-- unchanged. A refusal of either refuses the request, and the browser lays it as a failed read of both, which is what
-- it does with a failed read of either. A browser that does not ask it asks the two apart, as it always did.

set local lock_timeout = '3s';

create or replace function public.rpc_near(p_world uuid, p_range double precision default 40, p_since text default null,
  p_have integer[] default null, p_pack boolean default false, p_ground_range double precision default 40,
  p_slow boolean default true, p_ground_since text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
begin
  return jsonb_build_object(
    'creatures', rpc_creatures(p_world, p_range, p_since, p_have, p_pack),
    'ground', rpc_ground(p_world, p_ground_range, p_slow, p_ground_since));
end $fn$;

select private.lock_doors();
