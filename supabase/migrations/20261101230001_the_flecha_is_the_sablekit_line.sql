-- The Flecha is the Sablekit line: the Sablekit, a Sableplume at its second stage and a Fletchercrest at its third. Its task,
-- its numbers and its id (`flecha`) are as they were; what changes in the definitions before this (`20261101230000_defs.sql`)
-- is the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, arrows per
-- fletch +1 (`species_def.perk` 'more', `perk_n`).
--
-- That skill needs no change here: fletching is a recipe worked at the stores (`tend_recipes('fletch')`, `errand_do`), and
-- `errand_do` already makes what the recipe makes and its line's third-stage `more` on top (`20261101163230`), as the
-- browser's `recipeStep` does.
--
-- A definitions migration does not lock the doors; this one does.

select private.lock_doors();
