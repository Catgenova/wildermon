/**
 * A stack let go over a crate rack fills the crates on it, one after another.
 *
 * Asked for: "Allow dragging inventory to a Crate shelf, where the crates on it
 * will fill one by one according to available space." A rack holds nothing of
 * its own, so a drop on one went nowhere; filling a rack meant opening each
 * crate in turn and counting what was left over by hand.
 *
 * `rack_put` is one ask. The same rack is built on both sides — four plank
 * crates on its first four spots, with room for five, none to speak of (it is
 * somebody else's), nine and fourteen — and both are asked the same things in
 * the same order: twenty ore, which is more than the first crate's room and
 * so runs on into the next ones, passing over the crate that is not yours;
 * forty more, which is more than all of what is left, so the rest stays in the
 * pack; and then the refusals — every crate full, a crate in the pack, a rack
 * out of reach and a rack with nothing on it. After each, what is in each crate,
 * what is in the pack and the one line it said, on both sides.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it,
 * off his deed so that a crate somebody else set down is not his to fill.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { crateCapacity, crateName, crateSpare, crateUnits, type PlacedCrate } from '../../src/game/crates';
import { furnitureCentre, furnitureName, rackDeck } from '../../src/game/furniture';

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

const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const HELD = (def: string): string =>
  `(select i.id from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def = '${def}' order by i.id desc limit 1)`;
const asDane = `select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false);`;

/* ---- the rack, on both sides ---------------------------------------------- */

// Off Dane's deed (Hoarding stands at 30,30), so whose a crate is is decided by who set it down.
const X = 40;
const Y = 40;
// Room in each of the four crates on spots 0..3, in the rack's order; the second is somebody else's.
const ROOM = [5, 6, 9, 14];
const THEIRS = 1;

const game = Game.create(4242);
game.crates.clear();
const rack = game.addFurniture('crate_shelf', X, Y, 0, 0, 20);
// A second rack beside it on the same tile, with nothing on it.
const bare = game.addFurniture('crate_shelf', X, Y, 2, 0, 20);
const deck = rackDeck(rack);
const crates: PlacedCrate[] = ROOM.map((room, n) => {
  const c = game.addCrate('plank', X, Y, deck[n][0], deck[n][1], [], false, 'pine');
  game.crateAdd(c, { uid: game.inventory.nextUid++, id: 'rock_shards', ql: 20, dmg: 0, count: crateCapacity(c) - room });
  if (n === THEIRS) c.mine = false;
  return c;
});
const [cx, cy] = furnitureCentre(rack);
const STAND = [cx + 0.05, cy - 0.1];
game.player.x = STAND[0];
game.player.y = STAND[1];
const ore = game.inventory.add('iron_ore', { ql: 40, count: 60 });

// Where Dane stood, to put him back after: the suite runs on in this database.
const WAS = psql(`select x || ',' || y from player where world_id = ${W} and name = 'Dane'`);

psql(`
do $$
declare w uuid; u uuid; them uuid;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  -- Somebody who is not Dane, and need not be on the island: whoever set a crate down is all that is asked of them.
  them := '99999999-9999-9999-9999-999999999999';
  delete from item i where i.world_id = w and i.holder = 'crate';
  delete from crate where world_id = w;
  delete from placed where world_id = w and kind = 'furniture' and sub = 'crate_shelf';
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by, ql)
    values (w, 'furniture', 'crate_shelf', ${X}, ${Y}, 0, 0, ${cx}, ${cy}, u, 20);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by, ql)
    values (w, 'furniture', 'crate_shelf', ${X}, ${Y}, 2, 0, ${furnitureCentre(bare)[0]}, ${furnitureCentre(bare)[1]}, u, 20);
  ${ROOM.map((_, n) => `
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by, material)
    values (w, ${n + 1}, 'plank', ${X}, ${Y}, ${deck[n][0]}, ${deck[n][1]}, false, ${n === THEIRS ? 'them' : 'u'}, 'pine');
  insert into item (world_id, holder, crate, def, ql, count)
    select w, 'crate', ${n + 1}, 'rock_shards', 20, crate_capacity(c) - ${ROOM[n]} from crate c where c.world_id = w and c.id = ${n + 1};`).join('')}
  update player set body_at = now(), x = ${STAND[0]}, y = ${STAND[1]}, level = 0 where world_id = w and uid = u;
  delete from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def in ('iron_ore', 'crate_plank');
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'iron_ore', 40, 60);
end $$;`);
const RACK = psql(`select id from placed where world_id = ${W} and sub = 'crate_shelf' and sx = 0`);
const BARE = psql(`select id from placed where world_id = ${W} and sub = 'crate_shelf' and sx = 2`);

check('the same rack on both sides',
  psql(`select string_agg(crate_spare(${W}, c)::text, ',' order by c.sy, c.sx) from rack_crates(${W}, (select p from placed p where p.id = ${RACK})) c`)
    === crates.map(crateSpare).join(',') && game.cratesOn(rack).map((c) => c.id).join(',') === crates.map((c) => c.id).join(','),
  `room ${crates.map(crateSpare).join(', ')} in rack order, and the second is somebody else's`);

const def = ACTION_BY_ID.get('rack_put');
if (!def) throw new Error('there is no rack_put');
const said: string[] = [];
game.logMsg = ((text: string) => { said.push(text); }) as Game['logMsg'];

const theirRefusal = (def_: string, count: number, into: string): string =>
  psql(`select coalesce(act_refusal(${W}, ${DANE}, 'rack_put',
    jsonb_build_object('kind', 'item', 'uid', ${HELD(def_)}, 'count', ${count}, 'into', ${into})), 'ALLOWED')`);
const theirCrates = (): string =>
  psql(`select string_agg(crate_units(${W}, c.id)::text, ',' order by c.id) from crate c where c.world_id = ${W}`);
const theirPack = (): string =>
  psql(`select coalesce(sum(count), 0) from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def = 'iron_ore'`);
const theirLine = (): string => psql(`select text from event where world_id = ${W} and uid = ${DANE} order by n desc limit 1`);
const put = (count: number): void => {
  const t: Target = { kind: 'item', uid: ore.uid, count, into: rack.id };
  const mine = def.check?.(t, game) ?? 'ALLOWED';
  const theirs = theirRefusal('iron_ore', count, RACK);
  check(`${count} ore onto the rack is allowed`, mine === 'ALLOWED' && theirs === 'ALLOWED', `browser "${mine}", island "${theirs}"`);
  def.perform?.(t, game);
  psql(`${asDane} select rpc_act(${W}, 'rack_put', jsonb_build_object('kind', 'item', 'uid', ${HELD('iron_ore')}, 'count', ${count}, 'into', ${RACK}), 1);`);
};
const units = (): string => crates.map(crateUnits).join(',');
const name = crateName(crates[3]).toLowerCase();
const rackName = furnitureName(rack).toLowerCase();

/* ---- twenty: more than the first crate has room for ----------------------- */
const before = crates.map(crateUnits);
put(20);
// Five into the first, the second passed over, nine into the third and the six left into the fourth.
const want1 = [5, 0, 9, 6];
check('twenty fill the crates in the rack\'s order, passing over the one that is not yours',
  units() === before.map((b, n) => b + want1[n]).join(',') && theirCrates() === units(),
  `browser ${units()}, island ${theirCrates()} (from ${before.join(',')})`);
check('and nothing is left in the pack of the twenty', game.inventory.count('iron_ore') === 40 && theirPack() === '40',
  `browser ${game.inventory.count('iron_ore')}, island ${theirPack()}`);
check('and one line says how many went into how many crates', said[said.length - 1] === theirLine()
  && theirLine() === `Stored: 20 × iron ore in 3 crates on ${rackName}.`,
  `browser "${said[said.length - 1]}", island "${theirLine()}"`);

/* ---- forty: more than all the room left ----------------------------------- */
put(40);
check('forty fill the eight left in the last crate', crateSpare(crates[3]) === 0 && theirCrates() === units(),
  `browser ${units()}, island ${theirCrates()}`);
check('and the other thirty-two stay in the pack', game.inventory.count('iron_ore') === 32 && theirPack() === '32',
  `browser ${game.inventory.count('iron_ore')}, island ${theirPack()}`);
check('and the line says how many of how many, the one crate by name, and what did not fit',
  said[said.length - 1] === theirLine()
  && theirLine() === `Stored: 8 of 40 × iron ore in ${name} on ${rackName}. 32 did not fit.`,
  `browser "${said[said.length - 1]}", island "${theirLine()}"`);

/* ---- and the refusals ----------------------------------------------------- */
const refused = (what: string, mine: string, theirs: string, want: string): void =>
  check(what, mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);

const ask = (t: Target): string => def.check?.(t, game) ?? 'ALLOWED';
refused('every crate it may go in is full, and the one it may not is named',
  ask({ kind: 'item', uid: ore.uid, count: 32, into: rack.id }), theirRefusal('iron_ore', 32, RACK),
  `Not yours: ${crateName(crates[THEIRS]).toLowerCase()}, nothing goes in. Others full.`);

// Nobody's crate is somebody else's now: every one of them simply full.
crates[THEIRS].mine = undefined;
game.crateAdd(crates[THEIRS], { uid: game.inventory.nextUid++, id: 'rock_shards', ql: 20, dmg: 0, count: crateSpare(crates[THEIRS]) });
psql(`update crate set made_by = ${DANE} where world_id = ${W} and id = ${THEIRS + 1};
  update item set count = count + ${ROOM[THEIRS]} where world_id = ${W} and holder = 'crate' and crate = ${THEIRS + 1};`);
refused('a rack whose crates are all full says so',
  ask({ kind: 'item', uid: ore.uid, count: 32, into: rack.id }), theirRefusal('iron_ore', 32, RACK),
  `All crates on ${rackName} full.`);

refused('a rack with no crates on it says so',
  ask({ kind: 'item', uid: ore.uid, count: 32, into: bare.id }), theirRefusal('iron_ore', 32, BARE),
  `No crates on ${rackName}.`);

const crateItem = game.inventory.add('crate_plank', { ql: 20, extra: 'pine' });
psql(`insert into item (world_id, holder, holder_uid, def, ql, count, extra) values (${W}, 'player', ${DANE}, 'crate_plank', 20, 1, 'pine');`);
refused('a crate does not go in the crates on a rack',
  ask({ kind: 'item', uid: crateItem.uid, count: 1, into: rack.id }), theirRefusal('crate_plank', 1, RACK),
  'No crates inside crates.');

game.player.x = X + 5.5;
game.player.y = Y + 0.5;
psql(`update player set body_at = now(), x = ${X + 5.5}, y = ${Y + 0.5} where world_id = ${W} and uid = ${DANE};`);
refused('a rack out of reach is walked to rather than loaded from across the yard',
  ask({ kind: 'item', uid: ore.uid, count: 32, into: rack.id }), theirRefusal('iron_ore', 32, RACK),
  `Stand next to the ${rackName}.`);

/*
 * And a drop on a rack across the yard, on an island: the feet go first, as
 * they do for a drop on a crate (`intoStore`), and the island is asked once
 * they arrive, naming the rack. The drop itself is the page's (`storeAt` and
 * `dropOnWorld`), which hands a rack to `rack_put` and nothing else.
 */
const asked: Array<{ id: string; into?: number }> = [];
game.ask = (d, t) => {
  asked.push({ id: d.id, into: t.kind === 'item' ? t.into : undefined });
};
game.player.path = null;
game.requestAction(def, { kind: 'item', uid: ore.uid, count: 32, into: rack.id });
check('a drop on a rack across the yard walks to it first', asked.length === 0 && !!game.player.path,
  `${asked.length} asked before walking, ${game.player.path ? 'a path' : 'no path'}`);
for (let t = 0; t < 400 && (game.action || game.player.path); t++) game.update(0.2);
check('and asks the island to load that rack on arrival', asked.length === 1 && asked[0].id === 'rack_put' && asked[0].into === rack.id,
  JSON.stringify(asked));
game.ask = null;

// And tidied away: the racks, their crates, the crate in the pack and the ore, and Dane back where he stood.
psql(`
  delete from item i where i.world_id = ${W} and i.holder = 'crate';
  delete from crate where world_id = ${W};
  delete from placed where world_id = ${W} and kind = 'furniture' and sub = 'crate_shelf';
  delete from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def in ('iron_ore', 'crate_plank');
  update player set body_at = now(), x = ${WAS.split(',')[0]}, y = ${WAS.split(',')[1]} where world_id = ${W} and uid = ${DANE};`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`a rack fills crate by crate and leaves the rest in the pack, the same on both sides — ${ok.length} of ${ok.length}`);
