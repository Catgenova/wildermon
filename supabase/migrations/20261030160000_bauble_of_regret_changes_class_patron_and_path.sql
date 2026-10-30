-- A Bauble of Regret is what changes a choice made for good: a class, a patron or a path. No silver does.
--
-- Asked, with the silver price of a change of class taken away: "baubles of regret only for changes to professions,
-- faiths, paths, etc". So:
--
--   * `rpc_take_class` in a slot already held breaks a Bauble of Regret from the pack (`regret_break`: `consume`, and
--     the two refusals `rpc_regret_class` already gave) where it took silver, and clears the
--     old class with its nodes, perks and spells as before. "Class changed: A to B. Bauble of Regret used." Its answer
--     says `regret` where it said `paid`.
--   * `rpc_classes` drops `change_cost` and `purse`; a card in a slot already held carries the bauble's refusal
--     (`regret_refusal`) as its `why`, so the Trades window says it before it is pressed.
--   * `rpc_regret_class` says what it did and no more: no "Next class: free (base N silver)".
--   * `rpc_regret_patron` undoes a patron: `player.patron` cleared, the faith spells taken from it (`player_spell`)
--     with it, and off the spell bar. Favour and faith stay. Then a patron may be taken again under `patron_refusal`.
--   * `rpc_regret_path` undoes a path: `player.way` cleared, its picks (`path_taken`) with it, its techniques off the
--     spell bar, and what Kin put on the beasts you keep (`kept_of`) taken off them, as `rpc_take_path_pick` puts it
--     on. What a technique left running ends with the path: Foreknow's goes, Clarity, the marks of a Seek or a Trace
--     (`path_marks`) and the timers on `blessings` (`path_*`). Calm, meditation, the sittings, and the day-keyed
--     records that stop a once-a-day thing coming twice (`studied`, `bloom_day`, `kill_saved_at`) stay. Then the path
--     may be chosen again at the rug (`choose_path`, from `choose_at()` meditation), as before.
--   * `patron_refusal`: "Patron already X. Undo: Bauble of Regret." where it said "permanent".
--   * The find line names all three: "Undoes a class, patron or path."
--   * The price function goes; nothing calls it.
--
-- `src/game/baubles.ts` says the same words; `supabase/test/regret.ts` holds the two sides to them.

set local lock_timeout = '3s';

/* ---- the bauble ---------------------------------------------------------------------------------- */

/**
 * Why a Bauble of Regret would not break for this person now, or null: one carried, loose or in a bag and not kept
 * back, is what `consume` takes.
 */
create or replace function regret_refusal(p_world uuid, p_uid uuid) returns text language sql stable as $$
  select case
    when pack_count(p_world, p_uid, 'bauble_regret') > 0 then null
    when exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                  and i.def = 'bauble_regret') then 'Bauble of Regret is kept back: return it to the pack.'
    else 'Need a Bauble of Regret.' end
$$;
revoke all on function regret_refusal(uuid, uuid) from public, anon, authenticated;

/** Break one: null when it broke, or why not. */
create or replace function regret_break(p_world uuid, p_uid uuid) returns text language plpgsql as $$
begin
  if consume(p_world, p_uid, 'bauble_regret', 1) then return null; end if;
  return coalesce(regret_refusal(p_world, p_uid), 'Need a Bauble of Regret.');
end $$;
revoke all on function regret_break(uuid, uuid) from public, anon, authenticated;

/** Every spell of one school (`spell_any`: faith, class or path) off the bar: what taught it has been put down. */
create or replace function spell_bar_clear_school(p_world uuid, p_uid uuid, p_school text) returns void language sql as $$
  update player p set spell_bar = (
    select jsonb_agg(case when exists (select 1 from spell_any sa where sa.school = p_school and sa.id = p.spell_bar->>s.slot)
                          then 'null'::jsonb
                          else coalesce(p.spell_bar->s.slot, 'null'::jsonb) end order by s.slot)
      from spell_slot s)
   where p.world_id = p_world and p.uid = p_uid
$$;
revoke all on function spell_bar_clear_school(uuid, uuid, text) from public, anon, authenticated;

/* ---- a class ------------------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.rpc_take_class(p_world uuid, p_class text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player; c class_def; v_had text; v_why text;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- Held for the rest of this, so that two asked at once cannot both break the same bauble.
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('why', 'You are not on this island.'); end if;
  select * into c from class_def where id = p_class;
  if not found then return jsonb_build_object('why', 'No such class.'); end if;

  v_why := class_refusal(p_world, me, p_class);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;

  v_had := case when c.kind = 'craft' then p.craft_class else p.combat_class end;
  if v_had = p_class then
    return jsonb_build_object('why', 'Already your class: ' || c.name || '.');
  end if;
  -- A change, not a first: a Bauble of Regret, and nothing else buys one.
  if v_had is not null then
    v_why := regret_break(p_world, me);
    if v_why is not null then return jsonb_build_object('why', v_why); end if;
  end if;

  /*
   * And the tree goes with the trade.
   *
   * Nodes are drawn on the trade they belong to, so putting it down puts them
   * down with it -- which is also the only way a tree is ever cleared. Only
   * the trade being put down is cleared; the other slot keeps what it had.
   */
  if v_had is not null then
    delete from player_node pn using class_node n
     where n.id = pn.node and pn.world_id = p_world and pn.uid = me and n.class = v_had;
    -- And its perks, which are rows in the same table.
    delete from player_node pn using class_perk k
     where k.id = pn.node and pn.world_id = p_world and pn.uid = me and k.class = v_had;
  end if;
  if c.kind = 'craft' then
    update player set craft_class = p_class, class_taken = now() where world_id = p_world and uid = me;
  else
    -- And its own level, from the start (`class_level_start`), and the old trade's spells off the bar.
    update player set combat_class = p_class, class_taken = now(), class_level = class_level_start()
      where world_id = p_world and uid = me;
    perform spell_bar_clear_class(p_world, me);
    perform journal_note(p_world, me, 'fighter');
  end if;
  perform class_fold(p_world, me);

  perform tell(p_world, me, case when v_had is null
    then 'Class taken: ' || c.name || '. ' || c.lever
    else 'Class changed: ' || (select name from class_def where id = v_had) || ' to ' || c.name
         || '. Bauble of Regret used. ' || c.lever end, 'system');
  return jsonb_build_object('took', p_class, 'kind', c.kind, 'regret', v_had is not null, 'was', v_had);
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_classes(p_world uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player; v_regret text;
begin
  perform private.pace(auth.uid(), 'look');
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then return jsonb_build_object('why', 'You are not on this island.'); end if;
  v_regret := regret_refusal(p_world, me);
  return jsonb_build_object(
    'taken', jsonb_build_object('craft', p.craft_class, 'combat', p.combat_class),
    'at', class_at()::int,
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'name', c.name, 'note', c.note,
        'main', c.main, 'lever', c.lever,
        'skills', (select jsonb_agg(cs.skill order by cs.skill) from class_skill cs where cs.class = c.id),
        -- What the trade would be worth in points if it were taken up, which
        -- is a thing worth knowing before taking it up.
        'points', class_points(p_world, me, c.id),
        'open', class_open(p_world, me, c.id),
        -- Shut below its level; and in a slot held by another, shut without a Bauble of Regret to change it.
        'why', coalesce(class_refusal(p_world, me, c.id),
                 case when h.held is not null and h.held <> c.id then v_regret end)) order by c.kind, c.name)
      from class_def c,
           lateral (select case when c.kind = 'craft' then p.craft_class else p.combat_class end as held) h), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_regret_class(p_world uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player; v_had text; v_why text;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- Held for the rest of this, so that two asked at once cannot both break the same bauble.
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('why', 'You are not on this island.'); end if;
  if p_kind is null or p_kind not in ('craft', 'combat') then
    return jsonb_build_object('why', 'No such class.');
  end if;
  v_had := case when p_kind = 'craft' then p.craft_class else p.combat_class end;
  if v_had is null then
    return jsonb_build_object('why', 'No ' || case when p_kind = 'craft' then 'crafting' else 'fighting' end
      || ' class to undo.');
  end if;
  -- One carried anywhere, loose or in a bag, as `consume` takes it; one put by is not broken.
  v_why := regret_break(p_world, me);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  -- The tree goes with the trade, as it does when one is put down for another.
  delete from player_node pn using class_node n
   where n.id = pn.node and pn.world_id = p_world and pn.uid = me and n.class = v_had;
  -- And its perks, which are rows in the same table.
  delete from player_node pn using class_perk k
   where k.id = pn.node and pn.world_id = p_world and pn.uid = me and k.class = v_had;
  if p_kind = 'craft' then
    update player set craft_class = null where world_id = p_world and uid = me;
  else
    update player set combat_class = null, class_level = 0 where world_id = p_world and uid = me;
    perform spell_bar_clear_class(p_world, me);
  end if;
  perform class_fold(p_world, me);
  perform tell(p_world, me, 'Bauble of Regret used: '
    || (select c.name from class_def c where c.id = v_had) || ' removed, with its '
    || case when exists (select 1 from class_perk k where k.class = v_had) then 'perks' else 'tree' end
    || '.', 'system');
  return jsonb_build_object('undone', v_had, 'kind', p_kind);
end $function$;

/* ---- a patron ------------------------------------------------------------------------------------ */

/** Break a Bauble of Regret to undo your patron: the patron, its spells, and their places on the bar. */
create or replace function rpc_regret_patron(p_world uuid) returns jsonb
  language plpgsql security definer set search_path = public as $function$
declare me uuid := auth.uid(); p player; v_why text; v_name text;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- Held for the rest of this, so that two asked at once cannot both break the same bauble.
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('why', 'You are not on this island.'); end if;
  if p.patron is null then return jsonb_build_object('why', 'No patron to undo.'); end if;
  v_why := regret_break(p_world, me);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  v_name := coalesce((select d.name from patron_def d where d.id = p.patron), p.patron);
  delete from player_spell ps using faith_spell s
   where s.id = ps.spell and ps.world_id = p_world and ps.uid = me;
  update player set patron = null where world_id = p_world and uid = me;
  perform spell_bar_clear_school(p_world, me, 'faith');
  perform tell(p_world, me, 'Bauble of Regret used: patron ' || v_name || ' removed, with its spells.', 'system');
  return faith_said(p_world, me) || jsonb_build_object('undone', 'patron');
end $function$;

CREATE OR REPLACE FUNCTION public.patron_refusal(p_world uuid, p_uid uuid, p_patron text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare d patron_def; p player; v_faith double precision;
begin
  select * into d from patron_def where id = p_patron;
  if not found then return 'No such patron.'; end if;
  select * into p from player where world_id = p_world and uid = p_uid;
  if not found then return 'You are not on this island.'; end if;
  if p.patron is not null then
    return 'Patron already ' || coalesce((select name from patron_def where id = p.patron), p.patron)
        || '. Undo: Bauble of Regret.';
  end if;
  v_faith := skill_of(p_world, p_uid, faith_skill());
  if v_faith < patron_at() then
    return 'Needs ' || faith_word() || ' ' || patron_at()::int || '; have ' || floor(v_faith)::int || '.';
  end if;
  return null;
end $function$;

/* ---- a path -------------------------------------------------------------------------------------- */

/**
 * Break a Bauble of Regret to undo your path: the path, its picks, its techniques on the bar, what Kin put on the
 * beasts you keep, and what a technique left running. Calm and meditation stay.
 */
create or replace function rpc_regret_path(p_world uuid) returns jsonb
  language plpgsql security definer set search_path = public as $function$
declare me uuid := auth.uid(); p player; v_why text; v_name text;
begin
  perform private.pace(auth.uid(), 'act');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  -- Held for the rest of this, so that two asked at once cannot both break the same bauble.
  select * into p from player where world_id = p_world and uid = me for update;
  if not found then return jsonb_build_object('why', 'You are not on this island.'); end if;
  if p.way is null then return jsonb_build_object('why', 'No path to undo.'); end if;
  v_why := regret_break(p_world, me);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  v_name := coalesce((select d.name from path_def d where d.id = p.way), p.way);
  delete from path_taken where world_id = p_world and uid = me;
  update player set way = null, foreknow = 0, clarity_until = null, path_marks = '{}'::jsonb,
         blessings = (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                        from jsonb_each(coalesce(player.blessings, '{}'::jsonb)) e where e.key not like 'path\_%')
   where world_id = p_world and uid = me;
  perform spell_bar_clear_school(p_world, me, 'path');
  -- What keeping a beast comes to without it (Love's Kin), as `rpc_take_path_pick` puts it on.
  update creature set kept = kept_of(p_world, me)
   where world_id = p_world and keeper = me and kept is distinct from kept_of(p_world, me);
  perform tell(p_world, me, 'Bauble of Regret used: path ' || v_name || ' removed, with its picks.', 'system');
  return faith_said(p_world, me) || jsonb_build_object('undone', 'path');
end $function$;

/* ---- the find line ------------------------------------------------------------------------------- */

do $do$
declare v text; v_n int;
  v_old text := $o$'. Undoes one class '
        || '(Trades window).'$o$;
begin
  v := pg_get_functiondef('public.perform_dig(uuid,uuid,text,jsonb)'::regprocedure);
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_dig has % of the Bauble of Regret find line, not 1', v_n; end if;
  execute replace(v, v_old, $n$'. Undoes a class, patron or path.'$n$);
end $do$;

/* ---- no price ------------------------------------------------------------------------------------ */

drop function if exists class_change_cost();

select private.lock_doors();
