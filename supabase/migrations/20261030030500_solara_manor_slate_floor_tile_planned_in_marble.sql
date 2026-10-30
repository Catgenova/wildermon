-- The one slate floor tile planned on Solara Manor's third storey, planned in marble instead.
--
-- Asked: "Change that slate floor tile plan to a marble floor tile plan." catgenova's Solara Manor (level 2, 2580,3027)
-- had a single planned slate floor tile in its marble landing beside the stairs, and the settlement's hod carriers sat
-- waiting for 12 slate brick nobody meant to buy. Its mortar is in.
--
-- So the tile is a marble floor now: its bill a planned marble floor's (`floor_bill`), less what has already gone into
-- it of the same things (the mortar), as if the mortar had been carried to a marble plan. Only while it is still that
-- slate plan with no slate laid; anywhere else, or once changed, nothing.

set local lock_timeout = '3s';

update floor_tile f
   set material = 'marble',
       total = b.bill,
       needed = (select jsonb_object_agg(k, greatest(0, (b.bill->>k)::int
                   - coalesce((f.total->>k)::int - (f.needed->>k)::int, 0)))
                   from jsonb_object_keys(b.bill) k)
  from player p, lateral (select floor_bill('marble', 'floor') as bill) b
 where p.name = 'catgenova' and f.world_id = p.world_id and f.planned_by = p.uid
   and f.level = 2 and f.x = 2580 and f.y = 3027 and f.kind = 'floor' and f.material = 'slate'
   and (f.needed->>'slate_brick')::int = (f.total->>'slate_brick')::int;

select private.lock_doors();
