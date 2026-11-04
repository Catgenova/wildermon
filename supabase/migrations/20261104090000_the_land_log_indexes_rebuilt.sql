-- The land's change log and the woods' picks, their indexes rebuilt.
--
-- The look of 11-04 01:37 on the live project: `tile_change` held 30 rows in 40 MB of table and 1230 MB of indexes,
-- after 877,309 rows in and 877,336 out since 11-02 (it is a log the browsers read from and the land lets go of);
-- `private.tree_run_pick` held no rows in 30 MB of indexes. An index file never gets smaller: pages a burst once
-- filled are kept and reused, so the two indexes on `tile_change` stayed at what the log was at its longest. They
-- were two thirds of the whole database (1804 MB), and every insert into the log walks them.
--
-- Each rebuilt from the rows there are, which is a moment: what is written to either table meanwhile waits for it.
set local lock_timeout = '3s';

reindex table public.tile_change;
reindex table private.tree_run_pick;

select private.lock_doors();
