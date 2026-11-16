/*
 * Change wall: the storey named.
 *
 * Reported again after the change was shown as it landed: "change wall seems to
 * do nothing". The tile's menu offered Change wall on the wall of the storey
 * being worked on only, and named no storey: once a building has a second
 * storey that is the top one, so a player changing the ground floor's wall --
 * a door under a storey, which is what Change wall is for -- changed the wall
 * above it, and the wall they were looking at stayed as it was. The browser
 * now offers every storey's wall on the side, each named by its storey
 * (`src/ui/ui.ts`, `changeWallRows`); here the lines say which storey a change
 * was planned on or dropped from, in a building of more than one:
 *
 *   * `change_side`: "north side", or "north side, storey 2";
 *   * `change_line` with a storey, beside the three-argument one an older page
 *     still matches;
 *   * `perform_change_wall` says both lines with the wall's storey.
 */
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

-- A side as a change names it, and its storey numbered from 1 when there is one to name (`changeSide`).
create or replace function change_side(p_side text, p_storey int) returns text
language sql stable as $$
  select side_name(p_side) || ' side' || coalesce(', storey ' || p_storey, '')
$$;

-- "Change planned: door, marble, west side, storey 2." (`changeLine`).
create or replace function change_line(p_type text, p_material text, p_side text, p_storey int) returns text
language sql stable as $$
  select 'Change planned: ' || wall_words(p_type, p_material) || ', ' || change_side(p_side, p_storey) || '.'
$$;

select pg_temp.patch_fn('perform_change_wall(uuid, uuid, jsonb, building)',
  $o$    perform tell(p_world, p_uid, 'Change dropped: ' || side_name(v_side) || ' side.', 'event');$o$,
  $n$    -- Its storey named in a building of more than one (`changeDropped`).
    perform tell(p_world, p_uid, 'Change dropped: ' || change_side(v_side, case when p_b.levels > 1 then w.level + 1 end) || '.', 'event');$n$);

select pg_temp.patch_fn('perform_change_wall(uuid, uuid, jsonb, building)',
  $o$change_line(wt.id, mat.id, v_side) || ' Needs '$o$,
  $n$change_line(wt.id, mat.id, v_side, case when p_b.levels > 1 then w.level + 1 end) || ' Needs '$n$);

select private.lock_doors();
