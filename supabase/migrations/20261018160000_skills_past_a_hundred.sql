-- Skills past a hundred.
--
-- Asked for: "Allow skills to continue to gain exp above 100.00 on a exponential 2^. This is for leaderboard purpose
-- only". A skill goes on climbing past `skill_top`, and what a go is worth past it is divided by `past_top` for every
-- point already over: the hundred-and-first point takes twice the goes the hundredth did at its floor, the next twice
-- that again. Everything that uses a skill reads it no higher than `skill_top` (`skill_of`), so what you make, how
-- often it comes off and how fast are as they were at a hundred; the boards, which read the table, read the whole of
-- it, and so does what a raise says (`skill_standing`). The browser's `SKILL_TOP`, `PAST_TOP`, `Skills.get` and
-- `Skills.standing`.

-- A skill is kept to double precision rather than single. Single precision near a hundred tells apart nothing finer
-- than about eight millionths, and a go past a hundred and two is worth less than that, so it would come to nothing at
-- all.
set local lock_timeout = '3s';
alter table skill alter column value type double precision;

-- What the definitions bring in, ahead of them.
create or replace function skill_top() returns double precision language sql immutable as $fn$ select 100::double precision $fn$;
create or replace function past_top() returns double precision language sql immutable as $fn$ select 2::double precision $fn$;

-- One gain, halved again for every point past the top (`skillGain`).
create or replace function skill_gain_of(p_v double precision, p_base double precision, p_roll double precision)
  returns double precision language sql immutable as $fn$
  select greatest(min_gain(), p_base * skill_room(p_v)) * p_roll * gain_rate() / power(past_top(), greatest(0, p_v - skill_top()))
$fn$;

-- The whole of a skill, past the top too (`Skills.standing`).
create or replace function skill_standing(p_world uuid, p_uid uuid, p_id text) returns double precision language sql stable as $fn$
  select coalesce(
     (select s.value from skill s where s.world_id = p_world and s.uid = p_uid and s.id = p_id),
     (select d.start from skill_def d where d.id = p_id),
     1)
$fn$;

-- A skill as everything that uses it reads it: no more than the top (`Skills.get`).
create or replace function skill_of(p_world uuid, p_uid uuid, p_id text) returns double precision language sql stable as $fn$
  select least(skill_top(), skill_standing(p_world, p_uid, p_id))
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A raise counts from the whole of the skill and is not stopped at a hundred.
    (1, 'skill_raise', $$  was := skill_of(p_world, p_uid, p_id);$$,
                       $$  was := skill_standing(p_world, p_uid, p_id);$$, 1),
    (2, 'skill_raise', $$  now_v := least(100, was + skill_gain_of($$,
                       $$  now_v := (was + skill_gain_of($$, 1),
    -- And says what it came to, past the top too.
    (3, 'skill_said', $$  now_at := skill_of(p_world, p_uid, p_id);$$,
                      $$  now_at := skill_standing(p_world, p_uid, p_id);$$, 1)
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
