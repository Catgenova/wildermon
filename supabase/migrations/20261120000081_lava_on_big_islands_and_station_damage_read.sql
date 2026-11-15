/*
 * Two fixes to the batch before it (`20261120000071_volcano_lava.sql`,
 * `20261120000078_stations_set_down_and_decay.sql`).
 *
 * Lava only on an island of `lava_min_size` a side or more (`LAVA_MIN_SIZE`,
 * `lavaAt`). The labyrinth was laid by scale over a world of any size, so on a
 * small one it covered ground every other rule is asked on: a creature's step
 * (`creature_tile_ok`), and so where a hoard is buried, and digging, planting
 * and founding (`lava_ground_refusal`). `lava_on` is false below the size, and
 * `lava_ready` keeps no day's design for such a world.
 *
 * The ground read sends a station's damage as it was last charged (`dmg`) and
 * when (`decay_at`, epoch seconds), both columns that stand still between
 * charges, and the browser works out its decay since (`stationDmg`). It sent
 * the damage worked out to now, which moved between two reads of an unchanged
 * row, so a read of only what changed never held what the whole answer said.
 * What the island does with the damage (`station_sweep`, a pick-up) is as it
 * was.
 */
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

/* ---- lava on a big enough island only ------------------------------------------------------------ */

select pg_temp.patch_fn('lava_on(uuid, integer, integer, integer, integer)',
  $o$  if p_x < 0 or p_y < 0 or p_x >= p_size or p_y >= p_size$o$,
  $n$  -- None on a world under `lava_min_size` a side (`LAVA_MIN_SIZE`).
  if p_size < lava_min_size() or p_x < 0 or p_y < 0 or p_x >= p_size or p_y >= p_size$n$);

select pg_temp.patch_fn('lava_ready(uuid)',
  $o$  if not found then return 0; end if;$o$,
  $n$  if not found or w.size < lava_min_size() then return 0; end if;$n$);

/* ---- a station's damage in the ground read, as stored -------------------------------------------- */

-- The column as it is, not worked out to now.
select pg_temp.patch_fn('rpc_ground(uuid, double precision, boolean, text)',
  $o$
                              'dmg', case when station_kind(pl.kind) then station_dmg(pl) else pl.dmg end,$o$,
  $n$$n$);
-- And for a station only, when it was charged.
select pg_temp.patch_fn('rpc_ground(uuid, double precision, boolean, text)',
  $o$- 'cx' - 'cy' - 'crumbles_at' - 'decay_at')$o$,
  $n$- 'cx' - 'cy' - 'crumbles_at' - 'decay_at'
         || case when station_kind(pl.kind) then jsonb_build_object('decay_at', extract(epoch from pl.decay_at)) else '{}'::jsonb end)$n$);

select private.lock_doors();
