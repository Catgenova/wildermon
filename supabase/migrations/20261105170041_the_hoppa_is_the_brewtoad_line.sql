-- The Hoppa is the Brewtoad line: the Brewtoad, a Brothgut at its second stage and a Barrelburp at its third. Its task, its
-- numbers and its id (`hoppa`) are as they were; what changes in the definitions before this (`20261105170040_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, work range
-- x1.2 (`species_def.perk` 'blood', `perk_n`, `perk_channel` 'range'), which `evo_mul` reads into `work_range` on the island
-- as it does the Cauldronthroat's.
--
-- That skill needs no change to a function: a go starts one brew in an idle barrel within its work range, so a wider range
-- is more barrels it keeps going, where a `loads` skill would be nothing to a brew.
--
-- A definitions migration does not lock the doors; this one does.

set local lock_timeout = '3s';

select private.lock_doors();
