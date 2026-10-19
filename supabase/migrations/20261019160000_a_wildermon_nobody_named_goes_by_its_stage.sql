-- A wildermon nobody has named is called what it is at the stage it is at, and is renamed as it evolves.
--
-- Asked for: "Stage 3 evolutions that never had a name change should have their names updated as they evolve. I have 3
-- harvestusks named pigroot". A wild one takes its kind's name as its own when it stands up, and nothing changed it
-- when it evolved, so a Pigroot grown into a Harvestusk was still called Pigroot. A name that is only one of its kind's
-- own -- its kind's, a stage's, or one its kind went by before (`was`) -- is nobody's choice (`kind_named`); such a
-- name now follows its stage (`kind_name_at`) when it evolves (`worker_learn`), and every one there is now is put
-- right here. A name somebody gave is never one of these, and is kept. The browser's `kindNamed` and `renamedKind`.

set local lock_timeout = '3s';

create or replace function kind_named(c creature) returns boolean language sql stable as $fn$
  select coalesce(c.name = sd.name or c.name = any(coalesce(sd.stages, '{}')) or c.name = any(coalesce(sd.was, '{}')), false)
    from species_def sd where sd.id = c.species
$fn$;

create or replace function kind_name_at(c creature) returns text language sql stable as $fn$
  select case when stage_of(c) = 0 then sd.name else sd.stages[stage_of(c)] end from species_def sd where sd.id = c.species
$fn$;

do $do$
declare v_def text;
  v_old text := 'update creature set health = health * stage_mul_hardy() where world_id = p_world and id = p_id;';
  v_new text := 'update creature set health = health * stage_mul_hardy(),
        -- And one nobody has named is called what it has become (`kind_named`).
        name = case when kind_named(c) then kind_name_at(c2) else name end
      where world_id = p_world and id = p_id;';
begin
  select pg_get_functiondef('public.worker_learn'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'worker_learn does not grow its health where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

update creature c set name = kind_name_at(c) where kind_named(c) and c.name is distinct from kind_name_at(c);

select private.lock_doors();
