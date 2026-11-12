/**
 * A wildermon in a crate keeps as it went in, but for its age; and one at heel is not written again for nothing.
 *
 * Asked for: "When crated, everything except ages should freeze, and age only ticks once daily."
 *
 *   * crated, an island day and a half after its last settle: its hunger, health, care and fleece as they were, its
 *     next settle an island day away (`stored_settle`), and its age counted from its birth as before;
 *   * crated and pregnant past its time: not born in the crate (`herd_settle`);
 *   * let out after an hour in: its pregnancy, a meal's bonus and a bleed an hour later than they were, and its body
 *     reckoned from now (`settled_at`);
 *   * one at its keeper's heel, settled again a moment later with nothing changed: its row not written, so not sent
 *     again (`creature_settle`, `companion_settle`); its keeper moved, written.
 *
 * Every step is its own transaction, the clock moved by moving the creature's own times back. Makes its own island,
 * and takes it away again.
 */

import { psql, check, finish } from './harness';
const ME = 'c4a7e000-0000-4000-8000-0000000000c1';
const ISLE = 'Cratedkeeps';
const W = `(select id from world where name = '${ISLE}')`;
const one = (sql: string): string => psql(sql).split('\n').pop() ?? '';

psql(`
delete from world where name = '${ISLE}';
do $t$
declare w uuid;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('${ISLE}', 417, 120, 60, 60, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(30, 90) x, generate_series(30, 90) y;
  perform set_config('request.jwt.claims', json_build_object('sub', '${ME}')::text, true);
  perform rpc_join(w, 'Crater');
  update player set x = 60.5, y = 60.5, seen_at = now(), away = false where world_id = w and uid = '${ME}';
end $t$;`);

const DAY = Number(one('select day_seconds()'));
const SETTLE = Number(one('select stored_settle()'));
check('a crated one is settled once an island day', SETTLE === DAY, `${SETTLE} s, a day ${DAY} s`);

// A crated one: shut in, then its last settle put back a day and a half.
const id = Number(one(`
select creature_spawn(${W}, 'roxxen', 60.5, 60.5, 'active', now() - interval '3 days', '${ME}');`));
psql(`
update creature set hunger = 0.6, health = 3, care = 0.8, fleece = 0.2 where world_id = ${W} and id = ${id};
-- Shut in as \`crate_shut_in\` shuts one in, with no crate standing: in its keeper's pack.
update creature set mode = 'stored', phase = 'idle', settled_at = now(), until = now() where world_id = ${W} and id = ${id};`);
check('shut in: the time it went in kept', one(`select (stored_at is not null)::text from creature where world_id = ${W} and id = ${id}`) === 'true');
const before = one(`select concat_ws('|', hunger, health, care, fleece, age_of(born, old_of(c), age_pace(c))) from creature c where world_id = ${W} and id = ${id}`);
psql(`update creature set settled_at = now() - make_interval(secs => ${DAY * 1.5}), until = now() - interval '1 second',
  stored_at = now() - make_interval(secs => ${DAY * 1.5}) where world_id = ${W} and id = ${id};
select creature_settle(${W}, ${id});`);
const after = one(`select concat_ws('|', hunger, health, care, fleece, age_of(born, old_of(c), age_pace(c))) from creature c where world_id = ${W} and id = ${id}`);
check('crated, an island day and a half on: hunger, health, care, fleece and age stage as they were', after === before, `${before} / ${after}`);
const next = Number(one(`select extract(epoch from until - now()) from creature where world_id = ${W} and id = ${id}`));
check('and its next settle an island day away', Math.abs(next - DAY) < 5, `${next.toFixed(0)} s`);

// Pregnant past its time, in the crate: not born.
psql(`update creature set due = now() - interval '1 minute', unborn = '[]'::jsonb, sex = 'female' where world_id = ${W} and id = ${id};
select herd_settle(${W});`);
check('pregnant past its time in a crate: not born', one(`select (due is not null)::text from creature where world_id = ${W} and id = ${id}`) === 'true');

// Let out after an hour in: its clocks an hour later.
psql(`update creature set stored_at = now() - interval '1 hour', due = now() + interval '10 minutes',
  fed_until = now() + interval '5 minutes', bleed_until = now() + interval '1 minute', settled_at = now() - interval '1 hour'
  where world_id = ${W} and id = ${id};`);
psql(`update creature set mode = 'active' where world_id = ${W} and id = ${id};`);
const out = one(`select concat_ws('|', round(extract(epoch from due - now())), round(extract(epoch from fed_until - now())),
  round(extract(epoch from bleed_until - now())), round(extract(epoch from now() - settled_at)), (stored_at is null)::text)
  from creature where world_id = ${W} and id = ${id}`).split('|').map((s) => (s === 'true' ? 1 : Number(s)));
check('let out after an hour: pregnancy, meal bonus and bleed an hour later, its body from now',
  Math.abs(out[0] - 4200) < 5 && Math.abs(out[1] - 3900) < 5 && Math.abs(out[2] - 3660) < 5 && out[3] < 5 && out[4] === 1, out.join('|'));

// At heel: settled, then again with nothing changed.
psql(`update creature set bleed_until = null, bleed_rate = null, due = null, fed_until = null, health = max_health(c)
  from creature c where creature.world_id = ${W} and creature.id = ${id} and c.world_id = creature.world_id and c.id = creature.id;
select creature_settle(${W}, ${id});`);
const xmin = (): string => one(`select xmin::text from creature where world_id = ${W} and id = ${id}`);
const x0 = xmin();
psql(`select creature_settle(${W}, ${id});`);
check('at heel, settled again with nothing changed: not written', xmin() === x0, `${x0} / ${xmin()}`);
psql(`update player set x = 63.5 where world_id = ${W} and uid = '${ME}';
select creature_settle(${W}, ${id});`);
check('its keeper moved: written, at its keeper', xmin() !== x0
  && one(`select to_x::text from creature where world_id = ${W} and id = ${id}`) === '63.5', xmin());

psql(`delete from world where name = '${ISLE}';`);

finish('a wildermon in a crate keeps');
