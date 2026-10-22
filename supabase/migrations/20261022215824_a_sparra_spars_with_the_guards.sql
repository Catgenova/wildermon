-- A Sparra kept on a settlement spars with your guards there.
--
-- Asked for: "Fighting only type wildermon have no real way to gain experience. If paired with Sparra on deed, both
-- fight and gain experience for doing so."
--
-- A Sparra on a settlement takes a worker's place, as any worker does, and has no other task. When it is idle it picks
-- a guard of yours on the same settlement (`spar_may`: a worker whose trade is keeping watch, after nothing wild, not
-- resting or tired, not yielded, not sparring with another Sparra, with the Sparra inside its work range of the totem),
-- the one that sparred longest ago first (`spar_at`), and stands for it (`creature.spar_with`); with none it says so
-- (`idle_why` 'nospar') and potters about as before. The guard, idle with nothing wild about, walks to within
-- `spar_reach` of the Sparra that picked it and spars: a go at its task (`work_duration` at its level skill over
-- `worker_pace`, its end in `spar_at`), looking round for something wild on the settlement every beat of it and
-- dropping the spar at once for it; then a blow each way (`spar_go`), neither taking anybody below `spar_yield` of its
-- health, and neither wounding, bleeding or killing (`spar_blow`). The go teaches the guard its level skill at
-- `guard_learn`, as an attack on a wild creature does, and the Sparra its fighting as a spar swing of yours does
-- (`beast_learns` 'spar'); and spends a go of each one's stamina and counts one to each one's ledger. Both are seen to
-- strike (`phase` 'strike' for the second after the go), and the Sparra picks again, so two guards take turns. One
-- that has yielded (`spar_yielded`) stands, saying until it is above `spar_back`, and spars again once it has its
-- breath back. `rpc_creatures` says who is sparring with whom (`sparWith`), for its keeper.
--
-- The browser keeps the same rules (`sparTaskSays`, `sparraStep`, `sparGo`, `sparBlows`).

set local lock_timeout = '3s';

alter table creature add column if not exists spar_with int;
alter table creature add column if not exists spar_at timestamptz;
-- A guard asks which Sparra has picked it, every go: on the few rows that have picked anybody.
create index if not exists creature_spar_with on creature (world_id, spar_with) where spar_with is not null;

-- Whether one of yours has yielded a spar: within `spar_slack` of `spar_yield` of its health (`yielded`).
create or replace function spar_yielded(c creature) returns boolean language sql stable
set search_path = public, extensions as $fn$
  select c.health <= max_health(c) * spar_yield() + spar_slack()
$fn$;

-- The health a yielded one has its breath back above, whole (`sparBack`).
create or replace function spar_back(c creature) returns int language sql stable
set search_path = public, extensions as $fn$
  select ceil(max_health(c) * spar_yield() + spar_slack())::int
$fn$;

-- One blow in a spar, as one of yours strikes, and nothing besides: no style, no ability, no wound (`sparBlow`).
create or replace function spar_blow(c creature) returns double precision language sql volatile
set search_path = public, extensions as $fn$
  select attack_of(c) * (1 + coalesce((c.skills->>'fighting')::double precision, 0) / 200) * (0.7 + random() * 0.6)
$fn$;

/*
 * Whether a guard may spar with a Sparra of its keeper's on a settlement whose totem is at a tile (`sparMay`). The
 * cheap questions first, one at a time: a Sparra's pick asks it of every worker its keeper has, and its health and its
 * range are worth working out only for a guard free to spar (measured: 6.4 ms for a pick among three asked all at once).
 */
create or replace function spar_may(p_world uuid, g creature, s creature, p_x int, p_y int) returns boolean language plpgsql stable
set search_path = public, extensions as $fn$
begin
  if g.world_id <> p_world or g.id = s.id or g.mode <> 'deed' or g.post is not null or g.keeper is distinct from s.keeper
     or g.enemy is not null or g.phase in ('rest', 'bed') or g.worn >= tire_goes()
     or (g.spar_with is not null and g.spar_with <> s.id) then
    return false;
  end if;
  if coalesce(g.job, (select sd.gathers from species_def sd where sd.id = g.species)) is distinct from 'guard' then return false; end if;
  return not spar_yielded(g)
     and greatest(abs(p_x + 0.5 - creature_x(s)), abs(p_y + 0.5 - creature_y(s))) <= work_range(g);
end $fn$;

/*
 * A go of a spar, at the time it ends (`sparBlows`): a blow each way, neither below where it yields; a go of stamina
 * and of the ledger each; the guard its level skill at `guard_learn`, the Sparra its fighting as a spar swing teaches
 * it; both seen to strike; and the Sparra free to pick again. Each row written by what it is now, so a settle of the
 * Sparra's in between is not undone.
 */
create or replace function spar_go(p_world uuid, p_guard int, p_sparra int, p_at timestamptz) returns void language plpgsql
set search_path = public, extensions as $fn$
declare g creature; s creature; v_day int := island_day(p_world); v_to_s double precision; v_to_g double precision;
begin
  select * into g from creature where world_id = p_world and id = p_guard;
  select * into s from creature where world_id = p_world and id = p_sparra for update;
  if g.id is null or s.id is null then return; end if;
  v_to_s := spar_blow(g);
  v_to_g := spar_blow(s);
  update creature set health = least(health, greatest(max_health(creature) * spar_yield(), health - v_to_s)), hurt_at = p_at,
      phase = 'strike', leg_at = p_at, leg_ends = p_at, until = p_at + interval '1 second',
      spar_with = null, worn = worn + 1, ledger = ledger_add(ledger, v_day, 1, 0, null, 0)
    where world_id = p_world and id = p_sparra;
  update creature set health = least(health, greatest(max_health(creature) * spar_yield(), health - v_to_g)), hurt_at = p_at,
      spar_with = null, spar_at = p_at, worn = worn + 1, ledger = ledger_add(ledger, v_day, 1, 0, null, 0)
    where world_id = p_world and id = p_guard;
  -- Yielded: it says until when.
  update creature set idle_why = 'yielded', idle_n = spar_back(creature)
    where world_id = p_world and id in (p_guard, p_sparra) and spar_yielded(creature);
  perform worker_learn(p_world, p_guard, coalesce((select gd.skill from gather_def gd where gd.id = 'guard'), 'body_strength'), guard_learn());
  perform beast_learns(p_world, p_sparra, 'spar');
end $fn$;

do $do$
declare v_def text;
  pairs text[][] := array[
    [$a$        v_day int; v_held jsonb; v_left int; v_bed placed;
$a$, $a$        v_day int; v_held jsonb; v_left int; v_bed placed; v_spar creature;
$a$],
    -- The row written before a strike reads it back: whom it spars with, too.
    [$a$          idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger, worn = c.worn, bed = c.bed, settled_at = now()
        where world_id = p_world and id = p_id;
      if c.enemy is not null and creature_attack(p_world, p_id, c.enemy) then done := done + 1; end if;$a$,
     $a$          idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger, worn = c.worn, bed = c.bed,
          spar_with = c.spar_with, spar_at = c.spar_at, settled_at = now()
        where world_id = p_world and id = p_id;
      if c.enemy is not null and creature_attack(p_world, p_id, c.enemy) then done := done + 1; end if;$a$],
    -- Tired, it is done sparring for now.
    [$a$    if c.phase = 'idle' and c.worn >= tire_goes() and (c.carrying is null or worker_errand(kind)) then
      v_bed := free_bed(p_world, c, cx, cy);$a$,
     $a$    if c.phase = 'idle' and c.worn >= tire_goes() and (c.carrying is null or worker_errand(kind)) then
      c.spar_with := null;
      v_bed := free_bed(p_world, c, cx, cy);$a$],
    -- A guard mid-spar: an eye on the settlement every beat of the go, and the blows at the end of it.
    [$a$    if c.phase = 'idle' and c.carrying is null
       and (fight_trade(kind) or c.enemy is not null or c.stance <> 'passive') then$a$,
     $a$    /*
     * A spar with a Sparra of yours on the settlement (`sparGo`). It looks round for something wild on the settlement
     * as often as a guard does, and drops the spar at once for it; or for the Sparra gone, let it go or yielded. At the
     * end of the go, a blow each way (`spar_go`), and the second after a go, seen to strike.
     */
    if c.phase = 'spar' then
      select * into v_spar from creature where world_id = p_world and id = c.spar_with;
      v_foe := fight_target(p_world, p_id);
      if v_foe.id is not null or v_spar.id is null or v_spar.spar_with is distinct from p_id or v_spar.mode <> 'deed'
         or spar_yielded(v_spar) then
        c.phase := 'idle'; c.spar_with := null;
        c.leg_at := c.until; c.leg_ends := c.until;
        continue;
      elsif c.spar_at > c.until then
        c.until := least(c.spar_at, c.until + interval '1.5 seconds');
        continue;
      end if;
      update creature set from_x = c.from_x, from_y = c.from_y, to_x = c.to_x, to_y = c.to_y,
          leg_at = c.leg_at, leg_ends = c.leg_ends, until = c.until, phase = c.phase,
          idle_why = c.idle_why, idle_n = c.idle_n, idle_since = c.idle_since, ledger = c.ledger, worn = c.worn,
          enemy = c.enemy, spar_with = c.spar_with, spar_at = c.spar_at, settled_at = now()
        where world_id = p_world and id = p_id;
      perform spar_go(p_world, p_id, v_spar.id, c.until);
      select * into c from creature where world_id = p_world and id = p_id;
      done := done + 1;
      c.phase := 'strike';
      c.leg_at := c.until; c.leg_ends := c.until;
      c.until := c.until + interval '1 second';
      continue;
    end if;

    if c.phase = 'idle' and c.carrying is null
       and (fight_trade(kind) or c.enemy is not null or c.stance <> 'passive') then$a$],
    -- Nothing wild about: a guard picked by a Sparra walks to it and spars; a Sparra picks the guard whose turn it is.
    [$a$    if kind = 'hunt' and c.phase = 'idle' and c.carrying is null then
      if c.work_x is not null and not exists$a$,
     $a$    /*
     * A guard a Sparra of yours on the settlement has picked (`sparGo`): to within `spar_reach` of it, and a go at its
     * task, its end in `spar_at`. Yielded, it stands until it has its breath back.
     */
    if kind = 'guard' and c.phase = 'idle' and c.carrying is null and c.post is null then
      select s.* into v_spar from creature s
       where s.world_id = p_world and s.spar_with = p_id and s.keeper = c.keeper and s.mode = 'deed'
       order by s.id limit 1;
      if v_spar.id is not null and v_spar.phase not in ('rest', 'bed') and not spar_yielded(v_spar) and not spar_yielded(c) then
        c.spar_with := v_spar.id;
        c.idle_why := null; c.idle_n := null; c.idle_since := null;
        ax := creature_x(v_spar); ay := creature_y(v_spar);
        dist := sqrt((ax - cx) ^ 2 + (ay - cy) ^ 2);
        if dist > spar_reach() then
          select * into v_step from chase_leg(p_world, cx, cy,
            cx + (ax - cx) * (dist - spar_reach() / 2) / dist, cy + (ay - cy) * (dist - spar_reach() / 2) / dist);
          if v_step.x is null then
            c.spar_with := null;
            c.from_x := cx; c.from_y := cy;
            c.leg_at := c.until; c.leg_ends := c.until;
            c.until := c.until + interval '2 seconds';
            continue;
          end if;
          c.from_x := cx; c.from_y := cy; c.to_x := v_step.x; c.to_y := v_step.y;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, sqrt((c.to_x - cx) ^ 2 + (c.to_y - cy) ^ 2) / greatest(0.1, pace)));
          c.until := c.leg_ends;
          continue;
        end if;
        c.phase := 'spar';
        c.from_x := cx; c.from_y := cy; c.to_x := cx; c.to_y := cy;
        c.leg_at := c.until; c.leg_ends := c.until;
        c.spar_at := c.until + make_interval(secs => work_duration(task_skill(c)) / worker_pace(p_world, c, kind));
        c.until := least(c.spar_at, c.until + interval '1.5 seconds');
        continue;
      end if;
      c.spar_with := null;
      if c.idle_why = 'yielded' then
        if spar_yielded(c) then
          c.idle_n := spar_back(c);
          c.from_x := cx; c.from_y := cy; c.to_x := cx; c.to_y := cy;
          c.leg_at := now(); c.leg_ends := now();
          c.until := now() + interval '2 seconds';
          exit;
        end if;
        c.idle_why := null; c.idle_n := null;
      end if;
    end if;

    /*
     * A Sparra on the settlement (`sparraStep`). Yielded, it stands until it has its breath back. Otherwise it keeps to
     * the guard it is sparring with while that one may, or picks the one whose turn it is, and stands for it to come,
     * looking again in a few seconds; with none, it says so and potters about the totem. Measured: a pick among two
     * guards about 8 ms, a guard's beat mid-spar about 4 ms, against about 40 ms for a guard's settle with nobody to
     * spar with.
     */
    if d.style = 'spar' and c.post is null and c.phase = 'idle' and c.carrying is null then
      if spar_yielded(c) then
        c.spar_with := null;
        c.idle_why := 'yielded'; c.idle_n := spar_back(c);
        c.from_x := cx; c.from_y := cy; c.to_x := cx; c.to_y := cy;
        c.leg_at := now(); c.leg_ends := now();
        c.until := now() + interval '2 seconds';
        exit;
      end if;
      if c.idle_why = 'yielded' then c.idle_why := null; c.idle_n := null; end if;
      if c.spar_with is not null then
        select * into v_spar from creature where world_id = p_world and id = c.spar_with;
        if v_spar.id is null or not spar_may(p_world, v_spar, c, v_site.x, v_site.y) then c.spar_with := null; end if;
      end if;
      if c.spar_with is null then
        select g.* into v_spar from creature g
         where g.world_id = p_world and g.keeper = c.keeper and g.mode = 'deed' and g.post is null
           and spar_may(p_world, g, c, v_site.x, v_site.y)
         order by g.spar_at nulls first, g.id
         limit 1;
        c.spar_with := v_spar.id;
      end if;
      c.from_x := cx; c.from_y := cy;
      if c.spar_with is not null then
        -- Its guard's go sets it going again when it ends (`spar_go`); this only notices a guard called away in between.
        c.idle_why := null; c.idle_n := null; c.idle_since := null;
        c.to_x := cx; c.to_y := cy;
        c.leg_at := now(); c.leg_ends := now();
        c.until := now() + interval '5 seconds';
        exit;
      end if;
      c.idle_why := 'nospar'; c.idle_n := null;
      c.idle_since := coalesce(c.idle_since, now());
      c.to_x := v_site.x + 0.5 + (hash_tile(p_id, guard, 601) * 2 - 1) * 3;
      c.to_y := v_site.y + 0.5 + (hash_tile(p_id, guard, 701) * 2 - 1) * 3;
      if not creature_tile_ok(p_world, floor(c.to_x)::int, floor(c.to_y)::int) then
        c.to_x := cx; c.to_y := cy;
      end if;
      c.leg_at := now();
      c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, sqrt((c.to_x - cx) ^ 2 + (c.to_y - cy) ^ 2) / greatest(0.1, pace)));
      c.until := c.leg_ends + worker_rest(c.idle_since);
      exit;
    end if;

    if kind = 'hunt' and c.phase = 'idle' and c.carrying is null then
      if c.work_x is not null and not exists$a$],
    -- And the row written at the end: whom it spars with, and when it last did.
    [$a$      idle_since = c.idle_since, idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger, worn = c.worn, bed = c.bed,
      enemy = c.enemy, settled_at = now()$a$,
     $a$      idle_since = c.idle_since, idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger, worn = c.worn, bed = c.bed,
      enemy = c.enemy, spar_with = c.spar_with, spar_at = c.spar_at, settled_at = now()$a$]
  ];
  i int;
begin
  select pg_get_functiondef('worker_settle(uuid, int)'::regprocedure) into v_def;
  for i in 1 .. array_length(pairs, 1) loop
    if (length(v_def) - length(replace(v_def, pairs[i][1], ''))) / length(pairs[i][1]) <> 1 then
      raise exception 'worker_settle: anchor % not found exactly once', i;
    end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  execute v_def;

  -- And for its keeper, whom each of theirs is sparring with on the settlement (`sparWith`).
  select pg_get_functiondef('rpc_creatures(uuid, double precision)'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, $a$jsonb_build_object('ledger', c.ledger, 'worn', c.worn, 'unfed', c.unfed,$a$, '')))
     / length($a$jsonb_build_object('ledger', c.ledger, 'worn', c.worn, 'unfed', c.unfed,$a$) <> 1 then
    raise exception 'rpc_creatures: anchor not found exactly once';
  end if;
  v_def := replace(v_def, $a$jsonb_build_object('ledger', c.ledger, 'worn', c.worn, 'unfed', c.unfed,$a$,
                          $a$jsonb_build_object('ledger', c.ledger, 'worn', c.worn, 'unfed', c.unfed, 'sparWith', c.spar_with,$a$);
  execute v_def;

  -- A Sparra may be set to the settlement, from the road or out of a crate, as a kind with a task may: sparring is its.
  select pg_get_functiondef('creature_refusal(uuid, uuid, text, jsonb)'::regprocedure) into v_def;
  pairs := array[
    [$a$    if d.gathers is null then return d.name || ': no task.'; end if;$a$,
     $a$    if d.gathers is null and d.style is distinct from 'spar' then return d.name || ': no task.'; end if;$a$],
    [$a$    if not worker_job_ported(coalesce(nullif(p_target->>'job', ''), d.gathers)) then$a$,
     $a$    if d.gathers is not null and not worker_job_ported(coalesce(nullif(p_target->>'job', ''), d.gathers)) then$a$]
  ];
  for i in 1 .. array_length(pairs, 1) loop
    if (length(v_def) - length(replace(v_def, pairs[i][1], ''))) / length(pairs[i][1]) <> 1 then
      raise exception 'creature_refusal: anchor % not found exactly once', i;
    end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  execute v_def;

  select pg_get_functiondef('crate_open_refusal(uuid, uuid, text, jsonb)'::regprocedure) into v_def;
  pairs := array[
    [$a$  if v_d.gathers is null then return v_d.name || ': no task.'; end if;
  if not worker_job_ported(v_d.gathers) then$a$,
     $a$  if v_d.gathers is null and v_d.style is distinct from 'spar' then return v_d.name || ': no task.'; end if;
  if v_d.gathers is not null and not worker_job_ported(v_d.gathers) then$a$]
  ];
  if (length(v_def) - length(replace(v_def, pairs[1][1], ''))) / length(pairs[1][1]) <> 1 then
    raise exception 'crate_open_refusal: anchor not found exactly once';
  end if;
  execute replace(v_def, pairs[1][1], pairs[1][2]);
end $do$;

-- What a Sparra set to the settlement is told it does (`deedJobLine`).
create or replace function deed_job_line(c creature) returns text language sql stable
set search_path to 'public', 'extensions' as $fn$
  select coalesce((select g.plain || ' within ' || work_range(c) || ' tiles of the totem'
                          || case when g.id in ('hive', 'scrub') or tend_job(g.id) then '' else '; output to the crate' end
                     from gather_def g
                    where g.id = coalesce(c.job, (select s.gathers from species_def s where s.id = c.species))),
                  case when (select s.style from species_def s where s.id = c.species) = 'spar'
                       then 'spar with a guard of yours on the settlement' else 'no task' end)
$fn$;

select private.lock_doors();
