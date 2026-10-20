-- The Holla is the Puddlehop: a Springcarrier at 25 and an Aquavoyager at 50.
--
-- Asked for: "To replace holla". The kind is still `holla` and still carries water to your barrels; its name, its
-- stages, its old name, its words and its carcass (no fur) come from the snapshot before this one (`species_def`). One
-- nobody named goes by what its kind is called at the stage it is at (`kind_named`, `kind_name_at`), so every one still
-- called a Holla is called a Puddlehop now, or a Springcarrier or Aquavoyager where its level has passed that stage; a
-- name somebody gave is kept.

set local lock_timeout = '3s';

update creature c set name = kind_name_at(c)
 where c.species = 'holla' and kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
