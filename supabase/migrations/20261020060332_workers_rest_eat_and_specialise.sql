-- A deed worker tires and rests, sleeping in a bed of its size when there is one; it slows once it has gone a day
-- without a meal; and three of a trade on a settlement make it a specialty.
--
-- Asked for: "Rest and stamina. Workers tire after N goes and rest for a short while. A bed or pen on the deed shortens
-- the rest", with of the wildermon beds "wildermon can only use [the bed] equivalent to their evolution stage"; "Each
-- worker eats from deed stores once per island day. An unfed one works at -50% and shows it on its card, so food
-- production matters"; and "Three or more workers of one trade on a deed unlock a +10% bonus for that trade."
--
-- Rest. A go at its task (where `worker_settle` counts one to the ledger: a `worker_do`, an `errand_go`, so a stage's
-- extra loads and handlings cost nothing more) spends one of its `tire_goes` (`creature.worn`). With none left, idle
-- with its arms empty or between the steps of an errand, it walks to the nearest wildermon bed on its settlement that is
-- free and of its own class (`free_bed`, `den_class`: its stage for a kind that evolves, its kind's health band
-- `den_health_1`/`den_health_2` for one that does not; `furniture_def.den`) and sleeps in it (`placed.sleeper`) for
-- `bed_rest` of `rest_for`; or rests `rest_for` where it stands. Then it gets up with its stamina full. A rest is no go:
-- nothing is counted to the ledger for it. The bed is let go when it gets up, and by trigger when it stops being a
-- worker (called to heel, crated, let go: `creature_out_of_bed`) or dies (`creature_gone_from_bed`); a bed moved is a bed
-- nobody is in (`placed_bed_moved`), and a bed picked up takes its sleeper's place with it.
--
-- Upkeep. The seconds a worker has worked since its last meal (`creature.unfed`), counted where its body is settled
-- (`creature_settle`) and put back to nought by any meal (`beast_fed`, a bucket of whey). It eats from the stores as it
-- always has, whenever it is hungry; one that has found nothing for `upkeep_for` (an island day, `day_seconds`) takes
-- its task at `unfed_pace` of its pace until it eats (`worker_pace`).
--
-- Specialty. With `specialty_at` or more deed workers of a trade on a settlement -- its founder's and its citizens' --
-- each takes its task at `1 + specialty_bonus` of its pace (`deed_trade_workers`, counted once a go off the keeper
-- index; `deed_trade_counts` once a call for `rpc_creatures`).
--
-- The browser keeps the same rules (`TIRE_GOES`, `restStep`, `denClass`, `UPKEEP_FOR`, `taskMul`, `SPECIALTY_AT`).

set local lock_timeout = '3s';

alter table creature add column if not exists worn int not null default 0;
alter table creature add column if not exists bed bigint;
alter table creature add column if not exists unfed real not null default 0;
alter table placed add column if not exists sleeper int;

-- The bed it fits: its stage for a kind that evolves, its kind's health band for one that does not (`denClass`).
create or replace function den_class(c creature) returns int language sql stable as $fn$
  select case when sd.stages is not null then stage_of(c)
              when sd.health < den_health_1() then 0
              when sd.health < den_health_2() then 1
              else 2 end
    from species_def sd where sd.id = c.species
$fn$;

-- The nearest wildermon bed on its keeper's settlement that is free and of its own class, from a point (`freeBed`).
create or replace function free_bed(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.*
    from deed_of(p_world, c.keeper) dd
    join placed p on p.world_id = p_world and p.kind = 'furniture'
                 and p.x between dd.x - dd.radius and dd.x + dd.radius
                 and p.y between dd.y - dd.radius and dd.y + dd.radius
    join furniture_def fd on fd.id = p.sub
   where dd.world_id is not null and fd.den = den_class(c) and p.sleeper is null
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id
   limit 1
$fn$;

-- Its keeper's settlement and everybody on it: the founder and the citizens.
create or replace function deed_people(p_world uuid, p_uid uuid) returns setof uuid language sql stable as $fn$
  with dd as (select d.founded_by from deed_of(p_world, p_uid) d where d.world_id is not null)
  select founded_by from dd
  union
  select m.uid from deed_member m join dd on m.founder = dd.founded_by where m.world_id = p_world
$fn$;

-- How many deed workers of a trade its keeper's settlement has (`tradeWorkers`).
create or replace function deed_trade_workers(p_world uuid, p_keeper uuid, p_kind text) returns int language sql stable as $fn$
  select count(*)::int
    from deed_people(p_world, p_keeper) k(uid)
    join creature c on c.world_id = p_world and c.keeper = k.uid
    join species_def sd on sd.id = c.species
   where c.mode = 'deed' and coalesce(c.job, sd.gathers) = p_kind
$fn$;

-- Every trade on the settlement and its workers, at once, for the creatures read.
create or replace function deed_trade_counts(p_world uuid, p_uid uuid) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_object_agg(t.kind, t.n), '{}'::jsonb)
    from (select coalesce(c.job, sd.gathers) as kind, count(*)::int as n
            from deed_people(p_world, p_uid) k(uid)
            join creature c on c.world_id = p_world and c.keeper = k.uid
            join species_def sd on sd.id = c.species
           where c.mode = 'deed' and coalesce(c.job, sd.gathers) is not null
           group by 1) t
$fn$;

-- What a go's work time is divided by: its blood, care and stage (`beast_mul` 'work'), its settlement's specialty in
-- the trade, and `unfed_pace` once it has gone a day without a meal. The browser's `taskMul`.
create or replace function worker_pace(p_world uuid, c creature, p_kind text) returns double precision
language sql stable as $fn$
  select beast_mul(c, 'work')
       * case when c.unfed >= upkeep_for() then unfed_pace() else 1 end
       * case when p_kind in ('guard', 'hunt') then 1
              when deed_trade_workers(p_world, c.keeper, p_kind) >= specialty_at() then 1 + specialty_bonus()
              else 1 end
$fn$;

-- The bed let go when it stops being a worker: called to heel, crated, let go. Its rest is over with it.
create or replace function creature_out_of_bed() returns trigger language plpgsql as $fn$
begin
  if old.bed is not null then
    update placed set sleeper = null where id = old.bed and sleeper = old.id;
  end if;
  new.bed := null;
  if new.phase in ('rest', 'bed') then new.phase := 'idle'; end if;
  return new;
end $fn$;
drop trigger if exists creature_out_of_bed on creature;
create trigger creature_out_of_bed before update of mode on creature for each row
  when (new.mode is distinct from old.mode and (old.bed is not null or old.phase in ('rest', 'bed')))
  execute function creature_out_of_bed();

-- And when it dies.
create or replace function creature_gone_from_bed() returns trigger language plpgsql as $fn$
begin
  update placed set sleeper = null where id = old.bed and sleeper = old.id;
  return old;
end $fn$;
drop trigger if exists creature_gone_from_bed on creature;
create trigger creature_gone_from_bed after delete on creature for each row
  when (old.bed is not null)
  execute function creature_gone_from_bed();

-- A bed moved is a bed nobody is in.
create or replace function placed_bed_moved() returns trigger language plpgsql as $fn$
begin
  new.sleeper := null;
  return new;
end $fn$;
drop trigger if exists placed_bed_moved on placed;
create trigger placed_bed_moved before update of x, y on placed for each row
  when (old.sleeper is not null and (new.x is distinct from old.x or new.y is distinct from old.y))
  execute function placed_bed_moved();

-- The settle loop: rest, a go's stamina, and the pace a go is worked at.
do $do$
declare v_def text;
  pairs text[][] := array[
    [$a$        v_day int; v_held jsonb; v_left int;
$a$, $a$        v_day int; v_held jsonb; v_left int; v_bed placed;
$a$],
    -- Rest, before anything else it might do but strike or pick up a carcass it walked to.
    [$a$    /*
     * Off its ground: it walks back to it before anything else,$a$, $a$    /*
     * Rest (`tire_goes`, `rest_for`). Up from a rest, its stamina full, and out of its bed. At a bed it walked to, into
     * it if it is still there and free, for `bed_rest` of the rest. And with no stamina left, idle with its arms empty
     * or between the steps of an errand: to the nearest free bed of its size on its settlement (`free_bed`), or a rest
     * where it stands. Nothing of a rest is a go.
     */
    if c.phase = 'rest' then
      update placed set sleeper = null where id = c.bed and sleeper = c.id;
      c.bed := null; c.worn := 0;
      c.idle_why := null; c.idle_n := null;
      c.phase := 'idle';
      c.leg_at := c.until; c.leg_ends := c.until;
      continue;
    elsif c.phase = 'bed' then
      if exists (select 1 from placed b join furniture_def fd on fd.id = b.sub
                  where b.id = c.bed and b.world_id = p_world and b.sleeper is null and fd.den = den_class(c)) then
        update placed set sleeper = c.id where id = c.bed;
        c.phase := 'rest'; c.idle_why := 'rest'; c.idle_n := null;
        c.leg_at := c.until; c.leg_ends := c.until;
        c.until := c.until + make_interval(secs => rest_for() * bed_rest());
        continue;
      end if;
      -- Gone, or taken by another on the way: it looks again.
      c.bed := null;
      c.phase := 'idle';
      c.leg_at := c.until; c.leg_ends := c.until;
    end if;
    if c.phase = 'idle' and c.worn >= tire_goes() and (c.carrying is null or worker_errand(kind)) then
      v_bed := free_bed(p_world, c, cx, cy);
      c.from_x := cx; c.from_y := cy; c.idle_n := null;
      if v_bed.id is not null then
        c.bed := v_bed.id;
        c.to_x := v_bed.cx; c.to_y := v_bed.cy;
        dist := sqrt((v_bed.cx - cx) ^ 2 + (v_bed.cy - cy) ^ 2);
        c.leg_at := c.until;
        c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
        c.until := c.leg_ends;
        c.phase := 'bed'; c.idle_why := 'tired';
      else
        c.leg_at := c.until; c.leg_ends := c.until;
        c.until := c.until + make_interval(secs => rest_for());
        c.phase := 'rest'; c.idle_why := 'rest';
      end if;
      continue;
    end if;

    /*
     * Off its ground: it walks back to it before anything else,$a$],
    -- A go spends a `tire_goes`th of its stamina: at its task, and at an errand.
    [$a$      c.ledger := ledger_add(c.ledger, v_day, 1, 0, null, 0);
$a$, $a$      c.ledger := ledger_add(c.ledger, v_day, 1, 0, null, 0);
      c.worn := c.worn + 1;
$a$],
    [$a$          c.ledger := ledger_add(c.ledger, v_day, 1, 0, v_held->>'def',
                                 greatest(0, coalesce((v_held->>'count')::int, 1) - v_left));
$a$, $a$          c.ledger := ledger_add(c.ledger, v_day, 1, 0, v_held->>'def',
                                 greatest(0, coalesce((v_held->>'count')::int, 1) - v_left));
          c.worn := c.worn + 1;
$a$]
  ];
  i int; n int;
begin
  select pg_get_functiondef('public.worker_settle'::regproc) into v_def;
  for i in 1 .. array_length(pairs, 1) loop
    n := (length(v_def) - length(replace(v_def, pairs[i][1], ''))) / length(pairs[i][1]);
    if n <> 1 then raise exception 'worker_settle has % of anchor %, not 1: %', n, i, pairs[i][1]; end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  -- Every go's work time, at its task and at an errand, at the pace `worker_pace` makes of it.
  n := (length(v_def) - length(replace(v_def, $a$work_duration(task_skill(c)) / beast_mul(c, 'work')$a$, '')))
       / length($a$work_duration(task_skill(c)) / beast_mul(c, 'work')$a$);
  if n <> 2 then raise exception 'worker_settle has % work times, not 2', n; end if;
  v_def := replace(v_def, $a$work_duration(task_skill(c)) / beast_mul(c, 'work')$a$, $a$work_duration(task_skill(c)) / worker_pace(p_world, c, kind)$a$);
  -- And every time the row goes down, its stamina and its bed with it.
  n := (length(v_def) - length(replace(v_def, 'ledger = c.ledger', ''))) / length('ledger = c.ledger');
  if n <> 4 then raise exception 'worker_settle writes its ledger % times, not 4', n; end if;
  v_def := replace(v_def, 'ledger = c.ledger', 'ledger = c.ledger, worn = c.worn, bed = c.bed');
  execute v_def;
end $do$;

-- Its time at work since it last ate, counted where its body is settled, and put back to nought when it eats there.
do $do$
declare v_def text;
  pairs text[][] := array[
    [$a$  if c.mode <> 'wild' and c.hitched_to is null and c.hunger < graze_hungry() then
$a$, $a$  -- Its time at work since it last ate (`upkeep_for`), for a worker.
  if c.mode = 'deed' then c.unfed := c.unfed + elapsed; end if;
  if c.mode <> 'wild' and c.hitched_to is null and c.hunger < graze_hungry() then
$a$],
    [$a$    if worker_feed(p_world, p_id, c.care) is not null then
$a$, $a$    if worker_feed(p_world, p_id, c.care) is not null then
      c.unfed := 0;
$a$],
    [$a$      health = c.health, hunger = c.hunger, fleece = c.fleece, care = c.care,
$a$, $a$      health = c.health, hunger = c.hunger, fleece = c.fleece, care = c.care, unfed = c.unfed,
$a$]
  ];
  i int; n int;
begin
  select pg_get_functiondef('public.creature_settle'::regproc) into v_def;
  for i in 1 .. array_length(pairs, 1) loop
    n := (length(v_def) - length(replace(v_def, pairs[i][1], ''))) / length(pairs[i][1]);
    if n <> 1 then raise exception 'creature_settle has % of anchor %, not 1: %', n, i, pairs[i][1]; end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

-- Any meal it eats puts that back to nought: what `beast_fed` is told of, and a bucket of whey.
do $do$
declare v_def text;
  v_old text := $a$      care = least(1, coalesce(p_care, care) + fed_care() * v_q / ql_top())
$a$;
  v_new text := $a$      care = least(1, coalesce(p_care, care) + fed_care() * v_q / ql_top()),
      -- And it has eaten (`upkeep_for`).
      unfed = 0
$a$;
begin
  select pg_get_functiondef('public.beast_fed'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'beast_fed does not raise care where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;
do $do$
declare v_def text;
  v_old text := $a$update creature set hunger = least(1, hunger + whey_feed()) where world_id = p_world and id = c.id;$a$;
  v_new text := $a$update creature set hunger = least(1, hunger + whey_feed()), unfed = 0 where world_id = p_world and id = c.id;$a$;
begin
  select pg_get_functiondef('public.perform_creature(uuid,uuid,text,jsonb)'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'perform_creature does not give whey where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- And the browser is told: a rest and a bed for anybody who looks at a worker; its stamina, its time since it ate and
-- its settlement's count of its trade, for its keeper.
do $do$
declare v_def text;
  pairs text[][] := array[
    [$a$declare me uuid := auth.uid(); p player;
$a$, $a$declare me uuid := auth.uid(); p player; v_spec jsonb;
$a$],
    [$a$  if not found then raise exception 'you are not on this island'; end if;
$a$, $a$  if not found then raise exception 'you are not on this island'; end if;
  -- Every trade on your settlement and how many work it, once a call (`deed_trade_counts`).
  v_spec := deed_trade_counts(p_world, me);
$a$],
    [$a$              else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null) end
$a$, $a$              -- Resting: in its bed while it lies in it, and the seconds left (`idleSays`); or on its way to a bed.
              when c.phase = 'rest' then jsonb_build_object(
                'idleWhy', case when exists (select 1 from placed b where b.id = c.bed and b.sleeper = c.id) then 'bed' else 'rest' end,
                'idleN', greatest(0, extract(epoch from c.until - now())), 'idlePost', c.post is not null,
                'idleBed', (select b.sub from placed b where b.id = c.bed and b.sleeper = c.id))
              when c.phase = 'bed' then jsonb_build_object('idleWhy', 'tired', 'idleN', 0, 'idlePost', c.post is not null,
                'idleBed', (select b.sub from placed b where b.id = c.bed))
              else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null) end
$a$],
    [$a$      || case when c.keeper = me and c.mode = 'deed' then jsonb_build_object('ledger', c.ledger) else '{}'::jsonb end
$a$, $a$      || case when c.keeper = me and c.mode = 'deed' then jsonb_build_object('ledger', c.ledger, 'worn', c.worn, 'unfed', c.unfed,
           'specialty', coalesce((v_spec->>coalesce(c.job, (select sd.gathers from species_def sd where sd.id = c.species)))::int, 0))
         else '{}'::jsonb end
$a$]
  ];
  i int; n int;
begin
  select pg_get_functiondef('public.rpc_creatures'::regproc) into v_def;
  for i in 1 .. array_length(pairs, 1) loop
    n := (length(v_def) - length(replace(v_def, pairs[i][1], ''))) / length(pairs[i][1]);
    if n <> 1 then raise exception 'rpc_creatures has % of anchor %, not 1: %', n, i, pairs[i][1]; end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
