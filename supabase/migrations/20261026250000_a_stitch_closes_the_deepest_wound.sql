/*
 * Quick Stitch closes the deepest wound, and says by how much.
 *
 * Reported: "quick stitch isn't working at all to lower wound severity". It
 * closed the wound `worst_wound` picks, and that one is scored as its depth
 * plus 0.5 for bleeding and 1 for gone bad -- the order a dressing wants, the
 * one to see to first. A dressing stops a wound bleeding, so once the deep
 * one is dressed, any light cut still bleeding outranks it: measured on the
 * island, a 40% bruise (it never bleeds) and a 3% cut, and the stitch took
 * the cut to 2.1% and left the bruise at 40%. The line said "worst wound
 * closed 30%" and named nothing, so it looked like nothing.
 *
 * It closes the deepest wound now (`class_stitch`): the most depth, gone bad
 * or not, by its share of that depth; and the line names the wound and its
 * depth before and after, rounded as the wound window shows it. Mass Dressing
 * still takes the worst wound, since stopping the bleeding is half of it.
 */
set local lock_timeout = '3s';

/**
 * The deepest wound on somebody closed by a share of its depth; gone once nothing is left of it (as a dressing leaves
 * one) unless it has gone bad. What it did, as the line says it ("burn (arm) depth 50% → 35%"), or null with no wound.
 */
create or replace function class_stitch(p_world uuid, p_uid uuid, p_share double precision)
  returns text language plpgsql as $fn$
declare v_wounds jsonb; w jsonb; v_i int; v_from double precision; v_to double precision; v_keep boolean;
begin
  select coalesce(wounds, '[]'::jsonb) into v_wounds from player where world_id = p_world and uid = p_uid for update;
  select e.i - 1, e.w into v_i, w from jsonb_array_elements(coalesce(v_wounds, '[]'::jsonb)) with ordinality e(w, i)
   order by (e.w->>'severity')::double precision desc, e.i
   limit 1;
  if v_i is null then return null; end if;
  v_from := (w->>'severity')::double precision;
  v_to := v_from * (1 - p_share);
  v_keep := v_to > 0.004 or coalesce((w->>'infected')::boolean, false);
  update player set wounds = case when v_keep then jsonb_set(v_wounds, array[v_i::text, 'severity'], to_jsonb(v_to))
                                  else v_wounds - v_i end
   where world_id = p_world and uid = p_uid;
  return coalesce((select k.name from wound_kind_def k where k.id = w->>'kind'), w->>'kind')
    || ' (' || part_name(w->>'part') || ') depth ' || faith_pct(v_from) || ' → '
    || case when v_keep then faith_pct(v_to) else 'closed' end;
end $fn$;

do $do$
declare v_def text; v_n int;
  v_old text := $$    if class_wounds_close(p_world, v_uid, spell_fx(p_spell, 'close'), false, false) = 0 then
      return jsonb_build_object('why', case when v_uid = p_uid then 'You have' else v_who || ' has' end || ' no wound.');
    end if;
    perform class_learn_heal(p_world, p_uid, v_uid);
    v_said := s.name || ' on ' || v_who || ': worst wound closed ' || faith_pct(spell_fx(p_spell, 'close')) || '.';$$;
  v_new text := $$    v_said := class_stitch(p_world, v_uid, spell_fx(p_spell, 'close'));
    if v_said is null then
      return jsonb_build_object('why', case when v_uid = p_uid then 'You have' else v_who || ' has' end || ' no wound.');
    end if;
    perform class_learn_heal(p_world, p_uid, v_uid);
    v_said := s.name || ' on ' || v_who || ': ' || v_said || '.';$$;
begin
  v_def := pg_get_functiondef('public.class_spell_cast'::regproc);
  if position(v_new in v_def) > 0 then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'class_spell_cast has % of Quick Stitch''s close, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
