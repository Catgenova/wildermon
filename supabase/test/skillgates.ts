/**
 * Skill gates: one rule, and felling a tree by woodcutting the first thing on it.
 *
 * Asked for: "cutting trees is similarly gated, with willow requiring the highest level and pine the least. Oak birch
 * and maple early on", every gate the same way, for players and for wildermon at their own level, and the gates of a
 * skill listed ticked or not in the Skills window. Asked of the island and of the browser:
 *
 *   * the island's `skill_gate` is the browser's `SKILL_GATES`, row for row: every tree species placed, pine least,
 *     birch, oak and maple early, willow most, every level on the ladder;
 *   * you at woodcutting 12.4 with a hatchet beside a mature willow: refused in the same words on both sides, "Willow:
 *     needs woodcutting 70; have 12.4.", the menu's hint; at 70, allowed; a willow sapling, with no logs, anybody clears;
 *   * a Sapgnaw at woodcutting 1 by a mature willow does not take it and says why, "Idle: Willow 3 tiles from the totem
 *     needs woodcutting 70 (yours 1.0).", on its card and as the island sends it; by a pine as well, it takes the pine;
 *   * the Skills window's list for woodcutting is the gate table in level order, ticked by your level, at 1 and at 25.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { GATHER_SKILL, type Creature } from '../../src/game/creatures';
import { idleSays } from '../../src/game/workerlog';
import { creatureLines } from '../../src/ui/creatureinfo';
import { GATE_LADDER, gateOf, KEPT_OFF_LADDER, skillGateRefusal, nextUnlockSaid, SKILL_GATES, unlocksOf } from '../../src/game/skillgates';
import { packTreeData, TileType, TREE_AGES, TREE_DEFS } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000a7e01';
const T = 40;
const species = (name: string): number => TREE_DEFS.findIndex((t) => t.name === name);
const WILLOW = species('Willow');
const PINE = species('Pine');
const MATURE = TREE_AGES.findIndex((a) => a.name === 'Mature');
const SAPLING = TREE_AGES.findIndex((a) => a.logs === 0 && a.alive);
const NEED = gateOf('tree', 'willow')!.level;

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.run(w uuid, p_id int, n int) returns void language plpgsql as $r$
declare i int;
begin
  for i in 1..n loop
    update creature set until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds',
           leg_at = now() - interval '61 seconds', leg_ends = now() - interval '60 seconds', from_x = to_x, from_y = to_y,
           worn = 0, hunger = 1
     where world_id = w and id = p_id and mode = 'deed';
    perform worker_settle(w, p_id);
  end loop;
end $r$;
create function pg_temp.feller(w uuid, u uuid, skill double precision) returns int language plpgsql as $m$
declare v int; j jsonb;
begin
  v := creature_spawn(w, 'bevere', ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, name = 'Pip',
         skills = jsonb_build_object('woodcutting', skill) where world_id = w and id = v;
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v));
  update creature set job = 'woodcut' where world_id = w and id = v;
  return v;
end $m$;
create function pg_temp.idle(w uuid, p_id int) returns text language sql as $i$
  select coalesce(idle_why, '') || '|' || coalesce(round(idle_n::numeric)::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = $1 and id = $2;
$i$;
create function pg_temp.woodcutting(w uuid, u uuid, v real) returns void language sql as $s$
  insert into skill (world_id, uid, id, value) values (w, u, 'woodcutting', v)
    on conflict (world_id, uid, id) do update set value = excluded.value;
$s$;
do $t$
declare w uuid; u uuid := '${U}'; v_m int; tile jsonb := jsonb_build_object('kind', 'tile', 'x', ${T + 3}, 'y', ${T});
begin
  insert into said select 'GATES', string_agg(kind || ':' || id || ':' || name || ':' || skill || ':' || level, ',' order by kind, id) from skill_gate;
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Gates', 306, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform land_set_height(w, x, y, 50) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform land_set_dirt(w, x, y, 14) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Gatestead', ${T}, ${T}, 15, 5, u);
  update player set x = ${T}.5, y = ${T + 1}.5, body_at = now(), seen_at = now() where world_id = w and uid = u;

  -- A mature willow three tiles off.
  perform land_set_tile(w, ${T + 3}, ${T}, tile_id('Tree'));
  perform land_set_data(w, ${T + 3}, ${T}, tree_pack(${WILLOW}, ${MATURE}));

  -- A feller at woodcutting 1: not taken, and why.
  v_m := pg_temp.feller(w, u, 1);
  insert into said select 'W1_MAY', worker_gatherable(w, ${T + 3}, ${T}, 'woodcut', c)::text from creature c where world_id = w and id = v_m;
  perform pg_temp.run(w, v_m, 1);
  insert into said values ('W1', pg_temp.idle(w, v_m));
  insert into said select 'W1_SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->'idleWhat'->>0, '') || ',' || coalesce(e->'idleWhat'->>1, '')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = v_m;
  -- And with a pine in reach as well, it goes to the pine.
  perform land_set_tile(w, ${T}, ${T + 5}, tile_id('Tree'));
  perform land_set_data(w, ${T}, ${T + 5}, tree_pack(${PINE}, ${MATURE}));
  perform pg_temp.run(w, v_m, 1);
  insert into said select 'W1_PINE', coalesce(work_x::text, '') || ',' || coalesce(work_y::text, '') || '|' || coalesce(idle_why, '')
    from creature where world_id = w and id = v_m;
  delete from creature where world_id = w and id = v_m;
  perform land_set_tile(w, ${T}, ${T + 5}, tile_id('Grass'));
  perform land_set_data(w, ${T}, ${T + 5}, 0);
  -- At its gate's level it takes the willow.
  v_m := pg_temp.feller(w, u, ${NEED});
  insert into said select 'W70_MAY', worker_gatherable(w, ${T + 3}, ${T}, 'woodcut', c)::text from creature c where world_id = w and id = v_m;
  delete from creature where world_id = w and id = v_m;

  -- You, beside it, with a hatchet.
  perform give(w, u, 'hatchet', 1, 40, null);
  update player set x = ${T + 2}.5, y = ${T}.5 where world_id = w and uid = u;
  perform pg_temp.woodcutting(w, u, 12.4);
  insert into said values ('YOU12', coalesce(act_refusal(w, u, 'cut_down', tile), 'none'));
  perform pg_temp.woodcutting(w, u, ${NEED});
  insert into said values ('YOU70', coalesce(act_refusal(w, u, 'cut_down', tile), 'none'));
  -- A sapling, with no logs in it, at 1.
  perform pg_temp.woodcutting(w, u, 1);
  perform land_set_data(w, ${T + 3}, ${T}, tree_pack(${WILLOW}, ${SAPLING}));
  insert into said values ('SAPLING', coalesce(act_refusal(w, u, 'cut_down', tile), 'none'));
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const said = (k: string): string => isle.get(k) ?? '';

/* ---- the defs -------------------------------------------------------------- */

{
  const mine = [...SKILL_GATES].sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : 1)).map((g) => `${g.kind}:${g.id}:${g.name}:${g.skill}:${g.level}`).join(',');
  check('the island\'s skill_gate is the browser\'s SKILL_GATES, row for row', said('GATES') === mine, `island ${said('GATES')} / browser ${mine}`);
  const trees = TREE_DEFS.map((t) => gateOf('tree', t.name.toLowerCase()));
  check(`every tree species has a woodcutting gate (${TREE_DEFS.length})`, trees.every((g) => g?.skill === 'woodcutting'));
  const lv = (n: string): number => gateOf('tree', n.toLowerCase())!.level;
  const most = Math.max(...trees.map((g) => g!.level));
  check(`pine least (${lv('Pine')}), willow most (${lv('Willow')}), alone at each end`,
    trees.filter((g) => g!.level <= lv('Pine')).length === 1 && trees.filter((g) => g!.level >= most).length === 1 && lv('Willow') === most);
  check(`birch ${lv('Birch')}, oak ${lv('Oak')} and maple ${lv('Maple')}: early (20 or under)`, ['Birch', 'Oak', 'Maple'].every((n) => lv(n) <= 20 && lv(n) > lv('Pine')));
  check(`every gate on the ladder (${GATE_LADDER.join(', ')})`, SKILL_GATES.every((g) => KEPT_OFF_LADDER.has(g.kind) || (GATE_LADDER as readonly number[]).includes(g.level)));
}

/* ---- you ------------------------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(306, 120);
  const w = g.world;
  w.water = null;
  w.heights.fill(50);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  w.dirt.fill(14);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Gatestead', x: T, y: T, radius: 15, level: 5 } as typeof g.deed;
  g.player.x = T + 0.5;
  g.player.y = T + 1.5;
  return g;
};
{
  const g = fresh();
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, MATURE));
  g.inventory.add('hatchet', { ql: 40 });
  g.player.x = T + 2.5;
  g.player.y = T + 0.5;
  const cut = ACTION_BY_ID.get('cut_down')!;
  const at = { kind: 'tile', x: T + 3, y: T } as Parameters<NonNullable<typeof cut.check>>[0];
  const words = skillGateRefusal('Willow', 'woodcutting', 12.4, NEED)!;
  g.skills.values.set('woodcutting', 12.4);
  const b12 = cut.check?.(at, g) ?? 'none';
  check(`you at woodcutting 12.4 by a mature willow: "${words}", the same on both sides (the menu's hint)`,
    b12 === words && said('YOU12') === words, `island "${said('YOU12')}" / browser "${b12}"`);
  g.skills.values.set('woodcutting', NEED);
  const b70 = cut.check?.(at, g) ?? 'none';
  check(`and at ${NEED}, allowed on both sides`, b70 === 'none' && said('YOU70') === 'none', `island ${said('YOU70')} / browser ${b70}`);
  g.skills.values.set('woodcutting', 1);
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, SAPLING));
  const bs = cut.check?.(at, g) ?? 'none';
  check('a willow sapling, no logs in it: anybody clears it, on both sides', bs === 'none' && said('SAPLING') === 'none', `island ${said('SAPLING')} / browser ${bs}`);
}

/* ---- a feller --------------------------------------------------------------- */

const feller = (g: Game, skill: number): Creature => {
  const c = g.creatures.spawn('bevere', T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
  c.traits = [];
  c.name = 'Pip';
  c.skills = { [GATHER_SKILL.woodcut]: skill };
  c.trade = 'woodcut';
  return c;
};
const run = (g: Game, c: Creature, secs: number): void => {
  const stepper = g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void };
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    c.hunger = 1;
    c.worn = 0;
    stepper.updateWorker(c, 0.25, g);
  }
};
{
  const g = fresh();
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, MATURE));
  const c = feller(g, 1);
  const may = g.creatures.gatherable(g, T + 3, T, 'woodcut', c);
  run(g, c, 2);
  const says = idleSays({ why: 'gate', n: 3, what: ['tree', 'willow'] }, 'woodcut', null, 1);
  const line = c.idle ? idleSays(c.idle, 'woodcut', null, c.skills[GATHER_SKILL.woodcut]) : '';
  check(`a Sapgnaw at woodcutting 1 by a mature willow: not taken, "${says}", on both sides`,
    !may && said('W1_MAY') === 'false' && said('W1') === 'gate|3|tree,willow' && c.idle?.why === 'gate' && line === says,
    `island ${said('W1_MAY')} ${said('W1')} / browser ${may} "${line}"`);
  check('and the browser is sent the gate', said('W1_SENT') === 'gate|tree,willow', said('W1_SENT'));
  check(`and its card says it`, creatureLines(g, c).includes(says), creatureLines(g, c).join(' / '));
  check(`at woodcutting ${NEED} it takes the willow`, said('W70_MAY') === 'true' && g.creatures.gatherable(g, T + 3, T, 'woodcut', feller(g, NEED)), said('W70_MAY'));
}
{
  const g = fresh();
  g.world.setTile(T + 3, T, TileType.Tree, packTreeData(WILLOW, MATURE));
  g.world.setTile(T, T + 5, TileType.Tree, packTreeData(PINE, MATURE));
  const c = feller(g, 1);
  run(g, c, 2);
  check('with a pine in reach as well, it goes to the pine, on both sides',
    said('W1_PINE') === `${T},${T + 5}|` && c.workX === T && c.workY === T + 5 && !c.idle,
    `island ${said('W1_PINE')} / browser ${c.workX},${c.workY} ${c.idle?.why ?? ''}`);
}

/* ---- the Skills window's list ------------------------------------------------ */

{
  const table = SKILL_GATES.filter((g) => g.skill === 'woodcutting');
  for (const have of [1, 25]) {
    const list = unlocksOf('woodcutting', have);
    const same = list.length === table.length && list.every((u, i) => u.name === table[i].name && u.level === table[i].level);
    const ticks = list.every((u) => u.met === have >= u.level);
    const sorted = list.every((u, i) => i === 0 || list[i - 1].level <= u.level);
    check(`woodcutting ${have}: the Unlocks list is the gate table in level order, ticked by level (${list.filter((u) => u.met).map((u) => u.name).join(', ')})`,
      same && ticks && sorted, list.map((u) => `${u.met ? '✓' : '·'}${u.name} ${u.level}`).join(' '));
  }
  check('and the next one named with your level: "Next: Birch at 5 (yours 1.0)"', nextUnlockSaid('woodcutting', 1) === 'Next: Birch at 5 (yours 1.0)', nextUnlockSaid('woodcutting', 1) ?? '');
}

finish('Skill gates: tree felling by woodcutting, for you and for a feller');
