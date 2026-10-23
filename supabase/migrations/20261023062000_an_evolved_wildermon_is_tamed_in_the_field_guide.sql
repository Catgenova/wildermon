set local lock_timeout = '3s';

-- An evolved wildermon of yours is tamed in the field guide.
--
-- Asked for: "Field guide: a monster that evolved from a tamed monster should be considered tamed". A stage's page
-- (`species:stage`) was marked seen and nothing else. Now it is marked tamed as well, for its keeper, when a wildermon
-- kept by you reaches that stage (`guide_evolved`), and when you tame one already at it (`guide_mark_forms`); the
-- browser's `guideMarks` and `guideMarkKind`. Bred stays its kind's.

-- A stage's page is marked seen and tamed; a form's seen and tamed (`guideMarks`).
create or replace function guide_mark(p_world uuid, p_uid uuid, p_species text, p_what text) returns void
language sql as $fn$
  insert into guide as g (world_id, uid, species, tamed, bred)
  select p_world, p_uid, p_species, p_what = 'tamed', p_what = 'bred'
   where p_uid is not null and p_what in ('seen', 'tamed', 'bred')
     and guide_kind(p_species)
     and (position(':' in p_species) = 0 or p_what in ('seen', 'tamed'))
     and (position('/' in p_species) = 0 or p_what in ('seen', 'tamed'))
     and exists (select 1 from player pl where pl.world_id = p_world and pl.uid = p_uid)
  on conflict (world_id, uid, species) do update
    set tamed = g.tamed or excluded.tamed, bred = g.bred or excluded.bred
    where (excluded.tamed and not g.tamed) or (excluded.bred and not g.bred)
$fn$;

-- A creature's kind marked, its stage's page where it is past its first and is tamed, and each wild form it is in
-- (`guideMarkKind`).
create or replace function guide_mark_forms(p_world uuid, p_uid uuid, c creature, p_what text) returns void
language sql as $fn$
  select guide_mark(p_world, p_uid, k, p_what)
    from unnest(array[c.species]
                || case when p_what = 'tamed' and stage_of(c) > 0 then array[c.species || ':' || stage_of(c)] else '{}'::text[] end
                || form_keys(c.species, c.form_colour, c.form_size)) k
$fn$;

-- A wildermon kept by you reaching a stage: that stage's page tamed, and any it passed on the way.
create or replace function guide_evolved() returns trigger language plpgsql as $fn$
declare v_from int := stage_of(old); v_to int := stage_of(new);
begin
  for v_n in v_from + 1 .. v_to loop
    perform guide_mark(new.world_id, new.keeper, new.species || ':' || v_n, 'tamed');
  end loop;
  return null;
end $fn$;

select private.shut('drop trigger if exists guide_evolved on public.creature');
select private.shut($ddl$create trigger guide_evolved after update of skills on public.creature
  for each row when (new.keeper is not null and new.skills is distinct from old.skills) execute function guide_evolved()$ddl$);

-- Those kept now that have evolved already: each stage up to theirs, for their keeper.
insert into guide as g (world_id, uid, species, tamed, bred)
select distinct c.world_id, c.keeper, c.species || ':' || n, true, false
  from creature c
  cross join lateral generate_series(1, stage_of(c)) n
 where c.keeper is not null and stage_of(c) > 0
   and exists (select 1 from player pl where pl.world_id = c.world_id and pl.uid = c.keeper)
on conflict (world_id, uid, species) do update set tamed = true where not g.tamed;

select private.lock_doors();
