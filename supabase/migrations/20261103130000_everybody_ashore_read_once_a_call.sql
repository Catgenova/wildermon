-- Everybody ashore, read once a call rather than once a person.
--
-- Measured on the live island under load (tools/loadtest.ts, run 2): the whole near answer (`rpc_near`, the ground's
-- slow half) took 90 ms a call with ten people on and 793 ms with 150, half of all the database's time, while the
-- answer of what changed beside it stayed at 7-11 ms. The difference is `folk_ashore`, the list of everybody on the
-- island the map draws, which the slow half hands out:
--
--   * every row of it asked `folk_seen` again, which counts everybody online: the people on the island times the
--     people online, for every one of them who asks;
--   * and `afoot` three times and `folk_name` twice, each a read of the same `player` row the list was already on.
--
-- So one ask grew with the square of the people on and all of them with the cube. This is the same list, row for
-- row and in the same order: online read off the row it is on, the crowd counted once, the name looked up once. On a
-- test island of 200 people, 151 online: 62-79 ms a call before, 10-16 ms after, the same answer crowded (no places)
-- and with five online (places sent).
set local lock_timeout = '3s';

create or replace function public.folk_ashore(p_world uuid, p_uid uuid) returns jsonb
  language sql stable as $fn$
  -- Whether places are sent at all (`folk_seen`: fewer online than `crowd_hides`), counted once.
  with seen as (select folk_seen(p_world) as near),
  q as (
    -- `afoot`, read off the row: not away, and seen within `idle_logout`.
    select p.uid, p.name, p.x, p.y,
           coalesce(not p.away and p.seen_at > now() - make_interval(secs => idle_logout()), false) as online
      from player p
     where p.world_id = p_world and p.uid <> p_uid
     order by 5 desc, p.name
     limit 200)
  -- `folk_row`, with `folk_name` once: the account's name, else the name on the row.
  select coalesce(jsonb_agg(
      jsonb_build_object('uid', q.uid, 'name', n.name, 'online', q.online)
      || case when s.near and q.online then jsonb_build_object('x', floor(q.x)::int, 'y', floor(q.y)::int)
              else '{}'::jsonb end
      order by q.online desc, n.name), '[]'::jsonb)
    from q cross join seen s
    cross join lateral (select coalesce(account_name(q.uid), q.name, 'somebody') as name) n
$fn$;

select private.lock_doors();
