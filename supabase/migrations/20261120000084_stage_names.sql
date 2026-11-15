/*
 * An evolved wildermon is named for its stage in a fight and on its carcass.
 *
 * Reported: "evolved forms of wildermon appear as their base form in combat logs and corpses, eg a bunnycourser's
 * corpse is shown as a thistlekit". A creature's `species` is its line, and `kind_name_at` names it at the stage it is
 * at; the fight, the kill and the carcass took the line's own name off `species_def.name` instead. Now:
 *
 *   * a carcass carries the name of the stage it died at (`item.extra`, as it carried the line's): killed, culled, dead
 *     of old age or of a blow taken for its keeper (`wound_beast`, `old_age_sweep`, `class_beast_take`). `corpse_species`
 *     already knows a stage's name, so butchering it goes on as before, and `item_name` (the pack, the ground and
 *     Examine) names it from that;
 *   * butchering says the stage it carries (`corpse_kind`); fur stays labelled with its line, for a pelt rug's kind;
 *   * every fight line that names a creature, both ways, names it at its stage: blows, shots and misses, kills, a
 *     companion's kill to its keeper, fighting back, a hunt, a flight, a heavy blow, a riposte, a thorn, an enchantment's
 *     word, a companion turning on one, the spells and Examine.
 *
 * A carcass lying about from before this keeps its line's name: what stage it died at was not written anywhere.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- What a carcass is of, by the name it carries: the stage's, when it carries one, or its line's (`corpseKind`).
create or replace function corpse_kind(p_extra text) returns text
language sql stable as $$
  select coalesce((select n from unnest(coalesce(sd.stages, '{}')) n where lower(n) = lower(p_extra) limit 1), sd.name)
    from corpse_species(p_extra) sd
$$;

-- A record of a creature's kind, named at its stage, where the function names it off that record.
select pg_temp.patch_fn('wound_beast(uuid, integer, double precision, double precision, double precision, uuid, integer)',
  $o$  select * into d from species_def where id = c.species;$o$,
  $n$  select * into d from species_def where id = c.species;
  -- Named at its stage, in every line and on its carcass (`kind_name_at`).
  d.name := kind_name_at(c);$n$);
select pg_temp.patch_fn('perform_fight(uuid, uuid, text, jsonb)',
  $o$    select * into d from species_def where id = c.species;$o$,
  $n$    select * into d from species_def where id = c.species;
    d.name := kind_name_at(c);$n$, 2);
select pg_temp.patch_fn('class_blow(uuid, uuid, integer, double precision, boolean, text, double precision, double precision)',
  $o$  select * into d from species_def where id = c.species;$o$,
  $n$  select * into d from species_def where id = c.species;
  d.name := kind_name_at(c);$n$);
select pg_temp.patch_fn('class_shot(uuid, uuid, integer, double precision, boolean, double precision, boolean, text)',
  $o$  select * into d from species_def where id = c.species;$o$,
  $n$  select * into d from species_def where id = c.species;
  d.name := kind_name_at(c);$n$);
select pg_temp.patch_fn('class_beast_blow(uuid, integer, integer, double precision)',
  $o$  select * into d from species_def where id = t.species;$o$,
  $n$  select * into d from species_def where id = t.species;
  d.name := kind_name_at(t);$n$);
select pg_temp.patch_fn('class_spell_cast(uuid, uuid, text, jsonb)',
  $o$    select * into d from species_def where id = c.species;$o$,
  $n$    select * into d from species_def where id = c.species;
    d.name := kind_name_at(c);$n$);
select pg_temp.patch_fn('faith_spell_cast(uuid, uuid, text, jsonb)',
  $o$    select * into d from species_def where id = c.species;$o$,
  $n$    select * into d from species_def where id = c.species;
    d.name := kind_name_at(c);$n$);
select pg_temp.patch_fn('warder_watched(uuid, uuid, integer)',
  $o$  select * into d from species_def where id = c.species;$o$,
  $n$  select * into d from species_def where id = c.species;
  d.name := kind_name_at(c);$n$);
select pg_temp.patch_fn('perform_creature(uuid, uuid, text, jsonb)',
  $o$  select * into d from species_def where id = c.species;$o$,
  $n$  select * into d from species_def where id = c.species;
  d.name := kind_name_at(c);$n$);
select pg_temp.patch_fn('perform_creature(uuid, uuid, text, jsonb)',
  $o$lower((select sd.name from creature q
      join species_def sd on sd.id = q.species where q.world_id = p_world and q.id = (p_target->>'foe')::int))$o$,
  $n$lower((select kind_name_at(q) from creature q
      where q.world_id = p_world and q.id = (p_target->>'foe')::int))$n$);

-- A carcass named for the stage it died at.
select pg_temp.patch_fn('old_age_sweep(uuid)',
  $o$    select name into v_kind from species_def where id = c.species;$o$,
  $n$    v_kind := kind_name_at(c);$n$);
select pg_temp.patch_fn('class_beast_take(uuid, integer, double precision, integer)',
  $o$  select name into v_name from species_def where id = c.species;$o$,
  $n$  v_name := kind_name_at(c);$n$);

-- Butchered: the stage the carcass carries.
select pg_temp.patch_fn('perform_fight(uuid, uuid, text, jsonb)',
  $o$lower(sp.name)$o$, $n$lower(corpse_kind(corpse.extra))$n$, 2);

-- A creature hunting you, and one in a brawl with yours, named at its stage.
select pg_temp.patch_fn('hunt_settle(uuid, creature, species_def, age_def)',
  $o$d.name$o$, $n$kind_name_at(c)$n$, 9);
select pg_temp.patch_fn('brawl_settle(uuid, creature, species_def, age_def)',
  $o$d.name || ' fled.'$o$, $n$kind_name_at(c) || ' fled.'$n$);

-- And off a name looked up on its own.
select pg_temp.patch_fn('fight_back(uuid, uuid, integer)',
  $o$select lower(sd.name) into v_species from species_def sd where sd.id = c.species;$o$,
  $n$v_species := lower(kind_name_at(c));$n$);
select pg_temp.patch_fn('engage_beast(uuid, integer, uuid)',
  $o$select sd.timid, sd.pack, lower(sd.name) into v_timid, v_pack, v_name from species_def sd where sd.id = c.species;$o$,
  $n$select sd.timid, sd.pack, lower(kind_name_at(c)) into v_timid, v_pack, v_name from species_def sd where sd.id = c.species;$n$);
select pg_temp.patch_fn('companion_settle(uuid, integer)',
  $o$lower((select name from species_def where id = q.species))$o$,
  $n$lower(kind_name_at(q))$n$);
select pg_temp.patch_fn('beast_threat(uuid, integer, integer)',
  $o$(select name from species_def where id = c.species)$o$,
  $n$kind_name_at(c)$n$);
select pg_temp.patch_fn('enchant_hit(uuid, uuid, integer, item, double precision)',
  $o$lower((select s.name from species_def s where s.id = c.species))$o$,
  $n$lower(kind_name_at(c))$n$);
select pg_temp.patch_fn('enchant_shot(uuid, uuid, integer, item)',
  $o$lower((select s.name from species_def s where s.id = c.species))$o$,
  $n$lower(kind_name_at(c))$n$);
select pg_temp.patch_fn('hurt_player(uuid, uuid, double precision, text, text)',
  $o$(select lower(name) from species_def where id = v_from.species)$o$,
  $n$lower(kind_name_at(v_from))$n$, 6);
select pg_temp.patch_fn('side_blow(uuid, uuid, integer, text, double precision)',
  $o$select lower(sd.name) into v_name from creature c join species_def sd on sd.id = c.species$o$,
  $n$select lower(kind_name_at(c)) into v_name from creature c$n$);
select pg_temp.patch_fn('style_blow(uuid, creature, integer, double precision)',
  $o$returning lower(sd.name) as name$o$,
  $n$returning lower(kind_name_at(o)) as name$n$);
select pg_temp.patch_fn('warder_thorns(uuid, uuid, integer, double precision)',
  $o$(select lower(name) from species_def where id = c.species)$o$,
  $n$lower(kind_name_at(c))$n$);
select pg_temp.patch_fn('do_spell(uuid, uuid, text, jsonb)',
  $o$lower((select name from species_def where id = c.species))$o$,
  $n$lower(kind_name_at(c))$n$, 2);

select private.lock_doors();
