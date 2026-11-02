-- The Leecha is the Clothkit line: the Clothkit, a Loomhare at its second stage and a Bandageweaver at its third. Its task, its
-- numbers and its id (`leecha`) are as they were; what changes in the definitions before this (`20261102040318_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, bandages, covers
-- or salves per make +1 (`species_def.perk` 'more', `perk_n`).
--
-- That skill needs no change to a function: its bandages, covers and salves are recipes worked at the stores (`errand_do`, the
-- trades a leecha's is one of), which already make what the recipe makes and the line's third-stage `more` on top (`perk_n`,
-- 20261101163230), as the browser's `recipeStep` does.
--
-- A definitions migration does not lock the doors; this one does.

select private.lock_doors();
