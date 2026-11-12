/**
 * Improve and repair, one window (`src/game/mending.ts`, `src/ui/panels/mend.ts`; `private.job_follow`,
 * `private.improve_stock` on the island).
 *
 * Asked for: "a single custom UI for Improving and Repairing. One section to queue repairing all held equipment
 * or using held ancient whetstones. For improving item a comprehensive interface to show material needed/held to
 * improve and a way to bulk queue improve&repair cycles". What this asks:
 *
 * Of the browser's rules, with no island:
 *   * held equipment is what is loose in the pack and improvable or worn: not stock, not what is in a bag;
 *   * Repair all goes the most damaged first, and Hone all the same, no more than the whetstones held;
 *   * every kind of stock a pass takes is listed with what is carried, a kind being its item and its material;
 *   * a pass held to one kind draws that kind and never another, and is refused "Out of iron lump." when it is gone;
 *   * the passes ahead are as many as the chosen kind allows, each from where the last left the piece;
 *   * a run of cycles stops at the first of its count, its stock and its target, and the count and the stock are exact.
 *
 * Of the island, in one transaction rolled back:
 *   * a run held to iron lumps on a hatchet of no metal in particular, with copper lumps at hand, uses every iron
 *     lump and no copper, and stops "Out of iron lump.";
 *   * a run of 12 cycles uses 12 lumps exactly however many repairs come between, repairs the piece when a failed
 *     pass leaves it over 10, and never leaves it over 10;
 *   * Repair all repairs every damaged piece of held equipment to nought, the most damaged first, and leaves stock
 *     and what is in a bag alone;
 *   * Hone all hones the most damaged pieces, a whetstone each, until the whetstones are gone;
 *   * and both sides say the same: the refusal, the goes a repair takes, and the door takes the new target keys.
 *
 *   npx esbuild supabase/test/mending.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/mending.mjs && node node_modules/.cache/mending.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { IMPROVE_DAMAGE, improvable, lockFor, lockTakes, outOfSaid, stockFor, stockKinds } from '../../src/game/improve';
import { cyclePlan, heldEquipment, honeQueue, passesAhead, repairGoes, repairQueue } from '../../src/game/mending';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ---- the browser's rules ------------------------------------------------------------------------- */

const g = Game.create(4242, 64);
g.inventory.items.length = 0;
g.skills.values.set('blacksmithing', 30);
g.skills.values.set('repair', 30);
const axe = g.inventory.add('hatchet', { ql: 20 });
g.inventory.add('file', { ql: 50 });
g.inventory.add('whetstone', { ql: 50 });
const iron = g.inventory.add('iron_lump', { ql: 20, count: 3 });
g.inventory.add('copper_lump', { ql: 10, count: 6 });
const kinds = stockKinds(g, axe);
check('a hatchet of no metal: every kind of lump at hand, by item, with what is carried',
  kinds.map((k) => `${k.lock.stock}:${k.carried}`).sort().join(',') === 'copper_lump:6,iron_lump:3', kinds.map((k) => `${k.lock.stock}:${k.carried}`).join(','));
const ironLock = lockFor(iron);
check('a kind is its item and its material', ironLock.stock === 'iron_lump' && ironLock.stockOf === 'Iron', JSON.stringify(ironLock));
check('a lock takes its own kind and no other', lockTakes(ironLock, iron) && !lockTakes(ironLock, { id: 'copper_lump' }) && !lockTakes(ironLock, { id: 'iron_ingot' }));
const what = improvable('hatchet');
const drawn = what ? stockFor(g, what.material, undefined, ironLock) : undefined;
check('held to iron: the stack drawn is iron, though copper is poorer', drawn?.item.id === 'iron_lump', drawn?.item.id ?? 'none');
const freeDrawn = what ? stockFor(g, what.material, undefined) : undefined;
check('unheld: the poorest at hand, as ever', freeDrawn?.item.id === 'copper_lump', freeDrawn?.item.id ?? 'none');

const ahead = passesAhead(g, axe, ironLock);
check('passes ahead: as many as the iron at hand', ahead.length === 3, String(ahead.length));
check('each pass from where the last left it, one lump fewer after each',
  ahead.every((r, i) => r.to > r.from && (i === 0 ? r.from === axe.ql : r.from === ahead[i - 1].to) && r.left === 3 - r.n), JSON.stringify(ahead.map((r) => [r.from.toFixed(2), r.to.toFixed(2), r.left])));

const byStock = cyclePlan(g, axe, ironLock, 10);
check('10 cycles held to 3 iron lumps: stops out of iron after 3 passes', byStock.stop === 'stock' && byStock.passes === 3, `${byStock.stop} ${byStock.passes}`);
const byCount = cyclePlan(g, axe, lockFor({ id: 'copper_lump' }), 2);
check('2 cycles held to 6 copper lumps: stops at the count', byCount.stop === 'count' && byCount.passes === 2, `${byCount.stop} ${byCount.passes}`);
const byTarget = cyclePlan(g, axe, lockFor({ id: 'copper_lump' }), 6, Math.ceil(axe.ql + 0.5));
check('a target just above: stops at the target first', byTarget.stop === 'target' && byTarget.passes < 6 && (byTarget.toTarget ?? 99) >= 1, `${byTarget.stop} ${byTarget.passes}`);

// Out of the kind it is held to: refused, in the island's words.
const improve = ACTION_BY_ID.get('improve_item');
g.inventory.remove(iron.uid, 3);
const held: Target = { kind: 'item', uid: axe.uid, stock: 'iron_lump', stockOf: 'Iron' };
const out = improve?.check?.(held, g) ?? null;
check('out of iron with copper at hand: refused, not the copper', out === outOfSaid(ironLock) && out === 'Out of iron lump.', out ?? 'allowed');
check('unheld, the same pack: allowed (the copper)', (improve?.check?.({ kind: 'item', uid: axe.uid }, g) ?? null) === null);

// Held equipment, Repair all and Hone all.
const g2 = Game.create(4243, 64);
g2.inventory.items.length = 0;
g2.skills.values.set('repair', 30);
const cap = g2.inventory.add('leather_cap', { ql: 30 });
const pick = g2.inventory.add('pickaxe', { ql: 30 });
const shovel = g2.inventory.add('shovel', { ql: 30 });
const lump = g2.inventory.add('iron_lump', { ql: 30 });
cap.dmg = 30;
pick.dmg = 12;
shovel.dmg = 5;
lump.dmg = 20;
g2.equip('head', cap.uid);
const gear = heldEquipment(g2).map((it) => it.id);
check('held equipment: the worn cap, the pickaxe and the shovel; not the lump', gear.join(',') === 'leather_cap,pickaxe,shovel', gear.join(','));
check('Repair all: the most damaged first', repairQueue(g2).map((it) => it.id).join(',') === 'leather_cap,pickaxe,shovel', repairQueue(g2).map((it) => it.id).join(','));
check('Hone all with none held: nothing', honeQueue(g2).length === 0);
g2.inventory.add('ancient_whetstone', { count: 2 });
check('Hone all with 2 whetstones: the 2 most damaged', honeQueue(g2).map((it) => it.id).join(',') === 'leather_cap,pickaxe', honeQueue(g2).map((it) => it.id).join(','));

/* ---- the island ------------------------------------------------------------------------------------ */

const U = 'a9c1e000-0000-4000-8000-0000000000d4';
const dmgs = [0.5, 5, 12.3, 30, 99];
const outAll = psql(`
discard temp;
begin;
select setseed(0.31);
create temp table said (k text, v text);
-- Every go of the job in hand comes due, one a call, until it is done or there have been this many.
create or replace function pg_temp.run(w uuid, u uuid, most int) returns int language plpgsql as $r$
declare k int := 0;
begin
  while k < most and exists (select 1 from player where world_id = w and uid = u and act is not null) loop
    update player set act_ends = now() - interval '1 second', body_at = now(),
           stats = coalesce(stats, '{}'::jsonb) || '{"stamina": 1, "hunger": 1, "thirst": 1}'::jsonb
     where world_id = w and uid = u;
    perform settle(w, u);
    k := k + 1;
  end loop;
  return k;
end $r$;
do $t$
declare w uuid; u uuid := '${U}'; axe bigint; sword bigint; cap bigint; pick bigint; shovel bigint; lump bigint; bag bigint; saw bigint;
        m0 bigint; seen text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Mending', 979, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mender');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'blacksmithing', 30), (w, u, 'weaponsmithing', 40),
    (w, u, 'repair', 30) on conflict (world_id, uid, id) do update set value = excluded.value;

  -- Held to iron lumps, with copper at hand.
  axe := give(w, u, 'hatchet', 1, 20);
  perform give(w, u, 'file', 1, 50);
  perform give(w, u, 'whetstone', 1, 50);
  perform give(w, u, 'iron_lump', 3, 20);
  perform give(w, u, 'copper_lump', 6, 10);
  m0 := coalesce((select max(n) from event where world_id = w), 0);
  insert into said values ('A_ASK', (rpc_act(w, 'improve_item', jsonb_build_object('kind', 'item', 'uid', axe, 'mend', true,
    'stock', 'iron_lump', 'stockOf', 'Iron'), 10))->>'started');
  insert into said values ('A_RUN', pg_temp.run(w, u, 200)::text);
  insert into said select 'A_IRON', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'iron_lump';
  insert into said select 'A_COPPER', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'copper_lump';
  insert into said select 'A_SAID', coalesce(string_agg(text, ' | ' order by n), '') from event where world_id = w and uid = u and n > m0;
  insert into said values ('A_REFUSE', coalesce(act_refusal(w, u, 'improve_item',
    jsonb_build_object('kind', 'item', 'uid', axe, 'stock', 'iron_lump', 'stockOf', 'Iron')), 'none'));
  insert into said values ('A_IDLE', coalesce((select act from player where world_id = w and uid = u), 'idle'));

  -- Twelve cycles, with repairs between: twelve lumps, no more, and never left over 10.
  update item set dmg = 0 where world_id = w and holder_uid = u;
  update item set ql = 1 where world_id = w and holder_uid = u and def in ('file', 'whetstone');
  sword := give(w, u, 'long_sword', 1, 20);
  perform give(w, u, 'tin_lump', 40, 20);
  m0 := coalesce((select max(n) from event where world_id = w), 0);
  insert into said values ('B_ASK', (rpc_act(w, 'improve_item', jsonb_build_object('kind', 'item', 'uid', sword, 'mend', true,
    'stock', 'tin_lump', 'stockOf', 'Tin'), 12))->>'started');
  insert into said values ('B_RUN', pg_temp.run(w, u, 400)::text);
  insert into said select 'B_USED', (40 - coalesce(sum(count), 0))::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'tin_lump';
  insert into said select 'B_PASSES', count(*)::text from event where world_id = w and uid = u and n > m0
     and (text like 'Improved: long sword%' or text like 'Improve failed: long sword%');
  insert into said select 'B_FAILS', count(*)::text from event where world_id = w and uid = u and n > m0 and text like 'Improve failed: long sword%';
  insert into said select 'B_REPAIRED', count(*)::text from event where world_id = w and uid = u and n > m0 and text like 'Fully repaired: long sword%';
  -- The damage after each failed pass, and whether any pass was taken with the piece over 10.
  select string_agg(substring(text from ', ([0-9.]+) damage'), ',' order by n) into seen from event
   where world_id = w and uid = u and n > m0 and text like 'Improve failed: long sword%';
  insert into said values ('B_FAILDMG', coalesce(seen, ''));
  insert into said select 'B_DMG', round(dmg::numeric, 2)::text from item where id = sword;
  insert into said values ('B_IDLE', coalesce((select act from player where world_id = w and uid = u), 'idle'));

  -- Repair all: the worn cap, a pickaxe and a shovel; a damaged lump and a saw in a bag left alone.
  update item set dmg = 0 where world_id = w and holder_uid = u;
  cap := give(w, u, 'leather_cap', 1, 30);
  pick := give(w, u, 'pickaxe', 1, 30);
  shovel := give(w, u, 'shovel', 1, 30);
  lump := give(w, u, 'iron_lump', 1, 30);
  bag := give(w, u, 'satchel', 1, 30);
  saw := give(w, u, 'saw', 1, 30);
  update item set holder = 'bag', inside = bag where id = saw;
  update player set equipped = jsonb_build_object('head', cap) where world_id = w and uid = u;
  update item set dmg = 30 where id = cap;
  update item set dmg = 12 where id = pick;
  update item set dmg = 5 where id = shovel;
  update item set dmg = 20 where id in (lump, saw);
  insert into said select 'HELD', string_agg(def, ',' order by dmg desc, id) from private.held_gear(w, u) where dmg > 0;
  m0 := coalesce((select max(n) from event where world_id = w), 0);
  insert into said values ('C_ASK', (rpc_act(w, 'repair_item', jsonb_build_object('kind', 'item', 'uid', cap, 'all', 3),
    private.repair_goes(w, u, 30)))->>'started');
  insert into said values ('C_RUN', pg_temp.run(w, u, 400)::text);
  insert into said select 'C_DMG', string_agg(def || ':' || round(dmg::numeric, 1), ',' order by id) from item where id in (cap, pick, shovel, lump, saw);
  insert into said select 'C_ORDER', string_agg(substring(text from 'Fully repaired: ([a-z ]+),'), ',' order by n) from event
   where world_id = w and uid = u and n > m0 and text like 'Fully repaired:%';

  -- Hone all: two whetstones, three damaged pieces.
  update item set dmg = 30 where id = cap;
  update item set dmg = 12 where id = pick;
  update item set dmg = 5 where id = shovel;
  perform give(w, u, 'ancient_whetstone', 2, 30);
  insert into said values ('D_ASK', (rpc_act(w, 'hone_whetstone', jsonb_build_object('kind', 'item', 'uid', cap, 'all', 2), 1))->>'started');
  insert into said values ('D_RUN', pg_temp.run(w, u, 50)::text);
  insert into said select 'D_DMG', string_agg(def || ':' || round(dmg::numeric, 1), ',' order by id) from item where id in (cap, pick, shovel);
  insert into said select 'D_LEFT', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'ancient_whetstone';

  -- Both sides' words and numbers.
  insert into said values ('OUT_IRON', private.out_of_said('{"stock": "iron_lump", "stockOf": "Iron"}'));
  insert into said values ('OUT_OAK', private.out_of_said('{"stock": "plank", "stockOf": "Oak"}'));
  insert into said select 'GOES', string_agg(private.repair_goes(w, u, d)::text, ',' order by o)
    from unnest(array[${dmgs.join(', ')}]::double precision[]) with ordinality t(d, o);
  insert into said values ('DOOR', coalesce(private.arg_why('{"kind": "item", "uid": 3, "mend": true, "stock": "iron_lump", "stockOf": "Iron", "upto": 60}'::jsonb,
    private.spec_target(), 'p_target'), 'taken') || ' / ' || coalesce(private.arg_why('{"kind": "item", "uid": 3, "all": 4}'::jsonb, private.spec_target(), 'p_target'), 'taken'));
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(outAll.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('island: a run held to iron lumps is taken', at('A_ASK') === 'true', at('A_ASK'));
check('island: it uses every iron lump and no copper', at('A_IRON') === '0' && at('A_COPPER') === '6', `iron ${at('A_IRON')}, copper ${at('A_COPPER')}`);
check('island: and stops "Out of iron lump.", idle', at('A_SAID').includes('Out of iron lump.') && at('A_IDLE') === 'idle', at('A_SAID'));
check('island: refused in the browser\'s words', at('A_REFUSE') === out, `island "${at('A_REFUSE')}", browser "${out}"`);

check('island: 12 cycles taken', at('B_ASK') === 'true', at('B_ASK'));
check('island: 12 lumps used, 12 passes, however many repairs between', at('B_USED') === '12' && at('B_PASSES') === '12', `used ${at('B_USED')}, passes ${at('B_PASSES')}, run ${at('B_RUN')} goes`);
const failDmg = at('B_FAILDMG').split(',').filter(Boolean).map(Number);
check('island: a failed pass that left it over 10 was followed by a repair', Number(at('B_REPAIRED')) >= 1 && failDmg.some((d) => d > IMPROVE_DAMAGE),
  `fails ${at('B_FAILS')}, damage after each ${at('B_FAILDMG')}, repaired ${at('B_REPAIRED')}`);
check('island: never a pass with it over 10 (no fail lands past 10 + 8), and it ends at 10 or under, idle',
  failDmg.every((d) => d <= IMPROVE_DAMAGE + 8.01) && Number(at('B_DMG')) <= IMPROVE_DAMAGE && at('B_IDLE') === 'idle', `${at('B_DMG')} ${at('B_IDLE')}`);

check('island: held equipment, most damaged first: the worn cap, the pickaxe, the shovel; not the lump, not the saw in the bag',
  at('HELD') === 'leather_cap,pickaxe,shovel', at('HELD'));
check('island: Repair all repairs all three to nought, and leaves the lump and the bagged saw',
  at('C_DMG') === 'leather_cap:0.0,pickaxe:0.0,shovel:0.0,iron_lump:20.0,saw:20.0', at('C_DMG'));
check('island: in the order the browser shows', at('C_ORDER') === 'leather cap,pickaxe,shovel', at('C_ORDER'));
check('island: Hone all with 2 whetstones hones the 2 most damaged, and uses both',
  at('D_DMG') === 'leather_cap:0.0,pickaxe:0.0,shovel:5.0' && at('D_LEFT') === '0', `${at('D_DMG')}, left ${at('D_LEFT')}`);

check('both sides: "Out of iron lump."', at('OUT_IRON') === outOfSaid({ stock: 'iron_lump', stockOf: 'Iron' }), at('OUT_IRON'));
check('both sides: "Out of plank (oak)."', at('OUT_OAK') === outOfSaid({ stock: 'plank', stockOf: 'Oak' }), `${at('OUT_OAK')} / ${outOfSaid({ stock: 'plank', stockOf: 'Oak' })}`);
const gr = Game.create(4244, 64);
gr.skills.values.set('repair', 30);
const tsGoes = dmgs.map((d) => repairGoes(gr, d)).join(',');
check('both sides: the goes a repair takes', at('GOES') === tsGoes, `island ${at('GOES')}, browser ${tsGoes}`);
check('the door takes mend, stock, stockOf and all', at('DOOR') === 'taken / taken', at('DOOR'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nimprove and repair — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
