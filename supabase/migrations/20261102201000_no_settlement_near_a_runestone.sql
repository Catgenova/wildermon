-- Asked: "Don't allow new settlements within 100 tiles of a runestone". A token goes in only `deed_stone_gap()` tiles
-- or more from every runestone, measured as `runestone_within` measures: from the stone's nearest tile. The nearest
-- stone closer than that refuses it, in the browser's words (`DEED_STONE_GAP`, `deedNearStone`, `game.ts`).
create or replace function public.deed_stone_gap() returns integer language sql immutable as $$ select 100 $$;

do $patch$
declare v_def text; v_old text; v_new text;
        v_decl text := 'v_apart int := deed_spacing();';
begin
  v_def := pg_get_functiondef('public.deed_refusal(uuid, uuid, text, jsonb)'::regprocedure);
  v_old := E'\n  return null;\nend';
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'deed_refusal: the end it is patched at is not there exactly once';
  end if;
  if (length(v_def) - length(replace(v_def, v_decl, ''))) / length(v_decl) <> 1 then
    raise exception 'deed_refusal: its declarations are not there exactly once';
  end if;
  v_new := replace(v_def, v_old, $new$
  -- And no nearer a runestone than deed_stone_gap(): the nearest one, by its gap from the stone's nearest tile.
  select c.name, sqrt(power(greatest(0, abs(tx - c.x) - stone_half()), 2) + power(greatest(0, abs(ty - c.y) - stone_half()), 2)) as gap
    into v_stone
    from runestone_centres((select w.size from world w where w.id = p_world)) c
   order by 2 limit 1;
  if v_stone.gap is not null and v_stone.gap < deed_stone_gap() then
    return 'Too close to ' || v_stone.name || ': ' || floor(v_stone.gap)::int || ' tiles; ' || deed_stone_gap() || ' needed.';
  end if;
  return null;
end$new$);
  v_new := replace(v_new, v_decl, v_decl || ' v_stone record;');
  execute v_new;
end
$patch$;

select private.lock_doors();
