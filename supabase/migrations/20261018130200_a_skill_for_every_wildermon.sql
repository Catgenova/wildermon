-- A skill for every wildermon.
--
-- Asked for: "Give skill-less wildermon a skill that levels as they complete tasks". A kind with no trade and no
-- traces now learns one skill of its own, which is its level (`creature_level`): a woola, a quill and a cudda learn
-- animal husbandry each time they are sheared, plucked or milked; a sparra learns fighting each time a spar swing lands
-- on it; a bura and a warda learn body strength and awareness for every `out_every` seconds they are out at your heel
-- or keeping a settlement, and a lume awareness for every `out_every` of it after dark. Which skill and what teaches
-- it is the species' `learns` and `learns_by`, which come in with the definitions. The browser's `Creatures.learnBy`.

-- What the definitions bring in, ahead of them: the columns, and the numbers (`OUT_EVERY`, `LEARNS_GAIN`), which the
-- definitions that come in after this write again from the browser's.
set local lock_timeout = '3s';
alter table species_def add column if not exists learns text;
alter table species_def add column if not exists learns_by text;
create or replace function out_every() returns double precision language sql immutable as $fn$ select 30::double precision $fn$;
create or replace function learns_gain_tended() returns double precision language sql immutable as $fn$ select 0.3::double precision $fn$;
create or replace function learns_gain_spar() returns double precision language sql immutable as $fn$ select 0.05::double precision $fn$;
create or replace function learns_gain_out() returns double precision language sql immutable as $fn$ select 0.2::double precision $fn$;
create or replace function learns_gain_dark() returns double precision language sql immutable as $fn$ select 0.2::double precision $fn$;

-- A go at its own task, for a kind that learns its own skill this way (`learnBy`).
create or replace function beast_learns(p_world uuid, p_id int, p_by text) returns void language plpgsql as $fn$
declare v_skill text;
begin
  select sd.learns into v_skill from creature c join species_def sd on sd.id = c.species
   where c.world_id = p_world and c.id = p_id and c.mode <> 'wild' and sd.learns_by = p_by;
  if v_skill is null then return; end if;
  perform worker_learn(p_world, p_id, v_skill, case p_by when 'tended' then learns_gain_tended() when 'spar' then learns_gain_spar()
                                                         when 'out' then learns_gain_out() else learns_gain_dark() end);
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Born knowing a little of it, as a worker is of its trade.
    (1, 'creature_spawn', $$  if gskill is not null then sk := jsonb_build_object(gskill, 1); end if;$$,
                          $$  if gskill is not null then sk := jsonb_build_object(gskill, 1); end if;
  -- And a kind with no trade, its own (`LearnsBy`).
  if d.learns is not null then sk := sk || jsonb_build_object(d.learns, 1); end if;$$, 1),

    -- Sheared, plucked or milked: by you, and by a sheela.
    (2, 'perform_creature', $$    update creature set fleece = 0 where world_id = p_world and id = c.id;$$,
                            $$    update creature set fleece = 0 where world_id = p_world and id = c.id;
    perform beast_learns(p_world, c.id, 'tended');$$, 1),
    (3, 'milk_go', $$  update creature set fleece = 0 where world_id = p_world and id = c.id;$$,
                   $$  update creature set fleece = 0 where world_id = p_world and id = c.id;
  perform beast_learns(p_world, c.id, 'tended');$$, 1),
    (4, 'errand_do', $$        update creature set fleece = 0 where world_id = p_world and id = o.id;$$,
                     $$        update creature set fleece = 0 where world_id = p_world and id = o.id;
        perform beast_learns(p_world, o.id, 'tended');$$, 1),

    -- A spar swing that lands.
    (5, 'perform_fight', $$        update creature set health = health - dmg, hurt_at = now() where world_id = p_world and id = c.id;$$,
                         $$        update creature set health = health - dmg, hurt_at = now() where world_id = p_world and id = c.id;
        perform beast_learns(p_world, c.id, 'spar');$$, 1),

    -- Being out: a go for every `out_every` of it, after dark for one that learns in the dark. However long it has been,
    -- no more than a working day's worth at once.
    (6, 'creature_settle', $$  c.care := greatest(0, c.care - elapsed$$,
                           $$  if c.mode in ('active', 'deed') and d.learns is not null and (d.learns_by = 'out' or (d.learns_by = 'dark' and is_night(p_world))) then
    n := floor(elapsed / out_every())::int + case when random() < elapsed / out_every() - floor(elapsed / out_every()) then 1 else 0 end;
    for i in 1 .. least(n, 960) loop perform beast_learns(p_world, p_id, d.learns_by); end loop;
  end if;
  c.care := greatest(0, c.care - elapsed$$, 1)
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
