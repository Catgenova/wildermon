-- The Simma is the Brothlet line: the Brothlet, a Stockbelly at its second stage and a Cauldronthroat at its third. Its task,
-- its numbers and its id (`simma`) are as they were; what changes in the definitions before this (`20261102190000_defs.sql`)
-- is the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, work range
-- x1.2 (`species_def.perk` 'blood', `perk_n`, `perk_channel` 'range'), which `evo_mul` reads into `work_range` on the island
-- as it does the Stonepolish's.
--
-- Not arrows' or shafts' kind of skill, a `more` on what one go makes: cooking is worked at a lit campfire or oven
-- (`errand_do`'s `cook`, the browser's `cookStep`), not at the stores, and adds no line's `more` to what it makes.
--
-- A definitions migration does not lock the doors; this one does.

select private.lock_doors();
