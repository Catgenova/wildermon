-- Solara's two marble bridges, set level at the storey they were planned at.
--
-- Reported: "this bridge was planned from storey 4 > 4, but planned and built 4 > 5". Both were planned by their
-- builder on 11-13 with storey 4 pinned, and saved by the old rule (each end on the highest finished floor of its tile,
-- 20261120000054) as ramps from level 3 to level 4, a finished level-4 floor standing on the far end tile:
--   #2  2571,3029 > 2567,3029   level 3, level_b 4, rise 30, height 106
--   #3  2565,3023 > 2565,3027   level 3, level_b 4, rise 30, height 106
-- The builder asked for both to be set level at level 3 (storey 4), as the new rule plans them: each end on its
-- finished level-3 floor, the deck at the ground plus three storeys, no rise. Their spans stay finished as they are.
-- Only a row still exactly as found is changed; anywhere else, or once changed, this does nothing.

update bridge b
   set level = 3, level_b = null, rise = 0,
       height = round((surface_height(b.world_id, b.ax, b.ay) + 3 * wall_height()
                     + surface_height(b.world_id, b.bx, b.by) + 3 * wall_height()) / 2)
 where b.world_id::text like 'f3a88670%'
   and (b.id, b.ax, b.ay, b.bx, b.by) in ((2, 2571, 3029, 2567, 3029), (3, 2565, 3023, 2565, 3027))
   and b.kind = 'marble' and b.level = 3 and b.level_b = 4 and b.rise = 30 and b.height = 106
   and exists (select 1 from deed d where d.world_id = b.world_id and d.name = 'Solara')
   and deck_level(b.world_id, b.ax, b.ay, 3) = 3 and deck_level(b.world_id, b.bx, b.by, 3) = 3;
