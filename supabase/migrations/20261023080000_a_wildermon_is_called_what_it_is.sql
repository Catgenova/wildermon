set local lock_timeout = '3s';

-- A wildermon nobody has named is called what it is now.
--
-- Reported: wildermon names still wrong after the visual overhauls -- old names showing, and stages not named for what
-- they evolved into, once tamed. A creature's name was set when it came into the world and changed only when it evolved
-- by a worker's go (`worker_learn_paced`): a kind given a new line kept its old name on every one already about, one
-- tamed already evolved kept its first stage's name, and one that evolved by fighting, sparring or a relic kept the
-- stage it had. Now, whenever a creature is made or its skills, kind or name change, one that only goes by one of its
-- kind's own names (`kind_named`: its kind's, a stage's, or one it was known by before) is called its kind at its stage
-- (`kind_name_at`); one somebody named keeps the name. And every one about now is called so.
create or replace function creature_kind_name() returns trigger language plpgsql as $fn$
begin
  if kind_named(new) then new.name := kind_name_at(new); end if;
  return new;
end $fn$;

select private.shut('drop trigger if exists creature_kind_name on public.creature');
select private.shut($ddl$create trigger creature_kind_name before insert or update of skills, species, name on public.creature
  for each row execute function creature_kind_name()$ddl$);

update creature c set name = kind_name_at(c) where kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
