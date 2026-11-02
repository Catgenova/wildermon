-- The Crakka is the Pestlet line: the Pestlet, a Churnscale at its second stage and a Mortarium at its third. Its task, its
-- numbers and its id (`crakka`) are as they were; what changes in the definitions before this (`20261101390000_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, concrete per
-- mix +1 (`species_def.perk` 'more', `perk_n`).
--
-- That skill needs no change here: mixing concrete is a recipe worked at the stores (`tend_recipes('concrete')`,
-- `errand_do`), and `errand_do` already makes what the recipe makes and its line's third-stage `more` on top
-- (`20261101163230`), as the browser's `recipeStep` does.
--
-- A definitions migration does not lock the doors; this one does.

select private.lock_doors();
