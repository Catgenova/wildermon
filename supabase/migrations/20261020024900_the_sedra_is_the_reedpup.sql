-- The Sedra is the Reedpup: a Reedweaver at 25 and a Marshreaper at 50.
--
-- Asked for: "To replace sedra". The kind is still `sedra` and still cuts reeds; its name, its stages, its old name,
-- its words and its carcass (fur where it gave feathers) come from the snapshot before this one (`species_def`). One
-- nobody named goes by what its kind is called at the stage it is at (`kind_named`, `kind_name_at`), so every one still
-- called a Sedra is called a Reedpup now, or a Reedweaver or Marshreaper where its level has passed that stage; a name
-- somebody gave is kept.

set local lock_timeout = '3s';

update creature c set name = kind_name_at(c)
 where c.species = 'sedra' and kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
