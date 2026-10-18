-- A carcass keeps its old name.
--
-- A carcass says what it was by its kind's name (`item.extra`), and a kind is looked up by that name to butcher it
-- (`corpse_species`). The Rabba is the Snufflet now, so a Rabba carcass already lying on the island, or put by in a
-- store, was no kind at all and could not be butchered. A kind keeps the names it used to have (`species_def.was`,
-- which comes in with the definitions), and a carcass is of the kind whose name, whose stage's name, or whose old name
-- it carries. The browser's `corpseSpecies`.

-- What the definitions bring in, ahead of them.
set local lock_timeout = '3s';
alter table species_def add column if not exists was text[];
update species_def set was = array['Rabba']::text[] where id = 'rabba';

create or replace function corpse_species(p_extra text) returns species_def language sql stable as $fn$
  select sd.* from species_def sd
   where lower(coalesce(p_extra, '')) in (select lower(n) from unnest(array[sd.name] || coalesce(sd.stages, '{}') || coalesce(sd.was, '{}')) n)
   order by sd.id
   limit 1
$fn$;

select private.lock_doors();
