/*
 * A spot picked over says when it is ready again.
 *
 * Every refusal for ground worked too lately said "Try later." and nothing
 * else: forage, botanize, cut grass, cut moss, cut reeds, pick fruit, cut a
 * bush, pick a sprout and investigate. Each now ends with the wait to the
 * second, "Ready in 2 min 10 s.", off the row in `foraged` that refused it
 * (`foraged_left`), said as the browser says it (`readyIn`, `waitWords`):
 *
 *   * `forage_wait(kind)`: the seconds a spot stays picked over for a kind,
 *     `sprout_cooldown` for a sprout and `forage_cooldown` for the rest, as
 *     `is_foraged` has them;
 *   * `foraged_left`: what is left of that wait, nought when it is over;
 *   * `wait_words` and `ready_in`: the wait in words.
 *
 * The browser reads `foraged` for the spots near it (select, own island) and
 * says the same wait before it asks.
 */
set local lock_timeout = '3s';

create or replace function forage_wait(p_kind text) returns double precision
language sql immutable as $$
  select case when p_kind = 'sprout' then sprout_cooldown() else forage_cooldown() end
$$;

create or replace function is_foraged(p_world uuid, p_x int, p_y int, p_kind text)
  returns boolean language sql stable as $$
  select exists (select 1 from foraged
    where world_id = p_world and x = p_x and y = p_y and kind = p_kind
      and now() - at < make_interval(secs => forage_wait(p_kind)))
$$;

/* Seconds until a spot can be worked again for a kind, nought when it can (`Game.foragedLeft`). */
create or replace function foraged_left(p_world uuid, p_x int, p_y int, p_kind text)
  returns double precision language sql stable as $$
  select coalesce(max(greatest(0, forage_wait(p_kind) - extract(epoch from now() - at)::double precision)), 0)
    from foraged where world_id = p_world and x = p_x and y = p_y and kind = p_kind
$$;

/* A short wait to the second: "40 s", "2 min 10 s", "1 h 5 min", rounded up (`waitWords`). */
create or replace function wait_words(p_secs double precision) returns text
language sql immutable as $$
  select case
    when s < 60 then s || ' s'
    when s < 3600 then (s / 60) || ' min' || case when s % 60 > 0 then ' ' || (s % 60) || ' s' else '' end
    else (s / 3600) || ' h' || case when (s % 3600) / 60 > 0 then ' ' || ((s % 3600) / 60) || ' min' else '' end
  end
  from (select greatest(1, ceil(coalesce(p_secs, 0) - 1e-6))::bigint as s) q
$$;

/* "Ready in 2 min 10 s.": the end of a refusal for a spot worked too lately (`readyIn`). */
create or replace function ready_in(p_world uuid, p_x int, p_y int, p_kind text) returns text
language sql stable as $$
  select 'Ready in ' || wait_words(foraged_left(p_world, p_x, p_y, p_kind)) || '.'
$$;

do $do$
declare v_def text; v_n int; r record;
begin
  for r in
    select * from (values
      ('gather_refusal', $a$if is_foraged(p_world, tx, ty, 'forage') then return 'Already searched. Try later.'; end if;$a$,
                         $a$if is_foraged(p_world, tx, ty, 'forage') then return 'Already searched. ' || ready_in(p_world, tx, ty, 'forage'); end if;$a$),
      ('gather_refusal', $a$if is_foraged(p_world, tx, ty, 'botanize') then return 'Already searched. Try later.'; end if;$a$,
                         $a$if is_foraged(p_world, tx, ty, 'botanize') then return 'Already searched. ' || ready_in(p_world, tx, ty, 'botanize'); end if;$a$),
      ('ground_refusal', $a$if is_foraged(p_world, tx, ty, 'grass') then return 'Grass too short. Try later.'; end if;$a$,
                         $a$if is_foraged(p_world, tx, ty, 'grass') then return 'Grass too short. ' || ready_in(p_world, tx, ty, 'grass'); end if;$a$),
      ('ground_refusal', $a$if is_foraged(p_world, tx, ty, 'moss') then return 'Moss too short. Try later.'; end if;$a$,
                         $a$if is_foraged(p_world, tx, ty, 'moss') then return 'Moss too short. ' || ready_in(p_world, tx, ty, 'moss'); end if;$a$),
      ('ground_refusal', $a$if is_foraged(p_world, tx, ty, 'reed') then return 'Reeds already cut. Try later.'; end if;$a$,
                         $a$if is_foraged(p_world, tx, ty, 'reed') then return 'Reeds already cut. ' || ready_in(p_world, tx, ty, 'reed'); end if;$a$),
      ('ground_refusal', $a$if is_foraged(p_world, tx, ty, 'sprout') then return 'Sprout already picked. Try later.'; end if;$a$,
                         $a$if is_foraged(p_world, tx, ty, 'sprout') then return 'Sprout already picked. ' || ready_in(p_world, tx, ty, 'sprout'); end if;$a$),
      ('ground_refusal', $a$return v_tree.name || ': already picked. Try later.';$a$,
                         $a$return v_tree.name || ': already picked. ' || ready_in(p_world, tx, ty, 'forage');$a$),
      ('ground_refusal', $a$return (select name from bush_def where id = bush_species(v_data)) || ': already picked. Try later.';$a$,
                         $a$return (select name from bush_def where id = bush_species(v_data)) || ': already picked. ' || ready_in(p_world, tx, ty, 'forage');$a$),
      ('dig_refusal',    $a$return 'Already searched this tile.';$a$,
                         $a$return 'Already searched this tile. ' || ready_in(p_world, tx, ty, 'dig');$a$)
    ) as t(fn, old, new)
  loop
    v_def := pg_get_functiondef(r.fn::regproc);
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of %, not 1', r.fn, v_n, r.old; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
