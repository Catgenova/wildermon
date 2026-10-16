-- A vesp tends the hives, as its trade.
--
-- Asked: "vesp should work beehives as their trade". A vesp had no trade, so
-- it could not be set to work a deed at all ("A vesp has no trade to be set
-- to."), and the hives it fills (`hive_sweep`) filled only for one kept
-- following you about the settlement. Its trade is `hive` now (the
-- definitions carry it): set to work, it goes to the nearest hive in reach of
-- the token and works there, and the hive fills with honey and beeswax as it
-- always has for a swarm on the deed. It brings nothing to the crate. With no
-- hive in reach it says so, as any worker with no work does.

-- The trade, among those the island works.
create or replace function worker_job_ported(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'mine', 'quarry',
                    'sand', 'clay', 'peat', 'reed', 'fish', 'farm', 'fetch',
                    'hod', 'mend', 'stoke', 'plant', 'compost', 'guard', 'hunt',
                    'prospect', 'water', 'seek', 'prune', 'stump', 'fruit', 'hive')
$fn$;

-- What a worker with nothing to do says it could not find.
create or replace function work_words(p_kind text) returns text language sql immutable as $fn$
  select case p_kind
    when 'woodcut' then 'trees to fell'
    when 'prune'   then 'trees worth pruning'
    when 'fruit'   then 'fruit on the bough'
    when 'stump'   then 'stumps to dig out'
    when 'mine'    then 'bare rock with a seam in it'
    when 'quarry'  then 'bare rock to cut'
    when 'sand'    then 'sand to dig'
    when 'clay'    then 'clay to dig'
    when 'peat'    then 'peat to cut'
    when 'reed'    then 'reeds to cut'
    when 'fish'    then 'water worth a rod'
    when 'seek'    then 'ground worth turning over'
    when 'farm'    then 'fields wanting work'
    when 'hive'    then 'hive to tend'
    else 'work' end
$fn$;

-- What a worker set to the deed will do; a swarm at the hives brings nothing to the crate (`deedJobLine`).
create or replace function deed_job_line(c creature) returns text language sql stable as $fn$
  select coalesce((select g.plain || ' within ' || work_range(c) || ' tiles of the token'
                          || case when g.id = 'hive' then '' else ' and bring what it finds to the crate' end
                     from gather_def g
                    where g.id = coalesce(c.job, (select s.gathers from species_def s where s.id = c.species))),
                  'stay around the settlement')
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A hive standing on the tile is work for a swarm, and any number of them may tend it: no claim (`hiveAt`).
    (1, 'worker_gatherable', $$  if not in_bounds(p_world, p_x, p_y) or claimed(p_world, p_x, p_y, c.id) then return false; end if;$$,
                             $$  if p_kind = 'hive' then
    return in_bounds(p_world, p_x, p_y) and exists (select 1 from placed pl where pl.world_id = p_world and pl.kind = 'furniture'
      and pl.sub = 'hive' and pl.x = p_x and pl.y = p_y and pl.crumbles_at is null);
  end if;
  if not in_bounds(p_world, p_x, p_y) or claimed(p_world, p_x, p_y, c.id) then return false; end if;$$, 1),
    -- Tending a hive brings nothing home: the hive fills itself while a swarm keeps it (`hive_sweep`).
    (2, 'worker_do', $$  perform worker_learn(p_world, p_id, skill_id, 0.225);$$,
                     $$  perform worker_learn(p_world, p_id, skill_id, 0.225);
  if kind = 'hive' then return null; end if;$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
