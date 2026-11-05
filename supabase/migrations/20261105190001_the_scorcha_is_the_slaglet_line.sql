-- The Scorcha is the Slaglet line: the Slaglet, an Alloyster at its second stage and a Moltenex at its third. Its task, its
-- numbers and its id (`scorcha`) are as they were; what changes in the definitions before this (`20261105190000_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, alloy lumps
-- per mix +1 (`species_def.perk` 'more', `perk_n`).
--
-- That skill needs no change to a function: its alloys are recipes worked at a lit smelter of its keeper's (`errand_do`'s
-- 'alloy'), which already puts what the recipe makes and the line's third-stage `more` on top (`perk_n`), as the browser's
-- `glassStep` does.
--
-- A definitions migration does not lock the doors; this one does.

set local lock_timeout = '3s';

select private.lock_doors();
