/**
 * A creature's lines say "grown in" and "Offerings taken" on an island as they do off one.
 *
 * `rpc_creatures` sent a young one's age as a word and never the hour it was born, so the browser worked "grown in"
 * out from a birth at nought; and it never sent a wild one's run of offerings at all, so "Offerings taken" was never
 * said on an island. This asks that:
 *
 *   * the island sends the seconds until a young one is grown (`grownIn`), and null for a grown one;
 *   * it sends a wild one's run of offerings (`coaxed`) with the seconds before it lapses (`coaxLeft`), and 0 once it
 *     has lapsed, and nothing of it for a tamed one;
 *   * the browser's lines say both off the row it is sent.
 *
 * Runs against the database the suite leaves behind.
 */
import { Game } from '../../src/game/game';
import { clockLeft } from '../../src/game/boons';
import type { IslandCreature } from '../../src/game/creatures';
import { creatureLines } from '../../src/ui/creatureinfo';
import { psql, check, finish } from './harness';

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '5bea7000-0000-4000-8000-0000000000c3';
const as = (uid: string): string => `perform set_config('request.jwt.claims', json_build_object('sub', '${uid}')::text, true);`;
const still = (id: string, x: number, y: number): string => `
  update creature set leg_at = now(), leg_ends = now(), from_x = ${x}, from_y = ${y}, to_x = ${x}, to_y = ${y},
         until = now() + interval '1 hour', settled_at = now() where world_id = w and id = ${id};`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_young int; v_old int; v_tame int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Growing', 171, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  ${as(MIRA)}
  perform rpc_join(w, 'Mira');
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now() where world_id = w;
  -- A wild young one a day old, offered to three times 25 seconds ago.
  select creature_spawn(w, 'rabba', 11.5, 10.5, 'wild', now() - interval '1 day') into v_young;
  update creature set coaxed = 3, coaxed_at = now() - interval '25 seconds' where world_id = w and id = v_young;
  ${still('v_young', 11.5, 10.5)}
  -- A wild grown one, whose run of offerings lapsed an hour ago.
  select creature_spawn(w, 'rabba', 9.5, 10.5, 'wild', now() - interval '30 days') into v_old;
  update creature set coaxed = 2, coaxed_at = now() - interval '1 hour' where world_id = w and id = v_old;
  ${still('v_old', 9.5, 10.5)}
  -- A tamed young one of her own, two days old.
  select creature_spawn(w, 'rabba', 10.5, 11.5, 'active', now() - interval '2 days', u) into v_tame;
  update creature set mode = 'active', keeper = u where world_id = w and id = v_tame;
  ${still('v_tame', 10.5, 11.5)}
  insert into said values ('YOUNG', (select r::text from jsonb_array_elements(rpc_creatures(w)) r where (r->>'id')::int = v_young));
  insert into said values ('OLD', (select r::text from jsonb_array_elements(rpc_creatures(w)) r where (r->>'id')::int = v_old));
  insert into said values ('TAME', (select r::text from jsonb_array_elements(rpc_creatures(w)) r where (r->>'id')::int = v_tame));
  insert into said values ('YOUNGFOR', young_for()::text);
  insert into said values ('LAPSE', coax_lapse()::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const young = JSON.parse(isle.get('YOUNG') ?? '{}') as IslandCreature;
const old = JSON.parse(isle.get('OLD') ?? '{}') as IslandCreature;
const tame = JSON.parse(isle.get('TAME') ?? '{}') as IslandCreature;
const youngFor = Number(isle.get('YOUNGFOR'));
const lapse = Number(isle.get('LAPSE'));
const near = (v: unknown, want: number, slack = 5): boolean => typeof v === 'number' && Math.abs(v - want) < slack;

check('the island sends a young wild one\'s seconds until grown', young.age === 'young' && near(young.grownIn, youngFor - 86400), `${young.age} ${young.grownIn}`);
check('and a young tamed one\'s', tame.age === 'young' && near(tame.grownIn, youngFor - 2 * 86400), `${tame.age} ${tame.grownIn}`);
check('and null for a grown one', old.age !== 'young' && 'grownIn' in old && old.grownIn === null, `${old.age} ${old.grownIn}`);
check('the island sends a wild one\'s run of offerings', young.coaxed === 3, String(young.coaxed));
check('with the seconds before it lapses', near(young.coaxLeft, lapse - 25), String(young.coaxLeft));
check('and 0 once it has lapsed, with no seconds', old.coaxed === 0 && old.coaxLeft === undefined, `${old.coaxed} ${old.coaxLeft}`);
check('and nothing of it for a tamed one', !('coaxed' in tame) && !('coaxLeft' in tame), JSON.stringify([tame.coaxed, tame.coaxLeft]));

/* ---- in the browser --------------------------------------------------------------- */

const g = Game.create(4271);
g.player.x = 20.5;
g.player.y = 20.5;
const c = g.creatures.spawn('rabba', 20.5, 19.5, 'wild');
g.creatures.sawAll([{ ...young, id: c.id, x: 20.5, y: 19.5 } as IslandCreature], g.time);
const seen = g.creatures.get(c.id);
const lines = seen ? creatureLines(g, seen) : [];
const grown = `grown in ${clockLeft(young.grownIn ?? 0)}`;
check(`a wild one's lines say "${grown}" off the island's row`, lines.some((l) => l.includes(grown)), lines.join(' | '));
check('and "Offerings taken: 3"', lines.some((l) => l.startsWith('Offerings taken: 3 · chance +')), lines.join(' | '));
// And no more once the island says its run has lapsed.
g.creatures.sawAll([{ ...old, id: c.id, x: 20.5, y: 19.5 } as IslandCreature], g.time);
const after = creatureLines(g, g.creatures.get(c.id)!);
check('and neither once it is grown and its run has lapsed', !after.some((l) => l.includes('grown in') || l.startsWith('Offerings taken')), after.join(' | '));

finish('"grown in" and "Offerings taken" on an island');
