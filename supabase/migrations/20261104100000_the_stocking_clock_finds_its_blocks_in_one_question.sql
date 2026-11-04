-- The stocking clock finds the blocks it owes in one question, each block asked once.
--
-- Load test 3 on the live island (11-03 23:28, tools/loadtest.ts): `stock_tick` 12.6 ms a call with 10 people awake,
-- 35.9 ms with 100 and 569 ms with 150, the database at 549% of its two cores. Measured again on a copy of the test
-- island made live-sized (7,734 wild, 52 companions, every land row stored as large as the live island's, the people
-- put out as the load test puts them, knots of five at least 256 tiles apart):
--
--   * A round that owes a block pays for the block (`creature_stock_block`, 100-250 ms here for fresh country,
--     whoever is awake): at 150 people the bodies stand round some 200 blocks, so nearly every round owes one, and
--     at 10 nearly none does. One block a round (`stock_a_round`) is the rule and stays.
--   * What grew with the people was finding that block. The round first asked whether anything was owed (one
--     statement over every tile and its ring of blocks), then asked it all again the slow way: for each tile in
--     order a call to `creature_stock_ahead`, and in it a `stock_due` query for each of the nine blocks round it,
--     until one was owed. With the owed block round the last tile, 15.9 ms at 150 people, 6.7 at 50, 0.9 at 10.
--
-- Now one statement gives the owed blocks in the order the loop came to them -- islands oldest stamp first, the tiles
-- bodies stand on by x then y, the block underfoot and then the `stock_ahead()` ring by rows, a block met twice taken
-- where it was met first -- and stops at `stock_a_round()` of them. Each distinct block is asked of `world_stocked`
-- once, however many tiles stand round it: 2.2 ms at 150 people, 1.9 at 50, 1.0 at 10. The islands are stamped as
-- entering each one stamped it: up to the one whose block filled the round, or all of them when none did. Nothing
-- owed costs 1.0-2.1 ms (was 0.7-1.4). The same blocks are stocked on the same rounds: 40, 80 and 150 rounds at 10,
-- 50 and 150 awake on two islands leave the same creatures, items, blocks and stamps, round for round.
--
-- `creature_stock_ahead` and `stock_due` stay as they are; nothing in the clock calls them now.
set local lock_timeout = '3s';

create or replace function public.stock_tick() returns jsonb language plpgsql as $fn$
declare v_put int := 0; v_worlds int; v_ids uuid[]; v_wi int[]; v_bx int[]; v_by int[];
begin
  /*
   * A lock of its own, so the slow stocking of a block never holds up the world clock (`world_tick`).
   */
  if not pg_try_advisory_lock(hashtext('stock_tick')::bigint) then
    return jsonb_build_object('worlds', 0, 'busy', true);
  end if;

  -- The islands the round reaches, oldest stamp first.
  select array_agg(s.id order by s.stocked_at) into v_ids from (
    select id, stocked_at from world where ready and exists (
      select 1 from player
      where player.world_id = world.id and not player.away
        and player.seen_at > now() - make_interval(secs => idle_logout()))
    order by stocked_at limit tick_worlds()) s;

  /*
   * The blocks owed, in the order the round comes to them, and no more than a round stocks (`stock_a_round`). On
   * each island the tiles bodies stand on (`tick_players()` of them, by x then y); round each the block underfoot
   * first and then the `stock_ahead()` ring by rows; a block met again later is the block met first. Owed is
   * `stock_due`: on the island, and not stocked within `restock_every()`. Each block is asked once, however many
   * bodies stand round it.
   */
  select array_agg(o.wi order by o.wi, o.seq), array_agg(o.bx order by o.wi, o.seq), array_agg(o.by order by o.wi, o.seq)
    into v_wi, v_bx, v_by
    from (
      select c.wi, c.seq, c.bx, c.by
        from (
          select i.wi::int as wi, i.id, ow.size, floor(t.x / stock_block())::int + k.dx as bx, floor(t.y / stock_block())::int + k.dy as by,
                 min(t.pi * (2 * stock_ahead() + 1) * (2 * stock_ahead() + 1) + k.ki) as seq
            from unnest(v_ids) with ordinality as i(id, wi)
            join world ow on ow.id = i.id
           cross join lateral (
             select d.x, d.y, row_number() over (order by d.x, d.y) as pi
               from (select distinct floor(pl.x) as x, floor(pl.y) as y from player pl
                      where pl.world_id = i.id and not pl.away
                        and pl.seen_at > now() - make_interval(secs => idle_logout())
                      order by 1, 2 limit tick_players()) d) t
           cross join (
             select 0 as dy, 0 as dx, 0::bigint as ki
             union all
             select r.dy, r.dx, row_number() over (order by r.dy, r.dx)
               from (select dy, dx from generate_series(-stock_ahead(), stock_ahead()) dy
                      cross join generate_series(-stock_ahead(), stock_ahead()) dx where dx <> 0 or dy <> 0) r) k
           group by 1, 2, 3, 4, 5) c
       where c.bx >= 0 and c.by >= 0 and c.bx * stock_block() < c.size and c.by * stock_block() < c.size
         and not exists (select 1 from world_stocked s
                          where s.world_id = c.id and s.bx = c.bx and s.by = c.by
                            and s.at > now() - make_interval(secs => restock_every()))
       order by c.wi, c.seq
       limit stock_a_round()) o;

  -- Every island up to the one whose block filled the round is stamped, as entering it always stamped it; all of
  -- them when the round is not filled. Stamped whether or not it had anything owing, so the ones this round never
  -- reached keep their old stamp and come first next time.
  v_worlds := case when coalesce(cardinality(v_wi), 0) >= stock_a_round() then v_wi[cardinality(v_wi)]
                   else coalesce(cardinality(v_ids), 0) end;
  update world set stocked_at = now() where id = any(v_ids[1:v_worlds]);

  for i in 1 .. coalesce(cardinality(v_wi), 0) loop
    perform creature_stock_block(v_ids[v_wi[i]], v_bx[i], v_by[i]);
    v_put := v_put + 1;
  end loop;

  perform pg_advisory_unlock(hashtext('stock_tick')::bigint);
  return jsonb_build_object('worlds', v_worlds, 'blocks', v_put);
end $fn$;

select private.lock_doors();
