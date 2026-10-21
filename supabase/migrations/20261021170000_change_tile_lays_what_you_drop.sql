-- Change tile: Drop dirt and Drop (raise ground) renamed, and both lay what was dropped.
--
-- Reported: "drop dirt" left dirt whatever was dropped. A corner's spadeful set its tile only on `buryable`
-- ground, which had no dirt in it, so clay or sand on dirt stayed dirt; and the spadeful at your feet took
-- dirt alone and always laid dirt. The defs that follow add dirt to `buryable`; this has the spadeful at your
-- feet take dirt, clay or sand (the one named, or the first carried) and lay its own tile (`spoil_tile`).

set local lock_timeout = '3s';

-- The first carried in the browser's order (`SPOIL_ORDER`), rather than the oldest stack.
create or replace function spoil_in_hand(p_world uuid, p_uid uuid, p_item bigint) returns text
language sql stable as $fn$
  select i.def from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked
     and i.def in ('dirt', 'clay', 'sand') and (p_item is null or i.id = p_item)
   order by array_position(array['dirt', 'clay', 'sand'], i.def), i.id limit 1
$fn$;

do $do$
declare v_def text; v_old text; v_new text;
begin
  v_def := pg_get_functiondef('perform_terrain'::regproc);
  v_old := $q$        v_n int; v_step int; v_level int;
begin$q$;
  v_new := $q$        v_n int; v_step int; v_level int;
        v_spoil text;
begin$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_terrain: declare anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$    if not consume(p_world, p_uid, 'dirt', 1) then return; end if;$q$;
  v_new := $q$    v_spoil := spoil_in_hand(p_world, p_uid, target_item(p_target));
    if v_spoil is null or not consume(p_world, p_uid, v_spoil, 1) then return; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_terrain: consume anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$      perform land_set_tile(p_world, tx, ty, 1);$q$;
  v_new := $q$      perform land_set_tile(p_world, tx, ty, spoil_tile(v_spoil));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_terrain: tile anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$    perform tell(p_world, p_uid, 'Dropped: dirt at your feet, corner raised.', 'event');$q$;
  v_new := $q$    perform tell(p_world, p_uid, 'Dropped: ' || lower((select name from item_def where id = v_spoil))
      || ' at your feet, corner raised.', 'event');$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_terrain: tell anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;

  v_def := pg_get_functiondef('terrain_refusal'::regproc);
  v_old := $q$    if pack_count(p_world, p_uid, 'dirt') < 1 then return 'You have no dirt to drop.'; end if;$q$;
  v_new := $q$    if spoil_in_hand(p_world, p_uid, target_item(p_target)) is null then return 'Need dirt, clay or sand.'; end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'terrain_refusal: dirt anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $do$;

select private.lock_doors();
