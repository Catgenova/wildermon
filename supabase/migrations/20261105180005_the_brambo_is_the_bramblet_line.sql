-- The Brambo is the Bramblet line: the Bramblet, a Vinehorn at its second stage and a Briarstag at its third. Its task, its
-- numbers and its id (`brambo`) are as they were; what changes in the definitions before this (`20261105180004_defs.sql`) is
-- the kind's name and its old one (`was`), its two stages' names, its line's own skill at its third stage, berries or grapes
-- per pick +1 (`species_def.perk` 'more', `perk_n`), which `worker_settle` already adds to what `worker_do` picks off a bush or
-- a trellis vine (`perk_more`), as it does a Vanari's; and the bush trade's learn pace (`learn_pace_def`), re-derived now
-- that the kind its go is measured on evolves.
--
-- A definitions migration does not lock the doors; this one does.

set local lock_timeout = '3s';

select private.lock_doors();
