/*
 * No reins from the saddle.
 *
 * Reported: "I appear double to other players, even my chat bubble is
 * doubled." catgenova was up on Thistlekit and at the reins of a wagon at once:
 * Mount refuses a body that is driving, but Take the reins never asked whether
 * the body was up on a wildermon. `drag_along` then took the wagon and its team
 * wherever the rider went, and every other screen drew them twice, in the
 * saddle and on the wagon's box, each with its name and its bubble.
 *
 * Take the reins, or the helm, refuses a mounted body now, as boarding as a
 * passenger already does.
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text := $$elsif p_action = 'board_vehicle' then$$; v_n int;
begin
  v_def := pg_get_functiondef('ride_refusal'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'ride_refusal has % of the board_vehicle branch, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || $$
    -- Up on a wildermon: in its saddle and at the reins at once is two bodies to everybody else.
    if exists (select 1 from creature m where m.world_id = p_world and m.rider = p_uid) then return 'Dismount first.'; end if;$$);
end $do$;

select private.lock_doors();
