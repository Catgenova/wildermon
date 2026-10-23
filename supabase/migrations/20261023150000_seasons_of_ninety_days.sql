set local lock_timeout = '3s';

-- Seasons of ninety days. Asked for: "Increase season time to 90 game days".
--
-- The defs after this lengthen a season (`season_days`) and count the year from the spring begun at 13:00 UTC on
-- 23 October 2026 (`year_from`), so that spring goes on. A field's growth is read off the field clock, which both
-- change: what each field and Season's Hand crop has grown into its stage now is kept here, on the clocks as they
-- were, and its stage start is put back that far on the new ones after them
-- (`20261023150002_a_field_keeps_what_it_has_grown`). A planter's and a glasshouse's clocks have no seasons in them.
create table if not exists private.crop_regrow (
  world_id uuid not null,
  x int not null,
  y int not null,
  clock text not null,
  grown double precision not null,
  primary key (world_id, x, y)
);
delete from private.crop_regrow;
insert into private.crop_regrow (world_id, x, y, clock, grown)
  select c.world_id, c.x, c.y, crop_kind(c.glass, c.hand),
         crop_clock_on(crop_kind(c.glass, c.hand), now()) - crop_clock_on(crop_kind(c.glass, c.hand), c.stage_at)
    from crop c where crop_kind(c.glass, c.hand) in ('field', 'hand');

select private.lock_doors();
