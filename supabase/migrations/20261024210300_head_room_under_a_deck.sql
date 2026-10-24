/*
 * Furniture under a bridge's deck wants head room, not the gap a span is
 * planned over: the deck `head_room` or more over the ground there
 * (`HEAD_ROOM`, `deckFurnitureRefusal`).
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('bridge_furniture_refusal'::regproc);
  v_old := $$  if bridge_deck_over(b, p_x, p_y) - surface_height(p_world, p_x, p_y) >= clearance() then return null; end if;
  return 'Under a bridge deck: needs ' || metres(clearance()) || ' m clearance.';$$;
  v_new := $$  if bridge_deck_over(b, p_x, p_y) - surface_height(p_world, p_x, p_y) >= head_room() then return null; end if;
  return 'Under a bridge deck: needs ' || metres(head_room()) || ' m clearance.';$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'bridge_furniture_refusal has % of the clearance under the deck, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
