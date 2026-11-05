-- After the Bramblet, Brewtoad and Crumbud merges: the combined defs snapshot may bring functions; lock the doors after it.

set local lock_timeout = '3s';

select private.lock_doors();
