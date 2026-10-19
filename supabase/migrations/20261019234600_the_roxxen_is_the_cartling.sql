-- The Roxxen is the Cartling: a Wagonox at 25 and a Haulhorn at 50.
--
-- Asked for: "This family to replace Roxxen once specced and rated". The kind is still `roxxen`; its name, its stages,
-- its old name and its words come from the snapshot before this one (`species_def`). One nobody named goes by what its
-- kind is called at the stage it is at (`kind_named`, `kind_name_at`), so every one still called a Roxxen is called a
-- Cartling now, or a Wagonox or Haulhorn where its level has passed that stage; a name somebody gave is kept.

set local lock_timeout = '3s';

update creature c set name = kind_name_at(c)
 where c.species = 'roxxen' and kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
