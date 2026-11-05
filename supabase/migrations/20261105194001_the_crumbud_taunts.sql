-- The Crumbud, the Gingerbark and the Yuleheart.
--
-- Asked for: "New wildermon, Christmas special running dec 1 > dec 25th annually. Crumbud gingerbark yuleheart. Combat
-- pet that taunts all nearby targets on a cooldown". The kind itself, and its season (`season_from` 1201, `season_to`
-- 1225, the browser's `YULE_SEASON`), come in with the definitions after this; a season is read wherever the Whispet's
-- is (`season_holds`, `suits`, `wild_out_of_season`), so nothing more is needed for it here. What is new is its ability:
--
--   * a Taunt (`AbilityId` 'taunt'): every wild creature within `taunt_reach` tiles of it that is after anybody -- you,
--     another of yours, or in a brawl -- and every hunter and monster there, turns on it and stays on it for
--     `taunt_secs`, as a Guardian's Call turns them (`brawl`, `threat_at`); a 'taunt' mark on each for as long. Not one
--     that is timid, already on it, or running from a Fear. None turned, it is not used. It is used besides its blow,
--     not instead of one, and not again for `taunt_rest` (`ability_rest`, cut by its stage-3 skill and its blood). A
--     wild one fights as any other does (`beast_ability`).

-- What the definitions bring in, ahead of them, for what is written here to be read against: a Taunt's three numbers
-- (`TAUNT_REACH`, `TAUNT_SECS`, `TAUNT_REST`), which the definitions after this write again from the browser's.
set local lock_timeout = '3s';
create or replace function taunt_reach() returns double precision language sql immutable as $fn$ select 6::double precision $fn$;
create or replace function taunt_secs() returns double precision language sql immutable as $fn$ select 6::double precision $fn$;
create or replace function taunt_rest() returns double precision language sql immutable as $fn$ select 20::double precision $fn$;

-- Seconds between goes at an ability, and its name: its spell's, a frost breath's, a Fear's or a Taunt's (`abilityRest`, `abilityName`).
create or replace function ability_rest(p_id text) returns double precision language sql stable as $fn$
  select case when p_id = 'frost_breath' then frost_breath_rest() when p_id = 'fear' then fear_rest()
              when p_id = 'taunt' then taunt_rest()
              else (select s.rest from class_spell s where s.id = p_id) end
$fn$;
create or replace function ability_name(p_id text) returns text language sql stable as $fn$
  select case when p_id = 'frost_breath' then 'Frost Breath' when p_id = 'fear' then 'Fear' when p_id = 'taunt' then 'Taunt'
              else (select s.name from class_spell s where s.id = p_id) end
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A Taunt: what is after anybody near it, and every hunter and monster there, turns on it.
    (1, 'beast_ability', $$  when 'binder_root' then$$,
                         $$  when 'taunt' then
    for r in
      update creature o set brawl = a.id, windup_at = null,
          -- Held on it for the whole of the taunt, as a Guardian's Call holds them.
          threat_at = now() + make_interval(secs => taunt_secs() - threat_hold())
        from species_def sd
       where sd.id = o.species and not coalesce(sd.timid, false)
         and o.world_id = p_world and o.mode = 'wild' and o.health > 0 and o.brawl is distinct from a.id
         and beast_mark(p_world, o.id, 'fear', 0) <= 0
         and (o.hunting is not null or o.brawl is not null or coalesce(sd.hunter, false) or coalesce(sd.monster, false)
              or exists (select 1 from creature e where e.world_id = p_world and e.id = o.enemy and e.mode <> 'wild'))
         and (creature_x(o) - creature_x(a)) ^ 2 + (creature_y(o) - creature_y(a)) ^ 2 <= taunt_reach() ^ 2
      returning o.id
    loop
      perform class_mark_put(p_world, r.id, 'taunt', 1, taunt_secs(), a.keeper);
      v_n := v_n + 1;
    end loop;
    if v_n = 0 then return null; end if;
    v_spent := false;
  when 'binder_root' then$$, 1)
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
