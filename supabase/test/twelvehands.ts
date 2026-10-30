/**
 * Twelve more hands on a settlement.
 *
 * Asked for off a second list of work only a player did. This asks, of both
 * sides, that each of the twelve is a species with its trade, may be set to
 * work a settlement and says what it does in the island's words; and that
 * set to work it does it: the smelter and the kiln emptied and charged, the
 * ashes raked and leached, a brew set going, supper cooked, a relic restored,
 * a planter sown, tended and harvested, and worms, a sprout, tar, wildflowers
 * and bare stone off their tiles.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { deedJobLine } from '../../src/game/creaturecrate';
import { cookRecipes, GATHER_DO, RESIN_TAPPED, SPECIES, TEND_JOBS, type Creature } from '../../src/game/creatures';
import { BREWS } from '../../src/game/brewing';
import { cropDef } from '../../src/game/farming';
import { packTreeData, TileType } from '../../src/world/tiles';
import { RESIN_TREE } from '../../src/game/actions';
import { greenOnTile, greenNow, GREEN_DAY } from '../../src/game/greening';
import { flowerSeason, flowersOn } from '../../src/world/flowers';
import { flowersHere } from '../../src/game/wildflowers';
import { SKEP, SKEP_REACH } from '../../src/game/bees';
import { POTTERY } from '../../src/game/kiln';
import { itemDef } from '../../src/game/items';

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

const HANDS: Array<[string, string]> = [
  ['forga', 'smelt'], ['potta', 'kiln'], ['cindra', 'ash'], ['hoppa', 'brew'], ['simma', 'cook'], ['relka', 'restore'],
  ['bedda', 'patch'], ['wurla', 'worm'], ['sprigga', 'sprout'], ['ambra', 'resin'], ['petta', 'flower'], ['scurra', 'scrub'],
];
const SEED = cropDef('wheat').seed;

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000c3';
const out = psql(`
discard temp;
begin;
-- Seed every harvest, as this was written for: the odds themselves are bracefeedseed's.
create or replace function harvest_seeds(p_chance double precision default seed_chance()) returns integer language sql volatile as $pin$ select (crop_yield(0))[1] $pin$;
create temp table said (k text, v text);
create temp table hand (species text, id int);
do $t$
declare w uuid; u uuid := '${MIRA}'; c creature; v_id int; v_p bigint; v_q bigint; v_load jsonb; v_n int; v_got text := '';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hands12', 172, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Twelvesend', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7201, 'plank', 17, 16, 0, 0, true, u);

  insert into said select 'TRADE:' || s.id, coalesce(s.gathers, '-') || '|' || worker_job_ported(coalesce(s.gathers, '-'))
    from species_def s where s.id in (${HANDS.map(([id]) => `'${id}'`).join(', ')});
  insert into hand select s, creature_spawn(w, s, 16.6, 16.6, 'active', now() - interval '60 days', u)
    from unnest(array[${HANDS.map(([id]) => `'${id}'`).join(', ')}]) s;
  insert into said select 'ASK:' || h.species, coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', h.id)), 'none') from hand h;
  update creature set mode = 'deed', stance = 'passive', hunger = 1, settled_at = now(), until = now(), leg_at = now(), leg_ends = now(),
         from_x = to_x, from_y = to_y
   where world_id = w and id in (select id from hand);
  insert into said select 'LINE:' || h.species, deed_job_line(c2) from hand h join creature c2 on c2.world_id = w and c2.id = h.id;
  update creature set mode = 'stored' where world_id = w and id in (select id from hand);
  insert into said values ('COOKS', array_to_string(tend_recipes('cook'), ','));
  insert into said values ('BREWS', array_to_string(brew_order(), ','));

  -- Forga: a smelter with two lumps made and room, three ore in the crate.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since, state, made_by)
    values (w, 'smelter', 19, 16, 0, 0, 19.75, 16.5, 50, 0, false, now(),
            jsonb_build_object('jobs', '[]'::jsonb, 'output', jsonb_build_array(jsonb_build_object('def', 'copper_lump', 'count', 2, 'ql', 30))), u)
    returning id into v_p;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7201, 'copper_ore', 30, 3);
  select id into v_id from hand where species = 'forga';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'SMELT', coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7201), '-')
    || '|' || jsonb_array_length(furnace_jobs(p)) || '|' || jsonb_array_length(furnace_output(p)) from placed p where p.id = v_p;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;
  delete from placed where id = v_p;

  -- Potta: a kiln with a fired brick waiting, two unfired bricks in the crate.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since, state, made_by)
    values (w, 'kiln', 19, 16, 0, 0, 19.5, 16.5, 50, 0, false, now(),
            jsonb_build_object('jobs', '[]'::jsonb, 'output', jsonb_build_array(jsonb_build_object('def', 'clay_brick', 'count', 1, 'ql', 30))), u)
    returning id into v_p;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7201, 'unfired_clay_brick', 30, 2);
  select id into v_id from hand where species = 'potta';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'KILN', coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7201), '-')
    || '|' || jsonb_array_length(furnace_jobs(p)) || '|' || jsonb_array_length(furnace_output(p)) from placed p where p.id = v_p;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;
  delete from placed where id = v_p;

  -- Potta again: an empty kiln, and one of every piece of unfired clay a kiln fires in the crate.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, since, state, made_by)
    values (w, 'kiln', 19, 16, 0, 0, 19.5, 16.5, 50, 0, false, now(), jsonb_build_object('jobs', '[]'::jsonb, 'output', '[]'::jsonb), u)
    returning id into v_p;
  insert into item (world_id, holder, crate, def, ql, count) select w, 'crate', 7201, pd.unfired, 30, 1 from pottery_def pd;
  insert into said select 'WARES', string_agg(pd.unfired || '>' || pd.fired, ',' order by pd.unfired) from pottery_def pd;
  select id into v_id from hand where species = 'potta';
  update creature set mode = 'deed', until = now() - interval '3600 seconds', settled_at = now() - interval '3600 seconds', phase = 'idle',
         carrying = null where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'KILNWARES', coalesce((select string_agg(j->>'makes', ',' order by j->>'makes') from jsonb_array_elements(furnace_jobs(p)) j), '-')
    || '|' || coalesce((select string_agg(def, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7201), '-')
    from placed p where p.id = v_p;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;
  delete from placed where id = v_p;

  -- Cindra: a cold campfire with two and a half ashes in it, and a bucket of water in the crate.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, ash, lit, since, made_by)
    values (w, 'campfire', 19, 16, 0, 0, 19.25, 16.25, 30, 0, 2.5, false, now(), u) returning id into v_p;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7201, 'water_bucket', 30, 1);
  select id into v_id from hand where species = 'cindra';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'ASH', coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7201), '-')
    || '|' || round(p.ash::numeric, 2) from placed p where p.id = v_p;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;
  delete from placed where id = v_p;

  -- Hoppa: a barrel of water and the wheat for ale.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, liquid, litres, made_by)
    values (w, 'furniture', 'barrel', 19, 16, 0, 0, 19.25, 16.25, 30, 'water', 20, u) returning id into v_p;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7201, 'wheat', 40, 12);
  select id into v_id from hand where species = 'hoppa';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'BREW', p.liquid || '|' || p.litres || '|' || (ferment_left(p) > 0)::text || '|'
    || coalesce((select sum(count) from item where world_id = w and holder = 'crate' and crate = 7201 and def = 'wheat'), 0)
    from placed p where p.id = v_p;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;
  delete from placed where id = v_p;

  -- Simma: a lit campfire and a piece of meat.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, ash, lit, since, made_by)
    values (w, 'campfire', 19, 16, 0, 0, 19.25, 16.25, 30, 3000, 0, true, now(), u) returning id into v_p;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7201, 'meat', 30, 1);
  select id into v_id from hand where species = 'simma';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'COOK', coalesce(string_agg(def || ' ' || count, ',' order by def), '-') from item where world_id = w and holder = 'crate' and crate = 7201;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;
  delete from placed where id = v_p;

  -- Kintsu (was Relka): both pieces of a bone comb.
  insert into item (world_id, holder, crate, def, ql, count, extra) values (w, 'crate', 7201, 'fragment', 40, 1, 'bone comb 1/2'), (w, 'crate', 7201, 'fragment', 40, 1, 'bone comb 2/2');
  select id into v_id from hand where species = 'relka';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'RESTORE', coalesce(string_agg(def || ' ' || count, ',' order by def), '-') from item where world_id = w and holder = 'crate' and crate = 7201;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;

  -- Bedda: an empty planter and a seed, and a planter with a ripe crop.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'planter', 19, 16, 0, 0, 19.25, 16.25, 30, u) returning id into v_p;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'planter', 15, 16, 0, 0, 15.25, 16.25, 30, u) returning id into v_q;
  insert into planter_crop (placed, world_id, id, stage, tended, ql, sown_by) values (v_q, w, 'wheat', crop_ripe(), 2, 40, u);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7201, '${SEED}', 30, 2);
  select id into v_id from hand where species = 'bedda';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle' where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'PLANTER', coalesce((select id from planter_crop where placed = v_p), '-') || '|'
    || coalesce((select stage::text from planter_crop where placed = v_q), 'gone') || '|'
    || coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7201), '-');
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7201;

  -- The five tile jobs, a go each.
  perform land_set_tile(w, 21, 16, tile_id('Marsh'));
  select * into c from creature where world_id = w and id = (select id from hand where species = 'wurla');
  update creature set mode = 'deed', work_x = 21, work_y = 16 where world_id = w and id = c.id;
  insert into said values ('WORMTILE', worker_gatherable(w, 21, 16, 'worm', c)::text);
  v_load := worker_do(w, c.id);
  insert into said values ('WORM', coalesce(v_load->>'def', '-') || '|' || coalesce(v_load->>'count', '0') || '|' || worker_gatherable(w, 21, 16, 'worm', c)::text);

  perform land_set_tile(w, 23, 16, tile_id('Tree'));
  perform land_set_data(w, 23, 16, tree_pack(2, 1));
  perform land_set_tile(w, 25, 16, tile_id('Tree'));
  perform land_set_data(w, 25, 16, tree_pack(resin_tree(), 1));
  select * into c from creature where world_id = w and id = (select id from hand where species = 'sprigga');
  update creature set mode = 'deed', work_x = 23, work_y = 16 where world_id = w and id = c.id;
  insert into said values ('SPROUTTILE', worker_gatherable(w, 23, 16, 'sprout', c)::text);
  v_load := worker_do(w, c.id);
  insert into said values ('SPROUT', coalesce(v_load->>'def', '-') || '|' || coalesce(v_load->>'extra', '-') || '|' || worker_gatherable(w, 23, 16, 'sprout', c)::text);
  select * into c from creature where world_id = w and id = (select id from hand where species = 'ambra');
  update creature set mode = 'deed', work_x = 25, work_y = 16 where world_id = w and id = c.id;
  insert into said values ('RESINTILE', worker_gatherable(w, 25, 16, 'resin', c)::text || '|' || worker_gatherable(w, 23, 16, 'resin', c)::text);
  v_load := worker_do(w, c.id);
  insert into said values ('RESIN', coalesce(v_load->>'def', '-') || '|' || coalesce(v_load->>'count', '0') || '|' || worker_gatherable(w, 25, 16, 'resin', c)::text);

  -- Petta: any tile of the island in flower now, and one beside a skep.
  select * into c from creature where world_id = w and id = (select id from hand where species = 'petta');
  insert into said select 'FLOWERS', count(*)::text from generate_series(0, 39) x, generate_series(0, 39) y where flowers_on(w, x, y, now()) > 0;

  -- Scurra: paving laid three days ago, on the settlement and off it.
  update world set green_from = now() - interval '30 days' where id = w;
  perform land_set_tile(w, 18, 18, tile_id('Cobblestone'));
  perform land_set_tile(w, 30, 30, tile_id('Cobblestone'));
  insert into green_since (world_id, thing, x, y, k, since) values (w, 'paving', 18, 18, 0, now() - interval '3 days'), (w, 'paving', 30, 30, 0, now() - interval '3 days')
    on conflict (world_id, thing, x, y, k) do update set since = excluded.since;
  select * into c from creature where world_id = w and id = (select id from hand where species = 'scurra');
  update creature set mode = 'deed', work_x = 18, work_y = 18 where world_id = w and id = c.id;
  insert into said values ('GREEN', green_on_tile(w, u, 18, 18) || '|' || green_on_tile(w, u, 30, 30) || '|' || worker_gatherable(w, 18, 18, 'scrub', c)::text);
  v_load := worker_do(w, c.id);
  insert into said values ('SCRUB', coalesce(v_load::text, 'nothing') || '|' || green_on_tile(w, u, 18, 18) || '|' || worker_gatherable(w, 18, 18, 'scrub', c)::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const words = (s: string): string => s.replace(/\d+/g, 'N');

/* ---- the species and their words ----------------------------------------------------- */

for (const [id, trade] of HANDS) {
  check(`a ${id}'s trade is ${trade} on both sides, and the island works it`, SPECIES[id]?.gathers === trade && at(`TRADE:${id}`) === `${trade}|true`, at(`TRADE:${id}`));
  check(`a ${id} may be set to work a settlement`, at(`ASK:${id}`) === 'none', at(`ASK:${id}`));
  check(`a ${id}'s description is filled in`, !!SPECIES[id] && !/[{}]/.test(SPECIES[id].description), SPECIES[id]?.description);
}
const g0 = Game.create(4247);
for (const [id] of HANDS) {
  const c = g0.creatures.spawn(id, g0.player.x + 1, g0.player.y, 'active', g0.rand, g0.time - 3600 * 24 * 30);
  c.mode = 'deed';
  check(`a ${id} says what it will do in the island's words`, words(deedJobLine(c)) === words(at(`LINE:${id}`)), `${deedJobLine(c)} / ${at(`LINE:${id}`)}`);
  const quiet = TEND_JOBS.has(SPECIES[id].gathers!) || SPECIES[id].gathers === 'scrub';
  check(`and ${quiet ? 'says nothing of the crate' : 'brings what it finds to the crate'}`, deedJobLine(c).endsWith('; output to the crate') === !quiet, deedJobLine(c));
}
check('a simma cooks the same recipes in the same order on both sides', at('COOKS') === cookRecipes().join(','), `${at('COOKS')} / ${cookRecipes().join(',')}`);
check('a hoppa tries the same brews in the same order on both sides', at('BREWS') === BREWS.map((b) => b.id).join(','), at('BREWS'));
check(`an ambra's tap is ${RESIN_TAPPED} tar, and its words say so`, SPECIES.ambra.description.includes(`${RESIN_TAPPED} tar per pine per day`), SPECIES.ambra.description);
check('the words of the trades that work at the stores say where what they make goes', ['smelt', 'kiln', 'ash', 'restore', 'patch'].every((k) => /stores/.test(GATHER_DO[k as keyof typeof GATHER_DO])));

/* ---- what each does, on the island --------------------------------------------------- */

const [smeltStores, smeltJobs, smeltOut] = at('SMELT').split('|');
check('on the island, a forga takes the lumps out of a smelter into the stores and charges it with the ore', smeltStores === 'copper_lump 2' && smeltJobs === '3' && smeltOut === '0', at('SMELT'));
const [kilnStores, kilnJobs, kilnOut] = at('KILN').split('|');
check('a potta takes a fired brick out of a kiln into the stores and packs it with the unfired ones', kilnStores === 'clay_brick 1' && kilnJobs === '2' && kilnOut === '0', at('KILN'));
const WARES = [...POTTERY].sort((a, b) => a.unfired.localeCompare(b.unfired));
check('the island fires the same unfired clay into the same ware as the browser', at('WARES') === WARES.map((p) => `${p.unfired}>${p.fired}`).join(','), at('WARES'));
check('a potta loads every piece of unfired clay a kiln fires, clay bricks among them, and leaves none in the stores',
  at('KILNWARES') === `${POTTERY.map((p) => p.fired).sort().join(',')}|-` && at('KILNWARES').split(',').includes('clay_brick'), at('KILNWARES'));
check('and its words name each one', POTTERY.every((p) => SPECIES.potta.description.includes(itemDef(p.unfired).name.toLowerCase()) && GATHER_DO.kiln.includes(itemDef(p.unfired).name.toLowerCase())),
  `${SPECIES.potta.description} / ${GATHER_DO.kiln}`);
const [ashStores, ashLeft] = at('ASH').split('|');
check('a cindra rakes the two whole ashes out of a campfire and leaches them with the bucket of water into lye', ashStores === 'lye_bucket 1' && ashLeft === '0.50', at('ASH'));
const [brewLiquid, brewLitres, brewWorking, wheatLeft] = at('BREW').split('|');
check('a hoppa sets ale going in a barrel of water with the wheat from the stores', brewLiquid === 'ale' && Number(brewLitres) === 15 && brewWorking === 'true' && wheatLeft === '0', at('BREW'));
check('a simma cooks the meat at a lit campfire and puts it back in the stores', at('COOK') === 'cooked_meat 1', at('COOK'));
check('a Kintsu (was relka) puts a bone comb back together out of both its pieces', at('RESTORE') === 'ancient_comb 1', at('RESTORE'));
const [sown, ripeLeft, planterStores] = at('PLANTER').split('|');
// Two seeds in the stores: one a harvest at most now (`SEED_CHANCE`), so the second sowing need not wait on the roll.
check('a bedda sows an empty planter with the seed from the stores, harvests the ripe one into them, and sows that again',
  sown === 'wheat' && ripeLeft === '0' && /wheat \d/.test(planterStores), at('PLANTER'));
const [wormDef, , wormAgain] = at('WORM').split('|');
check('a wurla digs a marsh for worms and leaves it to rest', at('WORMTILE') === 'true' && wormDef === 'worm' && wormAgain === 'false', at('WORM'));
const [sproutDef, sproutTree, sproutAgain] = at('SPROUT').split('|');
check('a sprigga picks a sprout off an oak, named for it, and leaves the tree to rest', at('SPROUTTILE') === 'true' && sproutDef === 'sprout' && sproutTree === 'Oak' && sproutAgain === 'false', at('SPROUT'));
const [resinDef, resinCount, resinAgain] = at('RESIN').split('|');
check('an ambra taps a pine and not an oak, and a pine once a day', at('RESINTILE') === 'true|false' && resinDef === 'tar' && Number(resinCount) === RESIN_TAPPED && resinAgain === 'false', `${at('RESINTILE')} / ${at('RESIN')}`);
const [greenHere, greenAway, scrubbable] = at('GREEN').split('|');
check('a scurra sees three days of moss on your paving and none on paving off your settlement', greenHere === '3' && greenAway === '0' && scrubbable === 'true', at('GREEN'));
const [scrubLoad, greenAfter, scrubAgain] = at('SCRUB').split('|');
check('and scrubs it back to bare stone, carrying nothing home', scrubLoad === 'nothing' && greenAfter === '0' && scrubAgain === 'false', at('SCRUB'));

/* ---- what each does, in the browser -------------------------------------------------- */

const body = (): Game => {
  const g = Game.create(4242);
  const w = g.world;
  for (let y = 14; y <= 28; y++) for (let x = 14; x <= 28; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 14; y <= 27; y++) for (let x = 14; x <= 27; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Twelvesend', x: 20, y: 20, radius: 6, level: 2 };
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  return g;
};
const worker = (g: Game, species: string): Creature => {
  const c = g.creatures.spawn(species, 20.5, 21.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.stance = 'passive';
  c.hunger = 1;
  return c;
};
const run = (g: Game, secs: number): void => {
  for (let i = 0; i < secs * 10; i++) {
    g.time += 0.1;
    g.creatures.update(0.1, g);
  }
};
const stock = (g: Game, items: Array<[string, number, string?]>): ReturnType<Game['addCrate']> =>
  g.addCrate('plank', 21, 20, 0, 0, items.map(([id, count, extra]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count, ...(extra ? { extra } : {}) })), true);
const held = (crate: ReturnType<Game['addCrate']>): string => crate.items.map((i) => `${i.id} ${i.count}`).sort().join(',') || '-';

{
  const g = body();
  const crate = stock(g, [['copper_ore', 3]]);
  const s = g.addSmelter(23, 21, 0, 0, 50);
  s.output.push({ uid: g.inventory.nextUid++, id: 'copper_lump', ql: 30, dmg: 0, count: 2 });
  worker(g, 'forga');
  run(g, 90);
  check('in the browser, a forga takes the lumps out of a smelter into the stores and charges it with the ore',
    held(crate) === 'copper_lump 2' && s.jobs.length === 3 && s.output.length === 0, `${held(crate)} ${s.jobs.length} ${s.output.length}`);
}
{
  const g = body();
  const crate = stock(g, [['unfired_clay_brick', 2]]);
  const k = g.addKiln(23, 21, 0, 0, 50);
  k.output.push({ uid: g.inventory.nextUid++, id: 'clay_brick', ql: 30, dmg: 0, count: 1 });
  worker(g, 'potta');
  run(g, 90);
  check('a potta takes a fired brick out of a kiln and packs it with the unfired ones', held(crate) === 'clay_brick 1' && k.jobs.length === 2 && k.output.length === 0, `${held(crate)} ${k.jobs.length}`);
}
{
  const g = body();
  const crate = stock(g, POTTERY.map((p) => [p.unfired, 1] as [string, number]));
  const k = g.addKiln(23, 21, 0, 0, 50);
  worker(g, 'potta');
  run(g, 300);
  const makes = k.jobs.map((j) => j.makes).sort().join(',');
  check('in the browser, a potta loads every piece of unfired clay a kiln fires, clay bricks among them, and leaves none in the stores',
    makes === POTTERY.map((p) => p.fired).sort().join(',') && held(crate) === '-', `${makes} / ${held(crate)}`);
}
{
  const g = body();
  const crate = stock(g, [['water_bucket', 1]]);
  const f = g.addCampfire(23, 21, 0, 0, 0, false);
  f.ash = 2.5;
  worker(g, 'cindra');
  run(g, 90);
  check('a cindra rakes the two whole ashes out of a campfire and leaches them with the bucket of water into lye', held(crate) === 'lye_bucket 1' && Math.abs((f.ash ?? 0) - 0.5) < 1e-9, `${held(crate)} ${f.ash}`);
}
{
  const g = body();
  const crate = stock(g, [['wheat', 12]]);
  const barrel = g.addFurniture('barrel', 23, 21, 0, 0, 30);
  barrel.liquid = 'water';
  barrel.litres = 20;
  worker(g, 'hoppa');
  run(g, 60);
  check('a hoppa sets ale going in a barrel of water with the wheat from the stores', (barrel.liquid as string) === 'ale' && barrel.litres === 15 && (barrel.ferment ?? 0) > 0 && held(crate) === '-', `${barrel.liquid} ${barrel.litres} ${held(crate)}`);
}
{
  const g = body();
  const crate = stock(g, [['meat', 1]]);
  g.addCampfire(23, 21, 0, 0, 3000, true);
  worker(g, 'simma');
  run(g, 60);
  check('a simma cooks the meat at a lit campfire and puts it back in the stores', held(crate) === 'cooked_meat 1', held(crate));
}
{
  const g = body();
  const crate = stock(g, [['fragment', 1, 'bone comb 1/2'], ['fragment', 1, 'bone comb 2/2']]);
  worker(g, 'relka');
  run(g, 60);
  check('a Kintsu (was relka) puts a bone comb back together out of both its pieces', held(crate) === 'ancient_comb 1', held(crate));
}
{
  const g = body();
  const crate = stock(g, [[SEED, 2]]);
  const empty = g.addFurniture('planter', 23, 21, 0, 0, 30);
  const ripe = g.addFurniture('planter', 18, 21, 0, 0, 30);
  const c = g.sowPlanter(ripe, 'wheat', 40);
  c.stage = 3;
  c.tended = 2;
  worker(g, 'bedda');
  run(g, 120);
  check('a bedda sows an empty planter with the seed from the stores, harvests the ripe one into them, and sows that again',
    g.planted.get(empty.id)?.id === 'wheat' && g.planted.get(ripe.id)?.stage === 0 && /wheat \d/.test(held(crate)), held(crate));
}
{
  const g = body();
  const crate = stock(g, []);
  g.world.setTile(23, 22, TileType.Marsh, 0);
  for (let y = 14; y <= 27; y++) for (let x = 14; x <= 27; x++) if (x !== 23 || y !== 22) g.world.setTile(x, y, TileType.Sand, 0);
  g.world.setTile(23, 22, TileType.Marsh, 0);
  const c = worker(g, 'wurla');
  check('in the browser, a wurla digs a marsh for worms', g.creatures.gatherable(g, 23, 22, 'worm', c) && !g.creatures.gatherable(g, 24, 22, 'worm', c));
  // Till the worms are home, not past the marsh's rest (`FORAGE_COOLDOWN`).
  for (let s = 0; s < 240 && !crate.items.some((i) => i.id === 'worm'); s++) run(g, 1);
  check('and carries them home, and the marsh rests after', crate.items.some((i) => i.id === 'worm') && !g.creatures.gatherable(g, 23, 22, 'worm', c), held(crate));
}
{
  const g = body();
  g.world.setTile(23, 22, TileType.Tree, packTreeData(2, 1));
  g.world.setTile(25, 22, TileType.Tree, packTreeData(RESIN_TREE, 1));
  const c = worker(g, 'sprigga');
  check('a sprigga picks a sprout off an oak, and an ambra taps a pine and not an oak',
    g.creatures.gatherable(g, 23, 22, 'sprout', c) && g.creatures.gatherable(g, 25, 22, 'resin', c) && !g.creatures.gatherable(g, 23, 22, 'resin', c));
  g.markTapped(25, 22);
  check('and a pine once a day', !g.creatures.gatherable(g, 25, 22, 'resin', c));
}
{
  const g = body();
  g.world.setTile(23, 23, TileType.Cobblestone, 0);
  g.greenFrom = greenNow() - 30 * GREEN_DAY;
  g.pavingSince.set('23,23', greenNow() - 3 * GREEN_DAY);
  const c = worker(g, 'scurra');
  check('a scurra sees three days of moss on your paving', greenOnTile(g, 23, 23, greenNow()) === 3 && g.creatures.gatherable(g, 23, 23, 'scrub', c), String(greenOnTile(g, 23, 23, greenNow())));
  run(g, 120);
  check('and scrubs it back to bare stone', greenOnTile(g, 23, 23, greenNow()) === 0, String(greenOnTile(g, 23, 23, greenNow())));
}
{
  // Spring, when the grass is in flower: a petta picks it, and leaves the flowers round a skep to the skep.
  const g = Game.create(4242);
  let spring = 0;
  for (let d = 0; d < 400 && !spring; d++) {
    const t = Date.UTC(2026, 0, 1) / 1000 + d * 86400;
    if (flowerSeason(t) === 'summer') spring = t;
  }
  g.wallNow = () => spring;
  // Somewhere the grass would bloom: a stretch of it laid flat round there, and the settlement on it.
  const w = g.world;
  let ox = 20, oy = 20;
  find: for (let y = 10; y < w.h - 20; y++) {
    for (let x = 10; x < w.w - 20; x++) {
      let n = 0;
      for (let dy = 0; dy < 12; dy++) for (let dx = 0; dx < 12; dx++) if (flowersOn(w.seed, x + dx, y + dy, TileType.Grass, 0, flowerSeason(spring)) > 0) n++;
      if (n >= 6) { ox = x; oy = y; break find; }
    }
  }
  for (let y = oy - 2; y <= oy + 14; y++) for (let x = ox - 2; x <= ox + 14; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = oy - 2; y <= oy + 13; y++) for (let x = ox - 2; x <= ox + 13; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = ox + 6.5;
  g.player.y = oy + 6.5;
  g.deed = { name: 'Bloomsend', x: ox + 6, y: oy + 6, radius: 7, level: 2 };
  for (const k of [...g.creatures.list.values()]) g.creatures.list.delete(k.id);
  const crate = g.addCrate('plank', ox + 7, oy + 6, 0, 0, [], true);
  const inFlower: Array<[number, number]> = [];
  for (let y = oy - 2; y <= oy + 13; y++) for (let x = ox - 2; x <= ox + 13; x++) if (flowersHere(g, x, y, spring) > 0) inFlower.push([x, y]);
  const c = g.creatures.spawn('petta', ox + 6.5, oy + 7.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.mode = 'deed';
  c.stance = 'passive';
  c.hunger = 1;
  check(`in flower, the grass round the token: ${inFlower.length} tiles of it`, inFlower.length > 0);
  if (inFlower.length) {
    // A skep where some of the flowers are in its reach and some are not.
    const reach = (sx: number, sy: number): number => inFlower.filter(([x, y]) => Math.max(Math.abs(x - sx), Math.abs(y - sy)) <= SKEP_REACH).length;
    const [sx, sy] = inFlower.find(([x, y]) => reach(x, y) < inFlower.length) ?? inFlower[0];
    g.addFurniture(SKEP, sx, sy, 0, 0, 30);
    const fed = inFlower.filter(([x, y]) => Math.max(Math.abs(x - sx), Math.abs(y - sy)) <= SKEP_REACH);
    const free = inFlower.filter(([x, y]) => Math.max(Math.abs(x - sx), Math.abs(y - sy)) > SKEP_REACH);
    check(`a petta leaves the ${fed.length} tiles within ${SKEP_REACH} of a skep to it, and would pick the ${free.length} others`,
      fed.every(([x, y]) => !g.creatures.gatherable(g, x, y, 'flower', c)) && free.every(([x, y]) => g.creatures.gatherable(g, x, y, 'flower', c)));
    run(g, 120);
    check('and picks them and carries them home, leaving them picked', crate.items.some((i) => i.id === 'wildflowers')
      && free.some(([x, y]) => flowersHere(g, x, y, spring) === 0) && fed.every(([x, y]) => flowersHere(g, x, y, spring) > 0), held(crate));
  }
}
check(`wildflowers on the island: ${at('FLOWERS')} tiles in flower now (none out of their seasons)`, Number(at('FLOWERS')) >= 0);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ntwelve more hands — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
