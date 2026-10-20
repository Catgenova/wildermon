-- The Tinka is the Stitchkit: a Patchcoon at 25 and a Mendermask at 50.
--
-- Asked for: "This family to replace reppa", the Tinka. The kind is still `tinka`; its name, its stages, its old name and
-- its words come from the snapshot before this one (`species_def`). One nobody named goes by what its kind is called
-- at the stage it is at (`kind_named`, `kind_name_at`), so every one still called a Tinka is called a Stitchkit now, or
-- a Patchcoon or Mendermask where its level has passed that stage; a name somebody gave is kept.

set local lock_timeout = '3s';

update creature c set name = kind_name_at(c)
 where c.species = 'tinka' and kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
