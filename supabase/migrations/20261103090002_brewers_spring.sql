-- Brewer's spring: a water mote set in a barrel, whose brews work for ×0.75 of their time.
--
-- Asked: a new use of water motes, "a barrel with a water mote set in it: brews in it ferment in ×0.75 the time".
--   * `set_brew_spring`, Set a water mote (`brewing.ts`): on a barrel of any size (anything that holds a liquid and is
--     not a well), within reach, not one already, not while a brew works in it, one water mote out of the pack. In the
--     last family, with its own refusal and go (`private.brew_spring_refusal`, `private.perform_brew_spring`). The
--     mark is `placed.state.spring`, kept until the barrel is picked up (the row goes; the item carries nothing).
--   * Every brew set going in one after, by a person (`perform_last`) or a Hoppa (`errand_do`), works for
--     `brew_spring_mul()` of its `brew_def.seconds` (`private.brew_seconds`), and is ready that much sooner; a wine's
--     `aged_from` follows, being stamped off `since + ferment` (`placed_aged_from`). None is working when the mote goes
--     in, so none is hurried part way.
--   * Examine says it (`vessel_says`, the browser's `vesselSays`): " Brewer's spring: brew time ×0.75."
--   * And `rpc_ground` sends a barrel's `ferment` as the seconds it has left (`ferment_left`), not the column: the
--     browser counts a brew down from what it is sent, so every reload started a brew over at its whole time, and one
--     long done read as working again.
-- `brew_spring_mul` and the action come with the definitions (20261103090000_defs.sql).
set local lock_timeout = '3s';

/* Whether a barrel is a brewer's spring. */
create or replace function private.brew_spring(p placed)
returns boolean language sql immutable as $fn$
  select coalesce((p.state->>'spring')::boolean, false)
$fn$;

/* Seconds a brew works for in this barrel (`brewTime`): its own, times `brew_spring_mul()` in a brewer's spring. */
create or replace function private.brew_seconds(p placed, b brew_def)
returns double precision language sql stable as $fn$
  select b.seconds * case when private.brew_spring(p) then brew_spring_mul() else 1 end
$fn$;

/* What Examine adds for one (`brewSpringSays`). */
create or replace function private.brew_spring_says(p placed)
returns text language sql stable as $fn$
  select case when private.brew_spring(p) then ' Brewer''s spring: brew time ×' || brew_spring_mul()::text || '.' else '' end
$fn$;

/* Why a water mote will not go into this piece, or null (`brewSpringReason`). */
create or replace function private.brew_spring_refusal(p_world uuid, p_uid uuid, p_target jsonb)
returns text language plpgsql stable as $fn$
declare pc placed;
begin
  pc := target_placed(p_world, p_target);
  if pc.id is null or pc.kind <> 'furniture' then return 'It is gone.'; end if;
  if not holds_liquid(pc) or is_well(pc) then return 'Not a barrel.'; end if;
  if not placed_in_reach(p_world, p_uid, pc.id) then return 'Stand next to it.'; end if;
  if private.brew_spring(pc) then return 'Already a brewer''s spring.'; end if;
  if is_working(pc) then return 'Still fermenting.'; end if;
  if pack_count(p_world, p_uid, water_mote()) < water_motes_each() then return water_mote_need(); end if;
  return null;
end $fn$;

/* A go of Set a water mote: the mote out of the pack, the barrel marked. */
create or replace function private.perform_brew_spring(p_world uuid, p_uid uuid, p_target jsonb)
returns void language plpgsql as $fn$
declare pc placed;
begin
  if private.brew_spring_refusal(p_world, p_uid, p_target) is not null then return; end if;
  pc := target_placed(p_world, p_target);
  if not consume(p_world, p_uid, water_mote(), water_motes_each()) then return; end if;
  update placed set state = state || jsonb_build_object('spring', true) where world_id = p_world and id = pc.id;
  perform tell(p_world, p_uid, 'Brewer''s spring: ' || lower(placed_name(pc)) || ', brew time ×'
    || brew_spring_mul()::text || '.', 'event');
end $fn$;

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

-- The last family takes Set a water mote.
select pg_temp.patch_fn('public.last_action(text)'::regprocedure,
$o$'start_brew', 'set_bauble',$o$,
$n$'start_brew', 'set_brew_spring', 'set_bauble',$n$);

select pg_temp.patch_fn('public.last_refusal(uuid,uuid,text,jsonb)'::regprocedure,
$o$  if p_action = 'sacrifice' then
    return sacrifice_refusal(p_world, p_uid, p_target);
  end if;
$o$,
$n$  -- A brewer's spring: a water mote into a barrel (`private.brew_spring_refusal`).
  if p_action = 'set_brew_spring' then
    return private.brew_spring_refusal(p_world, p_uid, p_target);
  end if;
  if p_action = 'sacrifice' then
    return sacrifice_refusal(p_world, p_uid, p_target);
  end if;
$n$);

select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
$o$  if p_action = 'sacrifice' then
    perform perform_sacrifice(p_world, p_uid, p_target);
    return;
  end if;
$o$,
$n$  if p_action = 'set_brew_spring' then
    perform private.perform_brew_spring(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'sacrifice' then
    perform perform_sacrifice(p_world, p_uid, p_target);
    return;
  end if;
$n$);

-- A brew set going works for its time in this barrel, and says so.
select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
$o$ferment = bd.seconds, since = now(),$o$,
$n$ferment = private.brew_seconds(pc, bd), since = now(),$n$);
select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
$o$floor(bd.seconds / 60 + 0.5)$o$,
$n$floor(private.brew_seconds(pc, bd) / 60 + 0.5)$n$);

-- And a Hoppa's the same.
select pg_temp.patch_fn('public.errand_do(uuid,integer,boolean,text)'::regprocedure,
$o$ferment = v_b.seconds, since = now(),$o$,
$n$ferment = private.brew_seconds(v_p, v_b), since = now(),$n$);

-- Examine says it.
select pg_temp.patch_fn('public.vessel_says(placed)'::regprocedure,
$o$      || wine_age_says(p, extract(epoch from now())::double precision)
$o$,
$n$      || wine_age_says(p, extract(epoch from now())::double precision)
      -- And a brewer's spring (`brewSpringSays`).
      || private.brew_spring_says(p)
$n$);

-- The seconds a brew has left, which is what the browser counts down.
select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
$o$        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl),
$o$,
$n$        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl), 'ferment', ferment_left(pl),
$n$);

select private.lock_doors();
