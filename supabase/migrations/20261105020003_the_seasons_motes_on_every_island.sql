-- The season's motes on every island.
--
-- Asked for: "make ice motes spawn globally in winter, and life motes in spring, fire in summer, wind in autumn". A
-- swirl on land was dark, light or its island's element (`ISLAND_ELEMENT`), so ice was the Northeast Tundra's alone.
-- Now, of the swirls on land, `swirl_season()` are the season's element (`season_element`, `SEASON_ELEMENT` in the
-- browser) on every island: after dark and light, before the island's own. Water is water as ever, and land that is
-- no island's takes none.

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

/*
 * What a swirl put down is (`swirlElement`): water on water; on land dark under `swirl_dark()`, light under that and
 * `swirl_light()`, the season's element under those and `swirl_season()` where a season is given, and the land's own
 * otherwise; none on land that is no island's.
 */
drop function if exists swirl_element(boolean, text, double precision);
create or replace function swirl_element(p_water boolean, p_land text, p_roll double precision, p_season text default null)
returns text language sql immutable as $$
  select case when p_water then 'water'
              when p_land is null then null
              when p_roll < swirl_dark() then 'dark'
              when p_roll < swirl_dark() + swirl_light() then 'light'
              when p_season is not null and p_roll < swirl_dark() + swirl_light() + swirl_season() then season_element(p_season)
              else p_land end
$$;

-- The day's swirls, put down in the season of the dawn they are for.
select pg_temp.patch_fn('public.swirl_day(uuid)'::regprocedure,
  $o$                 region_element(region_at(p_world, s.x + 0.5, s.y + 0.5)),
                 random()) as element$o$,
  $n$                 region_element(region_at(p_world, s.x + 0.5, s.y + 0.5)),
                 random(),
                 -- And the season's element on every island (`season_element`).
                 season_at(now())) as element$n$);

select private.lock_doors();
