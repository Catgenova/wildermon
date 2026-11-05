/*
 * The forga, the cordra and the brittla are gone.
 *
 * Asked for: "Remove forga", "Remove cordra", "Remove brittla". As the ten guards went
 * (`20261101100001_the_ten_guards_are_gone.sql`), one somebody owns becomes the kind nearest its trade and keeps
 * everything else: its name, keeper, level, skills, traits, stats, age, pedigree and where it is. A forga becomes a
 * scorcha (smelting), a cordra an ulva (ropemaking's level kept in tailoring), a brittla a hoppa (brewing). It is set to
 * its new kind's trade: what it has in its arms goes into its keeper's stores, a trade of its own it was set to is
 * over. A wild one is gone, and with it what anything else still said of it. A carcass of one is a carcass of the kind
 * it became; the field guide and the stud book name the kind it became. Its rows go from the definitions here, and
 * the definitions after this (`20261105170002_defs.sql`) no longer carry them, so none stands up wild or is bred
 * again. The browser's `REMOVED_KINDS` says the same map.
 *
 * Charging smelters, laying up rope and distilling are left with no kind that works them; their worker code stays.
 *
 * Safe to run again: everything here asks for a removed kind, and once done there is none.
 */
set local lock_timeout = '3s';

-- The kind each became; the ten guards' as before, and null for any other.
create or replace function private.kind_now(p_species text) returns text language sql immutable as $fn$
  select case p_species
    when 'testa' then 'crakka' when 'skulka' then 'spitta' when 'gasha' then 'carra' when 'hamma' then 'awla'
    when 'bashka' then 'glossa' when 'executa' then 'carra' when 'shova' then 'whirla' when 'howla' then 'frosta'
    when 'marka' then 'scorcha' when 'wardo' then 'leecha'
    when 'forga' then 'scorcha' when 'cordra' then 'ulva' when 'brittla' then 'hoppa' end
$fn$;

-- The wild ones, and what anything else said of them: whom it fought, hurt, sparred, followed or was drawn to.
drop table if exists gone_wild;
create temp table gone_wild as
  select world_id, id from creature where private.kind_now(species) is not null and keeper is null;
update creature c set enemy = null from gone_wild g where c.world_id = g.world_id and c.enemy = g.id;
update creature c set hurt_by = null from gone_wild g where c.world_id = g.world_id and c.hurt_by = g.id;
update creature c set brawl = null from gone_wild g where c.world_id = g.world_id and c.brawl = g.id;
update creature c set pack_lead = null from gone_wild g where c.world_id = g.world_id and c.pack_lead = g.id;
update creature c set spar_with = null, spar_at = null from gone_wild g where c.world_id = g.world_id and c.spar_with = g.id;
delete from class_mark m using gone_wild g where m.world_id = g.world_id and m.creature_id = g.id;
delete from creature c using gone_wild g where c.world_id = g.world_id and c.id = g.id;

-- The owned ones: the marks on it and a spar, while they are still of their old kind.
drop table if exists turned;
create temp table turned as
  select world_id, id, species as was, private.kind_now(species) as now from creature where private.kind_now(species) is not null;
delete from class_mark m using turned t where m.world_id = t.world_id and m.creature_id = t.id;
update creature c set spar_with = null, spar_at = null, phase = case when c.phase = 'spar' then 'idle' else c.phase end
  from turned t where c.world_id = t.world_id and c.spar_with = t.id;

-- Its level in its old trade's skill kept in its new trade's (`GATHER_SKILL`): smelting and brewing are the same skill
-- on both sides, and a cordra's ropemaking goes into an ulva's tailoring.
update creature c set skills = jsonb_set(coalesce(c.skills, '{}'::jsonb), array[k.to_skill],
         to_jsonb(greatest(coalesce((c.skills->>k.to_skill)::double precision, 0), (c.skills->>k.from_skill)::double precision)))
  from turned t, (values ('forga', 'smelting', 'smelting'), ('cordra', 'ropemaking', 'tailoring'), ('brittla', 'brewing', 'brewing'))
         k(was, from_skill, to_skill)
 where c.world_id = t.world_id and c.id = t.id and k.was = t.was and c.skills ? k.from_skill;

-- What it has in its arms, into its keeper's stores (or onto the ground where it stands).
do $do$
declare c creature;
begin
  for c in select cr.* from creature cr join turned t on t.world_id = cr.world_id and t.id = cr.id where cr.carrying is not null loop
    perform worker_put(c.world_id, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1),
                       coalesce((c.carrying->>'ql')::double precision, 40), floor(c.to_x)::int, floor(c.to_y)::int, c.carrying->>'extra');
    update creature set carrying = null where world_id = c.world_id and id = c.id;
  end loop;
end $do$;

-- And its kind, and nothing else.
update creature c set species = t.now, job = null, spar_with = null, spar_at = null,
       phase = case when c.phase = 'spar' then 'idle' else c.phase end, idle_why = null, idle_n = null, idle_what = null
  from turned t where c.world_id = t.world_id and c.id = t.id;

-- What it was seen, tamed or bred as in the field guide, under the kind it became.
insert into guide (world_id, uid, species, seen_at, tamed, bred)
  select world_id, uid, private.kind_now(species), min(seen_at), bool_or(tamed), bool_or(bred)
    from guide where private.kind_now(species) is not null group by world_id, uid, private.kind_now(species)
  on conflict (world_id, uid, species) do update
    set seen_at = least(guide.seen_at, excluded.seen_at), tamed = guide.tamed or excluded.tamed, bred = guide.bred or excluded.bred;
delete from guide where private.kind_now(species) is not null;

-- The stud book under the kind it became: its record for a figure where it beats the one that kind holds.
insert into bred_record as r (world_id, species, stat, value, creature_id, name, breeder, born_at)
  select distinct on (world_id, private.kind_now(species), stat) world_id, private.kind_now(species), stat, value, creature_id, name, breeder, born_at
    from bred_record where private.kind_now(species) is not null
   order by world_id, private.kind_now(species), stat, value desc
  on conflict (world_id, species, stat) do update
    set value = excluded.value, creature_id = excluded.creature_id, name = excluded.name, breeder = excluded.breeder, born_at = excluded.born_at
    where excluded.value > r.value;
delete from bred_record where private.kind_now(species) is not null;

-- A carcass of one, by its kind's name, a carcass of the kind it became, by that kind's name as it is now.
update item i set extra = coalesce((select s.name from species_def s where s.id = k.now), i.extra)
  from (values ('Forga', 'scorcha'), ('Cordra', 'ulva'), ('Brittla', 'hoppa')) k(name, now)
 where i.def = 'corpse' and i.extra = k.name;

-- And out of the definitions, so none stands up wild or is bred again.
delete from wild_table where private.kind_now(species) is not null;
delete from species_butcher where private.kind_now(species) is not null;
delete from species_diet where private.kind_now(species) is not null;
delete from species_def where private.kind_now(id) is not null;

drop table gone_wild;
drop table turned;
