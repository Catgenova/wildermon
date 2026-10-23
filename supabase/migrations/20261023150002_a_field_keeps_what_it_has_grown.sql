set local lock_timeout = '3s';

-- A field keeps what it has grown across the longer seasons: each field and Season's Hand crop kept by
-- `20261023150000_seasons_of_ninety_days` has its stage start put back as far on the new clocks as it had grown on the old.
update crop c set stage_at = crop_moment_on(r.clock, crop_clock_on(r.clock, now()) - r.grown)
  from private.crop_regrow r
 where c.world_id = r.world_id and c.x = r.x and c.y = r.y and crop_kind(c.glass, c.hand) = r.clock;
drop table private.crop_regrow;

select private.lock_doors();
