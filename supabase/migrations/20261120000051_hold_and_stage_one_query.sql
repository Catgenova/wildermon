-- A boat's hold and a creature's stage as one query returned each, the form every planned function keeps
-- (supabase/test/writeload.ts). The same rules: what the piece holds, and under a helm the room Sailing adds
-- (`cargoRoom`); a stage written in the pedigree first, else off the level.
create or replace function furniture_capacity(p placed) returns integer language plpgsql stable as $fn$
begin
  return (
select r.v + case when p.driver is not null and is_boat(p)
                  then floor(r.v * (cargo_room(skill_of(p.world_id, p.driver, sailing_skill())) - 1))::int else 0 end
  from (select room_for(coalesce((select coalesce(capacity, hive, pond, 0) from furniture_def where id = p.sub), 0)
          * mat_hold(p.material) * mark_of(p.mark, 'hold') * room_mul(p.enchant), p.rare) as v offset 0) r
  );
end $fn$;

create or replace function stage_of(c creature) returns integer language plpgsql stable as $fn$
begin
  return (
select case when c.pedigree ? 'stage' then greatest(0, least(2, (c.pedigree->>'stage')::int))
            when (select sd.stages from species_def sd where sd.id = c.species) is null then 0
            else (select case when l.v >= evolve_at_2() then 2 when l.v >= evolve_at_1() then 1 else 0 end
                    from (select creature_level(c.skills, c.species) as v offset 0) l) end
  );
end $fn$;

select private.lock_doors();
