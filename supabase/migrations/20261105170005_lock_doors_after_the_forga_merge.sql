-- After the remove-forga merge: the combined defs snapshot (20261105170004) may bring functions; lock the doors after it.

set local lock_timeout = '3s';

select private.lock_doors();
