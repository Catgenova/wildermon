-- After the Crumbud's definitions (20261105194002), which may bring functions: lock the doors after them.

set local lock_timeout = '3s';

select private.lock_doors();
