-- The wild dragons standing anywhere but Volcano Isle are gone.
--
-- Asked for: "Remove wild dragons off the volcano isle". Since `20261019140000` a dragon stands up on Volcano Isle and
-- nowhere else (`monster_isle`), but the ones that stood up elsewhere before then were still out there, one of them on
-- the Crescent. Every wild dragon not on its own island goes, as one out of its season goes (`wild_out_of_season`):
-- whatever was fighting it is let go, and the marks on it with it. One in a trap is the trap's and stays.

set local lock_timeout = '3s';

with gone as (
  delete from creature c
   where c.mode = 'wild' and c.trapped is null and monster_isle(c.species) is not null
     and region_at(c.world_id, c.to_x, c.to_y) is distinct from monster_isle(c.species)
  returning c.world_id, c.id
), freed as (
  update creature e set enemy = null from gone g where e.world_id = g.world_id and e.enemy = g.id returning 1
), unmarked as (
  delete from class_mark m using gone g where m.world_id = g.world_id and m.creature_id = g.id returning 1
)
select count(*) as dragons_gone from gone;

select private.lock_doors();
