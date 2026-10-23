set local lock_timeout = '3s';

-- Life stages in days of the wall clock. Asked for: "Change the age transitions of wildermon to be real life days",
-- after "Scale life stages to match the 90-day seasons ... Any wildermon currently Old set to grown".
--
-- The defs before this count `young_for`, `old_at` and `old_for` in days of the wall clock (grown at 7.5, old at 45,
-- dead 90 after). Three things follow:
--
--   * A wild one's birth is dated back across the ages (`old_at` × 1.6), so the wild holds young, grown and old; its
--     stay in the wild is counted from when it was put out (`put_at`), no longer from its birth, which would put out
--     most of them already past their stay.
--   * Every keeper's numbers stamped afresh (`kept`), its old age among them.
--   * Every wildermon keeps the stage it had: one young by the island's stages until now (young for 9000 s, at its
--     keeper's pace) is young as far into its youth as it was; every other one is set to the start of grown and
--     `comb_into` into it, as an ancient comb puts it -- the old among them grown again, as asked.
alter table creature add column if not exists put_at timestamptz not null default now();

do $do$
declare v_def text; v_n int; i int;
  v_fix text[][] := array[
    array['wild_turnover', '(p_any or c.born is null or c.born <= now() - make_interval(secs => wild_stay_of(c.id)))',
      '(p_any or c.put_at <= now() - make_interval(secs => wild_stay_of(c.id)))'],
    array['creature_stock_block', 'random() * 6 * 3600 * 1.6', 'random() * old_at() * 1.6'],
    array['creature_stock', 'random() * 6 * 3600 * 1.6', 'random() * old_at() * 1.6']];
begin
  for i in 1 .. array_length(v_fix, 1) loop
    v_def := pg_get_functiondef(v_fix[i][1]::regproc);
    v_n := (length(v_def) - length(replace(v_def, v_fix[i][2], ''))) / length(v_fix[i][2]);
    if v_n <> 1 then raise exception '% has % of %, not 1', v_fix[i][1], v_n, v_fix[i][2]; end if;
    execute replace(v_def, v_fix[i][2], v_fix[i][3]);
  end loop;
end $do$;

update creature set kept = kept_of(world_id, keeper) where keeper is not null and kept is distinct from kept_of(world_id, keeper);

update creature cr set born = case
    when extract(epoch from (now() - cr.born)) * age_pace(cr) < 9000
      then now() - make_interval(secs => extract(epoch from (now() - cr.born)) / 9000 * young_for())
    else now() - make_interval(secs => (young_for() + comb_into()) / age_pace(cr)) end
 where cr.born is not null;

select private.lock_doors();
