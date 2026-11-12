-- A run of goes keeps the wood (or metal) it was started on.
--
-- Reported: "bulk sawing planks continues on with other log types after you run out of the type you were working
-- with, eg i clicked 36 pine logs and set it to craft 50 and after making 36 pine logs it kept working but with nearby
-- oak logs".
--
-- A run is aimed at one stack. When a go uses that stack up, `craft_carry_on` re-aims the run at the next stack of
-- the same thing in the same material -- and when there is none, it left the run aimed at the stack that had gone.
-- The next go then asked `craft_material` what the run was made of, with nothing named any longer to read it off, and
-- it answered from scratch: the first stack of logs within reach, of any wood. So the run went on in oak.
--
-- Now, with nothing of the same thing and material left, `craft_carry_on` writes into the run's target what ran
-- out (`ranOut`: the thing and its material), and the run is refused there (`craft_ran_out`), in the words a recipe
-- short of its material uses: "Saw planks: Need 1 log of pine. Left: 14." The browser keeps the same rule
-- (`recipeAction`'s `carryOn`, `src/game/recipes.ts`).
--
-- And `settle` asks whether a run goes on of the target the go left it with. It asked it of the target as it stood
-- before the go, so a run whose stack a go had just used up was asked about a stack that was gone -- which
-- `craft_material` answered from scratch, any wood -- and the go after it, asked a moment ago, was not asked again.

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

/**
 * Keep a run of goes on the next pile of the same thing, once a go has used
 * up the stack the run was aimed at: the next stack a craft would reach of the
 * thing that stack was, in the wood or metal the go was made of. Only the job
 * in hand is re-aimed, and only while it is still aimed at the stack that went.
 *
 * With none left of that thing in that material, the run is marked as having
 * run out of it (`ranOut`), and `craft_ran_out` stops it at the next go rather
 * than letting it go on in another material.
 */
create or replace function craft_carry_on(p_world uuid, p_uid uuid, p_recipe text, p_target jsonb,
                                          p_was text, p_mat text)
  returns void language plpgsql as $fn$
declare aimed bigint := target_item(p_target); nxt bigint;
begin
  if aimed is null or p_was is null
     or exists (select 1 from item where id = aimed and world_id = p_world) then
    return;
  end if;
  select s.id into nxt from craft_stock(p_world, p_uid) s
   where s.def = p_was and (p_mat is null or s.extra is not distinct from p_mat)
   order by s.draw limit 1;
  if nxt is null then
    if p_mat is not null then
      update player
         set act_target = act_target || jsonb_build_object('ranOut', jsonb_build_object('item', p_was, 'material', p_mat))
       where world_id = p_world and uid = p_uid and act = p_recipe and target_item(act_target) = aimed;
    end if;
    return;
  end if;
  update player
     set act_target = jsonb_set(act_target, array[case when act_target ? 'itemUid' then 'itemUid' else 'uid' end],
                                to_jsonb(nxt))
   where world_id = p_world and uid = p_uid and act = p_recipe and target_item(act_target) = aimed;
end $fn$;

/**
 * Why a run of a recipe stops: the stack it was aimed at is gone, and nothing of
 * that thing in that material was left within reach when it went (`ranOut`, from
 * `craft_carry_on`). Null otherwise. The browser's `ranOutSaid`.
 */
create or replace function craft_ran_out(p_world uuid, p_uid uuid, p_recipe text, p_target jsonb)
  returns text language plpgsql stable as $fn$
declare o jsonb := p_target->'ranOut'; aimed bigint := target_item(p_target); n int;
begin
  if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'item') is distinct from 'string'
     or jsonb_typeof(o->'material') is distinct from 'string' or aimed is null
     or exists (select 1 from craft_stock(p_world, p_uid, aimed) s where s.id = aimed) then
    return null;
  end if;
  n := recipe_need(p_world, p_uid, p_recipe,
         coalesce((select ri.count from recipe_input ri where ri.recipe = p_recipe and ri.item = o->>'item'
                    order by ri.ord limit 1), 1));
  return 'Need ' || n || ' ' || plural_of(o->>'item', n) || ' of ' || lower(o->>'material') || '.';
end $fn$;

select pg_temp.patch_fn('public.act_refusal_rules(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    return craft_refusal(p_world, p_uid, p_action, target_item(p_target));$o$,
  $n$    -- A run that has used up the last of its material stops there (`craft_ran_out`).
    return coalesce(craft_ran_out(p_world, p_uid, p_action, p_target),
                    craft_refusal(p_world, p_uid, p_action, target_item(p_target)));$n$);

-- Whether a run goes on, asked of the target the go left it with (`craft_carry_on` re-aims it), not the one before.
select pg_temp.patch_fn('public.settle(uuid,uuid)'::regprocedure,
  $o$p.act_left > 1 and act_refusal(p_world, p_uid, p.act, p.act_target) is null$o$,
  $n$p.act_left > 1 and act_refusal(p_world, p_uid, p.act,
            coalesce((select pl.act_target from player pl where pl.world_id = p_world and pl.uid = p_uid and pl.act = p.act),
                     p.act_target)) is null$n$);
select pg_temp.patch_fn('public.settle(uuid,uuid)'::regprocedure,
  $o$act_refusal(p_world, p_uid, p.act, p.act_target) || ' Left: '$o$,
  $n$act_refusal(p_world, p_uid, p.act,
              coalesce((select pl.act_target from player pl where pl.world_id = p_world and pl.uid = p_uid and pl.act = p.act),
                       p.act_target)) || ' Left: '$n$);

select private.lock_doors();
