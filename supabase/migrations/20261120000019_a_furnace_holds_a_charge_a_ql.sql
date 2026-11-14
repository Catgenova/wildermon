-- A smelter or a kiln holds a charge a QL, times its rarity's.
--
-- Asked for: "smelters can hold up to 100 charges at 100ql. 1 charge per ql. rare bonus 1.5x, supreme 2x, fantastic 3x.
-- use for other similar utilities". So a furnace (a smelter's lumps, a kiln's pieces) holds its whole QL in charges, at
-- least one and at most a hundred, times `rarity_def.charge` (1.5, 2, 3); was twenty for a smelter and sixteen for a kiln
-- whatever their QL, and a twentieth more a step of rarity (`room_for`). The browser's `chargesFor`.
--
-- Every door that asks how much a furnace holds asks `furnace_capacity(placed)`: putting ore, scrap or ware in, a mould
-- poured, a worker's errand. What is in one past its new room stays in it and comes out as it would; nothing more goes in
-- until it is under.

set local lock_timeout = '3s';

create or replace function furnace_capacity(p placed) returns int language sql stable as $fn$
  select greatest(1, round(greatest(1, least(100, floor(coalesce(p.ql, 1))))
                           * coalesce((select r.charge from rarity_def r where r.id = p.rare), 1)))::int
$fn$;

select private.lock_doors();
