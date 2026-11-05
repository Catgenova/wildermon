/*
 * The gorral, the shaggan and the lume are gone.
 *
 * Asked for: "Remove gorral, shaggan, lume". As the forga, the cordra and the brittla went
 * (`20261105170000_forga_cordra_brittla_are_gone.sql`), one somebody owns becomes the kind nearest its use and keeps
 * everything else: its name, keeper, level, skills, traits, stats, age, pedigree and where it is. A gorral becomes an
 * orse (the other land saddle mount; climbing kept), a shaggan a roxxen (the other draught beast; its climbing kept in
 * driving), a lume a wicka (the lamplighters; its awareness kept in carrying). One ridden is got down from and one in the
 * traces let out of them first: nobody is left on, or a cart left hitched to, a kind it was not put to. A wild one is
 * gone, and with it what anything else still said of it. A carcass of one is a carcass of the kind it became; the field
 * guide and the stud book name the kind it became. Its rows go from the definitions here, and the definitions after this
 * no longer carry them, so none stands up wild or is bred again. The browser's `REMOVED_KINDS` says the same map.
 *
 * Safe to run again: everything here asks for a removed kind, and once done there is none.
 */
set local lock_timeout = '3s';

-- The kind each became; every earlier removal's as before, and null for any other.
create or replace function private.kind_now(p_species text) returns text language sql immutable as $fn$
  select case p_species
    when 'testa' then 'crakka' when 'skulka' then 'spitta' when 'gasha' then 'carra' when 'hamma' then 'awla'
    when 'bashka' then 'glossa' when 'executa' then 'carra' when 'shova' then 'whirla' when 'howla' then 'frosta'
    when 'marka' then 'scorcha' when 'wardo' then 'leecha'
    when 'forga' then 'scorcha' when 'cordra' then 'ulva' when 'brittla' then 'hoppa'
    when 'gorral' then 'orse' when 'shaggan' then 'roxxen' when 'lume' then 'wicka' end
$fn$;

-- The three taken out here, apart from the earlier ones, which are already gone.
create or replace function pg_temp.gone_now(p_species text) returns boolean language sql immutable as $fn$
  select p_species in ('gorral', 'shaggan', 'lume')
$fn$;

-- The wild ones, and what anything else said of them: whom it fought, hurt, sparred, followed or was drawn to.
drop table if exists gone_wild;
create temp table gone_wild as
  select world_id, id from creature where pg_temp.gone_now(species) and keeper is null;
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
  select world_id, id, species as was, private.kind_now(species) as now from creature where pg_temp.gone_now(species);
delete from class_mark m using turned t where m.world_id = t.world_id and m.creature_id = t.id;
update creature c set spar_with = null, spar_at = null, phase = case when c.phase = 'spar' then 'idle' else c.phase end
  from turned t where c.world_id = t.world_id and c.spar_with = t.id;

-- Got down from, and let out of the traces: its rider on foot where it stands, the cart or wagon it drew left standing.
update creature c set rider = null from turned t where c.world_id = t.world_id and c.id = t.id and c.rider is not null;
update creature c set hitched_to = null from turned t where c.world_id = t.world_id and c.id = t.id and c.hitched_to is not null;

-- Its level in its old skill kept in its new kind's (`levelSkill`): a gorral's climbing is an orse's, a shaggan's climbing
-- goes into a roxxen's driving, a lume's awareness into a wicka's carrying (lamplighting).
update creature c set skills = jsonb_set(coalesce(c.skills, '{}'::jsonb), array[k.to_skill],
         to_jsonb(greatest(coalesce((c.skills->>k.to_skill)::double precision, 0), (c.skills->>k.from_skill)::double precision)))
  from turned t, (values ('gorral', 'climbing', 'climbing'), ('shaggan', 'climbing', 'driving'), ('lume', 'awareness', 'carrying'))
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
    from guide where pg_temp.gone_now(species) group by world_id, uid, private.kind_now(species)
  on conflict (world_id, uid, species) do update
    set seen_at = least(guide.seen_at, excluded.seen_at), tamed = guide.tamed or excluded.tamed, bred = guide.bred or excluded.bred;
delete from guide where pg_temp.gone_now(species);

-- The stud book under the kind it became: its record for a figure where it beats the one that kind holds.
insert into bred_record as r (world_id, species, stat, value, creature_id, name, breeder, born_at)
  select distinct on (world_id, private.kind_now(species), stat) world_id, private.kind_now(species), stat, value, creature_id, name, breeder, born_at
    from bred_record where pg_temp.gone_now(species)
   order by world_id, private.kind_now(species), stat, value desc
  on conflict (world_id, species, stat) do update
    set value = excluded.value, creature_id = excluded.creature_id, name = excluded.name, breeder = excluded.breeder, born_at = excluded.born_at
    where excluded.value > r.value;
delete from bred_record where pg_temp.gone_now(species);

-- A carcass of one, by its kind's name, a carcass of the kind it became, by that kind's name as it is now.
update item i set extra = coalesce((select s.name from species_def s where s.id = k.now), i.extra)
  from (values ('Gorral', 'orse'), ('Shaggan', 'roxxen'), ('Lume', 'wicka')) k(name, now)
 where i.def = 'corpse' and i.extra = k.name;

-- And out of the definitions, so none stands up wild or is bred again.
delete from wild_table where pg_temp.gone_now(species);
delete from species_butcher where pg_temp.gone_now(species);
delete from species_diet where pg_temp.gone_now(species);
delete from species_def where pg_temp.gone_now(id);

drop table gone_wild;
drop table turned;
