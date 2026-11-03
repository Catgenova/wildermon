-- Asked for: "faster skill gain below level 10, ×2".
--
-- A body's own skill gains `early_skill_mul()` times as much while it is below `early_skill_below()`, and the
-- multiplied part stops there: a go that would carry the skill past it ends at it, or at the go's own gain if that is
-- more (`early_gain`). Raised by every go there is (`skill_raise`), so every trade, characteristic and fighting skill
-- alike; a characteristic starts above it. A wildermon's skills (`worker_learn_paced`) and a class level
-- (`class_learn`) read `skill_gain_of` alone, as before. The browser's `earlyGain` and `playerGain`;
-- supabase/test/earlyskill.ts holds the two sides to each other.

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

-- A gain of `p_gain` made at `p_v`, by a body's own skill (`earlyGain`).
create or replace function early_gain(p_v double precision, p_gain double precision)
  returns double precision language sql immutable as $fn$
  select greatest(p_gain, least(early_skill_mul() * p_gain, early_skill_below() - p_v))
$fn$;

-- Every raise of a body's own skill (`Skills.gain`).
select pg_temp.patch_fn('public.skill_raise(uuid, uuid, text, double precision)'::regprocedure,
  $$  now_v := (was + skill_gain_of(was, p_base * skill_mult(p_world, p_uid, p_id) * path_first(p_world, p_uid, p_id),
                                          0.6 + 0.8 * random()));$$,
  $$  now_v := (was + early_gain(was, skill_gain_of(was, p_base * skill_mult(p_world, p_uid, p_id) * path_first(p_world, p_uid, p_id),
                                          0.6 + 0.8 * random())));$$);

-- And the watch's count of the goes a rise took, at the rate a go makes below the mark.
select pg_temp.patch_fn('private.watch_goes(double precision, double precision, double precision)'::regprocedure,
  $$/ public.skill_gain_of(p_from + (p_to - p_from) * (k + 0.5) / 16, p_mult, private.watch_best_roll())), 0)$$,
  $$/ (public.skill_gain_of(p_from + (p_to - p_from) * (k + 0.5) / 16, p_mult, private.watch_best_roll())
                         * case when p_from + (p_to - p_from) * (k + 0.5) / 16 < public.early_skill_below()
                                then public.early_skill_mul() else 1 end)), 0)$$);

select private.lock_doors();
