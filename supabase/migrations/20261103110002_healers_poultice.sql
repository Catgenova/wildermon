-- A Healer's poultice: first aid with a life mote (`dress_poultice`, `treat_poultice`; the browser's `firstaid.ts`).
--
-- Asked: "Healer's poultice -- first aid with a life mote heals x2 and closes one extra wound." Its own entries beside
-- Dress a wound and Treat its wounds, so a mote is never spent unasked, and never repeated. Refused without a life mote
-- in the pack (`life_mote_need`), and otherwise as the dressing or the treatment it is. On a go that takes: one life mote
-- used (`life_motes_each`), the health healed x`poultice_heal`, and on a body -- yours or somebody's beside you -- the
-- next worst uninfected wound past the one dressed (`worst_wound`) closed. A wildermon has no wounds: only the heal.
-- On a dressing that slips or a treatment that goes badly the mote is kept and the go is a plain one.
set local lock_timeout = '3s';

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

/* ---- The two are fighting-family jobs, as the dressing and the treatment are ---- */
select pg_temp.patch_fn('public.fight_action(text)'::regprocedure,
$o$'bind_wound', 'clean_wound', 'treat_creature')$o$,
$n$'bind_wound', 'clean_wound', 'treat_creature',
                      -- A Healer's poultice: the dressing and the treatment with a life mote.
                      'dress_poultice', 'treat_poultice')$n$);

/* ---- Refused without a life mote, and then as the go it is ---- */
select pg_temp.patch_fn('public.fight_refusal(uuid,uuid,text,jsonb)'::regprocedure,
$o$  select * into p from player where world_id = p_world and uid = p_uid;

  if p_action in ('equip', 'unequip') then$o$,
$n$  select * into p from player where world_id = p_world and uid = p_uid;

  -- A Healer's poultice: a life mote in the pack, and then whatever the dressing or the treatment it is asks.
  if p_action in ('dress_poultice', 'treat_poultice') then
    if pack_count(p_world, p_uid, life_mote()) < life_motes_each() then return life_mote_need(); end if;
    return fight_refusal(p_world, p_uid, case p_action when 'dress_poultice' then 'bind_wound' else 'treat_creature' end, p_target);
  end if;

  if p_action in ('equip', 'unequip') then$n$);

/* ---- The go ---- */
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$v_wind double precision; v_spar boolean := false;$o$,
$n$v_wind double precision; v_spar boolean := false;
        -- A Healer's poultice: asked for, the mote used, the wound it closes, and what the lines say of it.
        v_mote boolean := false; v_used boolean := false; v_shut jsonb; v_tail text := '';$n$);

-- The dressing, yours or somebody's: the poultice asked for.
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$  elsif p_action = 'bind_wound' then
$o$,
$n$  elsif p_action in ('bind_wound', 'dress_poultice') then
    v_mote := p_action = 'dress_poultice';
$n$);

-- The wound it closes, off the wounds as they were, and the mote used only on a go that took.
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$                       pk(p_world, p_uid, 'fail:bind_wound', 1));
$o$,
$n$                       pk(p_world, p_uid, 'fail:bind_wound', 1));
    -- A Healer's poultice: the next worst wound past the one dressed, never one gone bad (`poulticeCloses`).
    if v_mote and clean then
      v_shut := worst_wound((select jsonb_agg(x) from jsonb_array_elements(pt.wounds) x
                              where x <> hurt and not coalesce((x->>'infected')::boolean, false)));
      v_used := consume(p_world, p_uid, life_mote(), life_motes_each());
    end if;
$n$);

-- Health healed x`poultice_heal` with the mote used.
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$              * (case when v_other then pk(p_world, p_uid, 'heal:others', 1) else 1 end);
$o$,
$n$              * (case when v_other then pk(p_world, p_uid, 'heal:others', 1) else 1 end)
              -- And over again for a Healer's poultice.
              * (case when v_used then poultice_heal() else 1 end);
$n$);

-- And the wound it closes left off.
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$      if (one->>'severity')::double precision > 0.004 or (one->>'infected')::boolean then
$o$,
$n$      if v_used and v_shut is not null and one = v_shut then continue; end if;
      if (one->>'severity')::double precision > 0.004 or (one->>'infected')::boolean then
$n$);

-- What it says: on somebody else, to you and to them.
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$    if v_other then
      perform tell(p_world, p_uid, case$o$,
$n$    v_tail := case when not v_mote then '' when not v_used then ' ' || poultice_kept()
      else poultice_says(case when v_shut is not null then 'the ' || (select name from wound_kind_def where id = v_shut->>'kind')
        || ' on ' || case when v_other then coalesce(pt.name, 'their') || '''s ' else 'your ' end || part_name(v_shut->>'part') end) end;
    if v_other then
      perform tell(p_world, p_uid, case$n$);
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$                  else ', cloth.' end
        end, 'event');$o$,
$n$                  else ', cloth.' end
        end || v_tail, 'event');$n$);
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$        else ' failed to dress the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.' end,
        'event');$o$,
$n$        else ' failed to dress the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.' end
        || case when v_used then poultice_says(case when v_shut is not null then 'the '
             || (select name from wound_kind_def where id = v_shut->>'kind') || ' on your ' || part_name(v_shut->>'part') end) else '' end,
        'event');$n$);
-- And on you.
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$        || ', cloth. Bleeding stopped; heals slowly.'
      end, 'event');$o$,
$n$        || ', cloth. Bleeding stopped; heals slowly.'
      end || v_tail, 'event');$n$);

-- The treatment of a wildermon: the poultice asked for, the mote used on a treatment that took, and the heal x2.
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$  elsif p_action = 'treat_creature' then
$o$,
$n$  elsif p_action in ('treat_creature', 'treat_poultice') then
    v_mote := p_action = 'treat_poultice';
$n$);
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$    clean := skill_check(skill_of(p_world, p_uid, 'first_aid'), 14, use.ql);
    top := max_health(c);
    healed := top * (0.06 + (skill_of(p_world, p_uid, 'first_aid') / 100) * 0.24 + (use.ql / 100) * 0.1)
              * (case when clean then 1 else 0.35 end);$o$,
$n$    clean := skill_check(skill_of(p_world, p_uid, 'first_aid'), 14, use.ql);
    v_used := v_mote and clean and consume(p_world, p_uid, life_mote(), life_motes_each());
    top := max_health(c);
    healed := top * (0.06 + (skill_of(p_world, p_uid, 'first_aid') / 100) * 0.24 + (use.ql / 100) * 0.1)
              * (case when clean then 1 else 0.35 end)
              * (case when v_used then poultice_heal() else 1 end);$n$);
select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$      end || ceil(c.health) || '/' || top || '.', 'event');$o$,
$n$      end || ceil(c.health) || '/' || top || '.'
      || case when not v_mote then '' when v_used then poultice_says(null) else ' ' || poultice_kept() end, 'event');$n$);

select private.lock_doors();
