/**
 * Ten more hands on a settlement.
 *
 * Asked for off a list of work nobody but a player did: a kemma brushes the
 * herd, a sheela milks and shears it, a salva dresses its hurts, a carra
 * butchers the carcasses in the stores, a tanna tans the hides, a grista
 * mills, a wicka keeps the lanterns, a brambo picks the bushes, a grazza cuts
 * grass and moss, and a siffa pans the sand at the water's edge. This asks,
 * of both sides:
 *
 *   * each is a species with that trade, may be set to work a settlement, and
 *     says what it will do there in the same words on both sides;
 *   * set to work, each does what it says: the care, the fleece, the milk,
 *     the health, the carcass, the hide, the grain and the lantern changed as
 *     the words say, and what is made put in the stores;
 *   * the three that walk out find their tile and bring home what the tile gives;
 *   * the words carry the numbers the rules use, and nothing is left unfilled.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { deedJobLine } from '../../src/game/creaturecrate';
import { CARE_WANTING, DAIRY_FULL, GATHER_DO, HEAL_BELOW, MILL_RECIPES, PAN_FIND, panFind, SPECIES, TAN_RECIPES, TEND_JOBS, type Creature } from '../../src/game/creatures';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { TileType } from '../../src/world/tiles';
import { percent } from '../../src/game/words';

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
  ['kemma', 'groom'], ['sheela', 'dairy'], ['salva', 'heal'], ['carra', 'butcher'], ['tanna', 'tan'],
  ['grista', 'mill'], ['wicka', 'lamp'], ['brambo', 'bush'], ['grazza', 'grass'], ['siffa', 'pan'],
];

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000b7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; c creature; v_id int; v_o int; v_o2 int; v_lamp bigint; v_bush int; v_load jsonb; v_n int;
        v_got text := '';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hands', 171, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Handsome', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7101, 'plank', 17, 16, 0, 0, true, u);

  -- Every one of them a trade the island works, and the words it says.
  insert into said select 'TRADE:' || s.id, coalesce(s.gathers, '-') || '|' || worker_job_ported(coalesce(s.gathers, '-'))
    from species_def s where s.id in ('kemma', 'sheela', 'salva', 'carra', 'tanna', 'grista', 'wicka', 'brambo', 'grazza', 'siffa');

  -- A worker of each, its own row to read the line off.
  create temp table hand (species text, id int);
  insert into hand select s, creature_spawn(w, s, 16.6, 16.6, 'active', now() - interval '30 days', u)
    from unnest(array['kemma', 'sheela', 'salva', 'carra', 'tanna', 'grista', 'wicka', 'brambo', 'grazza', 'siffa']) s;
  insert into said select 'ASK:' || h.species, coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', h.id)), 'none') from hand h;
  update creature set mode = 'deed', stance = 'passive', hunger = 1, settled_at = now(), until = now(), leg_at = now(), leg_ends = now(),
         from_x = to_x, from_y = to_y
   where world_id = w and id in (select id from hand);
  insert into said select 'LINE:' || h.species, deed_job_line(c2) from hand h join creature c2 on c2.world_id = w and c2.id = h.id;
  -- Only one at work at a time: the rest are put away while each is tried.
  update creature set mode = 'stored' where world_id = w and id in (select id from hand);

  -- A worker's afternoon, ten minutes of it.
  -- Kemma: a woola of yours wanting a brush.
  v_o := creature_spawn(w, 'woola', 17.5, 17.5, 'active', now() - interval '30 days', u);
  update creature set care = 0, health = 1 where world_id = w and id = v_o;
  select id into v_id from hand where species = 'kemma';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'GROOM', round(care::numeric, 3) || '|' || round(health::numeric, 2) from creature where world_id = w and id = v_o;
  update creature set mode = 'stored' where world_id = w and id = v_id;

  -- Sheela: that woola's fleece, and a cudda with a bucket in the crate for her.
  v_o2 := creature_spawn(w, 'cudda', 15.5, 17.5, 'active', now() - interval '30 days', u);
  update creature set fleece = 1, hunger = 1, sex = 'female' where world_id = w and id in (v_o, v_o2);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7101, 'bucket', 30, 1);
  select id into v_id from hand where species = 'sheela';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'DAIRY', (select round(fleece::numeric, 2) from creature where world_id = w and id = v_o) || '|'
    || (select round(fleece::numeric, 2) from creature where world_id = w and id = v_o2) || '|'
    || coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7101), '-');
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7101;

  -- Salva: the woola hurt and bleeding, and a bandage in the crate.
  update creature set health = 1, bleed_until = now() + interval '1 hour', bleed_rate = 0.01, hurt_at = now() where world_id = w and id = v_o;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7101, 'bandage', 50, 1);
  select id into v_id from hand where species = 'salva';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'HEAL', round(health::numeric, 2) || '|' || coalesce(bleed_until::text, 'stopped') || '|'
    || (select count(*) from item where world_id = w and holder = 'crate' and crate = 7101 and def = 'bandage')
    from creature where world_id = w and id = v_o;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  update creature set mode = 'stored' where world_id = w and id in (v_o, v_o2);
  delete from item where world_id = w and holder = 'crate' and crate = 7101;

  -- Carra: a rabba carcass in the crate.
  insert into item (world_id, holder, crate, def, ql, count, extra) values (w, 'crate', 7101, 'corpse', 30, 1, 'Rabba');
  select id into v_id from hand where species = 'carra';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'BUTCHER', coalesce(string_agg(def || ' ' || count, ',' order by def), '-') from item where world_id = w and holder = 'crate' and crate = 7101;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7101;

  -- Tanna: a hide, a bucket of lye and a carving knife.
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7101, 'hide', 30, 1), (w, 'crate', 7101, 'lye_bucket', 30, 1), (w, 'crate', 7101, 'carving_knife', 30, 1);
  select id into v_id from hand where species = 'tanna';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'TAN', coalesce(string_agg(def || ' ' || count, ',' order by def), '-') from item where world_id = w and holder = 'crate' and crate = 7101;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7101;

  -- Grista: four wheat and no quern, then a quern.
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7101, 'wheat', 30, 4);
  select id into v_id from hand where species = 'grista';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'NOQUERN', coalesce(string_agg(def || ' ' || count, ',' order by def), '-') from item where world_id = w and holder = 'crate' and crate = 7101;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7101, 'quern', 30, 1);
  update creature set until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'MILL', coalesce(string_agg(def || ' ' || count, ',' order by def), '-') from item where world_id = w and holder = 'crate' and crate = 7101;
  update creature set mode = 'stored' where world_id = w and id = v_id;
  delete from item where world_id = w and holder = 'crate' and crate = 7101;

  -- Wicka: a lantern post with no candle, and two candles in the crate.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, state, fuel, lit, since, made_by)
    values (w, 'furniture', 'lamp_post', 18, 18, 0, 0, 18.125, 18.125, 50, jsonb_build_object('lamp', jsonb_build_object('ql', 50)), 0, false, now(), u)
    returning id into v_lamp;
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7101, 'candle', 30, 2);
  select id into v_id from hand where species = 'wicka';
  update creature set mode = 'deed', until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'LAMP', (placed_fuel(p) > 0)::text || '|' || (placed_lit(p) = is_night(w))::text || '|'
    || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'crate' and crate = 7101 and def = 'candle')
    from placed p where p.id = v_lamp;
  update creature set mode = 'stored' where world_id = w and id = v_id;

  -- Brambo, grazza and siffa: the tile, and what one go on it brings home.
  select b.id into v_bush from bush_def b where b.yields is not null and fruits_now(b.yields) order by b.id limit 1;
  insert into said values ('BUSHSEASON', coalesce(v_bush::text, 'none'));
  perform land_set_tile(w, 19, 16, tile_id('Bush'));
  perform land_set_data(w, 19, 16, coalesce(v_bush, (select min(id) from bush_def where yields is not null)));
  select * into c from creature where world_id = w and id = (select id from hand where species = 'brambo');
  insert into said values ('BUSHTILE', worker_gatherable(w, 19, 16, 'bush', c)::text || '|' || worker_gatherable(w, 20, 16, 'bush', c)::text);
  update creature set mode = 'deed', work_x = 19, work_y = 16 where world_id = w and id = c.id;
  v_load := worker_do(w, c.id);
  insert into said values ('BUSH', coalesce(v_load->>'def', '-') || '|' || coalesce(v_load->>'count', '0') || '|'
    || coalesce((select b.yields from bush_def b where b.id = land_data(w, 19, 16)), '-') || '|' || is_foraged(w, 19, 16, 'forage')::text);

  perform land_set_tile(w, 21, 16, tile_id('Moss'));
  select * into c from creature where world_id = w and id = (select id from hand where species = 'grazza');
  update creature set mode = 'deed', work_x = 20, work_y = 17 where world_id = w and id = c.id;
  v_load := worker_do(w, c.id);
  insert into said values ('GRASS', coalesce(v_load->>'def', '-') || ' ' || coalesce(v_load->>'count', '0') || '|' || (land_data(w, 20, 17) & 4)::text
    || '|' || worker_gatherable(w, 20, 17, 'grass', c)::text);
  update creature set work_x = 21, work_y = 16 where world_id = w and id = c.id;
  v_load := worker_do(w, c.id);
  insert into said values ('MOSS', coalesce(v_load->>'def', '-') || ' ' || coalesce(v_load->>'count', '0') || '|' || worker_gatherable(w, 21, 16, 'grass', c)::text);
  -- A whole afternoon of it: a cut carried home to the crate.
  update creature set until = now() - interval '600 seconds', settled_at = now() - interval '600 seconds', phase = 'idle', work_x = null, work_y = null
   where world_id = w and id = c.id;
  perform worker_settle(w, c.id);
  insert into said select 'HAY', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'crate' and crate = 7101 and def = 'mixed_grass';
  update creature set mode = 'stored' where world_id = w and id = c.id;

  perform land_set_tile(w, 23, 16, tile_id('Sand'));
  perform land_set_tile(w, 23, 18, tile_id('Sand'));
  perform land_set_height(w, 24, 17, -3);
  select * into c from creature where world_id = w and id = (select id from hand where species = 'siffa');
  insert into said values ('PANTILE', worker_gatherable(w, 23, 16, 'pan', c)::text || '|' || worker_gatherable(w, 23, 18, 'pan', c)::text);
  update creature set mode = 'deed', work_x = 23, work_y = 16, skills = jsonb_build_object('prospecting', 100) where world_id = w and id = c.id;
  for v_n in 1..60 loop
    v_load := worker_do(w, c.id);
    if v_load is not null then v_got := v_got || (v_load->>'def') || ','; end if;
  end loop;
  insert into said values ('PAN', v_got);
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
  // The seven worked at the stores or at your own bring nothing to the crate, and say where what they make goes instead.
  const errand = TEND_JOBS.has(SPECIES[id].gathers!);
  check(`and ${errand ? 'says nothing of the crate' : 'brings what it finds to the crate'}`, deedJobLine(c).endsWith('; output to the crate') === !errand, deedJobLine(c));
}
check('the words carry the numbers the rules use',
  GATHER_DO.groom.includes(`${Math.round(CARE_WANTING * 100)}%`) && GATHER_DO.dairy.includes(`${Math.round(DAIRY_FULL * 100)}%`)
  && GATHER_DO.heal.includes(`${Math.round(HEAL_BELOW * 100)}%`)
  && SPECIES.siffa.description.includes(percent(PAN_FIND[0])) && SPECIES.siffa.description.includes(percent(PAN_FIND[1])),
  `${GATHER_DO.groom} / ${GATHER_DO.dairy} / ${GATHER_DO.heal} / ${SPECIES.siffa.description}`);
// The words for the two recipe trades name what the recipes take, so a recipe added to either has to be said.
const takes = (ids: readonly string[]): string[] => [...new Set(ids.flatMap((r) => RECIPE_BY_ID.get(r)?.inputs.map((i) => i.item) ?? []))].sort();
check('a grista grinds wheat and corn and presses olives, which is what its recipes take, on a quern',
  takes(MILL_RECIPES).join(',') === 'corn,olive,wheat' && MILL_RECIPES.every((r) => RECIPE_BY_ID.get(r)?.tool === 'quern'), takes(MILL_RECIPES).join(','));
check('a tanna tans a hide in lye with a carving knife, which is what its recipe takes',
  takes(TAN_RECIPES).join(',') === 'hide,lye_bucket' && RECIPE_BY_ID.get(TAN_RECIPES[0])?.tool === 'carving_knife', takes(TAN_RECIPES).join(','));
check(`a siffa's pan finds something ${PAN_FIND[0]} of the time at no skill and ${PAN_FIND[1]} at a hundred`, panFind(0) === PAN_FIND[0] && panFind(100) === PAN_FIND[1]);

/* ---- what each does, on the island --------------------------------------------------- */

const [care, groomHealth] = at('GROOM').split('|').map(Number);
check('on the island, a kemma brushes a woola of yours wanting it up past the line', care >= CARE_WANTING && groomHealth > 1, at('GROOM'));
const [fleeceWoola, fleeceCudda, dairyStores] = at('DAIRY').split('|');
check('a sheela shears a woola of yours and milks a cudda into the bucket in the stores',
  Number(fleeceWoola) === 0 && Number(fleeceCudda) === 0 && dairyStores === 'milk_bucket 1,wool 3', at('DAIRY'));
const [healed, bleeding, bandages] = at('HEAL').split('|');
check('a salva dresses a bleeding woola of yours with the bandage out of the stores: the bleeding stops and its health comes up',
  Number(healed) > 1 && bleeding === 'stopped' && bandages === '0', at('HEAL'));
check('a carra butchers the rabba in the stores and puts its meat back in', !at('BUTCHER').includes('corpse') && at('BUTCHER').includes('meat'), at('BUTCHER'));
check('a tanna tans the hide in the lye, and the leather and the bucket go back in beside the knife',
  at('TAN') === 'bucket 1,carving_knife 1,leather 1', at('TAN'));
check('a grista with no quern in the stores grinds nothing', at('NOQUERN') === 'wheat 4', at('NOQUERN'));
check('and with one, grinds the wheat into flour, two to a flour', at('MILL') === 'flour 2,quern 1', at('MILL'));
const [fuelled, litRight, candlesLeft] = at('LAMP').split('|');
check('a wicka puts a candle out of the stores in a post that has none, lit if it is dark', fuelled === 'true' && litRight === 'true' && candlesLeft === '1', at('LAMP'));
const [bushTile, grassBeside] = at('BUSHTILE').split('|');
const [bushGot, bushCount, bushYields, bushPicked] = at('BUSH').split('|');
if (at('BUSHSEASON') === 'none') {
  check('a brambo passes a bush out of its season by', bushTile === 'false' && grassBeside === 'false', at('BUSHTILE'));
} else {
  check('a brambo finds a bush in its season, and not the grass beside it', bushTile === 'true' && grassBeside === 'false', at('BUSHTILE'));
  check('and picks it as a person would, leaving it picked', bushGot === bushYields && Number(bushCount) >= 1 && bushPicked === 'true', at('BUSH'));
}
const [grassLoad, mown, grassAgain] = at('GRASS').split('|');
check('a grazza cuts mixed grass off grass, marks the settlement\'s grass as cut today toward lawn, and leaves it short', grassLoad === 'mixed_grass 2' && mown === '4' && grassAgain === 'false', at('GRASS'));
const [mossLoad, mossAgain] = at('MOSS').split('|');
check('and moss off moss, leaving it short', mossLoad === 'moss 2' && mossAgain === 'false', at('MOSS'));
check('and set to it for an afternoon, carries its cuts home to the crate', Number(at('HAY')) >= 2, at('HAY'));
check('a siffa pans sand with the water at a corner, and not dry sand', at('PANTILE') === 'true|false', at('PANTILE'));
const pans = at('PAN').split(',').filter(Boolean);
check('and what settles in its pan is what a person\'s does', pans.length > 0 && pans.every((p) => ['copper_ore', 'tin_ore', 'silver_ore'].includes(p)), at('PAN'));

/* ---- what each does, in the browser -------------------------------------------------- */

const body = (): Game => {
  const g = Game.create(4242);
  const w = g.world;
  for (let y = 14; y <= 28; y++) for (let x = 14; x <= 28; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); }
  for (let y = 14; y <= 27; y++) for (let x = 14; x <= 27; x++) w.setTile(x, y, TileType.Grass, 0);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.deed = { name: 'Handsome', x: 20, y: 20, radius: 6, level: 2 };
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
const stock = (g: Game, x: number, y: number, items: Array<[string, number, string?]>): ReturnType<Game['addCrate']> =>
  g.addCrate('plank', x, y, 0, 0, items.map(([id, count, extra]) => ({ uid: g.inventory.nextUid++, id, ql: 30, dmg: 0, count, ...(extra ? { extra } : {}) })), true);
const held = (crate: ReturnType<Game['addCrate']>): string => crate.items.map((i) => `${i.id} ${i.count}`).sort().join(',') || '-';

{
  const g = body();
  stock(g, 21, 20, []);
  const woola = g.creatures.spawn('woola', 22.5, 22.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  woola.care = 0;
  worker(g, 'kemma');
  run(g, 120);
  check('in the browser, a kemma brushes a woola of yours wanting it up past the line', woola.care >= CARE_WANTING, String(woola.care));
}
{
  const g = body();
  const crate = stock(g, 21, 20, [['bucket', 1]]);
  const woola = g.creatures.spawn('woola', 22.5, 22.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  const cudda = g.creatures.spawn('cudda', 18.5, 22.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  woola.fleece = 1;
  cudda.fleece = 1;
  worker(g, 'sheela');
  run(g, 180);
  check('a sheela shears a woola of yours and milks a cudda into the bucket in the stores',
    woola.fleece < DAIRY_FULL / 2 && cudda.fleece < DAIRY_FULL / 2 && held(crate) === 'milk_bucket 1,wool 3', `${woola.fleece} ${cudda.fleece} ${held(crate)}`);
}
{
  const g = body();
  const crate = stock(g, 21, 20, [['bandage', 1]]);
  const woola = g.creatures.spawn('woola', 22.5, 22.5, 'active', g.rand, g.time - 3600 * 24 * 30);
  woola.health = 1;
  woola.bleedUntil = g.time + 3600;
  woola.bleedRate = 0.01;
  worker(g, 'salva');
  run(g, 60);
  check('a salva dresses a bleeding woola of yours with the bandage out of the stores', woola.health > 1 && woola.bleedUntil <= g.time && held(crate) === '-', `${woola.health} ${held(crate)}`);
}
{
  const g = body();
  const crate = stock(g, 21, 20, [['corpse', 1, 'Rabba']]);
  worker(g, 'carra');
  run(g, 60);
  check('a carra butchers the rabba in the stores and puts its meat back in', !held(crate).includes('corpse') && held(crate).includes('meat'), held(crate));
}
{
  const g = body();
  const crate = stock(g, 21, 20, [['hide', 1], ['lye_bucket', 1], ['carving_knife', 1]]);
  worker(g, 'tanna');
  run(g, 60);
  check('a tanna tans the hide in the lye, and the leather and the bucket go back in beside the knife', held(crate) === 'bucket 1,carving_knife 1,leather 1', held(crate));
}
{
  const g = body();
  const crate = stock(g, 21, 20, [['wheat', 4]]);
  worker(g, 'grista');
  run(g, 60);
  check('a grista with no quern in the stores grinds nothing', held(crate) === 'wheat 4', held(crate));
  crate.items.push({ uid: g.inventory.nextUid++, id: 'quern', ql: 30, dmg: 0, count: 1 });
  run(g, 120);
  check('and with one, grinds the wheat into flour, two to a flour', held(crate) === 'flour 2,quern 1', held(crate));
}
{
  const g = body();
  const crate = stock(g, 21, 20, [['candle', 2]]);
  const post = g.addFurniture('lamp_post', 23, 22, 0, 0, 50);
  post.lamp = { ql: 50 };
  post.fuel = 0;
  post.lit = false;
  worker(g, 'wicka');
  run(g, 60);
  check('a wicka puts a candle out of the stores in a post that has none, lit if it is dark',
    (post.fuel ?? 0) > 0 && !!post.lit === g.isNight() && held(crate) === 'candle 1', `${post.fuel} ${post.lit} ${held(crate)}`);
}
{
  const g = body();
  const crate = stock(g, 21, 20, []);
  g.world.setTile(23, 23, TileType.Moss, 0);
  worker(g, 'grazza');
  run(g, 120);
  const hay = crate.items.filter((i) => i.id === 'mixed_grass' || i.id === 'moss').reduce((n, i) => n + i.count, 0);
  check('a grazza cuts grass and moss and carries its cuts home to the crate', hay >= 2, held(crate));
}
{
  const g = body();
  g.world.setTile(23, 22, TileType.Sand, 0);
  g.world.setTile(23, 24, TileType.Sand, 0);
  g.world.setHeight(24, 23, -3);
  const c = worker(g, 'siffa');
  check('in the browser, a siffa pans sand with the water at a corner, and not dry sand',
    g.creatures.gatherable(g, 23, 22, 'pan', c) && !g.creatures.gatherable(g, 23, 24, 'pan', c));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nten more hands — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
