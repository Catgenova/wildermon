-- Improve all: a run of improve-and-repair cycles on each held piece Improve takes, one piece after another, as
-- Repair all and Hone all go. The browser asks the first piece's run with `all` (pieces at most) and `cycles`
-- (Improve passes a piece) on its target; when a piece's run ends, `job_follow` puts the next piece's in front of
-- the line: the next held piece by item id that Improve takes now, or that a Repair to 0 first would let it take
-- (that Repair carrying the run, `cycles`, as a cycle run over 10 damage always has). A piece refused after its
-- Repair is passed over for the next.

set local lock_timeout = '3s';

-- The next piece's run of an Improve all, after the piece `p_from`: '[]' when there is none.
create or replace function private.improve_all_next(p_world uuid, p_uid uuid, p_from bigint, p_all int, p_each int, p_upto jsonb)
 returns jsonb
 language plpgsql
 stable
as $function$
declare v_next item; v_t jsonb;
begin
  if p_all <= 1 or p_each is null then return '[]'::jsonb; end if;
  select g.* into v_next from private.held_gear(p_world, p_uid) g
   where g.id > coalesce(p_from, 0)
     and (item_refusal(p_world, p_uid, 'improve_item',
            jsonb_build_object('kind', 'item', 'uid', g.id) || jsonb_strip_nulls(jsonb_build_object('upto', p_upto))) is null
          or (g.dmg > 10
              and item_refusal(p_world, p_uid, 'improve_item', jsonb_build_object('kind', 'item', 'uid', g.id)) = 'Damage over 10: repair it first.'
              and item_refusal(p_world, p_uid, 'repair_item', jsonb_build_object('kind', 'item', 'uid', g.id)) is null))
   order by g.id
   limit 1;
  if v_next.id is null then return '[]'::jsonb; end if;
  v_t := jsonb_build_object('kind', 'item', 'uid', v_next.id, 'mend', true, 'all', p_all - 1, 'cycles', p_each)
         || jsonb_strip_nulls(jsonb_build_object('upto', p_upto));
  -- Over 10 damage: its Repair to 0 first, carrying its run.
  if v_next.dmg > 10 then
    return jsonb_build_array(jsonb_build_object('action', 'repair_item', 'target', v_t,
             'goes', private.repair_goes(p_world, p_uid, v_next.dmg)));
  end if;
  return jsonb_build_array(jsonb_build_object('action', 'improve_item', 'target', v_t, 'goes', p_each));
end $function$;

create or replace function private.job_follow(p_world uuid, p_uid uuid, p_action text, p_target jsonb, p_left int)
 returns jsonb
 language plpgsql
 stable
as $function$
declare v_it item; v_next item; v_all int; v_each int; v_t jsonb; v_from bigint;
begin
  if p_action not in ('improve_item', 'repair_item', 'hone_whetstone') or jsonb_typeof(p_target) is distinct from 'object' then
    return null;
  end if;
  v_all := case when jsonb_typeof(p_target->'all') = 'number' then (p_target->>'all')::int else 0 end;
  v_each := case when jsonb_typeof(p_target->'cycles') = 'number' then least(100, greatest(1, (p_target->>'cycles')::int)) end;
  if (p_action = 'repair_item' and v_each is not null) or p_action = 'improve_item' then
    if p_action = 'repair_item' then
      -- A Repair to 0 that carries a run: the run, on the same piece.
      v_it := carried(p_world, p_uid, target_item(p_target));
      if v_it.id is not null then
        v_t := jsonb_build_object('kind', 'item', 'uid', v_it.id, 'mend', true)
               || jsonb_strip_nulls(jsonb_build_object('stock', p_target->'stock', 'stockOf', p_target->'stockOf',
                                                       'upto', p_target->'upto', 'all', p_target->'all',
                                                       'cycles', case when v_all > 1 then to_jsonb(v_each) end));
        if v_all <= 1 or item_refusal(p_world, p_uid, 'improve_item', v_t) is null then
          return jsonb_build_array(jsonb_build_object('action', 'improve_item', 'target', v_t, 'goes', v_each));
        end if;
      end if;
    else
      if not coalesce((p_target->>'mend')::boolean, false) then return null; end if;
      -- A run over 10 damage: Repair to 0, then the rest of the run.
      v_it := carried(p_world, p_uid, target_item(p_target));
      if v_it.id is not null and v_it.dmg > 10 and item_refusal(p_world, p_uid, 'repair_item', p_target) is null then
        return jsonb_build_array(jsonb_build_object('action', 'repair_item',
                 'target', jsonb_build_object('kind', 'item', 'uid', v_it.id),
                 'goes', private.repair_goes(p_world, p_uid, v_it.dmg)))
            || case when p_left > 0
                    then jsonb_build_array(jsonb_build_object('action', 'improve_item', 'target', p_target, 'goes', p_left))
                    -- The run over, in an Improve all: the next piece's after the Repair.
                    else private.improve_all_next(p_world, p_uid, v_it.id, v_all, v_each, p_target->'upto') end;
      end if;
    end if;
    -- Improve all: the next piece's run, once this one's is over.
    v_from := coalesce(v_it.id, case when jsonb_typeof(p_target->'uid') = 'number' then (p_target->>'uid')::bigint end);
    return nullif(private.improve_all_next(p_world, p_uid, v_from, v_all, v_each, p_target->'upto'), '[]'::jsonb);
  end if;
  -- Repair all and Hone all: the most damaged held piece next.
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
end $function$;

select private.lock_doors();
