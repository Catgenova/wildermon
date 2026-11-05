-- The Chissa is the Chipkin line: the Chipkin, a Brickorn at its second stage and a Fortigran at its third. Its task, its
-- numbers and its id (`chissa`) are as they were; what changes in the definitions before this (`20261105180000_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, stone brick per
-- shard +1 (`species_def.perk` 'more', `perk_n`).
--
-- That skill needs no change to a function: its stone brick is a recipe worked at the stores (`errand_do`, the trades a
-- chissa's is one of), which already makes what the recipe makes and the line's third-stage `more` on top (`perk_n`,
-- 20261101163230), as the browser's `recipeStep` does.
--
-- A definitions migration does not lock the doors; this one does.

set local lock_timeout = '3s';

select private.lock_doors();
