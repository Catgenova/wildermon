-- A wildermon of a kind that was taken out of the game is called what its kind is now.
--
-- Reported: "Marka and testa names still appear in game instead of the new names. Sweep for any others and correct."
-- When a kind went (the ten guards, then the forga, cordra and brittla, the gorral, shaggan and lume, the rootle),
-- every one somebody owned became the kind nearest its use with "its name" kept: and one nobody had named was called
-- by its old kind's name, so a Marka that is a Slaglet now still says Marka. `kind_named` knows a kind's own names and
-- the ones it went by (`species_def.was`), not the name of a kind it was turned from, so nothing renamed it since.
--
-- So each removed kind's name, on one of the kind it became (the browser's `REMOVED_KINDS`), is that kind's name at its
-- stage (`kind_name_at`); a carcass by a removed kind's name is the kind it became's; and a stud book record set by one
-- the name of the kind it is now. A name somebody chose that is not a removed kind's is left alone, and a removed kind's
-- name on a kind it did not become is too (somebody may have called a Snufflet "Marka"). Matched in any case: "testa" as "Testa".

set local lock_timeout = '3s';

create temp table gone_name (name text primary key, now text not null);
insert into gone_name values
  ('Testa', 'crakka'), ('Skulka', 'spitta'), ('Gasha', 'carra'), ('Hamma', 'awla'), ('Bashka', 'glossa'),
  ('Executa', 'carra'), ('Shova', 'whirla'), ('Howla', 'frosta'), ('Marka', 'scorcha'), ('Wardo', 'leecha'),
  ('Forga', 'scorcha'), ('Cordra', 'ulva'), ('Brittla', 'hoppa'), ('Gorral', 'orse'), ('Shaggan', 'roxxen'),
  ('Lume', 'wicka'), ('Rootle', 'brambo');

update creature c set name = kind_name_at(c)
  from gone_name g
 where lower(c.name) = lower(g.name) and c.species = g.now and c.name is distinct from kind_name_at(c);

update item i set extra = s.name
  from gone_name g join species_def s on s.id = g.now
 where i.def = 'corpse' and lower(i.extra) = lower(g.name);

update bred_record r set name = s.name
  from gone_name g join species_def s on s.id = g.now
 where r.species = g.now and lower(r.name) = lower(g.name);

drop table gone_name;
