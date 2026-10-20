-- The Orse is the Thistlekit: a Bunnycourser at 25 and a Moonhare at 50.
--
-- Asked for: "This family to replace Orse as a rideable mount". The kind is still `orse`, still the mount and still a
-- draught beast; its name, its stages, its old name and its words come from the snapshot before this one
-- (`species_def`). One nobody named goes by what its kind is called at the stage it is at (`kind_named`,
-- `kind_name_at`), so every one still called an Orse is called a Thistlekit now, or a Bunnycourser or Moonhare where
-- its level has passed that stage; a name somebody gave is kept.

set local lock_timeout = '3s';

update creature c set name = kind_name_at(c)
 where c.species = 'orse' and kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
