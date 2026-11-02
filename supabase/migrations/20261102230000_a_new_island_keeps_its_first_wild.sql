-- An island never reset counts as reset when it was made, so a new one keeps the wild it was stocked with.
--
-- `wild_reset_due` read an island with no `private.wild_reset_at` row as never reset, so owed at once: every island
-- there was got its row in 20261101090000, but one founded since has none, and the tree clock wiped its wild inside
-- its first minute (the live smoke's island, founded 22:39:03 UTC today, 96 wild within sixty tiles and 80 of them
-- gone 15 s later). Its first reset is now `wild_reset_days()` rollovers after `world.made_at`.
create or replace function wild_reset_due(p_world uuid) returns boolean
language sql stable as $$
  select w.ready and w.trees_at >= tree_last_dawn()
     and coalesce((select r.at from private.wild_reset_at r where r.world_id = w.id), w.made_at)
         <= tree_last_dawn() - make_interval(days => wild_reset_days()) + interval '1 hour'
    from world w where w.id = p_world
$$;
select private.lock_doors();
