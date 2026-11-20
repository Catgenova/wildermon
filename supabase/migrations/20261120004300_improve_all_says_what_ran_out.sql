-- Improve all stopped by a material run out: said, which (`private.improve_all_next`).
--
-- Asked for: Improve all stops when the material runs out, with a note saying which. A piece whose stock is out was
-- passed over and the run ended with nothing said; now, the run over with pieces left that their stock refuses, the
-- island says what ran out and of how many pieces: "Improve all: stopped. Need iron to work into it (2 items)." Volatile now that it tells (and so its caller).

set local lock_timeout = '3s';

create or replace function private.improve_all_next(p_world uuid, p_uid uuid, p_from bigint, p_all integer, p_each integer, p_upto jsonb)
 returns jsonb
 language plpgsql
 volatile
as $function$
declare v_next item; v_t jsonb; v_out text;
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
  if v_next.id is null then
    -- The pieces left that their stock refuses, by what ran out.
    select string_agg(r || ' (' || n || case when n = 1 then ' item)' else ' items)' end, ' · ' order by r) into v_out
      from (select rtrim(x.r, '.') as r, count(*) as n
              from private.held_gear(p_world, p_uid) g,
                   lateral (select item_refusal(p_world, p_uid, 'improve_item',
                              jsonb_build_object('kind', 'item', 'uid', g.id) || jsonb_strip_nulls(jsonb_build_object('upto', p_upto))) as r) x
             where g.id > coalesce(p_from, 0) and (x.r like 'Out of %' or x.r like 'Need % to work into it.')
             group by 1) o;
    if v_out is not null then perform tell(p_world, p_uid, 'Improve all: stopped. ' || v_out || '.', 'event'); end if;
    return '[]'::jsonb;
  end if;
  v_t := jsonb_build_object('kind', 'item', 'uid', v_next.id, 'mend', true, 'all', p_all - 1, 'cycles', p_each)
         || jsonb_strip_nulls(jsonb_build_object('upto', p_upto));
  -- Over 10 damage: its Repair to 0 first, carrying its run.
  if v_next.dmg > 10 then
    return jsonb_build_array(jsonb_build_object('action', 'repair_item', 'target', v_t,
             'goes', private.repair_goes(p_world, p_uid, v_next.dmg)));
  end if;
  return jsonb_build_array(jsonb_build_object('action', 'improve_item', 'target', v_t, 'goes', p_each));
end $function$;

alter function private.job_follow(uuid, uuid, text, jsonb, integer) volatile;

select private.lock_doors();
