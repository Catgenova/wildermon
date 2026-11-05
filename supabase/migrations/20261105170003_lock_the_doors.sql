set local lock_timeout = '3s';

-- The definitions before this one (`20261105170002_defs.sql`) put back no door; lock them again all the same.
select private.lock_doors();
