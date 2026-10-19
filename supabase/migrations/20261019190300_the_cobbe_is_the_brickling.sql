-- The Cobbe is the Brickling: a Mortarback at 25 and a Bastiondrake at 50.
--
-- Asked for: "Implement this family through a rate loop to replace Cobbe". The kind is still `cobbe`; its name, its
-- stages, its old name and its words come from the snapshot before this one (`species_def`). One nobody named goes
-- by what its kind is called at the stage it is at (`kind_named`, `kind_name_at`, 20261019160000), so every one still
-- called a Cobbe is called a Brickling now, or a Mortarback or Bastiondrake where its level has passed that stage; a
-- name somebody gave is kept.

set local lock_timeout = '3s';

update creature c set name = kind_name_at(c)
 where c.species = 'cobbe' and kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
