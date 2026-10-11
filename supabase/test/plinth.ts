/**
 * The enchanter's plinth (`enchant.ts`, `furniture.ts`, `plinth.ts`), on both
 * sides.
 *
 * Built with masonry and a trowel from its bill and refused short of it, set
 * down as any piece is, and moss gathering on it as on a statue; Enchant
 * refused away from one in the station rule's words, on the scroll's pack
 * entry as on the job, and taken within the station reach of its middle and
 * not a step past it; writing a scroll needing none; and the browser's own
 * reading of it in use -- you or anybody else enchanting within that reach --
 * and the light it throws at rest and in use.
 *
 * Runs against the database the suite leaves behind; the island half is
 * rolled back.
 *
 *   npx esbuild supabase/test/plinth.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/plinth.mjs && node node_modules/.cache/plinth.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { itemDef, type Item } from '../../src/game/items';
import { RECIPE_BY_ID, STATION_NAME } from '../../src/game/recipes';
import { ENCHANT_SAID, ENCHANTERS_PLINTH, PLINTH_NAME } from '../../src/game/enchant';
import { ENCHANT } from '../../src/game/enchanting';
import { furnitureCentre, furnitureDef, STATION_REACH } from '../../src/game/furniture';
import { PLINTH_BUSY_GLOW, PLINTH_BUSY_REACH, PLINTH_GLOW, PLINTH_REACH } from '../../src/game/light';
import { ENCHANT_JOB, plinthBusy } from '../../src/game/plinth';
import { TileType } from '../../src/world/tiles';

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
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

const RECIPE = `make_${ENCHANTERS_PLINTH}`;
const recipe = RECIPE_BY_ID.get(RECIPE);
const def = furnitureDef(ENCHANTERS_PLINTH);
/** Just inside the reach and just outside it, from the plinth's middle along the row. */
const INSIDE = STATION_REACH - 0.1;
const OUTSIDE = STATION_REACH + 0.1;

/* ---- the piece and the words, on both sides --------------------------------------- */

const bill = recipe?.inputs.map((i) => `${i.item}x${i.count ?? 1}`).join(',') ?? '';
const isleBill = psql(`select string_agg(item || 'x' || count, ',' order by ord) from recipe_input where recipe = '${RECIPE}'`);
check(`an enchanter's plinth is built from the same bill on both sides: ${bill}`,
  !!recipe && isleBill === bill && bill === 'stone_brickx32,mortarx12,stone_slabx2,light_motex1,dark_motex1', `${isleBill} / ${bill}`);
const isleWith = psql(`select skill || '|' || tool || '|' || coalesce(difficulty::text, '-') || '|' || base_time from recipe where id = '${RECIPE}'`);
check('with masonry and a trowel, at the same difficulty and time on both sides',
  isleWith === `${recipe?.skill}|${recipe?.tool}|${recipe?.difficulty}|${recipe?.baseTime}` && recipe?.skill === 'masonry' && recipe?.tool === 'trowel', isleWith);
const islePiece = psql(`select w || 'x' || h || '|' || mossy from furniture_def where id = '${ENCHANTERS_PLINTH}'`);
check('a piece two subtiles each way that gathers moss as a statue does, on both sides',
  islePiece === `${def.w}x${def.h}|true` && def.w === 2 && def.h === 2 && def.mossy === true, islePiece);
const isleNames = psql(`select station_name('${ENCHANTERS_PLINTH}') || '|' || enchant_said('plinth') || '|' || (select name from item_def where id = '${ENCHANTERS_PLINTH}')`);
check(`the station is called the same and refuses in the station rule's words on both sides: "${ENCHANT_SAID.plinth}"`,
  isleNames === `${STATION_NAME[ENCHANTERS_PLINTH]}|${ENCHANT_SAID.plinth}|${itemDef(ENCHANTERS_PLINTH).name}`
    && STATION_NAME[ENCHANTERS_PLINTH] === PLINTH_NAME && ENCHANT_SAID.plinth === `You need to stand at an ${PLINTH_NAME}.`, isleNames);
const isleText = psql(`select description from item_def where id = '${ENCHANTERS_PLINTH}'`);
check(`its description states the reach from the rule (${STATION_REACH} tiles), the same on both sides`,
  isleText === itemDef(ENCHANTERS_PLINTH).description && isleText.includes(`within ${STATION_REACH} tiles of the middle`) && !isleText.includes('{'), isleText);
check('writing a scroll asks for no station', ENCHANTMENT_SCROLLS_FREE(), '');
check('the plinth reads the Enchant job by its own id', ENCHANT_JOB === ENCHANT, ENCHANT_JOB);
function ENCHANTMENT_SCROLLS_FREE(): boolean {
  return [...RECIPE_BY_ID.values()].filter((r) => r.category === 'Enchanting').every((r) => !r.station);
}

/* ---- on the island ------------------------------------------------------------------ */

const MIRA = 'e1c4a170-0000-4000-8000-000000000014';
const T = (uid: string, scroll: string): string => `jsonb_build_object('kind', 'item', 'uid', ${uid}, 'scroll', ${scroll})`;
const count = (d: string): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${d}'), 0)`;
const out = psql(`
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wurm.dice'), ',');
        n int := coalesce(nullif(current_setting('wurm.dice_n', true), ''), '0')::int;
begin
  perform set_config('wurm.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wurm.dice', v, true);
  perform set_config('wurm.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_b bigint; v_it bigint; v_s bigint; v_sw bigint; v_pap bigint; v_pl placed;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Plinth', 141, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'masonry', 90), (w, u, 'enchanting', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- 1. Built: refused a mote short, then built from the whole bill.
  v_b := give(w, u, 'stone_brick', 32, 40);
  perform give(w, u, 'mortar', 12, 40);
  perform give(w, u, 'stone_slab', 2, 40);
  perform give(w, u, 'light_mote', 1, 40);
  perform give(w, u, 'trowel', 1, 50);
  insert into said values ('SHORT', coalesce(act_refusal(w, u, '${RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_b)), 'none'));
  perform give(w, u, 'dark_mote', 1, 40);
  insert into said values ('ASK', coalesce(act_refusal(w, u, '${RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_b)), 'none'));
  perform pg_temp.dice('0.01');
  perform perform_craft(w, u, '${RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_b));
  perform pg_temp.nodice();
  insert into said values ('BUILT', ${count(ENCHANTERS_PLINTH)} || '|' || ${count('stone_brick')} || '|' || ${count('light_mote')} || '|' || ${count('dark_mote')});

  -- 2. Away from one: Enchant refused; a scroll still written.
  v_sw := give(w, u, 'sword', 1, 40, 'Iron');
  v_s := give(w, u, 'emberbrand_scroll', 1, 90);
  insert into said values ('AWAY', coalesce(act_refusal(w, u, 'enchant', ${T('v_sw', 'v_s')}), 'none'));
  v_pap := give(w, u, 'papyrus', 1, 50);
  perform give(w, u, 'fire_mote', 2, 50);
  insert into said values ('WRITE', coalesce(act_refusal(w, u, 'make_emberbrand_scroll', jsonb_build_object('kind', 'item', 'uid', v_pap)), 'none'));

  -- 3. Set down, as any piece is.
  select id into v_it from item where world_id = w and holder_uid = u and def = '${ENCHANTERS_PLINTH}';
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'item', 'uid', v_it, 'x', 12, 'y', 10, 'sx', 0, 'sy', 0));
  select * into v_pl from placed where world_id = w and kind = 'furniture' and sub = '${ENCHANTERS_PLINTH}';
  insert into said values ('PLACED', coalesce(v_pl.x || ',' || v_pl.y || ',' || v_pl.cx || ',' || v_pl.cy, 'none') || '|' || ${count(ENCHANTERS_PLINTH)});

  -- 4. Its reach: just inside, and just outside, from its middle along the row.
  update player set x = v_pl.cx + ${INSIDE}, y = v_pl.cy where world_id = w and uid = u;
  insert into said values ('INSIDE', coalesce(act_refusal(w, u, 'enchant', ${T('v_sw', 'v_s')}), 'none'));
  update player set x = v_pl.cx - ${OUTSIDE}, y = v_pl.cy where world_id = w and uid = u;
  insert into said values ('OUTSIDE', coalesce(act_refusal(w, u, 'enchant', ${T('v_sw', 'v_s')}), 'none'));

  -- 5. At it, the job.
  update player set x = v_pl.cx + 1, y = v_pl.cy + 0.5 where world_id = w and uid = u;
  perform pg_temp.dice('0.01');
  perform act_perform(w, u, 'enchant', ${T('v_sw', 'v_s')});
  perform pg_temp.nodice();
  insert into said select 'TOOK', coalesce(i.enchant->>'id', 'none') || '|' || ${count('emberbrand_scroll')} from item i where i.id = v_sw;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(141, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
const held = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, count = 1, extra?: string): Item => g.gather(id, { count, ql, ...(extra ? { extra } : {}) });
g.skills.values.set('masonry', 90);
g.skills.values.set('enchanting', 100);

/* 1. Built. */
const brick = thing('stone_brick', 40, 32);
thing('mortar', 40, 12);
thing('stone_slab', 40, 2);
thing('light_mote', 40);
thing('trowel', 50);
const short = act(RECIPE).check?.({ kind: 'item', uid: brick.uid }, g) ?? 'none';
check(`a mote short, it is refused on both sides, the island naming the input short and the browser the same first: ${part('SHORT')}`,
  part('SHORT') !== 'none' && short !== 'none' && short.startsWith(part('SHORT').replace(/\.$/, '')) && part('SHORT').includes('dark mote'), `${part('SHORT')} / ${short}`);
thing('dark_mote', 40);
const ask = act(RECIPE).check?.({ kind: 'item', uid: brick.uid }, g) ?? 'none';
dice(0.01);
act(RECIPE).perform({ kind: 'item', uid: brick.uid }, g);
check('with its whole bill it is built, the bill used up, the same on both sides',
  part('ASK') === 'none' && ask === 'none' && isle.get('BUILT') === '1|0|0|0'
    && held(ENCHANTERS_PLINTH) === 1 && held('stone_brick') === 0 && held('light_mote') === 0 && held('dark_mote') === 0,
  `${isle.get('ASK')} ${isle.get('BUILT')} / ${ask} ${held(ENCHANTERS_PLINTH)}`);

/* 2. Away from one. */
const sword = thing('sword', 40, 1, 'Iron');
const scroll = thing('emberbrand_scroll', 90);
const enchantAsk = (): string => act(ENCHANT).check?.({ kind: 'item', uid: sword.uid, scroll: scroll.uid } as Target, g) ?? 'none';
const away = enchantAsk();
check(`away from a plinth Enchant is refused on both sides: ${away}`, isle.get('AWAY') === ENCHANT_SAID.plinth && away === ENCHANT_SAID.plinth, `${isle.get('AWAY')} / ${away}`);
check('and the scroll\'s pack entry says it before anything is chosen (the rule the entry reads: no plinth within reach)',
  !g.atStation(ENCHANTERS_PLINTH), '');
const pap = thing('papyrus', 50);
thing('fire_mote', 50, 2);
const write = act('make_emberbrand_scroll').check?.({ kind: 'item', uid: pap.uid }, g) ?? 'none';
check('a scroll is still written away from one, on both sides', isle.get('WRITE') === 'none' && write === 'none', `${isle.get('WRITE')} / ${write}`);

/* 3. Set down. */
const item = g.inventory.items.find((it) => it.id === ENCHANTERS_PLINTH) as Item;
const spot = { kind: 'tile' as const, x: 12, y: 10, itemUid: item.uid, sx: 0, sy: 0, facing: 's' as const };
const placeAsk = act('place_furniture').check?.(spot as Target, g) ?? 'none';
act('place_furniture').perform(spot as Target, g);
const placed = [...g.furniture.values()].find((f) => f.kind === ENCHANTERS_PLINTH);
const [cx, cy] = placed ? furnitureCentre(placed) : [NaN, NaN];
const [ix, iy, icx, icy] = part('PLACED').split(',').map(Number);
check(`it is set down as any piece is, at the same middle on both sides (${cx}, ${cy})`,
  placeAsk === 'none' && !!placed && ix === placed.x && iy === placed.y && near(icx, cx) && near(icy, cy) && part('PLACED', 1) === '0' && held(ENCHANTERS_PLINTH) === 0
    , `${isle.get('PLACED')} / ${placeAsk} ${placed?.x},${placed?.y} ${cx},${cy}`);

/* 4. Its reach. */
g.putBody(cx + INSIDE, cy, 0);
const inside = enchantAsk();
g.putBody(cx - OUTSIDE, cy, 0);
const outside = enchantAsk();
check(`Enchant is taken ${INSIDE} tiles from its middle and refused at ${OUTSIDE}, the station reach of ${STATION_REACH}, on both sides`,
  isle.get('INSIDE') === 'none' && inside === 'none' && isle.get('OUTSIDE') === ENCHANT_SAID.plinth && outside === ENCHANT_SAID.plinth,
  `${isle.get('INSIDE')} ${isle.get('OUTSIDE')} / ${inside} ${outside}`);

/* 5. At it. */
g.putBody(cx + 1, cy + 0.5, 0);
dice(0.01);
act(ENCHANT).perform({ kind: 'item', uid: sword.uid, scroll: scroll.uid } as Target, g);
check('standing at it, the scroll goes in, on both sides', part('TOOK') === 'emberbrand' && part('TOOK', 1) === '0' && sword.enchant?.id === 'emberbrand' && held('emberbrand_scroll') === 0,
  `${isle.get('TOOK')} / ${JSON.stringify(sword.enchant)}`);

/* 6. In use, and its light: the browser's own. */
if (placed) {
  g.islandClock = () => 0;
  const lit = (): { radius: number; strength: number } | undefined => g.lights().find((l) => near(l.x, cx) && near(l.y, cy));
  const rest = lit();
  check(`at rest nobody is enchanting at it, and at night it lights ${PLINTH_REACH} tiles at ${PLINTH_GLOW}`,
    !plinthBusy(g, placed) && g.darkness() > 0.5 && rest?.radius === PLINTH_REACH && rest?.strength === PLINTH_GLOW, JSON.stringify(rest));
  const s2 = thing('emberbrand_scroll', 90);
  const s3 = thing('sword', 40, 1, 'Iron');
  g.requestAction(act(ENCHANT), { kind: 'item', uid: s3.uid, scroll: s2.uid } as Target);
  for (let i = 0; i < 5 && g.action?.state !== 'performing'; i++) g.update(0.05);
  const busy = lit();
  check(`while you enchant at it, it is in use, and lights ${PLINTH_BUSY_REACH} tiles at ${PLINTH_BUSY_GLOW}`,
    g.action?.def.id === ENCHANT && plinthBusy(g, placed) && busy?.radius === PLINTH_BUSY_REACH && busy?.strength === PLINTH_BUSY_GLOW, `${g.action?.state} ${JSON.stringify(busy)}`);
  g.cancelAction?.();
  if (g.action) (g as unknown as { acting: { action: null } }).acting.action = null;
  g.putBody(cx + 6, cy, 0);
  const peer = { uid: 'peer-1', name: 'Tam', x: cx - 1.5, y: cy + 0.4, level: 0, act: ENCHANT } as const;
  const roster = g.roster as unknown as { list: () => unknown[] };
  const was = roster.list;
  roster.list = () => [peer];
  const byPeer = plinthBusy(g, placed);
  roster.list = () => [{ ...peer, x: cx - OUTSIDE }];
  const peerFar = plinthBusy(g, placed);
  roster.list = () => [{ ...peer, act: 'make_emberbrand_scroll' }];
  const peerOther = plinthBusy(g, placed);
  roster.list = was;
  check('somebody else enchanting within its reach puts it in use too; past its reach, or at another job, does not',
    byPeer && !peerFar && !peerOther && !plinthBusy(g, placed), `${byPeer} ${peerFar} ${peerOther}`);
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(`${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
