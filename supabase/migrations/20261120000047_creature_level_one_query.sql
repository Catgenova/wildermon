-- A hybrid's level as one query returned, the form every planned creature function keeps
-- (supabase/test/writeload.ts): the mean of its two trades' skills, one for a skill it has none of yet
-- (`hybridLevel`); any other kind's off its level skill, as before.
create or replace function creature_level(p_skills jsonb, p_species text) returns integer language plpgsql stable as $fn$
begin
  return (
select case when coalesce(array_length(h.sk, 1), 0) = 2
            then greatest(1, floor((coalesce((p_skills->>h.sk[1])::numeric, 1) + coalesce((p_skills->>h.sk[2])::numeric, 1)) / 2))::int
            else greatest(1, floor(coalesce(case when ls.skill is null then (select max(value::numeric) from jsonb_each_text(p_skills))
                                                 else (p_skills->>ls.skill)::numeric end, 0)))::int end
    from (select level_skill(p_species) as skill offset 0) ls
    cross join lateral (select (select array(select g.skill from unnest(d.trades) with ordinality t(id, n) join gather_def g on g.id = t.id order by t.n)
                                  from species_def d where d.id = p_species and d.hybrid_a is not null) as sk) h
  );
end $fn$;

select private.lock_doors();
