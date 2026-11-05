-- The Spitta is the Padbloom line: the Padbloom, a Lilyback at its second stage and a Lotushell at its third. Its task, its
-- numbers and its id (`spitta`) are as they were; what changes in the definitions before this (`20261105210002_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, and its line's own skill at its third stage, roots or seeds
-- per trip +1 (`species_def.perk` 'loads', `perk_n`).
--
-- That skill needs no change to a function: at the stores it takes `stage_loads` lily roots and lotus seeds into its arms
-- (`errand_do`, 'lily'), and `stage_loads` already adds a line's 'loads' at its third stage, as the browser's `stageLoads`
-- does.
--
-- A definitions migration does not lock the doors; this one does.

set local lock_timeout = '3s';

select private.lock_doors();
