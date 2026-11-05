-- After the recipe-knacks and recipe-stations merge: the combined defs snapshot (20261105141610) may bring functions; lock the doors after it.

set local lock_timeout = '3s';

select private.lock_doors();
