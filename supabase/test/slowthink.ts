/**
 * A wildermon's think that held the clock's round, kept with what it was doing (`private.slow_think`).
 *
 * Read off the island: one round of 36.4 s, all of it the stir stage, and nothing kept to say whose think it was.
 *
 *   * every think the clock asks for goes through `private.settle_timed`: `kept_sweep`, `worker_sweep` and
 *     `creature_sweep`, and none of them calls `creature_settle` any other way;
 *   * one of `slow_think_ms()` or more is kept with the creature, its kind, mode, job, phase and keeper, and its time;
 *   * one under it is not; and what `settle_timed` says is what `creature_settle` says;
 *   * kept at the time the think began, not its round's;
 *   * one of `slow_stall_ms()` or more is kept with what else was running (`others`), one under it without.
 *
 * Every step is undone.
 */
import { psql, check, finish } from './harness';

const U = 'fdd40000-0000-4000-8000-0000000000e1';
const out = psql(`
begin;
create temp table said (k text, v text);
insert into said select 'SWEEP:' || f, (position('private.settle_timed(p_world, r.id)' in pg_get_functiondef(f::regproc)) > 0
    and position('if creature_settle(' in pg_get_functiondef(f::regproc)) = 0)::text
  from unnest(array['public.kept_sweep', 'public.worker_sweep', 'public.creature_sweep']) f;
do $t$
declare w uuid; u uuid := '${U}'; m int; v_ok boolean;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Slowthink', 334, 200, 100, 100, true) returning id into w;
  perform land_blank(w, 200);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(80, 120) x, generate_series(80, 120) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Slowpoke');
  m := creature_spawn(w, 'rabba', 100.5, 100.5, 'active', now() - interval '20 days', u);
  update creature set keeper = u, until = now() - interval '1 second', settled_at = now() - interval '5 seconds' where world_id = w and id = m;
  -- Under the bar: nothing kept.
  v_ok := private.settle_timed(w, m);
  insert into said values ('UNDER', (select count(*)::text from private.slow_think where world_id = w));
  -- Every think over the bar.
  create or replace function public.slow_think_ms() returns double precision language sql immutable as $fn$ select 0::double precision $fn$;
  update creature set until = now() - interval '1 second', settled_at = now() - interval '5 seconds' where world_id = w and id = m;
  v_ok := private.settle_timed(w, m);
  insert into said values ('SAYS', v_ok::text);
  insert into said select 'KEPT', count(*) || '|' || max(t.creature) || '|' || max(t.species) || '|' || max(t.mode) || '|' || bool_and(t.keeper = u)::text
      || '|' || (min(t.ms) >= 0)::text from private.slow_think t where t.world_id = w;
  insert into said values ('ID', m::text);
  -- Kept at the think's own start: after this transaction began.
  insert into said select 'AT', bool_and(t.at > now())::text from private.slow_think t where t.world_id = w;
  insert into said select 'NO_OTHERS', bool_and(t.others is null)::text from private.slow_think t where t.world_id = w;
  -- Over the stall bar: what else was running, kept with it (a list, if an empty one).
  create or replace function public.slow_stall_ms() returns double precision language sql immutable as $fn$ select 0::double precision $fn$;
  update creature set until = now() - interval '1 second', settled_at = now() - interval '5 seconds' where world_id = w and id = m;
  v_ok := private.settle_timed(w, m);
  insert into said select 'OTHERS', count(*) || '|' || coalesce(jsonb_typeof((array_agg(t.others order by t.at desc))[1]), 'none')
    from private.slow_think t where t.world_id = w;
end $t$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));
for (const f of ['public.kept_sweep', 'public.worker_sweep', 'public.creature_sweep']) {
  check(`${f}: every think through private.settle_timed`, said.get(`SWEEP:${f}`) === 'true', said.get(`SWEEP:${f}`));
}
check('a think under slow_think_ms(): nothing kept', said.get('UNDER') === '0', said.get('UNDER'));
check('a think at or over it: kept with the creature, its kind, mode and keeper, and its time',
  said.get('KEPT') === `1|${said.get('ID')}|rabba|active|true|true`, said.get('KEPT'));
check('kept at the time the think began, not its round\'s', said.get('AT') === 'true', said.get('AT'));
check('under slow_stall_ms(): no others kept', said.get('NO_OTHERS') === 'true', said.get('NO_OTHERS'));
check('at or over it: what else was running kept with it', said.get('OTHERS') === '2|array', said.get('OTHERS'));
check('and settle_timed says what creature_settle says', said.get('SAYS') === 'true' || said.get('SAYS') === 'false', said.get('SAYS'));
finish('A slow think, kept');
