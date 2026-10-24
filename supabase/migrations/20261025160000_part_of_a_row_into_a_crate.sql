/*
 * Part of a row into a crate.
 *
 * Reported: one needle of several put in a crate, and the whole row went. A
 * thing that does not stack can still be a row of more than one -- needles are
 * carved two at a time -- and `crate_put` moved such a row whole, whatever
 * count was asked, or refused it whole when the crate had room for only some.
 *
 * Now it moves the count asked for, as far as there is room, as a stackable
 * thing always went (`cratePut`): the part goes in as a row of its own, with
 * everything the row carries, and the rest stays in the pack.
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('crate_put'::regproc);

  v_old := $$declare v_c crate; v_it item; v_kept deed; v_want int;$$;
  v_new := $$declare v_c crate; v_it item; v_kept deed; v_want int; v_part item;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'crate_put has % of its declarations, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $$    if crate_units(p_world, v_c.id) + v_it.count > crate_capacity(v_c) then
      why := 'The ' || lower(crate_name(v_c)) || ' is full.';
      return;
    end if;
    update item set holder = 'crate', holder_uid = null, crate = v_c.id, gx = v_c.x, gy = v_c.y, inside = null, placed = null
      where id = v_it.id;
    put := v_it.count;$$;
  v_new := $$    -- The count asked for, as far as there is room (`cratePut`).
    put := least(v_want, crate_spare(p_world, v_c));
    if put <= 0 then
      put := 0;
      why := 'The ' || lower(crate_name(v_c)) || ' is full.';
      return;
    end if;
    if put < v_it.count then
      -- Part of the row: a row of its own in the crate, carrying all the row carries.
      v_part := v_it;
      v_part.id := nextval(pg_get_serial_sequence('item', 'id'));
      v_part.count := put;
      v_part.holder := 'crate'; v_part.holder_uid := null; v_part.crate := v_c.id;
      v_part.gx := v_c.x; v_part.gy := v_c.y; v_part.inside := null; v_part.placed := null;
      insert into item overriding system value select (v_part).*;
      update item set count = count - put where id = v_it.id;
    else
      update item set holder = 'crate', holder_uid = null, crate = v_c.id, gx = v_c.x, gy = v_c.y, inside = null, placed = null
        where id = v_it.id;
    end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'crate_put has % of the whole-row move, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
