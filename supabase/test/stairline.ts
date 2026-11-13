/**
 * A worker climbs a staircase of flights in a line to any storey of it, and comes back down.
 *
 * Reported, with a screenshot of two Bastiondrakes idle on the ground beside a marble staircase: "bastiondrakes cant
 * go to storey 4 despite stairs right next to them?". The manor's staircase climbs in a line, each flight's head the
 * foot of the next (`flightfoot.ts`). A beast steps off a flight only at its head or its foot (`creature_way`), so in
 * a line it went on up every flight to the top storey and never onto a storey between, and off a flight's foot it
 * stepped only onto a floor, never onto the head of the flight under it. Every storey between was out of its way
 * (`stairs`, that storey), and the top storey was one it went up to and never came down from (`stranded`).
 *
 * One rolled-back settlement: a house of five storeys, four flights up it in a line, each climbed from the north, and
 * walls planned on storey 4 only. On the island:
 *
 *   * a way from the ground to storey 2, 3 and 4 is found, ends on that storey, and climbs only the flights under it;
 *   * a way from storey 4 and from storey 5 down to the ground is found, down every flight under it;
 *   * a hod carrier with mortar in a chest on the ground goes up to storey 4, fits every wall planned there, comes
 *     back down for more, and never says `stairs` or `stranded`.
 */
import { psql, check, finish } from './harness';

const T = 40;
const U = '7e5b0000-0000-4000-8000-00000057a1e4';
/** The house: T..T+3 by T..T+5, the ground and four storeys over it. */
const X0 = T, X1 = T + 3, Y0 = T, Y1 = T + 5;
const TOP = 4;
/** The flights, up to storeys 2 to 5 (levels 1 to 4) in a line down x = T+1, each climbed from the north. */
const FLIGHTS = [1, 2, 3, 4].map((l) => [l, T + 1, T + l] as const);
/** Where the ways go: a tile on each storey off the line of the flights. */
const SPOT = [T + 3, T + 1] as const;
const STORE = [T - 3, T - 3] as const;
const START = [T - 2, T - 2] as const;
/** The walls planned on storey 4 (level 3): the house's north and south sides. */
const WALLS: Array<[string, number, number]> = [];
for (let x = X0; x <= X1; x++) WALLS.push(['h', x, Y0], ['h', x, Y1 + 1]);
const UP = 3;

const onLine = new Set(FLIGHTS.map(([l, x, y]) => `${l},${x},${y}`));
const floors: string[] = [];
for (let l = 1; l <= TOP; l++) for (let x = X0; x <= X1; x++) for (let y = Y0; y <= Y1; y++) {
  if (!onLine.has(`${l},${x},${y}`)) floors.push(`(w, ${l}, ${x}, ${y}, 1, 'plank', 'floor', null, '{}', '{}', u)`);
}

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_hod int; v_store bigint; i int; c creature;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stairline', 383, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 12}, ${T + 12}) x, generate_series(${T - 12}, ${T + 12}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Stairline');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Stairline', ${T}, ${T}, 12, 1, u);
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Manor', ${TOP + 1}, u);
  insert into building_tile (world_id, building, x, y)
    select w, 1, x, y from generate_series(${X0}, ${X1}) x, generate_series(${Y0}, ${Y1}) y;
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total, planned_by) values
    ${floors.join(', ')},
    ${FLIGHTS.map(([l, x, y]) => `(w, ${l}, ${x}, ${y}, 1, 'plank', 'stairs', 'n', '{}', '{}', u)`).join(', ')};
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    ${WALLS.map(([d, x, y]) => `(w, ${UP}, '${d}', ${x}, ${y}, 1, 'solid', 'plank', '{"mortar": 1}', '{"mortar": 1}', u)`).join(', ')};

  for i in 1..${TOP} loop
    insert into said values ('UP' || i, coalesce(array_to_string(creature_way(w, ${START[0]}, ${START[1]}, 0, ${SPOT[0]}, ${SPOT[1]}, i), ','), 'null'));
    insert into said values ('DOWN' || i, coalesce(array_to_string(creature_way(w, ${SPOT[0]}, ${SPOT[1]}, i, ${START[0]}, ${START[1]}, 0), ','), 'null'));
  end loop;

  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values
    (w, 'furniture', 'chest', ${STORE[0]}, ${STORE[1]}, 0, 0, ${STORE[0]} + 0.375, ${STORE[1]} + 0.375, 40, u) returning id into v_store;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_store, 'mortar', 30, 20);
  v_hod := creature_spawn(w, 'cobbe', ${START[0]} + 0.5, ${START[1]} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, stance = 'passive', hunger = 1, phase = 'idle', carrying = null, job = null, post = null,
         from_x = to_x, from_y = to_y, until = now() - interval '1 millisecond', leg_at = now() - interval '1 millisecond',
         leg_ends = now() - interval '1 millisecond'
   where world_id = w and id = v_hod;
  for i in 1..240 loop
    update creature set worn = 0, hunger = 1, leg_at = leg_at - (until - now()) - interval '1 millisecond',
           leg_ends = leg_ends - (until - now()) - interval '1 millisecond', until = now() - interval '1 millisecond'
     where world_id = w and id = v_hod;
    perform worker_settle(w, v_hod);
    select * into c from creature where world_id = w and id = v_hod;
    if c.idle_why in ('stairs', 'stranded') then insert into said values ('SAID', i || ':' || c.idle_why || ' ' || c.idle_n); end if;
    if c.storey = ${UP} then insert into said values ('ON_UP', i::text); end if;
    if c.storey = 0 and c.storey_from > 0 then insert into said values ('CAME_DOWN', i::text); end if;
    exit when not exists (select 1 from wall wl where wl.world_id = w and wl.level = ${UP} and not bill_done(wl.needed));
  end loop;
  insert into said select 'LEFT', count(*)::text from wall wl where wl.world_id = w and wl.level = ${UP} and not bill_done(wl.needed);
end $t$;
select k || '=' || v from said;
rollback;`);

const said = new Map<string, string[]>();
for (const l of out.split('\n').filter((s) => s.includes('='))) {
  const k = l.slice(0, l.indexOf('='));
  said.set(k, [...(said.get(k) ?? []), l.slice(l.indexOf('=') + 1)]);
}
const at = (k: string): string => said.get(k)?.[0] ?? '(not said)';
const triples = (s: string): string[] => {
  const n = s.split(',');
  const r: string[] = [];
  for (let i = 0; i + 2 < n.length; i += 3) r.push(`${n[i]},${n[i + 1]},${n[i + 2]}`);
  return r;
};
const flight = (l: number): string => `${T + 1},${T + l},${l}`;

for (let l = 1; l <= TOP; l++) {
  const up = triples(at(`UP${l}`));
  const under = FLIGHTS.filter(([fl]) => fl <= l).map(([fl]) => flight(fl));
  const over = FLIGHTS.filter(([fl]) => fl > l).map(([fl]) => flight(fl));
  check(`a way from the ground to storey ${l + 1}, ending there, up the ${under.length} flight${under.length === 1 ? '' : 's'} under it and no other`,
    at(`UP${l}`) !== 'null' && up.at(-1) === `${SPOT[0]},${SPOT[1]},${l}` && under.every((f) => up.includes(f)) && !over.some((f) => up.includes(f)),
    at(`UP${l}`));
  const down = triples(at(`DOWN${l}`));
  check(`a way from storey ${l + 1} down to the ground, down every flight under it`,
    at(`DOWN${l}`) !== 'null' && down.at(-1)?.endsWith(',0') === true && under.every((f) => down.includes(f)), at(`DOWN${l}`));
}
check('a hod carrier with walls planned on storey 4 never says no stairs up or no stairs down', !said.has('SAID'),
  (said.get('SAID') ?? []).slice(0, 4).join(', '));
check('it goes up to storey 4', said.has('ON_UP'), (said.get('ON_UP') ?? []).slice(0, 3).join(','));
check('fits every wall planned there', at('LEFT') === '0', `${at('LEFT')} of ${WALLS.length} left`);
check('and comes back down the flights for more', (said.get('CAME_DOWN') ?? []).length >= 2, (said.get('CAME_DOWN') ?? []).slice(0, 4).join(','));

finish('a staircase in a line, to every storey of it');
