/**
 * A failed craft damages its inputs (`faildamage.ts`), on both sides.
 *
 * Asked: "failing a craft damages all ingredients, more damage at 1ql and very
 * little at 99ql, but crafts like smelters dont automatically destroy it all".
 * Checked here, the island against the browser:
 *
 *   * the curve: the damage at QL 0, 1, 25, 50, 75, 99 and 100;
 *   * a stack: only the units a go would have used are damaged, the pile's
 *     damage up by that over its count, at QL 1, 50 and 99;
 *   * units the damage takes to the most there is are gone;
 *   * a litre input loses that share of its litres, the vessel left as it is;
 *   * a smelting recipe and a cooking one that used to lose everything damage
 *     instead, and nothing is handed back;
 *   * a Tailor's Nothing Wasted spares the damage, an Artisan's Keep the Stone
 *     the gem, a Smith's Second Heat the casting;
 *   * at the anvil a failed piece damages its casting and a failed strike its
 *     lump; a failed brew damages what would have gone in and loses the barrel
 *     that share of its water;
 *   * and every one of them says so in the same words on both sides.
 *
 * Every check fails, on purpose. Runs against the database the suite leaves
 * behind, rolled back.
 *
 *   npx esbuild supabase/test/faildamage.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/faildamage.mjs && node node_modules/.cache/faildamage.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { itemDef, type Item } from '../../src/game/items';
import { DAMAGE_MAX } from '../../src/game/limits';
import { FAIL_DAMAGE_AT_HIGH, FAIL_DAMAGE_AT_LOW, FAIL_DAMAGE_QL_HIGH, FAIL_DAMAGE_QL_LOW, failDamage } from '../../src/game/faildamage';
import { perksOf, type PerkDef } from '../../src/game/perks';
import { RECIPE_BY_ID, recipeAction, SPARED, STONE_KEPT } from '../../src/game/recipes';
import { SECOND_HEAT } from '../../src/game/anvil';
import { BREW_BY_ID } from '../../src/game/brewing';
import { GEMS } from '../../src/game/gems';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
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
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

const perk = (cls: string, name: string): PerkDef => {
  const p = perksOf(cls).find((x) => x.name === name);
  if (!p) throw new Error(`the ${cls} has no perk called ${name}`);
  return p;
};
const WASTED = perk('tailor', 'Nothing Wasted');
const STONE = perk('artisan', 'Keep the Stone');
const HEAT = perk('smith', 'Second Heat');
const RUBY = GEMS.find((g) => g.id === 'ruby')!;
const ALE = BREW_BY_ID.get('ale')!;
const QLS = [0, 1, 25, 50, 75, 99, 100];
/** The water in the barrel, and its QL, which the water's loss is by. */
const BARREL_L = 20;
const BARREL_QL = 40;
/** The damage already on the pile the go takes to the most there is. */
const WORN = 60;

/* What every case leaves behind, the same way on both sides: count:damage of each thing asked after, and what was said. */
const CASES = ['STACK1', 'STACK50', 'STACK99', 'GONE', 'LITRE', 'SMELT', 'COOK', 'PLAIN_SACK', 'SPARE', 'STONE', 'SMITH', 'HEAT', 'COINS', 'BREW'] as const;
type Case = typeof CASES[number];

/* ---- the island ------------------------------------------------------------------------- */

const count = (def: string): string =>
  `(select coalesce(sum(i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = ${q(def)})`;
const dmgOf = (def: string): string =>
  `(select coalesce(to_char(max(i.dmg), 'FM990.0000'), '-') from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = ${q(def)})`;
const litres = (def: string): string =>
  `(select coalesce(sum(item_litres(i) * i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = ${q(def)})`;
const said = `(select coalesce(string_agg(e.text, '#' order by e.n), '') from event e where e.world_id = w and e.uid = u and e.kind = 'event')`;
const state = (...defs: string[]): string => defs.map((d) => `${count(d)} || ':' || ${dmgOf(d)}`).join(` || ',' || `);
const record = (k: Case, ...defs: string[]): string =>
  `insert into said values (${q(k)}, ${state(...defs)} || '|' || ${said});
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def <> smith_tool();
  delete from event where world_id = w and uid = u;`;
const craft = (r: string, uid: string): string => `perform perform_craft(w, u, ${q(r)}, jsonb_build_object('kind', 'item', 'uid', ${uid}))`;
const newest = (def: string): string =>
  `(select i.id from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = ${q(def)} order by i.id desc limit 1)`;
const atAnvil = (uid: string): string => `jsonb_build_object('kind', 'anvil', 'id', v_anvil, 'itemUid', ${uid})`;
const hold = (cls: string, ...ids: string[]): string =>
  `update player set craft_class = ${q(cls)} where world_id = w and uid = u;
  perform pg_temp.hold(w, u, array[${ids.map(q).join(', ')}]::text[])`;

const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.hold(w uuid, u uuid, ids text[]) returns jsonb language plpgsql as $f$
begin
  delete from player_node where world_id = w and uid = u;
  insert into player_node (world_id, uid, node) select w, u, x from unnest(ids) x;
  return class_fold(w, u);
end $f$;
-- Every check fails.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
   p_tool_ql double precision default 0, p_ease double precision default 0)
   returns boolean language sql as 'select false';

insert into said select 'CURVE', string_agg(fail_damage(x)::text, ',' order by o)
  from unnest(array[${QLS.join(', ')}]::double precision[]) with ordinality as t(x, o);
insert into said values ('CONSTS', fail_damage_at_low() || ',' || fail_damage_at_high() || ',' || fail_damage_ql_low() || ',' || fail_damage_ql_high());
insert into said values ('COLUMN', (select count(*)::text from information_schema.columns where table_name = 'recipe' and column_name = 'consume_on_fail')
  || ',' || (select count(*)::text from recipe_gives where kind = 'salvage'));

do $$
declare w uuid; u uuid; tx int; ty int; v_anvil bigint; v_barrel bigint; v_id bigint;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  for tx in 0..15 loop for ty in 0..15 loop
    perform land_set_height(w, tx, ty, 40); perform land_set_dirt(w, tx, ty, 20);
    perform land_set_tile(w, tx, ty, tile_id('Dirt')); perform land_set_data(w, tx, ty, 0);
  end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from item where world_id = w and holder = 'ground' and gx between 0 and 15 and gy between 0 and 15;
  delete from item where world_id = w and holder = 'crate'
     and crate in (select c.id from crate c where c.world_id = w and c.x between 0 and 15 and c.y between 0 and 15);
  delete from item where world_id = w and holder in ('trap', 'furniture')
     and placed in (select id from placed where world_id = w and x between 4 and 15 and y between 4 and 15);
  delete from placed where world_id = w and x between 4 and 15 and y between 4 and 15;
  delete from player_node where world_id = w and uid = u;
  delete from event where world_id = w and uid = u;
  insert into item (world_id, holder, holder_uid, def, ql, extra) values (w, 'player', u, smith_tool(), 50, 'Iron');
  update player set x = 9.5, y = 9.5, act = null, act_target = null, act_started = null, act_ends = null,
         act_left = null, act_goes = null, act_queue = '[]', craft_class = 'tailor', combat_class = null,
         class_mul = null, level_h = null, rested = 0, boons = '[]'::jsonb, body_at = now(), swim_at = now(),
         equipped = '{}'::jsonb, craft_from_stores = true, craft_spare_rare = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'anvil', 'iron', 9, 10, 0, 0, 9.25, 10.25, 50, u) returning id into v_anvil;

  /* ---- A stack: one log of three used, at QL 1, 50 and 99. ---- */
  perform give(w, u, 'carving_knife', 1, 50);
  perform give(w, u, 'log', 3, 1, 'Pine');
  ${craft('make_mallet', newest('log'))};
  ${record('STACK1', 'log')}
  perform give(w, u, 'carving_knife', 1, 50);
  perform give(w, u, 'log', 3, 50, 'Pine');
  ${craft('make_mallet', newest('log'))};
  ${record('STACK50', 'log')}
  perform give(w, u, 'carving_knife', 1, 50);
  perform give(w, u, 'log', 3, 99, 'Pine');
  ${craft('make_mallet', newest('log'))};
  ${record('STACK99', 'log')}

  /* ---- Taken to the most there is: the one used is gone, the rest as they were. ---- */
  perform give(w, u, 'carving_knife', 1, 50);
  v_id := give(w, u, 'log', 3, 1, 'Pine');
  update item set dmg = ${WORN} where id = v_id;
  ${craft('make_mallet', 'v_id')};
  ${record('GONE', 'log')}

  /* ---- A litre input: dough, its water by the bucket's QL. ---- */
  perform give(w, u, 'flour', 2, 1);
  perform give(w, u, 'water_bucket', 1, 1);
  ${craft('make_dough', newest('flour'))};
  insert into said values ('LITRES', ${litres('water_bucket')}::text);
  ${record('LITRE', 'flour', 'water_bucket', 'dough')}

  /* ---- Smelting and cooking, which used to lose everything. ---- */
  perform give(w, u, 'copper_lump', 3, 1);
  perform give(w, u, 'tin_lump', 1, 99);
  ${craft('make_bronze', newest('copper_lump'))};
  ${record('SMELT', 'copper_lump', 'tin_lump', 'bronze_lump')}
  perform give(w, u, 'clay_bowl', 1, 50);
  perform give(w, u, 'milk_bucket', 1, 20);
  ${craft('make_cheese', newest('milk_bucket'))};
  ${record('COOK', 'milk_bucket', 'bucket', 'whey_bucket', 'cheese')}

  /* ---- Nothing Wasted, and a sack without it. ---- */
  perform give(w, u, 'needle', 1, 50);
  perform give(w, u, 'cloth', 2, 1);
  ${craft('make_sack', newest('cloth'))};
  ${record('PLAIN_SACK', 'cloth')}
  ${hold('tailor', WASTED.id)};
  perform give(w, u, 'needle', 1, 50);
  perform give(w, u, 'cloth', 2, 1);
  ${craft('make_sack', newest('cloth'))};
  ${record('SPARE', 'cloth')}

  /* ---- Keep the Stone. ---- */
  ${hold('artisan', STONE.id)};
  perform give(w, u, 'file', 1, 50);
  perform give(w, u, 'gem', 1, 1, ${q(RUBY.name)});
  perform give(w, u, 'silver_lump', 1, 1);
  ${craft('set_focus', newest('silver_lump'))};
  ${record('STONE', 'gem', 'silver_lump')}

  /* ---- The anvil: a casting, Second Heat, and a strike. ---- */
  update player set craft_class = 'smith' where world_id = w and uid = u;
  perform pg_temp.hold(w, u, '{}');
  insert into item (world_id, holder, holder_uid, def, ql, count, extra, piece) values (w, 'player', u, 'casting', 1, 1, 'Iron', 'rake_head')
    returning id into v_id;
  perform act_perform(w, u, 'smith', ${atAnvil('v_id')});
  ${record('SMITH', 'casting', 'rake_head')}
  ${hold('smith', HEAT.id)};
  insert into item (world_id, holder, holder_uid, def, ql, count, extra, piece) values (w, 'player', u, 'casting', 1, 1, 'Iron', 'rake_head')
    returning id into v_id;
  perform act_perform(w, u, 'smith', ${atAnvil('v_id')});
  ${record('HEAT', 'casting', 'rake_head')}
  perform pg_temp.hold(w, u, '{}');
  perform give(w, u, 'coin_die', 1, 50);
  perform give(w, u, 'gold_lump', 2, 1);
  perform act_perform(w, u, 'strike_coins', ${atAnvil(newest('gold_lump'))});
  ${record('COINS', 'gold_lump', 'coin')}

  /* ---- A brew. ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, material, made_by, litres, liquid, since)
    values (w, 'furniture', 'barrel', 10, 9, 0, 0, 10.5, 9.5, ${BARREL_QL}, 'Oak', u, ${BARREL_L}, 'water', now()) returning id into v_barrel;
  perform give(w, u, ${q(ALE.input)}, ${ALE.count}, 1);
  perform act_perform(w, u, 'start_brew', jsonb_build_object('kind', 'furniture', 'id', v_barrel, 'brew', 'ale'));
  insert into said values ('BARREL', (select coalesce(liquid, 'none') || ':' || trim_scale(litres::numeric) from placed where id = v_barrel));
  ${record('BREW', ALE.input)}
end $$;
select k || '=' || v from said;
rollback;
`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => {
  const at = l.indexOf('=');
  return [l.slice(0, at), l.slice(at + 1)] as [string, string];
}));
const at = (k: string): string => isle.get(k) ?? '(nothing)';

/* ---- the browser ------------------------------------------------------------------------ */

const g = Game.create(4711);
g.skillCheck = () => false;
const pack = (): Item[] => g.inventory.items;
const clearPack = (): void => { pack().splice(0); g.log.length = 0; };
const browserState = (...defs: string[]): string => defs.map((d) => {
  const its = pack().filter((i) => i.id === d);
  const n = its.reduce((s, i) => s + i.count, 0);
  return `${n}:${its.length ? Math.max(...its.map((i) => i.dmg)).toFixed(4) : '-'}`;
}).join(',');
const browserSaid = (): string => g.log.filter((l) => l.kind === 'event').map((l) => l.text).join('#');
const here = new Map<string, string>();
const recordHere = (k: Case, ...defs: string[]): void => {
  here.set(k, `${browserState(...defs)}|${browserSaid()}`);
  clearPack();
};
const bench = (id: string, on: Item): void => {
  recipeAction(RECIPE_BY_ID.get(id)!).perform({ kind: 'item', uid: on.uid }, g);
};
clearPack();
g.setPerks({});

for (const [k, ql] of [['STACK1', 1], ['STACK50', 50], ['STACK99', 99]] as Array<[Case, number]>) {
  g.inventory.add('carving_knife', { ql: 50 });
  bench('make_mallet', g.inventory.add('log', { count: 3, ql, extra: 'Pine' }));
  recordHere(k, 'log');
}
g.inventory.add('carving_knife', { ql: 50 });
const worn = g.inventory.add('log', { count: 3, ql: 1, extra: 'Pine' });
worn.dmg = WORN;
bench('make_mallet', worn);
recordHere('GONE', 'log');

const flour = g.inventory.add('flour', { count: 2, ql: 1 });
g.inventory.add('water_bucket', { ql: 1 });
bench('make_dough', flour);
const litresHere = pack().filter((i) => i.id === 'water_bucket').reduce((s, i) => s + (i.charges ?? 0) * i.count, 0);
recordHere('LITRE', 'flour', 'water_bucket', 'dough');

const copper = g.inventory.add('copper_lump', { count: 3, ql: 1 });
g.inventory.add('tin_lump', { ql: 99 });
bench('make_bronze', copper);
recordHere('SMELT', 'copper_lump', 'tin_lump', 'bronze_lump');
g.inventory.add('clay_bowl', { ql: 50 });
bench('make_cheese', g.inventory.add('milk_bucket', { ql: 20 }));
recordHere('COOK', 'milk_bucket', 'bucket', 'whey_bucket', 'cheese');

g.inventory.add('needle', { ql: 50 });
bench('make_sack', g.inventory.add('cloth', { count: 2, ql: 1 }));
recordHere('PLAIN_SACK', 'cloth');
g.setPerks(WASTED.fx);
g.inventory.add('needle', { ql: 50 });
bench('make_sack', g.inventory.add('cloth', { count: 2, ql: 1 }));
recordHere('SPARE', 'cloth');

g.setPerks(STONE.fx);
g.inventory.add('file', { ql: 50 });
g.inventory.add('gem', { ql: 1, extra: RUBY.name });
bench('set_focus', g.inventory.add('silver_lump', { ql: 1 }));
recordHere('STONE', 'gem', 'silver_lump');

g.setPerks({});
const anvil = g.addAnvil(Math.floor(g.player.x), Math.floor(g.player.y), 0, 0, 'iron', 50);
const forge = (action: string, on: Item): void => {
  ACTION_BY_ID.get(action)!.perform({ kind: 'anvil', id: anvil.id, itemUid: on.uid } as Target, g);
};
g.inventory.add('hammer', { ql: 50 });
forge('smith', g.inventory.add('casting', { ql: 1, extra: 'Iron', piece: 'rake_head' }));
recordHere('SMITH', 'casting', 'rake_head');
g.setPerks(HEAT.fx);
g.inventory.add('hammer', { ql: 50 });
forge('smith', g.inventory.add('casting', { ql: 1, extra: 'Iron', piece: 'rake_head' }));
recordHere('HEAT', 'casting', 'rake_head');
g.setPerks({});
g.inventory.add('hammer', { ql: 50 });
g.inventory.add('coin_die', { ql: 50 });
forge('strike_coins', g.inventory.add('gold_lump', { count: 2, ql: 1 }));
recordHere('COINS', 'gold_lump', 'coin');

const barrel = g.addFurniture('barrel', Math.floor(g.player.x), Math.floor(g.player.y), 0, 0, BARREL_QL, [], 'Oak');
Object.assign(barrel, { liquid: 'water', litres: BARREL_L });
g.inventory.add(ALE.input, { count: ALE.count, ql: 1 });
ACTION_BY_ID.get('start_brew')!.perform({ kind: 'furniture', id: barrel.id, brew: 'ale' } as Target, g);
const barrelHere = `${barrel.liquid ?? 'none'}:${barrel.litres}`;
recordHere('BREW', ALE.input);

/* ---- the checks ------------------------------------------------------------------------- */

const name = (id: string): string => itemDef(id).name.toLowerCase();
const d = failDamage;
check(`the curve: +${FAIL_DAMAGE_AT_LOW} at QL ${FAIL_DAMAGE_QL_LOW} and below, +${FAIL_DAMAGE_AT_HIGH} at QL ${FAIL_DAMAGE_QL_HIGH} and above, the same numbers on both sides`,
  at('CURVE') === QLS.map(d).join(',') && d(0) === FAIL_DAMAGE_AT_LOW && d(1) === FAIL_DAMAGE_AT_LOW && d(99) === FAIL_DAMAGE_AT_HIGH
    && d(100) === FAIL_DAMAGE_AT_HIGH && d(50) === 26 && at('CONSTS') === [FAIL_DAMAGE_AT_LOW, FAIL_DAMAGE_AT_HIGH, FAIL_DAMAGE_QL_LOW, FAIL_DAMAGE_QL_HIGH].join(','),
  `island ${at('CURVE')} / ${at('CONSTS')}, browser ${QLS.map(d).join(',')}`);
check('the bench\'s consume_on_fail column and its salvage rows are gone from the island', at('COLUMN') === '0,0', at('COLUMN'));

const same = (k: Case, what: string, want: string): void => {
  check(`${what}, the same on both sides`, at(k) === here.get(k) && here.get(k) === want, `island "${at(k)}", browser "${here.get(k)}", wanted "${want}"`);
};
const dm = (n: number): string => n.toFixed(4);
for (const [k, ql] of [['STACK1', 1], ['STACK50', 50], ['STACK99', 99]] as Array<[Case, number]>) {
  same(k, `a failed mallet off three logs at QL ${ql} damages the one it would have used by ${d(ql)}, the pile by a third of that`,
    `3:${dm(d(ql) / 3)}|Failed: mallet. Inputs damaged: log ×1, +${d(ql)} damage.`);
}
same('GONE', `a log at ${WORN} damage taken past ${DAMAGE_MAX} is gone, the other two as they were`,
  `2:${dm(WORN)}|Failed: mallet. Inputs damaged: log ×1, destroyed.`);
const lost = Math.floor(2 * d(1) / DAMAGE_MAX + 0.5);
same('LITRE', `a failed dough damages its flour and loses ${lost} of its 2 L of water, the bucket undamaged`,
  `2:${dm(d(1))},1:${dm(0)},0:-|Failed: dough. Inputs damaged: flour ×2, +${d(1)} damage; water 2 L, ${lost} L lost.`);
check('and the water is gone from the bucket, on both sides', Number(at('LITRES')) === 5 - lost && litresHere === 5 - lost, `island ${at('LITRES')}, browser ${litresHere}`);
same('SMELT', 'a failed bronze no longer loses its lumps: each damaged by its own QL, nothing made',
  `3:${dm(d(1))},1:${dm(d(99))},0:-|Failed: bronze lump. Inputs damaged: copper lump ×3, +${d(1)} damage; tin lump ×1, +${d(99)} damage.`);
same('COOK', 'a failed cheese no longer loses its milk: the bucket of milk damaged, no bucket or whey handed back',
  `1:${dm(d(20))},0:-,0:-,0:-|Failed: cheese. Inputs damaged: ${name('milk_bucket')} ×1, +${d(20)} damage.`);
same('PLAIN_SACK', 'a failed sack damages its cloth', `2:${dm(d(1))}|Failed: sack. Inputs damaged: cloth ×2, +${d(1)} damage.`);
same('SPARE', `${WASTED.name} spares it`, `2:${dm(0)}|Failed: sack.#${SPARED}`);
same('STONE', `${STONE.name}: the gem undamaged, the silver damaged`,
  `1:${dm(0)},1:${dm(d(1))}|Failed: focus. Inputs damaged: silver lump ×1, +${d(1)} damage.#${STONE_KEPT}`);
same('SMITH', 'a failed rake head damages its casting and does not use it', `1:${dm(d(1))},0:-|Failed: rake head. Inputs damaged: casting ×1, +${d(1)} damage.`);
same('HEAT', `${HEAT.name} spares the casting`, `1:${dm(0)},0:-|Failed: rake head. ${SECOND_HEAT}`);
same('COINS', 'a failed strike damages one lump of two and spends none',
  `2:${dm(d(1) / 2)},0:-|Failed: coins, skill check. Inputs damaged: gold lump ×1, +${d(1)} damage.`);
const waterLost = Math.floor(ALE.litres * d(BARREL_QL) / DAMAGE_MAX + 0.5);
same('BREW', `a failed ale damages its ${name(ALE.input)} and loses ${waterLost} of the ${ALE.litres} L of water it would have taken`,
  `${ALE.count}:${dm(d(1))}|Failed: ale. Inputs damaged: ${name(ALE.input)} ×${ALE.count}, +${d(1)} damage; water ${ALE.litres} L, ${waterLost} L lost.`);
check('and the barrel holds the rest of its water, on both sides', at('BARREL') === `water:${BARREL_L - waterLost}` && barrelHere === at('BARREL'),
  `island ${at('BARREL')}, browser ${barrelHere}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`\n${bad.length} of ${ok.length + bad.length} failed`);
  process.exit(1);
}
console.log(`a failed craft damages its inputs — ${ok.length} of ${ok.length}`);
