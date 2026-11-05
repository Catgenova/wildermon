-- Making rope and distilling are no worker's trade any more.
--
-- Asked for: "Remove making rope and distilling as wildermon abilities". The cordra and the brittla that worked them are
-- gone (`20261105170000_forga_cordra_brittla_are_gone.sql`); the trades go with them, out of every list a worker's
-- trade is looked up in and out of the errands that worked them. A player lays up rope and distils by hand as before
-- (`make_rope`, a Cook's Distil). The browser's `GatherKind` no longer has them.

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

-- The errands: rope no longer among the trades worked at the stores, and the distilling branch gone.
select pg_temp.patch_fn('public.errand_step(uuid,int,text)'::regprocedure, $o$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese') then$o$, $n$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'fletch', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese') then$n$);
select pg_temp.patch_fn('public.errand_step(uuid,int,text)'::regprocedure, $o$  elsif kind = 'distil' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('distil'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := cook_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

$o$, $n$$n$);
select pg_temp.patch_fn('public.errand_do(uuid,int,boolean,text)'::regprocedure, $o$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese') then$o$, $n$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'fletch', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese') then$n$);
select pg_temp.patch_fn('public.errand_do(uuid,int,boolean,text)'::regprocedure, $o$  elsif kind = 'distil' then
    -- At a lit campfire or oven of yours, the first brew the stores hold three buckets of, distilled into a bucket of
    -- spirit, as a Cook's Distil does it, and the spirit and the empty buckets put in the stores. No Distil learned.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      if not exists (select 1 from placed p where p.world_id = p_world and (p.kind = 'campfire' or is_oven(p)) and placed_lit(p)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('distil'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop; end if;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform private.worker_put_back(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
      return true;
    end;

$o$, $n$$n$);

-- The lists a trade is looked up in.
select pg_temp.patch_fn('public.hands_trade(text)'::regprocedure,
  $o$'brick', 'rope', 'fletch', 'cook',$o$, $n$'brick', 'fletch', 'cook',$n$);
select pg_temp.patch_fn('public.hands_trade(text)'::regprocedure,
  $o$'churn', 'alloy', 'distil')$o$, $n$'churn', 'alloy')$n$);
select pg_temp.patch_fn('public.store_recipe_trade(text)'::regprocedure,
  $o$'brick', 'rope', 'fletch', 'concrete',$o$, $n$'brick', 'fletch', 'concrete',$n$);
select pg_temp.patch_fn('public.tend_job(text)'::regprocedure,
  $o$'brick', 'rope', 'fletch', 'paper', 'fill',$o$, $n$'brick', 'fletch', 'paper', 'fill',$n$);
select pg_temp.patch_fn('public.tend_job(text)'::regprocedure,
  $o$'churn', 'alloy', 'distil')$o$, $n$'churn', 'alloy')$n$);
select pg_temp.patch_fn('public.worker_job_ported(text)'::regprocedure,
  $o$'brick', 'rope', 'fletch', 'paper', 'fill',$o$, $n$'brick', 'fletch', 'paper', 'fill',$n$);
select pg_temp.patch_fn('public.worker_job_ported(text)'::regprocedure,
  $o$'churn', 'alloy', 'distil')$o$, $n$'churn', 'alloy')$n$);
select pg_temp.patch_fn('public.tend_recipes(text)'::regprocedure,
  $o$    when 'rope' then array['make_rope']
$o$, $n$$n$);
select pg_temp.patch_fn('public.tend_recipes(text)'::regprocedure,
  $o$    when 'distil' then array['distil_ale', 'distil_cider', 'distil_mead', 'distil_wine', 'distil_grape_wine']
$o$, $n$$n$);

-- A worker still set to either is set to its kind's own trade (none can be: the kinds that had them are gone).
update creature set job = null where job in ('rope', 'distil');
