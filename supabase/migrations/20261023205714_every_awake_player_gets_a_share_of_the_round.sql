set local lock_timeout = '3s';

-- Reported: "Mortarbacks still not working when I log in", their card saying nobody awake was near, their keeper
-- beside them. The card says that when a worker's turn is half a minute overdue with its keeper in: the clock is not
-- settling it.
--
-- `world_tick` settles what is round each awake player's tile in turn (`creature_sweep`, up to 120 overdue things a
-- tile, the longest overdue first, wild or tame), and stops at the round's budget (`settle_budget`). The tiles went in
-- the same order every round, west to east, so the first player's country -- full of wildlife always coming due -- could
-- spend the whole budget round after round, and the players after them got nothing settled near them at all.
--
-- Now, first, every wildermon of everybody awake -- at work on a settlement or at their heel, wherever it is -- is settled
-- on a budget of its own (`kept_sweep`), before any wildlife; then each awake player's tile has a fair share of what is
-- left of the round's, the tiles taken in a different order each round; and in each sweep the tame go before the wild.

/** Every deed worker and companion of somebody awake, due, longest overdue first, until `p_until`. */
create or replace function kept_sweep(p_world uuid, p_until timestamptz default null) returns integer
  language plpgsql as $$
declare r record; n int := 0;
begin
  for r in
    select c.id from creature c
     where c.world_id = p_world and c.mode in ('deed', 'active') and c.until <= now()
       and exists (select 1 from player p where p.world_id = p_world and p.uid = c.keeper and not p.away
                     and p.seen_at > now() - make_interval(secs => idle_logout()))
     order by c.until limit worker_sweep_most()
  loop
    exit when p_until is not null and clock_timestamp() > p_until;
    if creature_settle(p_world, r.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;

do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('world_tick'::regproc);
  for r in select * from (values
    (1, $$v_tidy boolean := false; v_deadline timestamptz; v_coarse boolean;$$,
        $$v_tidy boolean := false; v_deadline timestamptz; v_coarse boolean;
        v_tiles int; v_tile int; v_share timestamptz;$$),
    (2, $$      for p in select distinct floor(x) as x, floor(y) as y from player
        where world_id = w.id and not away
          and seen_at > now() - make_interval(secs => idle_logout())
        order by 1, 2 limit tick_players()
      loop
        exit when clock_timestamp() > v_deadline;
        v_stirred := v_stirred + creature_sweep(w.id, p.x, p.y, 40, v_deadline, stir_slack());
        if v_coarse then
          v_stirred := v_stirred + creature_sweep(w.id, p.x, p.y, 40, v_deadline, null, true);
        end if;
      end loop;$$,
        $$      -- First every wildermon of everybody awake, on a budget of its own (`kept_sweep`).
      v_stirred := v_stirred + kept_sweep(w.id, clock_timestamp() + settle_budget());
      -- Then each tile its share of what is left of the budget, in an order of this round's own.
      select count(*) into v_tiles from (select distinct floor(x), floor(y) from player
        where world_id = w.id and not away
          and seen_at > now() - make_interval(secs => idle_logout()) limit tick_players()) t;
      v_tile := 0;
      for p in select t.x, t.y from (select distinct floor(x) as x, floor(y) as y from player
        where world_id = w.id and not away
          and seen_at > now() - make_interval(secs => idle_logout())
        limit tick_players()) t
        order by md5(t.x::text || ',' || t.y::text || ',' || floor(extract(epoch from v_t0))::text)
      loop
        exit when clock_timestamp() > v_deadline;
        v_share := least(v_deadline, clock_timestamp() + (v_deadline - clock_timestamp()) / greatest(1, v_tiles - v_tile));
        v_tile := v_tile + 1;
        v_stirred := v_stirred + creature_sweep(w.id, p.x, p.y, 40, v_share, stir_slack());
        if v_coarse then
          v_stirred := v_stirred + creature_sweep(w.id, p.x, p.y, 40, v_share, null, true);
        end if;
      end loop;$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'world_tick has % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;

  -- The tame first in a sweep, then the longest overdue.
  v_def := pg_get_functiondef('creature_sweep'::regproc);
  v_n := (length(v_def) - length(replace(v_def, 'order by until limit 120', ''))) / length('order by until limit 120');
  if v_n <> 1 then raise exception 'creature_sweep has % of its order, not 1', v_n; end if;
  execute replace(v_def, 'order by until limit 120', 'order by mode = ''wild'', until limit 120');
end $do$;

select private.lock_doors();
