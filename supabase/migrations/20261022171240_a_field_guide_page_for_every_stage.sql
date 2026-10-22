-- A field guide page for every stage.
--
-- Asked for: "Add entries to the Field Guide for each evolution stage, so that every wildermon is shown". A stage's page
-- is kept under `species:stage` (the browser's `stageKey`), one and two for a kind's second and third, and is marked
-- seen when one at that stage is in sight (`stage_of`); taming and breeding stay on the kind's own page.

set local lock_timeout = '3s';

-- Whether there is a page under this key: a kind, or a stage it has (`guideEntry`).
create or replace function guide_kind(p_key text) returns boolean language sql stable as $fn$
  select exists (select 1 from species_def d
                  where d.id = split_part(p_key, ':', 1)
                    and (position(':' in p_key) = 0
                         or (split_part(p_key, ':', 2) ~ '^[0-9]+$'
                             and split_part(p_key, ':', 2)::int between 1 and coalesce(array_length(d.stages, 1), 0))))
$fn$;

create or replace function guide_mark(p_world uuid, p_uid uuid, p_species text, p_what text) returns void language sql as $fn$
  insert into guide as g (world_id, uid, species, tamed, bred)
  select p_world, p_uid, p_species, p_what = 'tamed', p_what = 'bred'
   where p_uid is not null and p_what in ('seen', 'tamed', 'bred')
     and guide_kind(p_species)
     -- A stage's page is marked seen and nothing else.
     and (position(':' in p_species) = 0 or p_what = 'seen')
     and exists (select 1 from player pl where pl.world_id = p_world and pl.uid = p_uid)
  on conflict (world_id, uid, species) do update
    set tamed = g.tamed or excluded.tamed, bred = g.bred or excluded.bred
    where (excluded.tamed and not g.tamed) or (excluded.bred and not g.bred)
$fn$;

do $do$
declare v_def text; v_old text; v_new text;
begin
  -- A sighting handed over is taken while one of that kind, at that stage for a stage's page, stands near.
  v_def := pg_get_functiondef('rpc_guide_seen'::regproc);
  v_old := $q$   where exists (select 1 from species_def d where d.id = s)
     and exists (select 1 from creature c
                  where c.world_id = p_world and c.species = s and c.mode <> 'stored'$q$;
  v_new := $q$   where guide_kind(s)
     and exists (select 1 from creature c
                  where c.world_id = p_world and c.species = split_part(s, ':', 1) and c.mode <> 'stored'
                    and (position(':' in s) = 0 or stage_of(c) = split_part(s, ':', 2)::int)$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'rpc_guide_seen: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
