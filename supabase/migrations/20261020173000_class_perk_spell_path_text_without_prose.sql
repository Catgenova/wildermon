-- Class, perk, rite, spell, path and skill text: labels and numbers, no prose.
--
-- Asked for: "Review all game text for cryptic AI talk. We dont need 'a boat under oars'. Just say 'boat row speed'. We
-- want no prose." The notes themselves (perks, class spells, path picks, classes, rites) reach the island through the
-- definitions; this is the text the island's own functions write: the refusals of a class, a perk, a node, a rite and a
-- spell, the line a class taken or a sitting says, and what a technique says when it is cast. Each is the browser's
-- string, word for word, where the browser has one. Nothing a rule decides changes.
--
-- Every change is a text patch on the function as it stands (`private.prose_patch`): the old text must be there exactly
-- once, so a function somebody else has since changed fails loudly here rather than quietly keeping its old words.

set local lock_timeout = '3s';

create or replace function private.prose_patch(p_name text, p_old text, p_new text) returns void
language plpgsql as $fn$
declare v_def text; v_n int; v_count int;
begin
  select count(*) into v_count from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = p_name;
  if v_count <> 1 then raise exception '% has % definitions, not 1', p_name, v_count; end if;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = p_name;
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> 1 then raise exception '% has % of «%», not 1', p_name, v_n, p_old; end if;
  execute replace(v_def, p_old, p_new);
end $fn$;
revoke all on function private.prose_patch(text, text, text) from public;
-- The same, for text that stands in a function `p_n` times, every one of which changes.
create or replace function private.prose_patch_all(p_name text, p_old text, p_new text, p_n int) returns void
language plpgsql as $fn$
declare v_def text; v_n int;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = p_name;
  if v_def is null then raise exception '% is not there', p_name; end if;
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_n then raise exception '% has % of «%», not %', p_name, v_n, p_old, p_n; end if;
  execute replace(v_def, p_old, p_new);
end $fn$;
revoke all on function private.prose_patch_all(text, text, text, int) from public;

-- A class, a perk, a node and a rite refused (`classRefusal`, `perkRefusal`, `nodeRefusal`, `riteRefusal`).
select private.prose_patch('class_refusal', $$  return 'You are not ' || case when lower(c.name) ~ '^[aeiou]' then 'an ' else 'a ' end
      || lower(c.name) || ' yet. That wants ' || class_at()::int
      || ' in one of ' || class_wants(p_class) || '.';$$,
  $$  return 'Opens at ' || class_at()::int || ' in one of: ' || class_wants(p_class) || '.';$$);

select private.prose_patch('perk_refusal', $$    return 'That is the ' || lower(c.name) || '’s, and you are not one.';$$,
  $$    return 'Not your class: ' || c.name || '.';$$);
select private.prose_patch('perk_refusal', $$    return 'You have that already.';$$, $$    return 'Already taken.';$$);
select private.prose_patch('perk_refusal', $$  if v_other is not null then return 'You took ' || v_other || ' at this tier.'; end if;$$,
  $$  if v_other is not null then return 'Tier already taken: ' || v_other || '.'; end if;$$);
select private.prose_patch('perk_refusal',
  $$      return 'This tier opens at class level ' || v_at || '; you have ' || floor(p.class_level)::int || '.';$$,
  $$      return 'Tier opens at class level ' || v_at || ' (have ' || floor(p.class_level)::int || ').';$$);
select private.prose_patch('perk_refusal', $$    return 'This tier opens at ' || v_at || ' in ' || replace(c.main, '_', ' ')
        || '; you have ' || floor(v_main)::int || '.';$$,
  $$    return 'Tier opens at ' || replace(c.main, '_', ' ') || ' ' || v_at || ' (have ' || floor(v_main)::int || ').';$$);

select private.prose_patch('node_refusal', $$    return 'That is the ' || lower(c.name) || '’s, and you are not one.';$$,
  $$    return 'Not your class: ' || c.name || '.';$$);
select private.prose_patch('node_refusal', $$    return 'You have that already.';$$, $$    return 'Already taken.';$$);
select private.prose_patch('node_refusal', $$    return (select name from class_node where id = n.needs) || ' comes first.';$$,
  $$    return 'Needs ' || (select name from class_node where id = n.needs) || ' first.';$$);
select private.prose_patch('node_refusal', $$    return n.name || ' wants ' || n.cost || ' point' || case when n.cost = 1 then '' else 's' end
        || ' and you have ' || v_left || '. Every ' || class_point_step()::int
        || ' in the trade is another one.';$$,
  $$    return n.name || ': need ' || n.cost || case when n.cost = 1 then ' point' else ' points' end
        || ' (have ' || v_left || '). One point per ' || class_point_step()::int || ' skill.';$$);

select private.prose_patch('rite_refusal', $$    return 'That is the ' || lower(c.name) || '’s to call, and you are not one.';$$,
  $$    return 'Not your class: ' || c.name || '.';$$);
select private.prose_patch('rite_refusal', $$    return r.name || ' takes ' || r.level::int || ' faith; you have '
        || floor(skill_of(p_world, p_uid, faith_skill()))::int || '.';$$,
  $$    return r.name || ': need ' || r.level::int || ' faith (have '
        || floor(skill_of(p_world, p_uid, faith_skill()))::int || ').';$$);
select private.prose_patch('rite_refusal', $$    return r.name || ' costs ' || r.cost::int || ' favour; you hold '
        || floor(v_have)::int || '. Pray at an altar.';$$,
  $$    return r.name || ': need ' || r.cost::int || ' favour (have ' || floor(v_have)::int || ').';$$);
select private.prose_patch('rite_refusal', $$    return r.name || ' again in ' || ceil(v_rest / 60)::int || ' minutes.';$$,
  $$    return r.name || ': ready in ' || ceil(v_rest / 60)::int || ' min.';$$);

-- A class taken up, or changed for another.
select private.prose_patch('rpc_take_class', $$    return jsonb_build_object('why', 'You are already a ' || lower(c.name) || '.');$$,
  $$    return jsonb_build_object('why', 'Already your class: ' || c.name || '.');$$);
select private.prose_patch('rpc_take_class', $$      return jsonb_build_object('why', 'Putting a trade down and taking another up costs '
        || v_cost || ' silver. You have ' || purse(p_world, me) || '.');$$,
  $$      return jsonb_build_object('why', 'Class change: need ' || v_cost || ' silver (have ' || purse(p_world, me) || ').');$$);
select private.prose_patch('rpc_take_class', $$    then 'You take up the ' || lower(c.name) || '’s trade. ' || c.lever
    else 'You put the ' || lower((select name from class_def where id = v_had))
         || '’s trade down and take up the ' || lower(c.name) || '’s, for '
         || v_cost || ' silver. ' || c.lever end, 'system');$$,
  $$    then 'Class taken: ' || c.name || '. ' || c.lever
    else 'Class changed: ' || (select name from class_def where id = v_had) || ' to ' || c.name || ', '
         || v_cost || ' silver. ' || c.lever end, 'system');$$);
select private.prose_patch('rpc_take_class', $$'There is no such trade.'$$, $$'No such class.'$$);
select private.prose_patch('class_refusal', $$'There is no such trade.'$$, $$'No such class.'$$);

-- An enchantment set, not taken, refused and worked (`enchantedSaid`, `notTakenSaid`, `placedNotTakenSaid`,
-- `alreadyEnchanted`, `enchantHitSaid`). What each one does, and the words its refusals use, are in the definitions.
create or replace function enchanted_said(p_name text, p_thing text, p_kind text, p_ql double precision, p_held text,
  p_scroll_ql double precision, p_item_ql double precision)
returns text language sql immutable as $fn$
  select 'Enchanted: ' || p_thing || ', ' || p_name || ' QL ' || enchant_ql_word(p_ql)
      || case p_held when 'item' then ' (capped at ' || p_kind || ' QL ' || enchant_ql_word(p_item_ql) || ')'
                     when 'scroll' then ' (capped at scroll QL ' || enchant_ql_word(p_scroll_ql) || ')' else '' end
      || '. Scroll used.'
$fn$;

create or replace function not_taken_said(p_name text, p_thing text, p_how text, p_dmg double precision)
returns text language sql immutable as $fn$
  select p_name || ' failed: ' || p_thing || case p_how
      when 'broke' then ' destroyed. Scroll used.'
      when 'harmBroke' then ' +' || enchant_harm()::bigint || ' damage, destroyed. Scroll used.'
      else ' +' || enchant_harm()::bigint || ' damage (now ' || enchant_ql_word(p_dmg) || '). Scroll used.' end
$fn$;

create or replace function placed_not_taken_said(p_name text, p_thing text, p_harm double precision, p_dmg double precision)
returns text language sql immutable as $fn$
  select p_name || ' failed: ' || p_thing || ' +' || enchant_ql_word(p_harm)
      || ' damage (now ' || enchant_ql_word(p_dmg) || '). Scroll used.'
$fn$;

select private.prose_patch('enchant_setting',
  $$    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_item.enchant->>'id'), o_item.enchant->>'id')
      || ' at QL ' ||$$,
  $$    o_why := 'Already enchanted: ' || coalesce((select e.name from enchantments() e where e.id = o_item.enchant->>'id'), o_item.enchant->>'id')
      || ' QL ' ||$$);
select private.prose_patch('enchant_setting_crate',
  $$    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_crate.enchant->>'id'), o_crate.enchant->>'id')
      || ' at QL ' ||$$,
  $$    o_why := 'Already enchanted: ' || coalesce((select e.name from enchantments() e where e.id = o_crate.enchant->>'id'), o_crate.enchant->>'id')
      || ' QL ' ||$$);
select private.prose_patch('enchant_setting_placed',
  $$    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_place.enchant->>'id'), o_place.enchant->>'id')
      || ' at QL ' ||$$,
  $$    o_why := 'Already enchanted: ' || coalesce((select e.name from enchantments() e where e.id = o_place.enchant->>'id'), o_place.enchant->>'id')
      || ' QL ' ||$$);
select private.prose_patch('enchant_hit', $$    perform tell(p_world, p_uid, 'Your ' || e.name || ' '
      || replace($$, $$    perform tell(p_world, p_uid, e.name || ': '
      || replace($$);
select private.prose_patch('enchant_shot', $$  perform tell(p_world, p_uid, 'Your ' || e.name || ' '
    || replace($$, $$  perform tell(p_world, p_uid, e.name || ': '
    || replace($$);

-- A Bauble of Regret used or refused, and a bauble set into an altar (`REGRET_SAID`, `regretEmpty`, `regretDone`,
-- `BAUBLE_SAID`, `fullSaid`, the set line).
select private.prose_patch('rpc_regret_class', $$    return jsonb_build_object('why', 'You have no ' || case when p_kind = 'craft' then 'crafting' else 'fighting' end
      || ' trade to undo.');$$,
  $$    return jsonb_build_object('why', 'No ' || case when p_kind = 'craft' then 'crafting' else 'fighting' end
      || ' class to undo.');$$);
select private.prose_patch('rpc_regret_class',
  $$      return jsonb_build_object('why', 'Your Bauble of Regret is kept back. Put it back in the pack first.');$$,
  $$      return jsonb_build_object('why', 'Bauble of Regret is kept back: return it to the pack.');$$);
select private.prose_patch('rpc_regret_class', $$    return jsonb_build_object('why', 'You need a Bauble of Regret to undo a trade.');$$,
  $$    return jsonb_build_object('why', 'Need a Bauble of Regret.');$$);
select private.prose_patch('rpc_regret_class', $$  perform tell(p_world, me, 'The Bauble of Regret breaks, and the '
    || lower((select c.name from class_def c where c.id = v_had))
    || '’s trade is put down as though you had never taken it up, its '
    || case when exists (select 1 from class_perk k where k.class = v_had) then 'perks' else 'tree' end
    || ' with it. '
    || 'The next ' || case when p_kind = 'craft' then 'crafting' else 'fighting' end
    || ' trade you take up costs nothing, not ' || class_change_cost()::bigint || ' silver.', 'system');$$,
  $$  perform tell(p_world, me, 'Bauble of Regret used: '
    || (select c.name from class_def c where c.id = v_had) || ' removed, with its '
    || case when exists (select 1 from class_perk k where k.class = v_had) then 'perks' else 'tree' end
    || '. Next ' || case when p_kind = 'craft' then 'crafting' else 'fighting' end
    || ' class: free (base ' || class_change_cost()::bigint || ' silver).', 'system');$$);

select private.prose_patch('bauble_setting', $$o_why := 'That is not an altar.';$$, $$o_why := 'Not an altar.';$$);
select private.prose_patch('bauble_setting', $$o_why := 'Stand at the altar.';$$, $$o_why := 'Too far from the altar.';$$);
select private.prose_patch('bauble_setting', $$o_why := 'This altar does not stand on a settlement of yours.';$$,
  $$o_why := 'Altar not on your settlement.';$$);
select private.prose_patch('bauble_setting', $$o_why := 'Restore it first: tarnished, it does nothing.';$$,
  $$o_why := 'Tarnished: restore it first.';$$);
select private.prose_patch('bauble_setting', $$  if o_item.id is null or v_read.kind is null then o_why := 'That is not a bauble you can set.'; return; end if;$$,
  $$  if o_item.id is null or v_read.kind is null then o_why := 'Not a settable bauble.'; return; end if;$$);
select private.prose_patch('bauble_setting', $$      o_why := 'That is not a bauble you can set.'; return;
    end if;$$, $$      o_why := 'Not a settable bauble.'; return;
    end if;$$);
select private.prose_patch('bauble_setting', $$    if v_asked < 0 or v_asked >= v_slots then o_why := 'That is not a bauble you can set.'; return; end if;$$,
  $$    if v_asked < 0 or v_asked >= v_slots then o_why := 'Not a settable bauble.'; return; end if;$$);
select private.prose_patch('bauble_setting', $$    o_why := 'All ' || v_slots || ' ' || o_tier || ' sockets are filled. Choose one to replace.';$$,
  $$    o_why := 'Sockets full: ' || v_slots || ' of ' || v_slots || ' ' || o_tier || '. Choose one to replace.';$$);
select private.prose_patch('perform_bauble', $$  perform tell(p_world, p_uid, 'You set the ' || v_name || ' into the altar, in ' || s.o_tier || ' socket '
    || (s.o_slot + 1) || '. Every citizen working on ' || v_deed || ' has it now.'
    || case when (s.o_was).world_id is not null
            then ' The ' || bauble_text((s.o_was).kind, (s.o_was).key, (s.o_was).amount) || ' that was there crumbles away.'$$,
  $$  perform tell(p_world, p_uid, 'Set: ' || v_name || ', ' || s.o_tier || ' socket '
    || (s.o_slot + 1) || ', ' || v_deed || ' (every working citizen).'
    || case when (s.o_was).world_id is not null
            then ' Replaced: ' || bauble_text((s.o_was).kind, (s.o_was).key, (s.o_was).amount) || '.'$$);
select private.prose_patch('rpc_regret_class', $$'There is no such trade.'$$, $$'No such class.'$$);

-- A path's technique cast or refused (`seekSaid` and the rest in `meditation.ts`).
select private.prose_patch('path_technique_cast', $$      return jsonb_build_object('why', 'There is no mote swirl within ' || (k.fx->>'reach') || ' tiles of you.');$$,
  $$      return jsonb_build_object('why', 'No mote swirl within ' || (k.fx->>'reach') || ' tiles.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'The nearest mote swirl is ' || floor(r.d + 0.5)::int || ' tiles off, '
      || case when r.element ~ '^[aeiou]' then 'an' else 'a' end || ' ' || r.element || ' mote swirl. It is marked on your map.');$$,
  $$    return jsonb_build_object('said', 'Nearest mote swirl: ' || r.element || ', ' || floor(r.d + 0.5)::int || ' tiles. Marked on your map.');$$);
select private.prose_patch('path_technique_cast', $$      return jsonb_build_object('why', 'No hoard of a map in your pack is buried within ' || (k.fx->>'reach') || ' tiles of you.');$$,
  $$      return jsonb_build_object('why', 'No hoard of a map in your pack within ' || (k.fx->>'reach') || ' tiles.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'A hoard buried for a map in your pack is ' || floor(r.d + 0.5)::int || ' tiles off. It is marked on your map.');$$,
  $$    return jsonb_build_object('said', 'Hoard of a map in your pack: ' || floor(r.d + 0.5)::int || ' tiles. Marked on your map.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'Your next ' || number_word((k.fx->>'goes')::int) || ' goes that roll for success will succeed.');$$,
  $$    return jsonb_build_object('said', 'Next ' || (k.fx->>'goes')::int || ' goes with a success roll: success.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'For ' || time_words((k.fx->>'secs')::double precision) || ' every skill gain you make is '
      || round((k.fx->>'more')::numeric * 100)::int || '% larger.');$$,
  $$    return jsonb_build_object('said', 'Skill gain +' || round((k.fx->>'more')::numeric * 100)::int || '% for '
      || time_words((k.fx->>'secs')::double precision) || '.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'You are neither hungry nor thirsty.');$$,
  $$    return jsonb_build_object('said', 'Hunger and thirst full.');$$);
select private.prose_patch('path_technique_cast', $$      return jsonb_build_object('why', 'No companion of yours is within ' || (k.fx->>'reach') || ' tiles of you.');$$,
  $$      return jsonb_build_object('why', 'No companion within ' || (k.fx->>'reach') || ' tiles.');$$);
select private.prose_patch('path_technique_cast', $$    if c.health >= max_health(c) then return jsonb_build_object('why', c.name || ' is not hurt.'); end if;$$,
  $$    if c.health >= max_health(c) then return jsonb_build_object('why', c.name || ': not hurt.'); end if;$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', c.name || ' regains ' || round((k.fx->>'heal')::numeric * 100)::int || '% of its health.');$$,
  $$    return jsonb_build_object('said', c.name || ': health +' || round((k.fx->>'heal')::numeric * 100)::int || '%.');$$);
select private.prose_patch('path_technique_cast', $$      return jsonb_build_object('why', 'No wildermon of yours is within ' || (k.fx->>'reach') || ' tiles of you.');$$,
  $$      return jsonb_build_object('why', 'No wildermon of yours within ' || (k.fx->>'reach') || ' tiles.');$$);
select private.prose_patch('path_technique_cast', $$      return jsonb_build_object('said', r.name || ' is beside you.');
    end if;
    return jsonb_build_object('said', upper(left(number_word(v_n), 1)) || substr(number_word(v_n), 2) || ' of your wildermon are beside you.');$$,
  $$      return jsonb_build_object('said', 'Gathered: ' || r.name || '.');
    end if;
    return jsonb_build_object('said', 'Gathered: ' || v_n || ' wildermon.');$$);
select private.prose_patch('path_technique_cast', $$      return jsonb_build_object('why', 'Nothing within ' || (k.fx->>'reach') || ' tiles of you is hunting you.');$$,
  $$      return jsonb_build_object('why', 'Nothing within ' || (k.fx->>'reach') || ' tiles is hunting you.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', case when v_n = 1
      then 'The one creature hunting you stops, and starts no hunt for ' || (k.fx->>'secs') || ' seconds unless you strike it.'
      else 'The ' || number_word(v_n) || ' creatures hunting you stop, and start no hunt for ' || (k.fx->>'secs') || ' seconds unless you strike them.' end);$$,
  $$    return jsonb_build_object('said', 'Lulled: ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end
      || '. No new hunt for ' || (k.fx->>'secs') || ' s unless struck.');$$);
select private.prose_patch('path_technique_cast', $$    if c.id is null then return jsonb_build_object('why', 'No companion follows you.'); end if;$$,
  $$    if c.id is null then return jsonb_build_object('why', 'No companion following you.'); end if;$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'For ' || time_words(v_secs) || ' ' || c.name || ' takes '
      || round((k.fx->>'cut')::numeric * 100)::int || '% less damage and deals ' || round((k.fx->>'more')::numeric * 100)::int
      || '% more while it is within ' || (k.fx->>'reach') || ' tiles of you.');$$,
  $$    return jsonb_build_object('said', c.name || ', for ' || time_words(v_secs) || ' within ' || (k.fx->>'reach')
      || ' tiles of you: damage taken −' || round((k.fx->>'cut')::numeric * 100)::int || '%, damage dealt +'
      || round((k.fx->>'more')::numeric * 100)::int || '%.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'Your wind comes back all at once.');$$,
  $$    return jsonb_build_object('said', 'Stamina full.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'For ' || time_words(v_secs) || ' swimming costs you no stamina.');$$,
  $$    return jsonb_build_object('said', 'Swimming costs no stamina for ' || time_words(v_secs) || '.');$$);
select private.prose_patch('path_technique_cast', $$      return jsonb_build_object('why', 'Nothing on you is bleeding, weeping or carrying venom.');$$,
  $$      return jsonb_build_object('why', 'No bleeding, weeping or venom.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'Nothing on you is bleeding, weeping or carrying venom now.');$$,
  $$    return jsonb_build_object('said', 'Bleeding, weeping and venom stopped.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'For ' || (k.fx->>'secs') || ' seconds you walk '
      || round(((k.fx->>'pace')::numeric - 1) * 100)::int || '% faster, and nothing slows you.');$$,
  $$    return jsonb_build_object('said', 'Walk speed +' || round(((k.fx->>'pace')::numeric - 1) * 100)::int || '% for '
      || (k.fx->>'secs') || ' s, no slowing.');$$);
select private.prose_patch('path_technique_cast', $$    return jsonb_build_object('said', 'For ' || time_words(v_secs) || ' nothing costs you stamina.');$$,
  $$    return jsonb_build_object('said', 'No stamina cost for ' || time_words(v_secs) || '.');$$);
select private.prose_patch('path_hard_to_kill', $$  perform tell(p_world, p_uid, 'You should be dead. You are not: you stand at '
    || round((k.fx->>'kill')::numeric * 100)::int || '% of your health.', 'fight');$$,
  $$  perform tell(p_world, p_uid, 'Hard to Kill: killing blow survived at '
    || round((k.fx->>'kill')::numeric * 100)::int || '% health.', 'fight');$$);
select private.prose_patch('sky_said', $$      || 'In ' || case when h = 1 then 'an hour' else number_word(h) || ' hours' end
      || ' the wind is from the ' || v_points[v_point + 1] || ': ' || v_word || ', '$$,
  $$      || 'Wind in ' || h || ' h: from the ' || v_points[v_point + 1] || ', ' || v_word || ', '$$);

-- A path's pick refused (`pathPickRefusal`), and a technique short of Calm (`calmRefusal`).
select private.prose_patch('path_pick_refusal', $$  if p.way is null then return 'Choose a path first, at ' || choose_at()::int || ' meditation.'; end if;$$,
  $$  if p.way is null then return 'Choose a path first (opens at meditation ' || choose_at()::int || ').'; end if;$$);
select private.prose_patch('path_pick_refusal', $$    return 'That is ' || coalesce((select name from path_def where id = k.path), k.path) || '’s, and you walk '
        || coalesce((select name from path_def where id = p.way), p.way) || '.';$$,
  $$    return 'Not your path: ' || coalesce((select name from path_def where id = k.path), k.path) || ' (yours: '
        || coalesce((select name from path_def where id = p.way), p.way) || ').';$$);
select private.prose_patch('path_pick_refusal', $$    return coalesce((select name from path_def where id = p.way), p.way) || ' is still walked by its steps.';$$,
  $$    return coalesce((select name from path_def where id = p.way), p.way) || ': still on steps, not tiers.';$$);
select private.prose_patch('path_pick_refusal', $$    return 'You have that already.';$$, $$    return 'Already taken.';$$);
select private.prose_patch('path_pick_refusal', $$  if v_other is not null then return 'You took ' || v_other || ' at this tier.'; end if;$$,
  $$  if v_other is not null then return 'Tier already taken: ' || v_other || '.'; end if;$$);
select private.prose_patch('path_pick_refusal', $$    return 'This tier opens at ' || v_at || ' meditation; you have ' || floor(v_med)::int || '.';$$,
  $$    return 'Tier opens at meditation ' || v_at || ' (have ' || floor(v_med)::int || ').';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' costs ' || s.cost::int || ' calm; you hold ' || floor(coalesce(p.calm, 0))::int || '. Sit somewhere quiet.';$$,
  $$      return s.name || ': need ' || s.cost::int || ' calm (have ' || floor(coalesce(p.calm, 0))::int || ').';$$);

-- A sitting: every place multiplier that applies, by name and number (`sitPlace`), and one cut short (`STRUCK_SAID`).
create or replace function sit_swirl_said() returns text language sql immutable as $fn$
  select 'mote swirl within ' || sit_swirl_reach() || ' tiles ×' || sit_swirl() $fn$;
create or replace function sit_stone_said() returns text language sql immutable as $fn$
  select 'Runestone within ' || sit_stone_reach() || ' tiles ×' || sit_stone() $fn$;
create or replace function sit_stale_said() returns text language sql immutable as $fn$
  select 'sat within ' || sit_stale_reach() || ' tiles since the trees last grew ×' || sit_stale() $fn$;
create or replace function struck_said() returns text language sql immutable as $fn$
  select 'Sitting interrupted: struck. No gain.' $fn$;
create or replace function sit_place(p_on_deed boolean, p_height double precision, p_water boolean, p_swirl boolean, p_stale boolean, p_stone boolean)
returns table(place double precision, said text) language plpgsql immutable as $fn$
declare v_by text[] := '{}';
begin
  place := 1;
  if p_on_deed then
    place := place * sit_yard();
    v_by := v_by || ('own yard ×' || sit_yard());
  end if;
  -- High, wild ground is what the paths are walked on.
  if p_height > sit_thin_at() then
    place := place * sit_thin();
    v_by := v_by || ('over ' || sit_thin_at() || ' high ×' || sit_thin());
  elsif p_height > sit_high_at() and not p_on_deed then
    place := place * sit_high();
    v_by := v_by || ('over ' || sit_high_at() || ' high, off your settlement ×' || sit_high());
  end if;
  if p_water then
    place := place * sit_water();
    v_by := v_by || ('feet in water ×' || sit_water());
  end if;
  if p_swirl then
    place := place * sit_swirl();
    v_by := v_by || sit_swirl_said();
  end if;
  if p_stone then
    place := place * sit_stone();
    v_by := v_by || sit_stone_said();
  end if;
  if p_stale then
    place := place * sit_stale();
    v_by := v_by || sit_stale_said();
  end if;
  said := 'Sitting: ' || coalesce(nullif(array_to_string(v_by, ', '), ''), 'no place modifier') || '.';
  return next;
end $fn$;

-- A sitting's lines, and the rug's refusals.
select private.prose_patch('perform_faith', $$      perform tell(p_world, p_uid, 'The trees round you grow while you sit: ' || v_bloom || ' of them, a stage each.', 'event');$$,
  $$      perform tell(p_world, p_uid, 'Bloom: ' || v_bloom || case when v_bloom = 1 then ' tree' else ' trees' end || ' grew a stage.', 'event');$$);
select private.prose_patch('perform_faith', $$      perform tell(p_world, p_uid, 'Something settles. Three ways of looking at all this have '
        || 'become clear, and you may walk exactly one of them. Choose from the rug.', 'system');$$,
  $$      perform tell(p_world, p_uid, 'Paths open: choose one of ' || (select count(*) from path_def) || ' from the rug.', 'system');$$);
select private.prose_patch('perform_faith', $$        perform tell(p_world, p_uid, r.path_name || ': tier ' || r.tier || ' is open. Take one of '
          || listed_or((select array_agg(k.name order by k.num) from path_pick k where k.path = p.way and k.tier = r.tier))
          || ' in the Faith window.', 'system');$$,
  $$        perform tell(p_world, p_uid, r.path_name || ': tier ' || r.tier || ' open. Pick one: '
          || listed_or((select array_agg(k.name order by k.num) from path_pick k where k.path = p.way and k.tier = r.tier))
          || ' (Faith window).', 'system');$$);
select private.prose_patch('perform_faith', $$    perform tell(p_world, p_uid, 'You take the path of '
      || (select name from path_def where id = v_way) || '. '$$,
  $$    perform tell(p_world, p_uid, 'Path taken: '
      || (select name from path_def where id = v_way) || '. '$$);
select private.prose_patch('faith_refusal', $$return 'You need a rug to sit on.';$$, $$return 'Need a rug.';$$);
select private.prose_patch('faith_refusal', $$      return 'You have sat today and got what there was to get. ' || ceil(rest / 60) || ' minutes.';$$,
  $$      return 'Sat already: next sitting in ' || ceil(rest / 60) || ' min.';$$);
select private.prose_patch('faith_refusal', $$      return 'You have chosen, and it is not the sort of thing that is chosen twice.';$$,
  $$      return 'Path already chosen.';$$);
select private.prose_patch('faith_refusal', $$      return 'Sit until you have ' || round(choose_at()) || ' meditation behind you.';$$,
  $$      return 'Need meditation ' || round(choose_at()) || '.';$$);
select private.prose_patch('faith_refusal', $$      return 'Choose one of the three.';$$, $$      return 'Choose a path.';$$);
select private.prose_patch('faith_refusal', $$    if v_step.path is null then return 'That is not something you know.'; end if;$$,
  $$    if v_step.path is null then return 'Not known.'; end if;$$);
select private.prose_patch('faith_refusal', $$      return v_step.name || ' again in ' || ceil(rest / 60) || ' minutes.';$$,
  $$      return v_step.name || ': ready in ' || ceil(rest / 60) || ' min.';$$);
select private.prose_patch('perform_faith', $$sit.said || ' Calm ' || floor(got) || ' of ' || floor(cap) || '.'$$,
  $$sit.said || ' Calm ' || floor(got) || '/' || floor(cap) || '.'$$);

-- A fighting class's spell refused (`NEEDS_SAID`): "<spell>: needs <what>."
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' costs ' || trim_scale(round((v_cost * 100)::numeric, 1)) || '% of your stamina; you have '
        || floor(v_stamina * 100)::int || '%.';$$,
  $$      return s.name || ': need ' || trim_scale(round((v_cost * 100)::numeric, 1)) || '% stamina (have '
        || floor(v_stamina * 100)::int || '%).';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a shield in your off hand.';$$,
  $$      return s.name || ': needs a shield in the off hand.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants ' || case v_needs when 'axes' then 'an axe' else 'a maul' end || ' in your hand.';$$,
  $$      return s.name || ': needs ' || case v_needs when 'axes' then 'an axe' else 'a maul' end || ' in hand.';$$);
select private.prose_patch('spell_cast_refusal', $$        return s.name || ' wants a bow in your hands.';$$,
  $$        return s.name || ': needs a bow in hand.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a javelin or a throwing axe in your hand.';$$,
  $$      return s.name || ': needs a javelin or throwing axe in hand.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a javelin, a throwing axe or a knife in your hand.';$$,
  $$      return s.name || ': needs a javelin, throwing axe or knife in hand.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a knife in your hand.';$$,
  $$      return s.name || ': needs a knife in hand.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a garnet or ruby focus in your pack.';$$,
  $$      return s.name || ': needs a garnet or ruby focus in your pack.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a sapphire or diamond focus in your pack.';$$,
  $$      return s.name || ': needs a sapphire or diamond focus in your pack.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a topaz or emerald focus in your pack.';$$,
  $$      return s.name || ': needs a topaz or emerald focus in your pack.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' wants a companion following you.';$$,
  $$      return s.name || ': needs a companion following you.';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' costs ' || round((s.fx->>'health')::double precision * 100)::int || '% of your health; you have '
        || floor(coalesce((p.stats->>'health')::double precision, 1) * 100)::int || '%.';$$,
  $$      return s.name || ': costs ' || round((s.fx->>'health')::double precision * 100)::int || '% health (have '
        || floor(coalesce((p.stats->>'health')::double precision, 1) * 100)::int || '%).';$$);
select private.prose_patch('spell_cast_refusal', $$      return s.name || ' is only for below ' || round((s.fx->>'below')::double precision * 100)::int || '% of your health.';$$,
  $$      return s.name || ': only below ' || round((s.fx->>'below')::double precision * 100)::int || '% health.';$$);
select private.prose_patch('class_spell_cast', $$      return jsonb_build_object('why', s.name || ' wants ' || spell_fx(p_spell, 'arrows')::int || ' arrows in your pack.');$$,
  $$      return jsonb_build_object('why', s.name || ': needs ' || spell_fx(p_spell, 'arrows')::int || ' arrows in your pack.');$$);
select private.prose_patch_all('class_spell_cast', $$    if k.id is null then return jsonb_build_object('why', s.name || ' wants a companion following you.'); end if;$$,
  $$    if k.id is null then return jsonb_build_object('why', s.name || ': needs a companion following you.'); end if;$$, 11);

-- And what a fighting class's spell says when there is nothing for it to do. The refusals it shares with an
-- ordinary swing or draw (out of reach, too close, a creature that will not fight) and with a faith spell (not hurt,
-- nothing written yet) are left in their words, for those to change together.
select private.prose_patch('class_spell_cast', $$'You cannot lunge from where you sit.'$$, $$'Cannot lunge while seated.'$$);
select private.prose_patch('class_spell_cast', $$'You cannot leap from where you sit.'$$, $$'Cannot leap while seated.'$$);
select private.prose_patch('class_spell_cast', $$'Something stands between you and the ' || lower(d.name) || '.'$$,
  $$'Blocked: no path to the ' || lower(d.name) || '.'$$);
select private.prose_patch('class_spell_cast', $$'Something stands between ' || k.name || ' and the ' || lower(d.name) || '.'$$,
  $$'Blocked: no path from ' || k.name || ' to the ' || lower(d.name) || '.'$$);
select private.prose_patch('class_spell_cast', $$'Nothing within ' || spell_fx(p_spell, 'reach')::int || ' tiles of you is hunting anybody.'$$,
  $$'Nothing hunting within ' || spell_fx(p_spell, 'reach')::int || ' tiles.'$$);
select private.prose_patch('class_spell_cast', $$'Nothing within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of you is hunting you.'$$,
  $$'Nothing hunting you within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles.'$$);
select private.prose_patch('class_spell_cast', $$'You have no wound to shrug off.'$$, $$'No wounds.'$$);
select private.prose_patch_all('class_spell_cast', $$'Nothing is within ' || spell_fx(p_spell, 'reach')::int || ' tiles of you to strike.'$$,
  $$'No target within ' || spell_fx(p_spell, 'reach')::int || ' tiles.'$$, 2);
select private.prose_patch_all('class_spell_cast', $$'Nothing is within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of you to strike.'$$,
  $$'No target within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles.'$$, 3);
select private.prose_patch_all('class_spell_cast', $$'Nothing is within ' || trim_scale(round(v_reach::numeric, 1)) || ' tiles of you to strike.'$$,
  $$'No target within ' || trim_scale(round(v_reach::numeric, 1)) || ' tiles.'$$, 2);
select private.prose_patch('class_spell_cast', $$'Nothing is within ' || trim_scale(v_reach::numeric) || ' tiles of you to strike.'$$,
  $$'No target within ' || trim_scale(v_reach::numeric) || ' tiles.'$$);
select private.prose_patch('class_spell_cast', $$'The ' || lower(d.name) || ' is already fighting you.'$$,
  $$'The ' || lower(d.name) || ': already fighting you.'$$);
select private.prose_patch('class_spell_cast', $$'The ' || lower(d.name) || ' never comes for anybody unless it is struck.'$$,
  $$'The ' || lower(d.name) || ': not aggressive.'$$);
select private.prose_patch('class_spell_cast', $$'The ' || lower(d.name) || ' is already at your feet.'$$,
  $$'The ' || lower(d.name) || ': already adjacent.'$$);
select private.prose_patch('class_spell_cast', $$'The ' || lower(d.name) || ' cannot be dragged: there is no ground it could walk between you.'$$,
  $$'The ' || lower(d.name) || ': no walkable ground between you.'$$);
select private.prose_patch('class_spell_cast', $$'The ' || lower(d.name) || ' is already after somebody.'$$,
  $$'The ' || lower(d.name) || ': already hunting someone.'$$);
select private.prose_patch('class_spell_cast', $$'Nobody within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of you is hurt, you included.'$$,
  $$'Nobody hurt within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles (you included).'$$);
select private.prose_patch('class_spell_cast', $$'Nobody within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of you has a wound, you included.'$$,
  $$'Nobody wounded within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles (you included).'$$);
select private.prose_patch_all('class_spell_cast', $$k.name || ' is not close enough to the ' || lower(d.name) || ' to strike it.'$$,
  $$k.name || ': too far from the ' || lower(d.name) || ' to strike.'$$, 3);
select private.prose_patch('class_spell_cast', $$k.name || ' is not hurt.'$$, $$k.name || ': not hurt.'$$);
select private.prose_patch('class_spell_cast', $$k.name || ' is more than ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles from the '
        || lower(d.name) || '.'$$,
  $$k.name || ': over ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles from the '
        || lower(d.name) || '.'$$);
select private.prose_patch('class_spell_cast', $$'Nothing wild is within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of ' || k.name || '.'$$,
  $$'No wild creature within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of ' || k.name || '.'$$);
select private.prose_patch('class_spell_cast', $$'The ' || lower(d.name) || ' cannot be tamed.'$$, $$'The ' || lower(d.name) || ': untameable.'$$);
select private.prose_patch('class_spell_cast', $$'Nothing burns inside a Truce.'$$, $$'No burning inside a Truce.'$$);
select private.prose_patch('class_spell_cast', $$'The ' || lower(d.name) || ' is not burning.'$$, $$'The ' || lower(d.name) || ': not burning.'$$);
select private.prose_patch('class_spell_cast', $$'Nothing on you is bleeding.'$$, $$'Not bleeding.'$$);
select private.prose_patch('class_spell_cast', $$'The skin over you is larger already.'$$, $$'Existing skin is larger.'$$);
select private.prose_patch('class_spell_cast', $$'The skin over ' || v_who || ' is larger already.'$$, $$v_who || ': existing skin is larger.'$$);
select private.prose_patch('class_spell_cast', $$'Every skin within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric)
        || ' tiles of you is larger already.'$$,
  $$'Every skin within ' || trim_scale(spell_fx(p_spell, 'reach')::numeric)
        || ' tiles is already larger.'$$);
select private.prose_patch('class_spell_cast', $$'There is no skin over you to break.'$$, $$'No skin to break.'$$);

-- Settlement invitations, ranks and the roll (`inviteRefusal`, `rankRefusal`, `rankedLine`, `joinedLine`,
-- `sendAwayRefusal`, `moveInRefusal` in the Social window).
select private.prose_patch('rpc_invite', $$'You hold no settlement to invite anybody to.'$$, $$'No settlement to invite to.'$$);
select private.prose_patch('rpc_invite', $$'That settlement is gone.'$$, $$'Settlement gone.'$$);
select private.prose_patch('rpc_invite', $$v_name || ' already lives here.'$$, $$v_name || ': already a citizen.'$$);
select private.prose_patch('rpc_invite', $$    return jsonb_build_object('why', v_name || ' is a citizen of '
      || deeds_joined()::int || ' settlements already, which is as many as anybody may be.');$$,
  $$    return jsonb_build_object('why', v_name || ': citizen of '
      || deeds_joined()::int || ' settlements (max).');$$);
select private.prose_patch('rpc_invite', $$v_name || ' has already been asked, and has not answered.'$$, $$v_name || ': invitation pending.'$$);
select private.prose_patch('rpc_rank', $$'That settlement is gone.'$$, $$'Settlement gone.'$$);
select private.prose_patch('rpc_rank', $$'Nobody may change their own rank.'$$, $$'Cannot change your own rank.'$$);
select private.prose_patch('rpc_rank', $$'Nobody may change the rank of whoever founded ' || d.name || '.'$$,
  $$'Cannot change the founder''s rank at ' || d.name || '.'$$);
select private.prose_patch('rpc_rank', $$v_name || ' is not a citizen of ' || d.name || '.'$$, $$v_name || ': not a citizen of ' || d.name || '.'$$);
select private.prose_patch('rpc_rank', $$d.name || ' has no rank called ' || btrim(coalesce(p_role, '')) || '.'$$,
  $$d.name || ': no rank named ' || btrim(coalesce(p_role, '')) || '.'$$);
select private.prose_patch('rpc_rank', $$      return jsonb_build_object('why', v_name || ' holds ' || v_theirs.name || ' at ' || d.name || '. Your rank, '
        || v_mine.name || ', may set the rank only of those ranked below it.');$$,
  $$      return jsonb_build_object('why', v_name || ' holds ' || v_theirs.name || ' at ' || d.name || '; your rank ('
        || v_mine.name || ') sets ranks only below it.');$$);
select private.prose_patch('rpc_rank', $$'Your rank at ' || d.name || ', ' || v_mine.name || ', may give only ranks below it.'$$,
  $$'Your rank at ' || d.name || ' (' || v_mine.name || ') gives only ranks below it.'$$);
select private.prose_patch('rpc_rank', $$v_name || ' already holds ' || v_to.name || ' at ' || d.name || '.'$$,
  $$v_name || ': already ' || v_to.name || ' at ' || d.name || '.'$$);
select private.prose_patch('rpc_rank', $$  perform tell(p_world, p_uid, v_by || ' gives you the rank of ' || v_to.name || ' at ' || d.name
    || ': you may ' || rank_may(v_to.perms) || '.', 'system');$$,
  $$  perform tell(p_world, p_uid, 'Rank at ' || d.name || ': ' || v_to.name || ' (from ' || v_by
    || '). Allowed: ' || rank_may(v_to.perms) || '.', 'system');$$);
select private.prose_patch('rpc_leave_deed', $$'Nobody may send away whoever founded ' || d.name || '.'$$,
  $$'Cannot send away the founder of ' || d.name || '.'$$);
select private.prose_patch('rpc_leave_deed', $$'Nobody there to send away.'$$, $$'Not on the roll.'$$);
select private.prose_patch('rpc_leave_deed', $$          || '. Your rank, ' || v_mine.name || ', may send away only those ranked below it.');$$,
  $$          || '; your rank (' || v_mine.name || ') sends away only ranks below it.');$$);
select private.prose_patch('rpc_invite_answer', $$    return jsonb_build_object('why', 'You are a citizen of ' || v_n
      || ' settlements already, which is as many as anybody may be. Leave one first.');$$,
  $$    return jsonb_build_object('why', 'Citizen of ' || v_n || ' settlements (max). Leave one first.');$$);
select private.prose_patch('rpc_invite_answer', $$  perform tell(p_world, me, 'You are a citizen of ' || d.name || ', at the rank of ' || r.name
    || ': you may ' || rank_may(r.perms) || '.', 'system');$$,
  $$  perform tell(p_world, me, 'Citizen of ' || d.name || ': rank ' || r.name
    || '. Allowed: ' || rank_may(r.perms) || '.', 'system');$$);
-- Class spell results and the class's own fight lines (what a cast, a Thorns, a Vengeance, a guard, a skin and a
-- companion's blow say): labels and numbers. A blow reads as `perform_fight`'s do: "Measured Cut, critical: ogre 12/40."

select private.prose_patch('class_spell_cast', $$      return jsonb_build_object('why', 'The ' || lower(d.name) || ' is more than ' || trim_scale(round(v_reach::numeric, 1)) || ' tiles away.');$$,
  $$      return jsonb_build_object('why', 'Too far: max ' || trim_scale(round(v_reach::numeric, 1)) || ' tiles.');$$);
select private.prose_patch('class_spell_cast', $$      return jsonb_build_object('why', 'The ' || lower(d.name) || ' is too close to draw on.');$$,
  $$      return jsonb_build_object('why', 'Too close to draw.');$$);
select private.prose_patch('class_spell_cast', $$    if coalesce(d.timid, false) then return jsonb_build_object('why', 'The ' || lower(d.name) || ' will not fight anybody.'); end if;$$,
  $$    if coalesce(d.timid, false) then return jsonb_build_object('why', 'The ' || lower(d.name) || ': never fights.'); end if;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the ' || lower(d.name) || ' turns on you, and hunts only you for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' hunts only you for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch_all('class_spell_cast', $$      v_said := class_blow_said(s.name, b) || ' For ' || faith_span(spell_fx(p_spell, 'secs')) || ' it goes at '
        || faith_pct(spell_fx(p_spell, 'pace')) || ' of its pace.';$$,
  $$      v_said := class_blow_said(s.name, b) || ' Pace ' || faith_pct(spell_fx(p_spell, 'pace')) || ' for '
        || faith_span(spell_fx(p_spell, 'secs')) || '.';$$, 2);
select private.prose_patch('class_spell_cast', $$      v_said := v_said || case when v_windup then ' It is knocked off its stroke, and' else ' Its' end
        || case when v_windup then ' its' else '' end || ' next blow is put back ' || faith_span(spell_fx(p_spell, 'back')) || '.';$$,
  $$      v_said := v_said || case when v_windup then ' Heavy blow broken.' else '' end
        || ' Next blow delayed ' || faith_span(spell_fx(p_spell, 'back')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || faith_pct(spell_fx(p_spell, 'stamina')) || ' of your stamina comes back at once.';$$,
  $$    v_said := s.name || ': stamina +' || faith_pct(spell_fx(p_spell, 'stamina')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every blow you block lands back at '
      || faith_pct(spell_fx(p_spell, 'share')) || ' of itself.';$$,
  $$    v_said := s.name || ': blocked blows reflected at ' || faith_pct(spell_fx(p_spell, 'share')) || ' for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' your wounds bleed '
      || faith_pct(1 - spell_fx(p_spell, 'bleed')) || ' less and those on your arms do not slow your swing.';$$,
  $$    v_said := s.name || ': bleeding −' || faith_pct(1 - spell_fx(p_spell, 'bleed')) || ', arm wounds do not slow your swing, for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$      v_said := v_said || ' Its next ' || spell_fx(p_spell, 'blows')::int || ' blows do ' || faith_pct(spell_fx(p_spell, 'cut')) || ' less.';$$,
  $$      v_said := v_said || ' Its next ' || spell_fx(p_spell, 'blows')::int || ' blows: damage −' || faith_pct(spell_fx(p_spell, 'cut')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' a swing or a draw costs you no stamina.';$$,
  $$    v_said := s.name || ': swings and draws cost no stamina for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature turns' else ' creatures turn' end
      || ' on you, and hunt' || case when v_n = 1 then 's' else '' end || ' only you for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature hunts' else ' creatures hunt' end
      || ' only you for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' you take ' || faith_pct(spell_fx(p_spell, 'cut')) || ' less damage.';$$,
  $$    v_said := s.name || ': damage taken −' || faith_pct(spell_fx(p_spell, 'cut')) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the worst of your wounds, on your ' || part_name(v_part) || ', is '
      || faith_pct(1 - spell_fx(p_spell, 'severity')) || ' less severe and stops bleeding.';$$,
  $$    v_said := s.name || ': worst wound (' || part_name(v_part) || ') severity −'
      || faith_pct(1 - spell_fx(p_spell, 'severity')) || ', bleeding stopped.';$$);
select private.prose_patch('class_spell_cast', $$      v_said := v_said || ' It bleeds ' || faith_pct(knife_bleed()) || ' of the blow a second for ' || faith_span(knife_bleed_secs()) || '.';$$,
  $$      v_said := v_said || ' Bleeding: ' || faith_pct(knife_bleed()) || ' of the blow per second for ' || faith_span(knife_bleed_secs()) || '.';$$);
select private.prose_patch_all('class_spell_cast', $$      v_said := v_said || ' It is held where it stands for ' || faith_span(v_h) || '.';$$,
  $$      v_said := v_said || ' Held for ' || faith_span(v_h) || '.';$$, 2);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' you deal ' || faith_pct(spell_fx(p_spell, 'dealt') - 1)
      || ' more damage and take ' || faith_pct(spell_fx(p_spell, 'taken') - 1) || ' more.';$$,
  $$    v_said := s.name || ': damage dealt +' || faith_pct(spell_fx(p_spell, 'dealt') - 1)
      || ', damage taken +' || faith_pct(spell_fx(p_spell, 'taken') - 1) || ', for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' a swing or a draw costs no stamina and takes '
      || faith_pct(1 - spell_fx(p_spell, 'time')) || ' less time.';$$,
  $$    v_said := s.name || ': swings and draws cost no stamina, time −'
      || faith_pct(1 - spell_fx(p_spell, 'time')) || ', for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := class_blow_said(s.name, b) || ' It costs you ' || faith_pct(spell_fx(p_spell, 'health')) || ' of your health.';$$,
  $$    v_said := class_blow_said(s.name, b) || ' Health −' || faith_pct(spell_fx(p_spell, 'health')) || '.';$$);
select private.prose_patch_all('class_spell_cast', $$    if found then v_said := v_said || ' Your next swing comes ' || faith_span(spell_fx(p_spell, 'wind')) || ' later.'; end if;$$,
  $$    if found then v_said := v_said || ' Next swing delayed ' || faith_span(spell_fx(p_spell, 'wind')) || '.'; end if;$$, 2);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': you strike at ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end
      || case when v_dead > 0 then ', and ' || v_dead || case when v_dead = 1 then ' dies' else ' die' end else '' end || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature hit' else ' creatures hit' end
      || case when v_dead > 0 then ', ' || v_dead || ' killed' else '' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': you strike at ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end
      || '; ' || v_held || ' held where ' || case when v_held = 1 then 'it stands' else 'they stand' end
      || ' for ' || faith_span(spell_fx(p_spell, 'hold'))
      || case when v_dead > 0 then ', and ' || v_dead || case when v_dead = 1 then ' dies' else ' die' end else '' end || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature hit' else ' creatures hit' end
      || ', ' || v_held || ' held for ' || faith_span(spell_fx(p_spell, 'hold'))
      || case when v_dead > 0 then ', ' || v_dead || ' killed' else '' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every blow you land is critical.';$$,
  $$    v_said := s.name || ': every blow critical for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the ' || lower(d.name) || ' will not come for you for ' || faith_span(spell_fx(p_spell, 'secs'))
      || ', alone or with its pack, unless you strike it.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' and its pack will not attack you for ' || faith_span(spell_fx(p_spell, 'secs'))
      || ', until you strike it.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': you drag the ' || lower(d.name) || ' ' || trim_scale(round(v_h::numeric, 1))
      || case when round(v_h::numeric, 1) = 1 then ' tile' else ' tiles' end || ' towards you.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' pulled ' || trim_scale(round(v_h::numeric, 1))
      || case when round(v_h::numeric, 1) = 1 then ' tile' else ' tiles' end || ' toward you.';$$);
select private.prose_patch('class_spell_cast', $$        perform tell(p_world, r.uid, coalesce(me.name, 'Somebody') || '’s ' || s.name || ' gives you back '
          || faith_pct(spell_fx(p_spell, 'stamina')) || ' of your stamina.', 'fight');$$,
  $$        perform tell(p_world, r.uid, coalesce(me.name, 'Somebody') || '’s ' || s.name || ': stamina +'
          || faith_pct(spell_fx(p_spell, 'stamina')) || '.', 'fight');$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || faith_pct(spell_fx(p_spell, 'stamina')) || ' of a full bar of stamina back for you'
      || case when v_n = 0 then '' else ' and ' || v_n || case when v_n = 1 then ' other' else ' others' end end || '.';$$,
  $$    v_said := s.name || ': stamina +' || faith_pct(spell_fx(p_spell, 'stamina')) || ' for you'
      || case when v_n = 0 then '' else ' and ' || v_n || case when v_n = 1 then ' other' else ' others' end end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || ' of ' || v_held || ' blows land'
      || case when (b->>'died')::boolean then ', and the ' || (b->>'name') || ' dies.'
              else '. The ' || (b->>'name') || ' is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end;$$,
  $$    v_said := s.name || ': ' || v_n || '/' || v_held || ' blows hit'
      || case when (b->>'died')::boolean then ', ' || (b->>'name') || ' killed.'
              else ', ' || (b->>'name') || ' ' || (b->>'left') || '/' || (b->>'of') || '.' end;$$);
select private.prose_patch('class_spell_cast', $$      v_said := v_said || ' It goes through into ' || v_n || ' more behind'
        || case when v_dead > 0 then ', and ' || v_dead || case when v_dead = 1 then ' dies' else ' die' end else '' end || '.';$$,
  $$      v_said := v_said || ' Through: ' || v_n || ' more hit'
        || case when v_dead > 0 then ', ' || v_dead || ' killed' else '' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every blow you land pushes what it lands on '
      || trim_scale(spell_fx(p_spell, 'push')::numeric) || case when spell_fx(p_spell, 'push') = 1 then ' tile' else ' tiles' end
      || ' further from you.';$$,
  $$    v_said := s.name || ': blows you land push ' || trim_scale(spell_fx(p_spell, 'push')::numeric)
      || case when spell_fx(p_spell, 'push') = 1 then ' tile' else ' tiles' end
      || ' back, for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' anything that comes within '
      || trim_scale(hunt_reach()::numeric) || ' tiles of you to strike is pushed ' || trim_scale(spell_fx(p_spell, 'push')::numeric)
      || ' tiles back instead.';$$,
  $$    v_said := s.name || ': creatures closing within '
      || trim_scale(hunt_reach()::numeric) || ' tiles to strike pushed ' || trim_scale(spell_fx(p_spell, 'push')::numeric)
      || ' tiles back, for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' the first creature that comes at you from outside your reach '
      || 'is met at the edge of it by a blow at ' || faith_pct(spell_fx(p_spell, 'more')) || '.';$$,
  $$    v_said := s.name || ': first creature closing from outside your reach within ' || faith_span(spell_fx(p_spell, 'secs'))
      || ': blow at ' || faith_pct(spell_fx(p_spell, 'more')) || ' at the edge of your reach.';$$);
select private.prose_patch('class_spell_cast', $$    if found then v_said := v_said || ' Your next draw comes ' || faith_span(spell_fx(p_spell, 'sooner')) || ' sooner.'; end if;$$,
  $$    if found then v_said := v_said || ' Next draw ' || faith_span(spell_fx(p_spell, 'sooner')) || ' sooner.'; end if;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': your next shot within ' || faith_span(spell_fx(p_spell, 'secs')) || ' cannot miss, and is critical '
      || case when spell_fx(p_spell, 'crit') = 2 then 'twice' else trim_scale(spell_fx(p_spell, 'crit')::numeric) || ' times' end
      || ' as often.';$$,
  $$    v_said := s.name || ': next shot within ' || faith_span(spell_fx(p_spell, 'secs')) || ' cannot miss, critical chance ×'
      || trim_scale(spell_fx(p_spell, 'crit')::numeric)
      || '.';$$);
select private.prose_patch_all('class_spell_cast', $$      v_said := v_said || ' For ' || faith_span(spell_fx(p_spell, 'secs')) || ' it goes at '
        || faith_pct(spell_fx(p_spell, 'pace')) || ' of its pace.';$$,
  $$      v_said := v_said || ' Pace ' || faith_pct(spell_fx(p_spell, 'pace')) || ' for '
        || faith_span(spell_fx(p_spell, 'secs')) || '.';$$, 2);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || ' of ' || v_held || ' arrows land'
      || case when (b->>'died')::boolean then ', and the ' || (b->>'name') || ' dies.'
              else '. The ' || (b->>'name') || ' is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end;$$,
  $$    v_said := s.name || ': ' || v_n || '/' || v_held || ' arrows hit'
      || case when (b->>'died')::boolean then ', ' || (b->>'name') || ' killed.'
              else ', ' || (b->>'name') || ' ' || (b->>'left') || '/' || (b->>'of') || '.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every blow and shot that lands on the ' || lower(d.name)
      || ' does ' || faith_pct(spell_fx(p_spell, 'more') - 1) || ' more.';$$,
  $$    v_said := s.name || ': damage on ' || lower(d.name)
      || ' +' || faith_pct(spell_fx(p_spell, 'more') - 1) || ' from every blow and shot, for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' everything that strikes at you strikes a decoy at your feet instead.';$$,
  $$    v_said := s.name || ': blows at you strike a decoy at your feet instead, for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' a draw takes '
      || faith_pct(1 - spell_fx(p_spell, 'time')) || ' less time.';$$,
  $$    v_said := s.name || ': draw time −'
      || faith_pct(1 - spell_fx(p_spell, 'time')) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    if found then v_said := v_said || ' Your next swing comes ' || faith_span(spell_fx(p_spell, 'sooner')) || ' sooner.'; end if;$$,
  $$    if found then v_said := v_said || ' Next swing ' || faith_span(spell_fx(p_spell, 'sooner')) || ' sooner.'; end if;$$);
select private.prose_patch('class_spell_cast', $$    v_said := class_blow_said(s.name, b) || ' For ' || faith_span(spell_fx(p_spell, 'secs')) || ' you walk '
      || faith_pct(spell_fx(p_spell, 'pace') - 1) || ' faster.';$$,
  $$    v_said := class_blow_said(s.name, b) || ' Walk speed +'
      || faith_pct(spell_fx(p_spell, 'pace') - 1) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$      v_said := v_said || ' Its next blow is put back ' || faith_span(stagger_maul()) || '.';$$,
  $$      v_said := v_said || ' Next blow delayed ' || faith_span(stagger_maul()) || '.';$$);
select private.prose_patch('class_spell_cast', $$      v_said := v_said || ' It bleeds for ' || faith_span(knife_bleed_secs() * pk(p_world, p_uid, 'bleed:secs', 1)) || '.';$$,
  $$      v_said := v_said || ' Bleeding for ' || faith_span(knife_bleed_secs() * pk(p_world, p_uid, 'bleed:secs', 1)) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := v_said || case when v_put is null then ' There is no room behind you to leap.'
                             else ' You leap ' || trim_scale(round((v_put->>'by')::numeric, 2)) || ' tiles back.' end;$$,
  $$    v_said := v_said || case when v_put is null then ' Leap: no room behind you.'
                             else ' Leapt ' || trim_scale(round((v_put->>'by')::numeric, 2)) || ' tiles back.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || ' of ' || v_held || ' throws land'
      || case when (b->>'died')::boolean then ', and the ' || (b->>'name') || ' dies.'
              else '. The ' || (b->>'name') || ' is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end;$$,
  $$    v_said := s.name || ': ' || v_n || '/' || v_held || ' throws hit'
      || case when (b->>'died')::boolean then ', ' || (b->>'name') || ' killed.'
              else ', ' || (b->>'name') || ' ' || (b->>'left') || '/' || (b->>'of') || '.' end;$$);
select private.prose_patch('class_spell_cast', $$        v_said := v_said || ' It glances on to the ' || (v_on->>'name')
          || case when not (v_on->>'landed')::boolean then ', and misses.'
                  when (v_on->>'died')::boolean then ', which dies.'
                  else ', which is down to ' || (v_on->>'left') || ' of ' || (v_on->>'of') || '.' end;$$,
  $$        v_said := v_said || ' Glance'
          || case when not (v_on->>'landed')::boolean then ' missed: ' || (v_on->>'name') || '.'
                  when (v_on->>'died')::boolean then ': ' || (v_on->>'name') || ' killed.'
                  else ': ' || (v_on->>'name') || ' ' || (v_on->>'left') || '/' || (v_on->>'of') || '.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': you throw at ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end
      || case when v_dead > 0 then ', and ' || v_dead || case when v_dead = 1 then ' dies' else ' die' end else '' end || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature hit' else ' creatures hit' end
      || case when v_dead > 0 then ', ' || v_dead || ' killed' else '' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every blow, throw and shot of yours on a creature '
      || 'fighting somebody else does ' || faith_pct(spell_fx(p_spell, 'more') - 1) || ' more.';$$,
  $$    v_said := s.name || ': damage +' || faith_pct(spell_fx(p_spell, 'more') - 1) || ' on creatures fighting someone else '
      || '(blows, throws, shots), for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature loses' else ' creatures lose' end
      || ' you, and will not come for you again for ' || faith_span(spell_fx(p_spell, 'secs')) || ' unless you strike '
      || case when v_n = 1 then 'it' else 'them' end || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end
      || ' lost you, no attack on you for ' || faith_span(spell_fx(p_spell, 'secs')) || ', until you strike '
      || case when v_n = 1 then 'it' else 'them' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every blow, throw and shot that lands on the ' || lower(d.name)
      || ' is critical ' || case when spell_fx(p_spell, 'crit') = 2 then 'twice' else trim_scale(spell_fx(p_spell, 'crit')::numeric) || ' times' end
      || ' as often.';$$,
  $$    v_said := s.name || ': critical chance ×' || trim_scale(spell_fx(p_spell, 'crit')::numeric) || ' on ' || lower(d.name)
      || ' (blows, throws, shots), for ' || faith_span(spell_fx(p_spell, 'secs'))
      || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' heals ' || v_who || ' by ' || faith_pct(spell_fx(p_spell, 'heal'))
      || case when (v_on->>'stopped')::int > 0 then ' and stops a wound bleeding' else '' end || '.';$$,
  $$    v_said := s.name || ' on ' || v_who || ': health +' || faith_pct(spell_fx(p_spell, 'heal'))
      || case when (v_on->>'stopped')::int > 0 then ', bleeding stopped' else '' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' closes the worst wound on ' || v_who || ' by ' || faith_pct(spell_fx(p_spell, 'close')) || '.';$$,
  $$    v_said := s.name || ' on ' || v_who || ': worst wound closed ' || faith_pct(spell_fx(p_spell, 'close')) || '.';$$);
select private.prose_patch('class_spell_cast', $$      if v_hp > 0 then v_said := v_said || ' You get back ' || faith_pct(v_hp) || ' of your health.'; end if;$$,
  $$      if v_hp > 0 then v_said := v_said || ' Health +' || faith_pct(v_hp) || '.'; end if;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' heals ' || v_who || ' by ' || faith_pct(spell_fx(p_spell, 'each')) || ' a second for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ' on ' || v_who || ': health +' || faith_pct(spell_fx(p_spell, 'each')) || ' per second for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the ' || lower(d.name) || ' bleeds ' || faith_pct(spell_fx(p_spell, 'each')) || ' of its health a second for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' bleeding ' || faith_pct(spell_fx(p_spell, 'each')) || ' health per second for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every dressing you put on puts back '
      || case when spell_fx(p_spell, 'more') = 2 then 'twice' else trim_scale(spell_fx(p_spell, 'more')::numeric) || ' times' end
      || ' as much health.';$$,
  $$    v_said := s.name || ': dressings heal ×'
      || trim_scale(spell_fx(p_spell, 'more')::numeric)
      || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' heals ' || v_n || case when v_n = 1 then ' person' else ' people' end || ' by ' || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$,
  $$    v_said := s.name || ': health +' || faith_pct(spell_fx(p_spell, 'heal')) || ' on ' || v_n || case when v_n = 1 then ' person' else ' people' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' stops the worst wound bleeding and closes it by ' || faith_pct(spell_fx(p_spell, 'close')) || ' on '
      || v_n || case when v_n = 1 then ' person.' else ' people.' end;$$,
  $$    v_said := s.name || ': worst wound closed ' || faith_pct(spell_fx(p_spell, 'close')) || ', bleeding stopped, on '
      || v_n || case when v_n = 1 then ' person.' else ' people.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature bleeds ' else ' creatures bleed ' end
      || faith_pct(spell_fx(p_spell, 'each')) || ' of ' || case when v_n = 1 then 'its' else 'their' end || ' health a second for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end || ' bleeding '
      || faith_pct(spell_fx(p_spell, 'each')) || ' health per second for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' closes every wound on ' || v_who || ' by ' || faith_pct(spell_fx(p_spell, 'close')) || ' and heals '
      || case when v_uid = p_uid then 'you' else 'them' end || ' by ' || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$,
  $$    v_said := s.name || ' on ' || v_who || ': every wound closed ' || faith_pct(spell_fx(p_spell, 'close')) || ', health +'
      || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' closes every wound on you and heals you by ' || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$,
  $$    v_said := s.name || ': every wound closed, health +' || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' closes every wound on ' || v_who || ' and heals ' || case when v_uid = p_uid then 'you' else 'them' end
      || ' by ' || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$,
  $$    v_said := s.name || ' on ' || v_who || ': every wound closed, health +'
      || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$);
select private.prose_patch_all('class_spell_cast', $$      return jsonb_build_object('why', k.name || ': too far from the ' || lower(d.name) || ' to strike.');$$,
  $$      return jsonb_build_object('why', k.name || ': out of reach of the ' || lower(d.name) || '.');$$, 3);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ' heals ' || k.name || ' by ' || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$,
  $$    v_said := s.name || ': ' || k.name || ' health +' || faith_pct(spell_fx(p_spell, 'heal')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := class_beast_said(s.name, k.name, b) || case when (b->>'died')::boolean then ''
      else ' Its next blow is put back ' || faith_span(spell_fx(p_spell, 'back')) || '.' end;$$,
  $$    v_said := class_beast_said(s.name, k.name, b) || case when (b->>'died')::boolean then ''
      else ' Next blow delayed ' || faith_span(spell_fx(p_spell, 'back')) || '.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature turns on ' else ' creatures turn on ' end || k.name || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end || ' now fighting ' || k.name || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || k.name || ' is at your side, and ' || v_n
      || case when v_n = 1 then ' creature turns on it.' else ' creatures turn on it.' end;$$,
  $$    v_said := s.name || ': ' || k.name || ' at your side, ' || v_n
      || case when v_n = 1 then ' creature now fighting it.' else ' creatures now fighting it.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := class_beast_said(s.name, k.name, b) || case when (b->>'died')::boolean then ''
      else ' It is held where it stands for ' || faith_span(spell_fx(p_spell, 'hold')) || '.' end;$$,
  $$    v_said := class_beast_said(s.name, k.name, b) || case when (b->>'died')::boolean then ''
      else ' Held for ' || faith_span(spell_fx(p_spell, 'hold')) || '.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := class_beast_said(s.name, k.name, b) || case when (b->>'died')::boolean then ''
      else ' It bleeds ' || faith_pct(spell_fx(p_spell, 'each')) || ' of the blow a second for ' || faith_span(spell_fx(p_spell, 'secs')) || '.' end;$$,
  $$    v_said := class_beast_said(s.name, k.name, b) || case when (b->>'died')::boolean then ''
      else ' Bleeding: ' || faith_pct(spell_fx(p_spell, 'each')) || ' of the blow per second for ' || faith_span(spell_fx(p_spell, 'secs')) || '.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' ' || k.name || '''s blows are '
      || faith_pct(spell_fx(p_spell, 'more') - 1) || ' larger.';$$,
  $$    v_said := s.name || ': ' || k.name || ' damage +'
      || faith_pct(spell_fx(p_spell, 'more') - 1) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' ' || k.name
      || ' answers every creature that lands a blow on you.';$$,
  $$    v_said := s.name || ': ' || k.name || ' strikes back at every creature that hits you, for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every blow on you or on ' || k.name
      || ' is split between you.';$$,
  $$    v_said := s.name || ': blows on you or ' || k.name || ' split between you, for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' ' || k.name || '''s blows are '
      || faith_pct(spell_fx(p_spell, 'more') - 1) || ' larger and come ' || faith_pct(spell_fx(p_spell, 'quick') - 1) || ' more often.';$$,
  $$    v_said := s.name || ': ' || k.name || ' damage +'
      || faith_pct(spell_fx(p_spell, 'more') - 1) || ', attack rate +' || faith_pct(spell_fx(p_spell, 'quick') - 1) || ', for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$      return jsonb_build_object('why', 'The ' || lower(d.name) || ' wants ' || round((tame_needs(c)).level)::int || ' taming; you have '
        || floor(skill_of(p_world, p_uid, 'taming'))::int || '.');$$,
  $$      return jsonb_build_object('why', 'The ' || lower(d.name) || ': need ' || round((tame_needs(c)).level)::int || ' taming (have '
        || floor(skill_of(p_world, p_uid, 'taming'))::int || ').');$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the ' || lower(d.name) || ' trusts you. ' || case when v_id is null then c.name || ' now follows you.'
      else 'It goes into the creature crate in your pack.' end;$$,
  $$    v_said := 'Tamed: ' || c.name || '. ' || case when v_id is null then 'Follows you.'
      else 'In the creature crate in your pack.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the next spell of yours within ' || faith_span(spell_fx(p_spell, 'secs')) || ' that deals fire deals '
      || faith_pct(spell_fx(p_spell, 'more') - 1) || ' more of it.';$$,
  $$    v_said := s.name || ': next fire spell within ' || faith_span(spell_fx(p_spell, 'secs')) || ': fire damage +'
      || faith_pct(spell_fx(p_spell, 'more') - 1) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' every burn you start lasts '
      || case when spell_fx(p_spell, 'long') = 2 then 'twice' else trim_scale(spell_fx(p_spell, 'long')::numeric) || ' times' end
      || ' as long.';$$,
  $$    v_said := s.name || ': burns you start last ×'
      || trim_scale(spell_fx(p_spell, 'long')::numeric)
      || ', for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the ' || lower(d.name) || ' catches.' || kindler_burn_said(v_burnt);$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' caught fire.' || kindler_burn_said(v_burnt);$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the burn on the ' || lower(d.name) || ' goes up at once, ' || round(v_hp::numeric) || ' of it'
      || case when (b->>'died')::boolean then ', and it dies.'
              else '. It is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end;$$,
  $$    v_said := s.name || ': burn spent at once, ' || lower(d.name) || ' −' || round(v_hp::numeric)
      || case when (b->>'died')::boolean then ', killed.'
              else ', ' || (b->>'left') || '/' || (b->>'of') || '.' end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' everything wild within '
      || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of you takes ' || trim_scale(round(v_fire::numeric, 1))
      || ' of fire a second.';$$,
  $$    v_said := s.name || ': fire ' || trim_scale(round(v_fire::numeric, 1)) || ' per second on everything wild within '
      || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles, for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := kindler_said(s.name, b) || case when v_n = 0 then '' else ' ' || v_n
      || case when v_n = 1 then ' more creature is' else ' more creatures are' end || ' caught in it'
      || case when v_dead = 0 then '.' when v_n = 1 then ', and it dies.' when v_dead = 1 then ', and one of them dies.'
              else ', and ' || v_dead || ' of them die.' end end;$$,
  $$    v_said := kindler_said(s.name, b) || case when v_n = 0 then '' else ' Splash: ' || v_n
      || ' more hit'
      || case when v_dead = 0 then '.' else ', ' || v_dead || ' killed.' end end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature is' else ' creatures are' end || ' caught in it'
      || case when v_dead = 0 then '.' when v_n = 1 then ', and it dies.' when v_dead = 1 then ', and one of them dies.'
              else ', and ' || v_dead || ' of them die.' end
      || case when v_burnt is null then ''
              else ' ' || case when v_dead = 0 and v_n = 1 then 'It burns ' when v_dead = 0 then 'They burn '
                               when v_n - v_dead = 1 then 'The other burns ' else 'The rest burn ' end
                || trim_scale(round(((v_burnt->>'each')::double precision * 100)::numeric, 1)) || '% of '
                || case when v_n - v_dead = 1 then 'its' else 'their' end || ' health a second for '
                || faith_span((v_burnt->>'secs')::double precision) || '.' end;$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature hit' else ' creatures hit' end
      || case when v_dead = 0 then '.' else ', ' || v_dead || ' killed.' end
      || case when v_burnt is null then ''
              else ' Survivors burning: '
                || trim_scale(round(((v_burnt->>'each')::double precision * 100)::numeric, 1)) || '% health per second for '
                || faith_span((v_burnt->>'secs')::double precision) || '.' end;$$);
select private.prose_patch_all('class_spell_cast', $$    v_said := s.name || ': the ' || lower(d.name) || ' is held where it stands for ' || faith_span(v_hp) || '.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' held for ' || faith_span(v_hp) || '.';$$, 2);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the ' || lower(d.name) || ' is rooted where it stands for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' rooted for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' the ' || lower(d.name) || ' cannot go more than '
      || trim_scale(spell_fx(p_spell, 'leash')::numeric) || ' tiles from where it stands.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' tethered, max '
      || trim_scale(spell_fx(p_spell, 'leash')::numeric) || ' tiles from where it stands, for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' the ' || lower(d.name) || ' strikes ' || faith_pct(1 - spell_fx(p_spell, 'often')) || ' less often.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' attack rate −' || faith_pct(1 - spell_fx(p_spell, 'often')) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' the ' || lower(d.name) || '''s blows land ' || faith_pct(1 - spell_fx(p_spell, 'dealt')) || ' smaller.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' blow damage −' || faith_pct(1 - spell_fx(p_spell, 'dealt')) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' the ' || lower(d.name) || ' takes ' || faith_pct(spell_fx(p_spell, 'taken') - 1) || ' more from everything that strikes it.';$$,
  $$    v_said := s.name || ': ' || lower(d.name) || ' damage taken +' || faith_pct(spell_fx(p_spell, 'taken') - 1) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': every wound on you stops bleeding.';$$,
  $$    v_said := s.name || ': all bleeding stopped.';$$);
select private.prose_patch_all('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' you take ' || faith_pct(spell_fx(p_spell, 'cut'))
      || ' less from every blow.';$$,
  $$    v_said := s.name || ': damage taken −' || faith_pct(spell_fx(p_spell, 'cut'))
      || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$, 2);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature goes' else ' creatures go' end || ' at '
      || faith_pct(spell_fx(p_spell, 'pace')) || ' of ' || case when v_n = 1 then 'its' else 'their' end || ' pace for '
      || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ': pace '
      || faith_pct(spell_fx(p_spell, 'pace')) || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || ', on '
      || v_n || case when v_n = 1 then ' creature' else ' creatures' end || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature is' else ' creatures are' end || ' rooted where '
      || case when v_n = 1 then 'it stands' else 'they stand' end || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$,
  $$    v_said := s.name || ': ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end || ' rooted'
      || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$      perform tell(p_world, v_uid, me.name || '''s ' || s.name || ': a skin of ' || faith_pct(v_hp) || ' goes over you.', 'system');$$,
  $$      perform tell(p_world, v_uid, me.name || '''s ' || s.name || ': skin ' || faith_pct(v_hp) || ' on you.', 'system');$$);
select private.prose_patch('class_spell_cast', $$          perform tell(p_world, r.uid, me.name || '''s ' || s.name || ': a skin of ' || faith_pct(v_hp) || ' goes over you.', 'system');$$,
  $$          perform tell(p_world, r.uid, me.name || '''s ' || s.name || ': skin ' || faith_pct(v_hp) || ' on you.', 'system');$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': ' || case when v_mine then 'a skin of ' || faith_pct(v_self) || ' goes over you'
                                     else 'the skin over you is larger already' end
      || case when v_n = 0 then '.'
              else case when v_mine then ', and ' else '; ' end || 'a skin of ' || faith_pct(v_other) || ' goes over '
                || v_n || case when v_n = 1 then ' other.' else ' others.' end end;$$,
  $$    v_said := s.name || ': ' || case when v_mine then 'skin ' || faith_pct(v_self) || ' on you'
                                     else 'your skin already larger' end
      || case when v_n = 0 then '.'
              else '; skin ' || faith_pct(v_other) || ' on '
                || v_n || case when v_n = 1 then ' other.' else ' others.' end end;$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the next skin you lay within ' || faith_span(spell_fx(p_spell, 'secs')) || ' is '
      || faith_pct(spell_fx(p_spell, 'more') - 1) || ' larger.';$$,
  $$    v_said := s.name || ': next skin within ' || faith_span(spell_fx(p_spell, 'secs')) || ' +'
      || faith_pct(spell_fx(p_spell, 'more') - 1) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ', when a skin of yours over somebody within '
      || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles of you is used up, a skin of '
      || faith_pct(spell_fx(p_spell, 'skin')) || ' goes back over them, once each.';$$,
  $$    v_said := s.name || ': your skins used up within '
      || trim_scale(spell_fx(p_spell, 'reach')::numeric) || ' tiles relaid at '
      || faith_pct(spell_fx(p_spell, 'skin')) || ', once per person, for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': the skin of ' || faith_pct(v_was) || ' over you breaks for ' || trim_scale(round(v_fire::numeric, 1))
      || ' damage on ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end
      || case when v_dead = 0 then '.' when v_n = 1 then ', and it dies.' when v_dead = 1 then ', and one of them dies.'
              else ', and ' || v_dead || ' of them die.' end;$$,
  $$    v_said := s.name || ': skin ' || faith_pct(v_was) || ' broken, ' || trim_scale(round(v_fire::numeric, 1))
      || ' damage on ' || v_n || case when v_n = 1 then ' creature' else ' creatures' end
      || case when v_dead = 0 then '.' else ', ' || v_dead || ' killed.' end;$$);
select private.prose_patch('class_spell_cast', $$        perform tell(p_world, r.uid, me.name || '''s ' || s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs'))
          || ' you take ' || faith_pct(spell_fx(p_spell, 'cut')) || ' less from every blow.', 'system');$$,
  $$        perform tell(p_world, r.uid, me.name || '''s ' || s.name || ': damage taken −' || faith_pct(spell_fx(p_spell, 'cut'))
          || ' for ' || faith_span(spell_fx(p_spell, 'secs')) || '.', 'system');$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' you'
      || case when v_n = 0 then '' when v_n = 1 then ' and one other' else ' and ' || v_n || ' others' end
      || ' take ' || faith_pct(spell_fx(p_spell, 'cut')) || ' less from every blow.';$$,
  $$    v_said := s.name || ': damage taken −' || faith_pct(spell_fx(p_spell, 'cut')) || ' for ' || faith_span(spell_fx(p_spell, 'secs'))
      || ', on you' || case when v_n = 0 then '' when v_n = 1 then ' and 1 other' else ' and ' || v_n || ' others' end
      || '.';$$);
select private.prose_patch('class_spell_cast', $$    v_said := s.name || ': for ' || faith_span(spell_fx(p_spell, 'secs')) || ' no blow aimed at you lands.';$$,
  $$    v_said := s.name || ': no blow lands on you for ' || faith_span(spell_fx(p_spell, 'secs')) || '.';$$);
select private.prose_patch('class_blow_said', $$  select p_spell || ': ' || case
    when not (b->>'landed')::boolean then 'you swing at the ' || (b->>'name') || ' and miss.'
    when (b->>'died')::boolean then 'you strike the ' || (b->>'name') || ', and it dies.'
    else 'you strike the ' || (b->>'name') || case when (b->>'crit')::boolean then ', a critical blow' else '' end
      || '. It is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end$$,
  $$  select p_spell || case
    when not (b->>'landed')::boolean then ' missed: ' || (b->>'name') || '.'
    when (b->>'died')::boolean then ': ' || (b->>'name') || ' killed.'
    else case when (b->>'crit')::boolean then ', critical' else '' end
      || ': ' || (b->>'name') || ' ' || (b->>'left') || '/' || (b->>'of') || '.' end$$);
select private.prose_patch('class_shot_said', $$  select p_spell || ': ' || case
    when not (b->>'landed')::boolean then 'your arrow goes wide of the ' || (b->>'name') || '.'
    when (b->>'died')::boolean then 'your arrow strikes the ' || (b->>'name') || ', and it dies.'
    else 'your arrow strikes the ' || (b->>'name') || case when (b->>'crit')::boolean then ', a critical hit' else '' end
      || '. It is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end$$,
  $$  select p_spell || case
    when not (b->>'landed')::boolean then ' missed: ' || (b->>'name') || '.'
    when (b->>'died')::boolean then ': ' || (b->>'name') || ' killed.'
    else case when (b->>'crit')::boolean then ', critical' else '' end
      || ': ' || (b->>'name') || ' ' || (b->>'left') || '/' || (b->>'of') || '.' end$$);
select private.prose_patch('kindler_said', $$  select p_spell || ': ' || case
    when not coalesce((b->>'landed')::boolean, false) then 'the fire does not take on the ' || coalesce(b->>'name', 'creature') || '.'
    when (b->>'died')::boolean then 'the ' || (b->>'name') || ' burns, and dies.'
    else 'the fire takes ' || round((b->>'dmg')::numeric) || ' off the ' || (b->>'name') || '. It is down to '
      || (b->>'left') || ' of ' || (b->>'of') || '.' end$$,
  $$  select p_spell || case
    when not coalesce((b->>'landed')::boolean, false) then ' missed: ' || coalesce(b->>'name', 'creature') || '.'
    when (b->>'died')::boolean then ': ' || (b->>'name') || ' killed.'
    else ': ' || (b->>'name') || ' −' || round((b->>'dmg')::numeric) || ' fire, '
      || (b->>'left') || '/' || (b->>'of') || '.' end$$);
select private.prose_patch('binder_said', $$  select p_spell || ': ' || case
    when not coalesce((b->>'landed')::boolean, false) then 'the shatter does not take on the ' || coalesce(b->>'name', 'creature') || '.'
    when (b->>'died')::boolean then 'the ' || (b->>'name') || ' shatters, and dies.'
    else 'the shatter takes ' || round((b->>'dmg')::numeric) || ' off the ' || (b->>'name') || '. It is down to '
      || (b->>'left') || ' of ' || (b->>'of') || '.' end$$,
  $$  select p_spell || case
    when not coalesce((b->>'landed')::boolean, false) then ' missed: ' || coalesce(b->>'name', 'creature') || '.'
    when (b->>'died')::boolean then ': ' || (b->>'name') || ' killed.'
    else ': ' || (b->>'name') || ' −' || round((b->>'dmg')::numeric) || ', '
      || (b->>'left') || '/' || (b->>'of') || '.' end$$);
select private.prose_patch('kindler_burn_said', $$  select case when v is null then '' else ' It burns ' || trim_scale(round(((v->>'each')::double precision * 100)::numeric, 1))
    || '% of its health a second for ' || faith_span((v->>'secs')::double precision) || '.' end$$,
  $$  select case when v is null then '' else ' Burning: ' || trim_scale(round(((v->>'each')::double precision * 100)::numeric, 1))
    || '% health per second for ' || faith_span((v->>'secs')::double precision) || '.' end$$);
select private.prose_patch('class_beast_said', $$  select p_spell || ': ' || p_name || ' strikes the ' || coalesce(b->>'name', 'creature')
      || case when (b->>'died')::boolean then ', and it dies.'
              when not coalesce((b->>'landed')::boolean, false) then ', and it does not tell.'
              else '. It is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end$$,
  $$  select p_spell || ': ' || p_name
      || case when (b->>'died')::boolean then ' killed ' || coalesce(b->>'name', 'creature') || '.'
              when not coalesce((b->>'landed')::boolean, false) then ' missed ' || coalesce(b->>'name', 'creature') || '.'
              else ' hit ' || coalesce(b->>'name', 'creature') || ' ' || (b->>'left') || '/' || (b->>'of') || '.' end$$);
select private.prose_patch('warder_skin_said', $$  select p_spell || ': a skin of ' || faith_pct(p_size) || ' goes over ' || p_who || case
    when p_was <= 0 then '.'
    when p_now > greatest(p_was, p_size) + 1e-9 then ', added to the one there: ' || faith_pct(p_now) || ' now.'
    else ', in place of a smaller one.' end$$,
  $$  select p_spell || ': skin ' || faith_pct(p_size) || ' on ' || p_who || case
    when p_was <= 0 then '.'
    when p_now > greatest(p_was, p_size) + 1e-9 then ', stacked: ' || faith_pct(p_now) || '.'
    else ', replacing a smaller one.' end$$);
select private.prose_patch('class_vengeance', $$    perform tell(p_world, p_uid, k.name || ' answers the ' || (b->>'name') || ' for you'
      || case when (b->>'died')::boolean then ', and it dies.'
              else '. It is down to ' || (b->>'left') || ' of ' || (b->>'of') || '.' end, 'fight');$$,
  $$    perform tell(p_world, p_uid, k.name || ' struck back: ' || (b->>'name')
      || case when (b->>'died')::boolean then ' killed.'
              else ' ' || (b->>'left') || '/' || (b->>'of') || '.' end, 'fight');$$);
select private.prose_patch('warder_thorns', $$': the ' || v_name || ' takes '
    || trim_scale(round(p_dmg::numeric, 1)) || ' back' || case when v_died then ', and dies.'
    else '. It is down to ' || greatest(0, ceil(v_left)) || ' of ' || max_health(c) || '.' end, 'fight');$$,
  $$': ' || v_name || ' −'
    || trim_scale(round(p_dmg::numeric, 1)) || case when v_died then ', killed.'
    else ', ' || greatest(0, ceil(v_left)) || '/' || max_health(c) || '.' end, 'fight');$$);
select private.prose_patch('class_guard_take', $$  perform tell(p_world, p_guard, 'You take the ' || p_by || '’s blow at ' || p_for || ' on your '
    || lower((select name from item_def where id = shield.def)) || '.', 'fight');$$,
  $$  perform tell(p_world, p_guard, 'Guarded ' || p_for || ': ' || p_by || '’s blow taken on your '
    || lower((select name from item_def where id = shield.def)) || '.', 'fight');$$);
select private.prose_patch('class_beast_take', $$c.name || ' dies of the wounds it took for you.'$$,
  $$c.name || ' died: damage taken for you.'$$);
select private.prose_patch('class_owed_pay', $$class_blow_said(v_name, b) || ' Its next blow is put back ' || faith_span(v_back) || '.'$$,
  $$class_blow_said(v_name, b) || ' Next blow delayed ' || faith_span(v_back) || '.'$$);
select private.prose_patch('class_person_why', $$    return coalesce(pl.name, 'They') || ' is more than ' || trim_scale(p_reach::numeric) || ' tiles away.';$$,
  $$    return 'Too far: max ' || trim_scale(p_reach::numeric) || ' tiles.';$$);
select private.prose_patch('warder_skin_spent', $$': you get back '
      || faith_pct(pk(p.class_mul, 'stamina:skin', 0)) || ' of your stamina.', 'fight');$$,
  $$': stamina +'
      || faith_pct(pk(p.class_mul, 'stamina:skin', 0)) || '.', 'fight');$$);
select private.prose_patch('warder_skin_spent', $$    || ': a skin of ' || faith_pct(v_size) || ' goes back over you.', 'fight');$$,
  $$    || ': skin ' || faith_pct(v_size) || ' relaid on you.', 'fight');$$);
select private.prose_patch('warder_skin_spent', $$|| ': a skin of ' || faith_pct(v_size)
    || ' goes back over ' || coalesce(p.name, 'them') || '.', 'fight');$$,
  $$|| ': skin ' || faith_pct(v_size)
    || ' relaid on ' || coalesce(p.name, 'them') || '.', 'fight');$$);

drop function private.prose_patch(text, text, text);
drop function private.prose_patch_all(text, text, text, int);

select private.lock_doors();
