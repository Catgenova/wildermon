-- A repeated mould pour takes the metal the first pour took.
--
-- Reported: "when i just filled a mold using lower QL mithril from a nearby wagon then repeated the action it used the
-- higher QL mithril in my inventory for the repeat action." The repeat named the wagon's lumps; queued behind the
-- pour in hand, `rpc_act` stamped what they were (`was`), and `act_retarget` -- which keeps a job's thing only while
-- it is carried -- took a stack in a store for a stack that is gone and stood the pack's mithril in for it.
--
-- A stand-in is for a thing you carry, as the browser's `retarget` stamps it (`lastAsked.was`, off the pack): a stack
-- in a store within reach is stamped with nothing, so a queued job takes that stack or is refused in its own words.

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

select pg_temp.patch_fn('public.rpc_act(uuid,text,jsonb,integer)'::regprocedure,
  $o$        || coalesce((select jsonb_build_object('was', i.def) from item i
                      where i.id = target_item(p_target) and i.world_id = p_world), '{}'::jsonb))$o$,
  $n$        || coalesce((select jsonb_build_object('was', i.def) from item i
                      where i.id = target_item(p_target) and i.world_id = p_world
                        -- Only a thing you carry: a stack in a store is the one named or none (`act_retarget`).
                        and (carried(p_world, me, i.id)).id is not null), '{}'::jsonb))$n$);

select private.lock_doors();
