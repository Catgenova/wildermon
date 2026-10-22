-- Nine kinds are new lines that evolve: the Sappa is the Pipseed, the Sprigga the Lemlet, the Rowl the Snarepup, the
-- Snout the Dirtlet, the Wicka the Glimmoth, the Thumpa the Pebbletooth, the Stona the Zephlet, the Lungra the Blushkit
-- and the Bogga the Mosskip, each with two stages after it.
--
-- Each kind keeps its id, task, stats and ability; its name, stages, old name, words and carcass come from the snapshot
-- before this one (`species_def`). One nobody named goes by what its kind is called at the stage it is at
-- (`kind_named`, `kind_name_at`); a name somebody gave is kept.

set local lock_timeout = '3s';

update creature c set name = kind_name_at(c)
 where c.species in ('sappa', 'sprigga', 'rowl', 'snout', 'wicka', 'thumpa', 'stona', 'lungra', 'bogga')
   and kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
