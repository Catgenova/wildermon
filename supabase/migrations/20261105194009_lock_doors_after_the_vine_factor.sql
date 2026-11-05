-- After the vine learn factor moved to the Bramblet line's measured rate (1.75): lock the doors after the defs snapshot.

set local lock_timeout = '3s';

select private.lock_doors();
