-- A kind's old names rewritten where they are kept, now and at every rename.
--
-- Reported: "rippa names are still in code and game, sweep to make sure all revamped wildermon names are fixed". A
-- creature nobody named is renamed by `creature_kind_name` only when its skills, kind or name change, and the one
-- sweep (`20261023080000_a_wildermon_is_called_what_it_is.sql`) ran before most of the lines were renamed, so a
-- Rippa lying about since is still called Rippa. A carcass keeps its kind's name (`item.extra`, def `corpse`) and a
-- stud book record the name of the one that set it (`bred_record.name`), both by the name the kind had then.
--
-- So for each kind, `private.kind_names_now` calls every creature nobody named what its kind is at its stage, and a
-- carcass or a record under one of its old names (`was`) by its name now. It runs on every kind here, and after that
-- whenever the definitions put a kind in or change its name, its stages' names or its old names
-- (`species_def_renamed`), so a rename that comes with the definitions reaches what is on the island with it.
set local lock_timeout = '3s';

create or replace function private.kind_names_now(p_species text) returns void language plpgsql as $fn$
declare sd species_def;
begin
  select * into sd from species_def where id = p_species;
  if not found then return; end if;
  update creature c set name = kind_name_at(c)
   where c.species = p_species and kind_named(c) and c.name is distinct from kind_name_at(c);
  if coalesce(cardinality(sd.was), 0) > 0 then
    update item set extra = sd.name where def = 'corpse' and extra = any(sd.was);
    update bred_record set name = sd.name where species = p_species and name = any(sd.was);
  end if;
end $fn$;

create or replace function private.species_def_renamed() returns trigger language plpgsql as $fn$
begin
  perform private.kind_names_now(new.id);
  return null;
end $fn$;

select private.shut('drop trigger if exists species_def_renamed on public.species_def');
select private.shut($ddl$create trigger species_def_renamed after insert or update of name, stages, was on public.species_def
  for each row execute function private.species_def_renamed()$ddl$);

select private.kind_names_now(id) from species_def;

select private.lock_doors();
