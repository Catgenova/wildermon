-- The stocking clock asks once whether anything is owed, and stops there when nothing is.
--
-- Measured on the live island: `stock_tick` was 2% of the database's time at 10 ms a call, once a second. Nearly
-- every one of those calls puts nothing out: a block is looked at again no sooner than `restock_every()` (fifty
-- minutes), so a body standing in stocked country owes nothing for most of an hour. The call found that out the
-- slow way: for every island with somebody on it, for every tile somebody stands on, a call to
-- `creature_stock_ahead`, and in it a separate `stock_due` query for each of the nine blocks round about.
--
-- Now one statement asks the same question of the same blocks first: the islands the round reaches (oldest stamp
-- first, `tick_worlds()` of them), the tiles bodies stand on there (`tick_players()` of them), and the
-- `stock_ahead()` ring of blocks round each, by `stock_due` as before. Nothing owed: the islands are stamped as the
-- loop would have stamped them, and the round is over. Anything owed, even one block: the loop runs exactly as it
-- did, from the start, so what is put out, where and in what order is the same.
--
-- A block off the edge of the island has no `world_stocked` row and so is always owed (`stock_due`), as it always
-- was, and the loop takes its turn as it always did.

set local lock_timeout = '3s';

create or replace function stock_tick() returns jsonb language plpgsql as $fn$
declare w record; p record; v_put int := 0; v_worlds int := 0; v_ids uuid[];
begin
  /*
   * A lock of its own, so the slow stocking of a block never holds up the world clock (`world_tick`).
   */
  if not pg_try_advisory_lock(hashtext('stock_tick')::bigint) then
    return jsonb_build_object('worlds', 0, 'busy', true);
  end if;

  -- The islands the round reaches, as the loop below takes them.
  select array_agg(s.id order by s.stocked_at) into v_ids from (
    select id, stocked_at from world where ready and exists (
      select 1 from player
      where player.world_id = world.id and not player.away
        and player.seen_at > now() - make_interval(secs => idle_logout()))
    order by stocked_at limit tick_worlds()) s;

  -- Nothing owed in any block the loop would look at: stamped as the loop stamps them, and done.
  -- `stock_due` written out rather than called: a SQL function with a subquery in it is not inlined, and called
  -- once a block it was most of the cost. Each block is asked once, however many bodies stand round it.
  if not exists (
    select 1 from (
      select distinct i.id, floor(t.x / stock_block())::int + dx as bx, floor(t.y / stock_block())::int + dy as by
        from unnest(v_ids) as i(id)
       cross join lateral (
         select distinct floor(pl.x) as x, floor(pl.y) as y from player pl
          where pl.world_id = i.id and not pl.away
            and pl.seen_at > now() - make_interval(secs => idle_logout())
          order by 1, 2 limit tick_players()) t
       cross join generate_series(-stock_ahead(), stock_ahead()) dy
       cross join generate_series(-stock_ahead(), stock_ahead()) dx) b
     where not exists (select 1 from world_stocked s
                        where s.world_id = b.id and s.bx = b.bx and s.by = b.by
                          and s.at > now() - make_interval(secs => restock_every()))) then
    update world set stocked_at = now() where id = any(v_ids);
    perform pg_advisory_unlock(hashtext('stock_tick')::bigint);
    return jsonb_build_object('worlds', coalesce(cardinality(v_ids), 0), 'blocks', 0);
  end if;

  for w in
    select id from world where ready and exists (
      select 1 from player
      where player.world_id = world.id and not player.away
        and player.seen_at > now() - make_interval(secs => idle_logout()))
    order by stocked_at limit tick_worlds()
  loop
    v_worlds := v_worlds + 1;
    -- Stamped on the way in rather than on the way out, so that an island this
    -- round did reach goes to the back of the queue whether or not it turned
    -- out to have anything owing, and the ones it never reached keep their old
    -- stamp and come first next time.
    update world set stocked_at = now() where id = w.id;
    -- The same tiles the sweep uses, and deduped the same way: a dozen bodies
    -- on one tile are one patch of country, not a dozen.
    for p in select distinct floor(x) as x, floor(y) as y from player
      where world_id = w.id and not away
        and seen_at > now() - make_interval(secs => idle_logout())
      order by 1, 2 limit tick_players()
    loop
      exit when v_put >= stock_a_round();
      v_put := v_put + creature_stock_ahead(w.id, p.x, p.y, stock_a_round() - v_put);
    end loop;
    exit when v_put >= stock_a_round();
  end loop;

  perform pg_advisory_unlock(hashtext('stock_tick')::bigint);
  return jsonb_build_object('worlds', v_worlds, 'blocks', v_put);
end $fn$;

/*
 * And a round that does put a block out, at a quarter of the cost: `near_tile` reads each line of the island it
 * looks at once.
 *
 * Profiled on a test island founded like the live one (4096, seed 7): a block put out was 2.3 s, and 1.7 s of it
 * was `near_tile(.., 'water')` asking `has_water` of each of the 81 tiles round a spot, which asks `land_height` of
 * four corners each, and every `land_height` read its line of corners where it lies -- eight kilobytes stored
 * packed, unpacked again for every corner: 23,424 of them for one block. The kinds that want trees, clay or tar
 * near them read a line of tiles per tile the same way.
 *
 * Now the lines the square covers are read out once, unpacked, and every tile of the square is bytes of those.
 * The same answer for every tile: water is a corner under nought, a spring or a pool in a foundation (`has_water`),
 * a tile off the island is never near (`in_bounds`), and a line with no row is no water and no tree, as before.
 * `near_tile` is asked by `suits` alone, which is the stocking's.
 */
create or replace function near_tile(p_world uuid, p_x integer, p_y integer, p_what text, p_range integer default 4)
returns boolean language plpgsql stable as $fn$
declare v_size int; v_x0 int; v_x1 int; v_y0 int; v_y1 int;
begin
  select w.size into v_size from world w where w.id = p_world;
  if v_size is null then return false; end if;
  v_x0 := greatest(0, p_x - p_range);
  v_x1 := least(v_size - 1, p_x + p_range);
  v_y0 := greatest(0, p_y - p_range);
  v_y1 := least(v_size - 1, p_y + p_range);
  if v_x0 > v_x1 or v_y0 > v_y1 then return false; end if;
  if p_what = 'water' then
    return exists (
      with c as materialized (
        select c.y, c.heights || ''::bytea as h from land_corner c
         where c.world_id = p_world and c.y between v_y0 and v_y1 + 1)
      select 1 from generate_series(v_y0, v_y1) gy
       cross join generate_series(v_x0, v_x1) gx
        left join c c0 on c0.y = gy
        left join c c1 on c1.y = gy + 1
       where least(b_i16(c0.h, gx), b_i16(c0.h, gx + 1), b_i16(c1.h, gx + 1), b_i16(c1.h, gx)) < 0
          or exists (select 1 from spring_tile t where t.world_id = p_world and t.x = gx and t.y = gy)
          or exists (select 1 from foundation fo where fo.world_id = p_world and fo.x = gx and fo.y = gy and fo.pool));
  elsif p_what in ('clay', 'trees', 'tar') then
    return exists (
      with t as materialized (
        select t.y, t.tiles || ''::bytea as b from land_tile t
         where t.world_id = p_world and t.y between v_y0 and v_y1)
      select 1 from t cross join generate_series(v_x0, v_x1) gx
       where case p_what
         when 'clay'  then get_byte(t.b, gx) = tile_id('Clay')
         when 'trees' then get_byte(t.b, gx) = tile_id('Tree')
         else get_byte(t.b, gx) in (tile_id('Tar'), tile_id('Peat'), tile_id('Marsh')) end);
  end if;
  return false;
end $fn$;

select private.lock_doors();
