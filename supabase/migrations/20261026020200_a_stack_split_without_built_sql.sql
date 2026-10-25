-- A stack split without SQL built at run time.
--
-- `barter_split` (part of a stack handed over in a trade) and `rpc_work_deliver` (part of a stack put in a
-- settlement's crate) copied the row by listing `item`'s columns out of `pg_attribute` and running the
-- insert they spelled. Nothing a player says reached that text, but it was the only SQL on the island put
-- together while it ran, and the reason for it -- every column copied, those added later too -- is had
-- as well by copying the row itself: read into a variable of the table's own type, the few fields that
-- change set on it, and inserted whole. Static SQL, planned once, and the same row as before.
--
-- And a check that keeps it so (`supabase/test/builtsql.ts`): no function in `public` runs EXECUTE on
-- anything but a literal, or `format()` of a literal with `%I` and `%L` only.

set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_new text; i int;
  v_swap text[][] := array[
    [E'declare v_cols text; v_new bigint;\n', E'declare v_part item; v_new bigint;\n'],
    [E'  select string_agg(quote_ident(a.attname), \', \' order by a.attnum) into v_cols\n'
     || E'    from pg_attribute a\n'
     || E'   where a.attrelid = \'public.item\'::regclass and a.attnum > 0 and not a.attisdropped\n'
     || E'     and a.attidentity = \'\' and a.attgenerated = \'\'\n'
     || E'     and a.attname not in (\'id\', \'count\', \'holder\', \'holder_uid\');\n'
     || E'  execute format(\'insert into item (holder, holder_uid, count, %s) select \'\'player\'\', $1, $2, %s from item where id = $3 returning id\',\n'
     || E'                 v_cols, v_cols)\n'
     || E'    into v_new using p_to, p_count, p_id;\n',
     E'  -- The whole row, so a column added later comes too, with how many and whose set on it.\n'
     || E'  select * into v_part from item where id = p_id;\n'
     || E'  if found then\n'
     || E'    v_part.id := nextval(pg_get_serial_sequence(\'public.item\', \'id\'));\n'
     || E'    v_part.holder := \'player\'; v_part.holder_uid := p_to; v_part.count := p_count;\n'
     || E'    insert into item overriding system value values (v_part.*) returning id into v_new;\n'
     || E'  end if;\n']];
begin
  v_def := pg_get_functiondef('public.barter_split(bigint, integer, uuid)'::regprocedure);
  if position('v_part item;' in v_def) > 0 then return; end if;
  for i in 1 .. array_length(v_swap, 1) loop
    v_old := v_swap[i][1];
    v_new := v_swap[i][2];
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'barter_split: anchor % not once', i;
    end if;
    v_def := replace(v_def, v_old, v_new);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_old text; v_new text; i int;
  v_swap text[][] := array[
    [E'        v_what text; v_cols text; v_by text; v_done boolean := false;\n',
     E'        v_what text; v_part item; v_by text; v_done boolean := false;\n'],
    [E'      select string_agg(quote_ident(a.attname), \', \' order by a.attnum) into v_cols\n'
     || E'        from pg_attribute a\n'
     || E'       where a.attrelid = \'public.item\'::regclass and a.attnum > 0 and not a.attisdropped\n'
     || E'         and a.attidentity = \'\' and a.attgenerated = \'\'\n'
     || E'         and a.attname not in (\'id\', \'count\', \'holder\', \'holder_uid\', \'crate\', \'gx\', \'gy\', \'inside\', \'placed\',\n'
     || E'                               \'price\', \'locked\', \'deal\');\n'
     || E'      execute format(\'insert into item (holder, crate, gx, gy, count, %s) select \'\'crate\'\', $1, $2, $3, $4, %s from item where id = $5\',\n'
     || E'                     v_cols, v_cols)\n'
     || E'        using cr.id, cr.x, cr.y, v_take, it.id;\n',
     E'      -- The whole row, so a column added later comes too; where it is set on it, and the rest as a new row has it.\n'
     || E'      select * into v_part from item where id = it.id;\n'
     || E'      v_part.id := nextval(pg_get_serial_sequence(\'public.item\', \'id\'));\n'
     || E'      v_part.holder := \'crate\'; v_part.holder_uid := null; v_part.crate := cr.id;\n'
     || E'      v_part.gx := cr.x; v_part.gy := cr.y; v_part.count := v_take;\n'
     || E'      v_part.inside := null; v_part.placed := null; v_part.price := null; v_part.locked := false; v_part.deal := null;\n'
     || E'      insert into item overriding system value values (v_part.*);\n']];
begin
  v_def := pg_get_functiondef('public.rpc_work_deliver(uuid, uuid, bigint)'::regprocedure);
  if position('v_part item;' in v_def) > 0 then return; end if;
  for i in 1 .. array_length(v_swap, 1) loop
    v_old := v_swap[i][1];
    v_new := v_swap[i][2];
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'rpc_work_deliver: anchor % not once', i;
    end if;
    v_def := replace(v_def, v_old, v_new);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
