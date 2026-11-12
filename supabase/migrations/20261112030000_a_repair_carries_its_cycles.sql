-- Improve and repair, several pieces at once: a Repair to nought that starts a run of cycles carries the run.
--
-- Asked for: "an Improve button next to Repair and Hone would be nice in my opinion, shift/ctrl clicking to select
-- multiple would be going the extra mile". The window (`src/ui/panels/mend.ts`) queues a run of improve-and-repair
-- cycles on each chosen piece in turn. A piece over `improve_damage` (10) was asked as two jobs, a Repair and then
-- the run of Improve; but `rpc_act` asks every job its refusal as it is asked, queued or not, so the Improve was
-- refused "Damage over 10: repair it first." while the Repair before it waited. And two places a piece fill the
-- queue twice as fast.
--
-- So the Repair carries the run: `repair_item` with `cycles` (the passes) and the run's `stock`, `stockOf` and
-- `upto`. When the Repair ends, `private.job_follow` puts the run in front of the line -- `improve_item` with `mend`
-- on the same piece, as the browser's `pieceJob` (`src/game/mending.ts`) builds it -- where it is asked its refusal
-- as any job is. One place in the queue a piece, over 10 or not.
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

-- The new target key, taken at the door: the passes of the run a Repair starts, as many as a job takes.
select pg_temp.patch_fn('private.spec_target()'::regprocedure,
  $o$"mend": {"t": "bool"},$o$,
  $n$"mend": {"t": "bool"}, "cycles": {"t": "int", "min": 1, "max": 100},$n$);

/**
 * What goes in front of the line when a run ends, or null: the run of Improve a Repair with `cycles` starts; the
 * Repair and the rest of an Improve and repair; the next piece of a Repair all or a Hone all. `p_left` is the
 * goes the run had not done.
 */
create or replace function private.job_follow(p_world uuid, p_uid uuid, p_action text, p_target jsonb, p_left int)
returns jsonb language plpgsql stable as $fn$
declare v_it item; v_next item; v_all int;
begin
  if p_action not in ('improve_item', 'repair_item', 'hone_whetstone') or jsonb_typeof(p_target) is distinct from 'object' then
    return null;
  end if;
  if p_action = 'repair_item' and jsonb_typeof(p_target->'cycles') = 'number' then
    v_it := carried(p_world, p_uid, target_item(p_target));
    if v_it.id is null then return null; end if;
    return jsonb_build_array(jsonb_build_object('action', 'improve_item',
             'target', jsonb_build_object('kind', 'item', 'uid', v_it.id, 'mend', true)
                       || jsonb_strip_nulls(jsonb_build_object('stock', p_target->'stock', 'stockOf', p_target->'stockOf',
                                                               'upto', p_target->'upto')),
             'goes', least(100, greatest(1, (p_target->>'cycles')::int))));
  end if;
  if p_action = 'improve_item' then
    if not coalesce((p_target->>'mend')::boolean, false) then return null; end if;
    v_it := carried(p_world, p_uid, target_item(p_target));
    if v_it.id is null or v_it.dmg <= 10 or item_refusal(p_world, p_uid, 'repair_item', p_target) is not null then
      return null;
    end if;
    return jsonb_build_array(jsonb_build_object('action', 'repair_item',
             'target', jsonb_build_object('kind', 'item', 'uid', v_it.id),
             'goes', private.repair_goes(p_world, p_uid, v_it.dmg)))
        || case when p_left > 0
                then jsonb_build_array(jsonb_build_object('action', 'improve_item', 'target', p_target, 'goes', p_left))
                else '[]'::jsonb end;
  end if;
  v_all := case when jsonb_typeof(p_target->'all') = 'number' then (p_target->>'all')::int else 0 end;
  if v_all <= 1 then return null; end if;
  select g.* into v_next from private.held_gear(p_world, p_uid) g
   where g.dmg > 0
     and case when p_action = 'repair_item'
              then item_refusal(p_world, p_uid, 'repair_item', jsonb_build_object('kind', 'item', 'uid', g.id))
              else relic_use_refusal(p_world, p_uid, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', g.id)) end is null
   order by g.dmg desc, g.id
   limit 1;
  if v_next.id is null then return null; end if;
  return jsonb_build_array(jsonb_build_object('action', p_action,
           'target', jsonb_build_object('kind', 'item', 'uid', v_next.id, 'all', v_all - 1),
           'goes', case when p_action = 'repair_item' then private.repair_goes(p_world, p_uid, v_next.dmg) else 1 end));
end $fn$;

revoke all on function private.job_follow(uuid, uuid, text, jsonb, int) from public, anon, authenticated;

select private.lock_doors();
