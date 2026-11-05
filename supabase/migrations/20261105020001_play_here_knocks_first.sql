-- Play here knocks first, as every door does.
--
-- `rpc_take_seat` (20261105000000) set `wurm.seat_take` before its `private.pace`, so the seat check let it by; every
-- door's first statement is its pace (ratelimit.ts). The flag is set as the function's variables are, before its
-- first statement, and the pace is that statement.

set local lock_timeout = '3s';

create or replace function public.rpc_take_seat()
returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare me uuid := auth.uid(); v_take text := set_config('wurm.seat_take', '1', true); v_seat uuid; v_was uuid; r record;
begin
  perform private.pace(me, 'act');
  if me is null then raise exception 'not signed in'; end if;
  v_seat := private.seat_sent();
  if v_seat is null then perform set_config('wurm.seat_take', '', true); return jsonb_build_object('why', 'No seat sent.'); end if;
  select seat into v_was from private.play_seat where uid = me;
  insert into private.play_seat (uid, seat, seen_at) values (me, v_seat, now())
  on conflict (uid) do update set seat = excluded.seat, seen_at = now();
  if v_was is not null and v_was <> v_seat then
    for r in select world_id from player where uid = me loop
      -- The seat that took it, so the tab holding it lets this go by.
      perform private.send('own:' || r.world_id || ':' || me, 'elsewhere', jsonb_build_object('seat', v_seat));
    end loop;
  end if;
  perform set_config('wurm.seat_take', '', true);
  return '{}'::jsonb;
end $f$;
revoke execute on function public.rpc_take_seat() from public, anon;
grant execute on function public.rpc_take_seat() to authenticated;

select private.lock_doors();
