/*
 * Wheels a bridge does not carry, standing on its end or its deck.
 *
 * A walk that starts on a bridge's end or deck went through unasked
 * (`walk_share`), so a wagon on a one-lane bridge's end drove across it. Now
 * wheels that deck does not carry (`deck_wheels`) are asked about every step
 * as from the bank, and stop where they would roll onto the deck, where the
 * browser's `driveRule` stops them.
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('walk_share'::regproc);
  v_old := $$  if spans and deck_at(p_world, fx, fy) is not null then return 1; end if;$$;
  v_new := $$  if spans and deck_at(p_world, fx, fy) is not null then
    -- Unless it is wheels that deck does not carry: those are asked about every step, as from the bank (`deck_wheels`).
    cart := driving(p_world, p_uid);
    if cart.id is null or coalesce(is_boat(cart), false) or deck_wheels(p_world, deck_at(p_world, fx, fy), cart.sub) then return 1; end if;
  end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'walk_share has % of the walk from a deck, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
