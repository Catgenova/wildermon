set local lock_timeout = '3s';

-- Life stages scaled to the ninety-day seasons, and death of old age. Asked for: "Scale life stages to match the
-- 90-day seasons. 90d days at old and the wildermon dies of old age. Any wildermon currently Old set to grown."
--
-- The defs before this lengthen `young_for` and `old_at` by the seasons' scale and add `old_for`. A wildermon that has
-- lived `old_of` (its keeper's perks' old age) and `old_for` more, at the pace its keeper's perks age it, dies: one
-- that is out leaves its carcass where it stands, its keeper is told, and whatever had hold of it lets go, as a wild
-- one turned over does (`wild_turnover`). The world's tidy round asks it (`world_tick`), not every creature's settle.
create or replace function old_age_sweep(p_world uuid) returns integer language plpgsql as $fn$
declare c creature; v_kind text; n int := 0;
begin
  for c in select cr.* from creature cr
            where cr.world_id = p_world and cr.born is not null
              and extract(epoch from (now() - cr.born)) * age_pace(cr) >= old_of(cr) + old_for()
  loop
    delete from creature where world_id = p_world and id = c.id;
    update creature set enemy = null where world_id = p_world and enemy = c.id;
    delete from class_mark where world_id = p_world and creature_id = c.id;
    delete from faith_mark where world_id = p_world and creature_id = c.id;
    delete from faith_weak where world_id = p_world and creature_id = c.id;
    select name into v_kind from species_def where id = c.species;
    if c.mode <> 'stored' then
      perform drop_on_ground(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int, 'corpse',
        (15 + random() * 35) * (age_row(c.born, old_of(c), age_pace(c))).yield, v_kind);
    end if;
    if c.keeper is not null then perform wtell(p_world, c.keeper, c.name || ' died of old age.'); end if;
    n := n + 1;
  end loop;
  return n;
end $fn$;

do $do$
declare v_def text; v_old text := 'perform pond_sweep(w.id);'; v_n int;
begin
  v_def := pg_get_functiondef('world_tick'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'world_tick has % of the pond sweep, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || E'\n        -- And whatever has lived out its old age (`old_age_sweep`).\n        perform old_age_sweep(w.id);');
end $do$;

-- Every keeper's numbers stamped afresh, its old age among them, now that the base it is a share of has moved.
update creature set kept = kept_of(world_id, keeper) where keeper is not null and kept is distinct from kept_of(world_id, keeper);
-- Every one old now is set back to grown by `20261023180001_life_stages_in_days_of_the_wall_clock`, once the stages
-- are counted in days of the wall clock.

select private.lock_doors();
