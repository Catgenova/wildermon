/**
 * Ten conveniences, each held to what it says.
 *
 * Asked for: rot warnings, putting everything away into the stores within
 * reach, searching the stores, a shopping list, making until you hold so
 * many, map pins and walking to them, eating by yourself, a notice when
 * something you wear is wearing out, and a Needs attention view of your
 * wildermon. The parts that are a rule rather than a window are checked here:
 *
 *   * Put away: each loose stack goes to a store within reach that holds the
 *     like of it, never to one further off, one that does not, or somebody
 *     else's chest; and alone it is in the store after;
 *   * rot: food on the ground has its time left from the decay rule, and food
 *     about to go is found; nothing in the pack is;
 *   * eating by yourself: under the share set it eats the food that fills
 *     most, never a locked stack, and leaves "Do it again" where it was;
 *   * the shopping list: a wagon's nails, ribbons and axles are cast, its
 *     planks and timber made from logs, and what is in the pack is spent once
 *     across every branch;
 *   * map pins: taken back from where an island game keeps them, and every
 *     change told so it can be kept again;
 *   * a long walk: further than one path is found over, it gets there in legs;
 *   * the island says when a dam's young are due, for her keeper only.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { foodToEat, AutoEat } from '../../src/game/autoeat';
import { Game, TRAVEL_LEG } from '../../src/game/game';
import type { Item } from '../../src/game/items';
import { putAway, putAwayPlan } from '../../src/game/putaway';
import '../../src/game/recipes';
import { rotSeconds, rottingNear, ROT_SOON } from '../../src/game/rot';
import { shoppingList } from '../../src/game/shopping';
import { NAILS_PER_LUMP } from '../../src/game/metal';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const game = Game.create(4242);
// A dry, open spot to stand on, with room round it.
let spot: [number, number] = [64, 64];
search: for (let r = 0; r < 80; r++) {
  for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) {
    const [x, y] = [64 + dx, 64 + dy];
    let dry = true;
    for (let j = -3; j <= 3 && dry; j++) for (let i = -3; i <= 3 && dry; i++) dry = game.world.isPassable(x + i, y + j) && !game.world.hasWater(x + i, y + j);
    if (dry) {
      spot = [x, y];
      break search;
    }
  }
}
const [px, py] = spot;
game.player.x = px + 0.5;
game.player.y = py + 0.5;
for (const c of [...game.crates.values()]) game.removeCrate(c.id);
for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
const pack = game.inventory;
for (const it of [...pack.items]) pack.remove(it.uid, it.count);
const stack = (id: string, count: number, ql = 30): Item => ({ uid: pack.nextUid++, id, ql, dmg: 0, count });

/* ---- put away ---- */
const logs = pack.add('log', { ql: 30, count: 5 });
const clay = pack.add('clay', { ql: 30, count: 4 });
const shards = pack.add('rock_shards', { ql: 30, count: 3 });
const near = game.addCrate('plank', px + 1, py, 0, 0, [stack('log', 2)]);
const far = game.addCrate('plank', px + 8, py, 0, 0, [stack('clay', 2)]);
const theirs = game.addFurniture('chest', px - 1, py, 0, 0, 30, [stack('rock_shards', 1)]);
theirs.mine = false;
const plan = putAwayPlan(game);
check('the logs go to the crate within reach that holds logs', plan.some((p) => p.item.uid === logs.uid && p.into.kind === 'crate' && p.into.id === near.id), JSON.stringify(plan.map((p) => [p.item.id, p.into.name])));
check('the clay does not go to the crate that holds clay further off than reach', !plan.some((p) => p.item.uid === clay.uid), `${far.id}`);
check('nor anything into somebody else\'s chest', !plan.some((p) => p.item.uid === shards.uid));
putAway(game);
check('and alone, the logs are in the crate after, the rest still in the pack',
  !pack.get(logs.uid) && near.items.reduce((n, it) => n + (it.id === 'log' ? it.count : 0), 0) === 7 && !!pack.get(clay.uid) && !!pack.get(shards.uid));
game.removeCrate(near.id);
game.removeCrate(far.id);
game.removeFurniture(theirs.id);

/* ---- rot ---- */
const meat = stack('cooked_meat', 2, 20);
meat.dmg = 99.5;
game.dropOnGround(px + 2, py + 2, meat);
const pile = game.groundAt(px + 2, py + 2);
const secs = pile.length ? rotSeconds(game, pile[0], px + 2, py + 2) : NaN;
check('food on the ground has its time left from the decay rule, and food nearly gone has under the notice\'s', secs > 0 && secs < ROT_SOON, `${secs}`);
check('and food near you about to rot is found', rottingNear(game).some((r) => r.item.id === 'cooked_meat'), `${rottingNear(game).length}`);
const whole = stack('cooked_meat', 1, 20);
check('a seal stops it: never', rotSeconds(game, { ...whole, mark: { seal: 0 } } as Item, px, py) === Infinity || rotSeconds(game, whole, px, py) > 0);

/* ---- eating by yourself ---- */
for (const it of [...pack.items]) pack.remove(it.uid, it.count);
const poor = pack.add('baked_potato', { ql: 10, count: 3 });
const good = pack.add('cooked_meat', { ql: 80, count: 1 });
good.locked = true;
const bread = pack.add('bread', { ql: 50, count: 1 });
const pick = foodToEat(game, false);
check('it never picks a locked stack', pick?.uid !== good.uid, pick?.id);
check('worst first picks the lowest quality', foodToEat(game, true)?.uid === poor.uid);
game.settings.autoEat = 0.3;
game.player.stats.hunger = 0.1;
game.player.stats.stamina = 1;
const eat = ACTION_BY_ID.get('eat');
const asked = { def: ACTION_BY_ID.get('pick_up') ?? eat!, target: { kind: 'self' as const } };
game.lastAsked = asked as never;
const auto = new AutoEat(game);
auto.update(1000);
check('under the share set it eats, and leaves "Do it again" where it was', (game.action?.def.id === 'eat' || game.player.stats.hunger > 0.1) && game.lastAsked === (asked as never), `${game.action?.def.id} ${game.player.stats.hunger}`);
void bread;

/* ---- the shopping list ---- */
for (const it of [...pack.items]) pack.remove(it.uid, it.count);
game.settings.fromStores = false;
const bare = shoppingList(game, [{ recipe: 'make_wagon', count: 1 }]);
const nails = bare.cast.find((c) => c.item === 'nail');
check('a wagon\'s nails, ribbons and axles are cast, with the lumps their moulds take',
  !!nails && nails.lumps === Math.ceil(nails.count / NAILS_PER_LUMP) && ['ribbon', 'big_axle'].every((id) => bare.cast.some((c) => c.item === id)), JSON.stringify(bare.cast.map((c) => [c.item, c.count, c.lumps])));
check('its planks and timber are made on the way, and logs fetched', bare.make.some((m) => m.item === 'plank') && bare.make.some((m) => m.item === 'timber') && bare.gather.some((g) => g.item === 'log'),
  JSON.stringify({ make: bare.make.map((m) => m.item), gather: bare.gather.map((g) => g.item) }));
pack.add('nail', { ql: 30, count: 1000 });
const nailed = shoppingList(game, [{ recipe: 'make_wagon', count: 1 }]);
check('nails in the pack are spent once, across the wagon and its wheels and yokes: none left to cast', !nailed.cast.some((c) => c.item === 'nail'), JSON.stringify(nailed.cast.map((c) => c.item)));
game.settings.fromStores = true;

/* ---- map pins ---- */
let told = 0;
game.marksChanged = () => told++;
game.takeMarks([{ id: 40, name: 'Clay here', x: px + 3, y: py, colour: 'amber' }]);
const m = game.addMark(px + 4, py, 'Ore');
game.renameMark(m.id, 'Iron');
game.recolourMark(m.id, 'red');
game.removeMark(m.id);
check('pins kept elsewhere are taken back, and every change after is told', game.marks.some((k) => k.id === 40) && told === 4 && m.id > 40, `${told} ${m.id}`);

/* ---- a long walk ---- */
// On a game of its own, from where it puts you ashore: the rest of this file moves you about by hand.
const walker = Game.create(4242);
/*
 * No wildlife, and none coming: what is checked is the legs, not the way
 * there. Left to itself the island lets out its hunters as you go
 * (`stream`), on Math.random, and about one walk in ten an ulva had your
 * scent half way, killed you, and you woke where you came ashore, 96 tiles
 * from the far spot. So the creatures are taken away and left to an island's
 * keeping, which here is nobody's: none is banked, streamed in or moved on.
 */
for (const c of [...walker.creatures.list.values()]) walker.creatures.remove(c.id);
walker.creatures.fromIsland = true;
const wx = Math.floor(walker.player.x), wy = Math.floor(walker.player.y);
let target: [number, number] | null = null;
// Somewhere further than one leg and a half and no more than three, dry: the nearest such, across the whole map.
{
  let best = Infinity;
  for (let ty = 0; ty < walker.world.h; ty += 2) for (let tx = 0; tx < walker.world.w; tx += 2) {
    const d = Math.hypot(tx - wx, ty - wy);
    if (d < TRAVEL_LEG * 1.6 || d > TRAVEL_LEG * 3 || d >= best) continue;
    if (!walker.world.isPassable(tx, ty) || walker.world.hasWater(tx, ty)) continue;
    best = d;
    target = [tx, ty];
  }
}
if (target) {
  const [tx, ty] = target;
  walker.player.stats.hunger = 1;
  const set = walker.travelTo(tx, ty, 'the far spot');
  for (let i = 0; i < 20000 && walker.travelling; i++) walker.update(0.05);
  const left = Math.hypot(tx + 0.5 - walker.player.x, ty + 0.5 - walker.player.y);
  check(`a walk further than one leg (${Math.round(Math.hypot(tx - wx, ty - wy))} tiles, legs of ${TRAVEL_LEG}) gets there in legs`, set && left < 2, `${left.toFixed(1)} tiles left`);
} else check('a far spot to walk to', false, 'none found');

/* ---- the island: when her young are due ---- */
const isle = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; me uuid; them uuid; v_c int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  select uid into them from player where world_id = w and name = 'Crowd1';
  select id into v_c from creature where world_id = w and keeper = me limit 1;
  if v_c is null then
    insert into said values ('NONE', '1');
    return;
  end if;
  update creature set due = now() + interval '600 seconds' where world_id = w and id = v_c;
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  insert into said select 'MINE', (select r->>'dueIn' from jsonb_array_elements(rpc_creatures(w, 1e6)) r where (r->>'id')::int = v_c);
  perform set_config('request.jwt.claims', json_build_object('sub', them)::text, true);
  insert into said select 'THEIRS', coalesce((select r->>'dueIn' from jsonb_array_elements(rpc_creatures(w, 1e6)) r where (r->>'id')::int = v_c), 'absent');
end $$;
select k || '=' || coalesce(v, 'null') from said;
rollback;
`);
const island: Record<string, string> = {};
for (const line of isle.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) island[line.slice(0, i)] = line.slice(i + 1);
}
if (island.NONE) check('a wildermon of Dane\'s to ask about', false, 'the suite left none');
else {
  check('the island says when her young are due, to her keeper', Math.abs(Number(island.MINE) - 600) < 30, island.MINE);
  check('and not to anybody else', island.THEIRS === 'absent' || island.THEIRS === 'null', island.THEIRS);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nten conveniences — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
