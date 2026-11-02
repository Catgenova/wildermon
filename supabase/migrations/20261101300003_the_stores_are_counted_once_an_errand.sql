-- The stores counted once an errand, and no search for strays the round has no time to walk.
--
-- Asked for: "streamline cpu". Two more of the clock's costs on an island built like the live one
-- (supabase/test/bench-stir.ts), each the same answer for less:
--
--   * `recipe_in_stores`, which says whether a crafting worker's stores hold a go of any of its trade's recipes, read
--     every store on the settlement once for each input of each recipe (`stores_count`): a cook's twenty-one recipes
--     were up to forty reads of the same shelves. They are read once now, and every count is taken off that one read.
--     Litres are still asked as they were (`stores_litres`).
--   * `worker_sweep`, which walks home the workers of somebody awake that are off their ground, worked out the ground
--     of every worker due before it looked at the clock, and settles nothing once the round's time is spent. A round
--     whose time is already spent no longer looks; and the ground is worked out only for workers due whose keeper is
--     awake.

set local lock_timeout = '3s';

create or replace function public.recipe_in_stores(p_world uuid, p_uid uuid, p_recipes text[])
 returns table(rid text, x integer, y integer, cx double precision, cy double precision)
 language plpgsql
 stable
as $function$
declare r recipe; v_id text; v_have jsonb; v_first jsonb;
begin
  -- What the settlement's stores hold, read once: for each thing not locked away, how many (`stores_count`) and the
  -- store it is first found in (by kind, then id).
  select coalesce(jsonb_object_agg(q.def, jsonb_build_object('n', q.n, 'x', q.x, 'y', q.y, 'cx', q.cx, 'cy', q.cy)), '{}'::jsonb)
    into v_have
    from (select (s.it).def as def, coalesce(sum((s.it).count), 0) as n,
                 (array_agg(s.x order by s.kind, s.sid))[1] as x, (array_agg(s.y order by s.kind, s.sid))[1] as y,
                 (array_agg(s.cx order by s.kind, s.sid))[1] as cx, (array_agg(s.cy order by s.kind, s.sid))[1] as cy
            from deed_store_items(p_world, p_uid) s
           where not coalesce((s.it).locked, false)
           group by (s.it).def) q;
  foreach v_id in array p_recipes loop
    select * into r from recipe where id = v_id;
    if r.id is null then continue; end if;
    if exists (select 1 from recipe_input ri where ri.recipe = r.id and case when ri.litres is not null then stores_litres(p_world, p_uid, ri.item) < ri.litres
                                                                            else coalesce((v_have->ri.item->>'n')::bigint, 0) < ri.count end) then continue; end if;
    v_first := v_have->(select ri.item from recipe_input ri where ri.recipe = r.id order by ri.ord limit 1);
    if v_first is null then continue; end if;
    rid := r.id; x := (v_first->>'x')::int; y := (v_first->>'y')::int;
    cx := (v_first->>'cx')::double precision; cy := (v_first->>'cy')::double precision;
    return next;
    return;
  end loop;
end $function$;

create or replace function public.worker_sweep(p_world uuid, p_until timestamp with time zone default null::timestamp with time zone)
 returns integer
 language plpgsql
as $function$
declare r record; n int := 0;
begin
  -- The round's time spent already: the loop below would leave before its first, so nothing is looked for.
  if p_until is not null and clock_timestamp() > p_until then return 0; end if;
  for r in
    -- Due, and its keeper awake, before its ground is worked out (`work_site`), which is the dear part.
    with due as materialized (
      select c from creature c
       where c.world_id = p_world and c.mode = 'deed' and c.until <= now()
         and exists (select 1 from player p where p.world_id = p_world and p.uid = c.keeper and not p.away
                       and p.seen_at > now() - make_interval(secs => idle_logout())))
    select (d.c).id as id from due d
     cross join lateral work_site(p_world, d.c) s
     where s.x is not null
       and greatest(abs(s.x + 0.5 - (d.c).to_x), abs(s.y + 0.5 - (d.c).to_y)) > s.radius + home_slack()
     order by (d.c).until limit worker_sweep_most()
  loop
    exit when p_until is not null and clock_timestamp() > p_until;
    begin
      if creature_settle(p_world, r.id) then n := n + 1; end if;
    exception when lock_not_available then null; -- put all in: held; the next round's
    end;
  end loop;
  return n;
end $function$;

select private.lock_doors();
