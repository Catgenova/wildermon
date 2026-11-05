-- After the remove-rootle change: the defs snapshot (20261105190002) may bring functions; lock the doors after it.

set local lock_timeout = '3s';

select private.lock_doors();
