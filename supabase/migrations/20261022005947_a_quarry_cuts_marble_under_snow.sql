-- A quarry cuts marble under snow, and brings up the stone it cuts.
--
-- Reported: a Chiptail would not cut marble that shows as Snow. A quarry took only a Rock tile, and a mountain top's
-- marble is rock under snow (`STONE_FACES`, the browser's). And what it brought up was rock shards whatever the stone,
-- where the browser's brings up the stone's own (`finishQuarry`): marble shards off marble.

set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_new text;
begin
  v_def := pg_get_functiondef('worker_gatherable'::regproc);
  v_old := $q$    return here = tile_id('Rock') and not rock.seam and rock_height(p_world, p_x, p_y) > -mine_depth()$q$;
  v_new := $q$    return here in (tile_id('Rock'), tile_id('Snow')) and not rock.seam and rock_height(p_world, p_x, p_y) > -mine_depth()$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'worker_gatherable: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('worker_do'::regproc);
  v_old := $q$    got := case when kind = 'mine' and rock.seam then rock.yields else 'rock_shards' end;$q$;
  v_new := $q$    got := case when kind = 'mine' and rock.seam then rock.yields
                when kind = 'quarry' and not rock.seam then coalesce(rock.yields, 'rock_shards') else 'rock_shards' end;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'worker_do: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
