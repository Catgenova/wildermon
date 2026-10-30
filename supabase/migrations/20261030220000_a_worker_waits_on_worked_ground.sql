set local lock_timeout = '3s';

-- Reported: a Sandpip "being dumb", idle by its sand. Its one sand tile in reach was on the forage cooldown, and its
-- card said "Idle: no sand to collect within 8 tiles of the totem." Now, where every tile of its work in reach is
-- worked and on its wait, it says so and when the soonest is back: "Idle: all in reach worked; next sand to collect
-- in 93 s." (`idleSays`, why 'waiting', its number the seconds).

/*
 * Seconds until the soonest tile of a trade's work within `p_range` of (`p_cx`, `p_cy`) is off its forage cooldown,
 * or null where none of its kind is on one: the marks `worker_gatherable` asks of each trade (`is_foraged`).
 */
create or replace function worker_wait_left(p_world uuid, p_cx int, p_cy int, p_range int, p_kind text)
  returns double precision language sql stable as $fn$
  select min(forage_wait(f.kind) - extract(epoch from now() - f.at))
    from foraged f
   where f.world_id = p_world
     and f.x between p_cx - p_range and p_cx + p_range and f.y between p_cy - p_range and p_cy + p_range
     and now() - f.at < make_interval(secs => forage_wait(f.kind))
     and case p_kind
       when 'sand' then f.kind = 'dig' and land_tile(p_world, f.x, f.y) = tile_id('Sand')
       when 'clay' then f.kind = 'dig' and land_tile(p_world, f.x, f.y) = tile_id('Clay')
       when 'peat' then f.kind = 'dig' and land_tile(p_world, f.x, f.y) in (tile_id('Peat'), tile_id('Tar'))
       when 'seek' then f.kind = 'dig'
       when 'reed' then f.kind = 'reed'
       when 'grass' then f.kind in ('grass', 'moss')
       when 'worm' then f.kind = 'worm'
       when 'sprout' then f.kind = 'sprout'
       when 'bush' then f.kind = 'forage' and land_tile(p_world, f.x, f.y) = tile_id('Bush')
       when 'forage' then f.kind = 'forage'
       when 'botanize' then f.kind = 'botanize'
       else false end
$fn$;
revoke all on function worker_wait_left(uuid, int, int, int, text) from public, anon, authenticated;

do $do$
declare v_def text; v_old text; v_n int;
begin
  v_def := pg_get_functiondef('worker_settle'::regproc);
  v_old := $$        c.idle_since := coalesce(c.idle_since, now()); c.idle_what := null; c.idle_why := 'range'; c.idle_n := v_site.radius;
        perform worker_idle(p_world, c, kind, v_site.x, v_site.y, v_site.radius, v_site.post);$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_settle has % of the range idle, not 1', v_n; end if;
  execute replace(v_def, v_old, $$        c.idle_since := coalesce(c.idle_since, now()); c.idle_what := null; c.idle_why := 'range'; c.idle_n := v_site.radius;
        -- All of it in reach worked and on its wait: the seconds till the soonest is back (`worker_wait_left`).
        if worker_wait_left(p_world, v_site.x, v_site.y, v_site.radius, kind) is not null then
          c.idle_why := 'waiting'; c.idle_n := ceil(worker_wait_left(p_world, v_site.x, v_site.y, v_site.radius, kind));
        else
          -- Nothing coming back: an hour of it is worth a word (`worker_idle`); a wait is not.
          perform worker_idle(p_world, c, kind, v_site.x, v_site.y, v_site.radius, v_site.post);
        end if;$$);
end $do$;

select private.lock_doors();
