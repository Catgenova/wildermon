-- A bed's name inside a line: a name its owner gave as written, the game's own in lower case ("Asleep in Meri's
-- miracle sleep", "Asleep in bed"). The browser's `furnitureNameInLine`, `asleepIn` and `sleepNotYours`.

/** The name inside a line: a given name as written, the game's own in lower case (`furnitureNameInLine`). */
create or replace function placed_name_in_line(p placed) returns text language sql stable as $$
  select coalesce(nullif(p.name, ''), lower(placed_name(p)))
$$;

/** A bed neither yours nor on a settlement of yours (`sleepNotYours`), its name as `placed_name_in_line` gives it. */
create or replace function sleep_not_yours(p_name text) returns text language sql immutable as $fn$
  select 'Not yours: ' || p_name || '.'
$fn$;

/** Where a body sleeps, as the log and the boot card say it (`asleepIn`), its name as `placed_name_in_line` gives it. */
create or replace function asleep_in(p_name text) returns text language sql immutable as $fn$
  select 'Asleep in ' || p_name
$fn$;

-- The bed's name taken that way where a body lies down (`sleep_fall`) and where a bed not its own is refused
-- (`last_refusal`): each function's body as it stands, the one call changed.
do $do$
declare v_sig regprocedure; v_def text; v_new text;
begin
  foreach v_sig in array array['public.sleep_fall(uuid,uuid,placed)'::regprocedure,
                                'public.last_refusal(uuid,uuid,text,jsonb)'::regprocedure] loop
    v_def := pg_get_functiondef(v_sig);
    v_new := replace(replace(v_def, 'v_name := placed_name(pc);', 'v_name := placed_name_in_line(pc);'),
                     'sleep_not_yours(placed_name(pc))', 'sleep_not_yours(placed_name_in_line(pc))');
    if v_new = v_def and position('placed_name_in_line' in v_def) = 0 then
      raise exception 'bed names: % not as expected', v_sig;
    end if;
    execute v_new;
  end loop;
end $do$;

-- Bodies asleep now: their bed's name as the boot card will say it.
update private.asleep a set name = placed_name_in_line(pc) from placed pc where pc.id = a.bed and pc.world_id = a.world_id;

select private.lock_doors();
