-- The Whirla is the Creamlet line: the Creamlet, a Churnsnail at its second stage and a Butterwhorl at its third. Its task, its
-- numbers and its id (`whirla`) are as they were; what changes in the definitions before this (`20261105142947_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, batches per
-- cycle +1 (`species_def.perk` 'loads', `perk_n`).
--
-- That skill needs no change to a function: its butter is a recipe worked at a churn of yours (`errand_do`, 'churn'), and
-- `errand_go` already works a go's batches after the first up to `stage_loads`, as it does an ulva's spinning, as the
-- browser's `moreRecipes` does.
--
-- A definitions migration does not lock the doors; this one does.

set local lock_timeout = '3s';

select private.lock_doors();
