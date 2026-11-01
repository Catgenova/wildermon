-- The issued frying pans and clay bowls, pots and jars taken back, wherever they are.
--
-- Asked: "Delete them" (the starting-kit copies already held, after 20261101091000 took the four out of the kit).
-- What is inside one moves up to where the vessel was (`inside` cascades, so it would go with it). Each player who held
-- one is told.

set local lock_timeout = '3s';

create temp table kit_vessel as
  select id, world_id, holder, holder_uid, inside from item
   where issued and def in ('frying_pan', 'clay_bowl', 'clay_pot', 'clay_jar');

update item c set inside = v.inside from kit_vessel v where c.inside = v.id;

select tell(t.world_id, t.holder_uid, 'Starting kit: frying pan, clay bowl, clay pot and clay jar removed.', 'system')
  from (select distinct world_id, holder_uid from kit_vessel where holder_uid is not null) t;

delete from item i using kit_vessel v where i.id = v.id;
drop table kit_vessel;

select private.lock_doors();
