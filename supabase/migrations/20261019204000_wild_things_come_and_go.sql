-- A wild thing goes after a day or two, and the wild things standing now go at once.
--
-- Asked: "I havent seen a single one of the new 60 wildermon. Are they populated on the island?" They were not. Of the
-- sixty or so kinds put in over the last days, fifty-two had not one wild head on the island, and the five and a half
-- thousand wild things there were nearly all born on the 17th. The kinds were in the roll (`wild_table`, about two
-- fifths of its weight) and the roll was hardly ever made: `creature_stock_block` puts a stretch of country out once
-- and afterwards puts out only what it is short of, and nothing wild ever left but what was killed or out of its
-- season. So the island stayed the mix it was on the day each stretch was first walked.
--
-- Two things, then.
--
-- A wild thing has a span (`wild_stay`, the browser's `WILD_STAY`). Each goes once it is older than its own share of
-- between once and twice that, by its id (`wild_stay_of`), so that what stood up together does not all go together,
-- and it goes when its stretch of country is next stocked, in the same place and the same way as one out of its season
-- (`wild_out_of_season`): the stocking then counts what is left and tops the stretch up off the weights as they are
-- now. Only one that has nothing to do with anybody goes (`wild_turnover`): a monster keeps its own rules, and one that
-- is anybody's, in a fight or a brawl, hunting, leading a pack, struck inside `blow_memory()`, held by id by anything
-- else (fought, brawled with, followed, struck back at, acted on by somebody, the thing that last hurt somebody), in a
-- trap, in the traces, under a rider, at a post, under a mark of any kind or being coaxed inside `coax_lapse()` stays.
-- Whatever held it by id is let go and the marks that ran out on it go with it, as when one goes out of its season,
-- because a creature's number is handed on (`creature_spawn` takes the highest and one more).
--
-- And every wild thing standing now that would go so, whatever its age, goes now, and every stretch of country is
-- owed its stocking at once. Nothing is put out in here: this runs while the island is live, and putting out the whole
-- island in one transaction over `creature` is what timed the world clock out today. `stock_tick` puts out a stretch a
-- second near whoever is walking, the one underfoot first and then the eight round it (`creature_stock_ahead`), so the
-- country round somebody is full again inside ten seconds and the rest as people walk into it.

-- The clocks wait for this, and so does anything else that writes a creature. A round of the tick moving the same
-- creatures in another order deadlocked the first try at this file: each held rows the other wanted. Each clock skips
-- its round while another holds its lock, and reads go on as before.
set local lock_timeout = '30s';
select pg_advisory_xact_lock(hashtext('world_tick')::bigint);
select pg_advisory_xact_lock(hashtext('stock_tick')::bigint);
select pg_advisory_xact_lock(hashtext('tree_tick')::bigint);
-- In a block, so a file run statement by statement outside a transaction (the rules' replays) takes it and lets it go.
do $$ begin lock table creature in exclusive mode; end $$;

set local lock_timeout = '3s';

-- The span itself, which the definitions emit from `WILD_STAY`; here too so that this file stands on its own.
create or replace function wild_stay() returns double precision language sql immutable as $fn$ select 86400::double precision $fn$;

-- How old a wild one is when it goes: `wild_stay()` and a share of as much again, the share stepping by the golden
-- ratio's from one id to the next so that neighbours land far apart. The browser's `wildStayOf`, the same arithmetic in
-- the same order, so the two come out the same to the last bit.
create or replace function wild_stay_of(p_id int) returns double precision language sql immutable as $fn$
  select wild_stay() * (1 + (p_id * ((sqrt(5::double precision) - 1) / 2) - floor(p_id * ((sqrt(5::double precision) - 1) / 2))))
$fn$;

-- Takes off every wild thing in the rectangle past its span that has nothing to do with anybody, or with `p_any`
-- every such one whatever its age, and says how many went. The browser's `wildUntouched` and `heldIds`.
create or replace function wild_turnover(p_world uuid, p_x0 int, p_y0 int, p_w int, p_h int, p_any boolean default false)
returns int language plpgsql as $fn$
declare v_n int;
begin
  with held as (
    -- What something else has hold of by its number: one creature reading the island's creatures once.
    select h.id from creature e
      cross join lateral unnest(array[e.enemy, e.brawl, nullif(e.pack_lead, e.id),
        case when e.hurt_at > now() - make_interval(secs => blow_memory()) then e.hurt_by end]) as h(id)
     where e.world_id = p_world and h.id is not null
       and (e.enemy is not null or e.brawl is not null or e.pack_lead is not null or e.hurt_by is not null)
    union
    -- What somebody is doing something to, and what last struck somebody.
    select (p.act_target->>'id')::int from player p
     where p.world_id = p_world and p.act is not null and p.act_target->>'kind' in ('creature', 'enemy', 'wildermon')
    union
    select (p.stats->>'hurtBy')::int from player p where p.world_id = p_world and p.stats ? 'hurtBy'
    union
    -- And what is under a mark, a judgment or a weakening that still holds, or owes a blow.
    select m.creature_id from class_mark m where m.world_id = p_world and m.until > now()
    union
    select m.creature_id from faith_mark m where m.world_id = p_world and m.until > now()
    union
    select m.creature_id from faith_weak m where m.world_id = p_world and m.until > now()
    union
    select o.creature_id from faith_owed o where o.world_id = p_world
  ), gone as (
    delete from creature c using species_def s
     where c.world_id = p_world and c.mode = 'wild' and s.id = c.species and not coalesce(s.monster, false)
       and c.to_x >= p_x0 and c.to_x < p_x0 + p_w and c.to_y >= p_y0 and c.to_y < p_y0 + p_h
       and (p_any or c.born is null or c.born <= now() - make_interval(secs => wild_stay_of(c.id)))
       and c.keeper is null and c.trapped is null and c.hitched_to is null and c.rider is null and c.post is null
       and c.enemy is null and c.brawl is null and c.hunting is null and c.pack_lead is null
       and (c.hurt_at is null or c.hurt_at <= now() - make_interval(secs => blow_memory()))
       and (c.coaxed = 0 or c.coaxed_at is null or c.coaxed_at <= now() - make_interval(secs => coax_lapse()))
       and not exists (select 1 from held where held.id = c.id)
    returning c.id
  ), freed as (
    update creature e set enemy = null from gone g where e.world_id = p_world and e.enemy = g.id returning 1
  ), unmarked as (
    delete from class_mark m using gone g where m.world_id = p_world and m.creature_id = g.id returning 1
  ), unjudged as (
    delete from faith_mark m using gone g where m.world_id = p_world and m.creature_id = g.id returning 1
  ), unweakened as (
    delete from faith_weak m using gone g where m.world_id = p_world and m.creature_id = g.id returning 1
  )
  select count(*) into v_n from gone;
  return v_n;
end $fn$;

-- Both stockings take off what has had its span, after what is out of its season and before anything is counted.
do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    (1, 'creature_stock_block', array[
      $$  perform wild_out_of_season(p_world, v_x0, v_y0, v_w, v_h);
$$], array[
      $$  perform wild_out_of_season(p_world, v_x0, v_y0, v_w, v_h);
  -- And what has had its span and has nothing to do with anybody, so the top-up below is rolled off the weights as
  -- they are now (`wild_turnover`, `wild_stay`).
  perform wild_turnover(p_world, v_x0, v_y0, v_w, v_h);
$$], array[1]),
    (2, 'creature_stock', array[
      $$  perform wild_out_of_season(p_world, 0, 0, size, size);
$$], array[
      $$  perform wild_out_of_season(p_world, 0, 0, size, size);
  -- And what has had its span (`wild_turnover`).
  perform wild_turnover(p_world, 0, 0, size, size);
$$], array[1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

-- Every wild thing standing now that would go so, whatever its age, on every island.
select w.id as world, wild_turnover(w.id, 0, 0, w.size, w.size, true) as gone from world w;

-- And every stretch of country owed its stocking now: the next pass of `stock_tick` near anybody tops it up.
update world_stocked set at = '-infinity';

select private.lock_doors();
