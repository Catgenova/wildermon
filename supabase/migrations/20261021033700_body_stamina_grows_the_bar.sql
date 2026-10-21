-- Body stamina makes the stamina bar bigger: the same bar at the starting mark, twice it at a hundred.
--
-- Asked for: "Body stamina should also increase the bar. 2x at 100". Stamina stays a share of the bar, so the marks
-- (winded, exhausted) and the "+N%" restores (tea, a dressing, Second Wind, a spell) stay shares of whatever bar you
-- have; what an action or a swing spends, what deep water drains and what comes back each second are divided by the
-- bar's size (`stamina_bar`, `Game.staminaBar`). What the chest learns from spending is still the wind spent.

set local lock_timeout = '3s';

create or replace function stamina_bar(p_world uuid, p_uid uuid) returns double precision
language sql stable as $fn$
  select 1 + greatest(0, skill_of(p_world, p_uid, 'body_stamina') - char_start()) * stamina_bar_per_level()
$fn$;

do $do$
declare v_def text; v_old text; v_new text;
begin
  -- What a job spends, as a share of the bar.
  v_def := pg_get_functiondef('spend_wind'::regproc);
  v_old := $q$to_jsonb(greatest(0, w - spent)))$q$;
  v_new := $q$to_jsonb(greatest(0, w - spent / stamina_bar(p_world, p_uid))))$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'spend_wind: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- Deep water's drain and the wind coming back, as shares of the bar.
  v_def := pg_get_functiondef('body_settle'::regproc);
  v_old := $q$w := greatest(0, w - (secs - v_free) * cost);$q$;
  v_new := $q$w := greatest(0, w - (secs - v_free) * cost / stamina_bar(p_world, p_uid));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'body_settle: swim anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$             * (case when h <= 0 or t <= 0 then wind_starving() else 1 end));$q$;
  v_new := $q$             * (case when h <= 0 or t <= 0 then wind_starving() else 1 end)
             / stamina_bar(p_world, p_uid));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'body_settle: wind anchor not once'; end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

select private.lock_doors();
