-- The anvil mould takes 40 lumps (was 80): the definitions snapshot before this one carries it, and makes
-- functions again, so the doors are locked after it.
select private.lock_doors();
