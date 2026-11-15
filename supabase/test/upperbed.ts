/**
 * A garden bed up a storey, the same on both sides.
 *
 * Reported from the island, over a storey-2 tile of a greenhouse whose storey-2
 * floor is garden beds: "bug: name of the floor is garden_bed and unable to sow
 * on second floor". The line over the tile wrote the material's id where its
 * name goes; and a bed up a storey could not be sown over a crop on the storey
 * under it (the island kept one crop a tile), nor at all when picked on a
 * pinned storey from another one (a job was aimed at the storey stood on).
 *
 * On a greenhouse of two storeys, garden beds on both, a glass roof over it:
 *   * its floor named "Garden bed floor" over the tile and in Examine, on both
 *     sides, and never by its id;
 *   * a crop on the storey-1 bed, sown while the floor over it was planned and
 *     standing still once it was finished; the storey-2 bed over it sown from
 *     storey 2 all the same, tended, grown on the glass clock in a winter under
 *     the glass roof and harvested, the island and the browser agreeing at each
 *     step, and the crop on storey 1 under it its own throughout: not tended,
 *     not grown, not reaped;
 *   * a job naming storey 2 asked from the ground: refused on the island in so
 *     many words, and walked up to by the browser first; the same job naming no
 *     storey is the ground floor's;
 *   * the ground read carrying both crops of the tile, each by its storey, and
 *     the browser keeping both;
 *   * and drawn in Chromium (`upperbed-page.ts`): pinned on storey 2, the line
 *     over a bed says "Garden bed floor" and its crop, and the menu of an empty
 *     bed offers Sow to somebody standing on the ground. Needs a Chromium as
 *     `storeyview.ts` does; without one the drawing is skipped, unless
 *     `STOREY_STRICT` is set, as it is in CI. With `UPPERBED_PNG` set to a
 *     directory, the tooltip and the beds are written there as PNGs.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { floorSaid, floorsSaid } from '../../src/game/building';
import { CROPS, STAGE_NAMES } from '../../src/game/farming';
import { BED, BED_COVERED, BED_NAME, bedStoreySaid } from '../../src/game/gardenbed';
import { Game, type IslandGround } from '../../src/game/game';
import { REAP_TOOL, TEND_TOOL } from '../../src/game/jobtools';
import { TileType } from '../../src/world/tiles';
import type { UpperLook } from './upperbed-page';
import { psql, check, bad, finish } from './harness';

/*
 * The ground, the same on both sides: a greenhouse of two storeys on (10..12, 10), roofed in glass:
 *   (10, 10): a garden bed on storey 1 and on storey 2 over it, storey 2's planned and finished after storey 1 is sown;
 *   (11, 10): a garden bed on both storeys, finished, the one on storey 1 covered by the one on storey 2;
 *   (12, 10): plank on storey 1, a plank staircase up on storey 2.
 */
const ODA = '6e1b0000-0000-4000-8000-0000000000d2';
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const tile = (x: number, y: number, extra: Record<string, unknown> = {}): string => q(JSON.stringify({ kind: 'tile', x, y, cx: x, cy: y, ...extra }));
const PER = CROPS.wheat.stageSeconds;
const RIPE = STAGE_NAMES.length - 1;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Every skill check passes, and a pair of hands turns out forty: a go must show the rule.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
   p_tool_ql double precision default 0, p_ease double precision default 0)
   returns boolean language sql as 'select true';
create or replace function product_ql(p_skill double precision, p_tool_ql double precision default 0)
  returns double precision language sql as 'select 40::double precision';
create or replace function harvest_seeds(p_chance double precision default seed_chance()) returns integer language sql volatile as $pin$ select 0 $pin$;
create function pg_temp.said(w uuid, u uuid, p text) returns text language sql as $f$
  select e.text from event e where e.world_id = w and e.uid = u and e.text like p order by e.n desc limit 1
$f$;
-- Every crop on a tile, from the ground up: storey:id:stage:tended:glass:still.
create function pg_temp.crops(p_w uuid, p_x int, p_y int) returns text language sql stable as $f$
  select coalesce(string_agg(c.storey || ':' || c.id || ':' || c.stage || ':' || c.tended || ':' || c.glass || ':' || c.still, ',' order by c.storey), 'none')
    from crop c where c.world_id = p_w and c.x = p_x and c.y = p_y
$f$;
create function pg_temp.at(p_w uuid, p_u uuid, p_x int, p_y int, p_l int) returns void language sql as $f$
  update player set body_at = now(), x = p_x + 0.5, y = p_y + 0.5, level = p_l, act = null, act_queue = '[]' where world_id = p_w and uid = p_u
$f$;
create function pg_temp.floor(w uuid, l int, x int, y int, m text, k text default 'floor', done boolean default true) returns void language sql as $f$
  insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total)
  values (w, l, x, y, 1, m, k, case when k = 'stairs' then 'w' end,
          case when done then '{}'::jsonb else floor_bill(m, k, 'gable') end, floor_bill(m, k, 'gable'))
$f$;
do $t$
declare w uuid; u uuid := '${ODA}'; v_seed bigint; v_j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Upper beds', 172, 64, 5, 5, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Oda');
  for i in 6 .. 16 loop for j in 6 .. 14 loop
    perform land_set_height(w, i, j, 20); perform land_set_dirt(w, i, j, 5);
    perform land_set_tile(w, i, j, ${TileType.Grass});
  end loop; end loop;
  update player set stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'farming', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform give(w, u, '${TEND_TOOL}', 1, 40); perform give(w, u, '${REAP_TOOL}', 1, 40);
  perform give(w, u, 'wheat_seed', 20, 50);
  v_seed := (select i.id from item i where i.world_id = w and i.holder_uid = u and i.def = 'wheat_seed' order by i.id limit 1);

  insert into building (world_id, id, name, levels, work_level, planned_by, roof) values (w, 1, 'Greenhouse', 2, 1, u, 'gable');
  insert into building_tile (world_id, building, x, y) values (w, 1, 10, 10), (w, 1, 11, 10), (w, 1, 12, 10);
  for i in 10 .. 12 loop perform land_set_tile(w, i, 10, ${TileType.PackedDirt}); end loop;
  perform pg_temp.floor(w, 0, 10, 10, '${BED}'); perform pg_temp.floor(w, 0, 11, 10, '${BED}'); perform pg_temp.floor(w, 0, 12, 10, 'plank');
  perform pg_temp.floor(w, 1, 10, 10, '${BED}', 'floor', false); perform pg_temp.floor(w, 1, 11, 10, '${BED}');
  perform pg_temp.floor(w, 1, 12, 10, 'plank', 'stairs');
  for i in 10 .. 12 loop perform pg_temp.floor(w, 2, i, 10, 'glass', 'roof'); end loop;

  /* ---- Storey 1 sown while the floor over it is planned; that floor finished, it stands still ---- */
  perform pg_temp.at(w, u, 10, 10, 0);
  perform act_perform(w, u, 'plant_seed', ${tile(10, 10)}::jsonb || jsonb_build_object('itemUid', v_seed));
  insert into said values ('LOWSOWN', pg_temp.crops(w, 10, 10));
  update floor_tile set needed = '{}' where world_id = w and level = 1 and x = 10 and y = 10;
  insert into said values ('LOWSTILL', pg_temp.crops(w, 10, 10));
  insert into said values ('NAME', examine_tile_text(w, 10, 10, u));

  /* ---- From the ground: storey 2 named is refused; storey 1's beds are covered by storey 2's ---- */
  insert into said values ('FROMGROUND', coalesce(act_refusal(w, u, 'plant_seed', ${tile(10, 10, { level: 1 })}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none')
    || '|' || coalesce(act_refusal(w, u, 'plant_seed', ${tile(10, 10)}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none')
    || '|' || coalesce(act_refusal(w, u, 'plant_seed', ${tile(11, 10)}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));

  /* ---- From storey 2: sown over the crop under it, and tended ---- */
  perform pg_temp.at(w, u, 10, 10, 1);
  insert into said values ('UPASK', coalesce(act_refusal(w, u, 'plant_seed', ${tile(10, 10, { level: 1 })}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));
  perform act_perform(w, u, 'plant_seed', ${tile(10, 10, { level: 1 })}::jsonb || jsonb_build_object('itemUid', v_seed));
  insert into said values ('UPSOWN', pg_temp.crops(w, 10, 10) || '|' || coalesce(pg_temp.said(w, u, 'Sown: %'), 'unsaid'));
  insert into said values ('AGAIN', coalesce(act_refusal(w, u, 'plant_seed', ${tile(10, 10, { level: 1 })}::jsonb || jsonb_build_object('itemUid', v_seed)), 'none'));
  insert into said values ('TENDASK', coalesce(act_refusal(w, u, 'tend_crop', ${tile(10, 10, { level: 1 })}), 'none'));
  perform act_perform(w, u, 'tend_crop', ${tile(10, 10, { level: 1 })});
  insert into said values ('TENDED', pg_temp.crops(w, 10, 10) || '|' || coalesce(act_refusal(w, u, 'tend_crop', ${tile(10, 10, { level: 1 })}), 'none'));

  /* ---- A winter under the glass roof: storey 2's grows on the glass clock, storey 1's stands still ---- */
  perform set_config('wildermon.season', 'winter', true);
  update crop set stage_at = now() - make_interval(secs => ${PER} / glasshouse_growth() + 1) where world_id = w and x = 10 and y = 10 and storey = 1;
  perform crops_settle(w, 10.5, 10.5, 2);
  insert into said values ('WINTER', pg_temp.crops(w, 10, 10));
  perform set_config('wildermon.season', '', true);

  /* ---- The ground read: both crops of the tile, each by its storey ---- */
  update player set x = 10.5, y = 10.5 where world_id = w and uid = u;
  delete from caller where uid = u;
  v_j := rpc_ground(w, 40, true);
  insert into said values ('GROUND', v_j->'crops');

  /* ---- Ripe on storey 2: harvested from there, storey 1's left as it was ---- */
  update crop set stage = ${RIPE}, stage_at = now() where world_id = w and x = 10 and y = 10 and storey = 1;
  insert into said values ('REAPASK', coalesce(act_refusal(w, u, 'harvest_crop', ${tile(10, 10, { level: 1 })}), 'none'));
  perform act_perform(w, u, 'harvest_crop', ${tile(10, 10, { level: 1 })});
  insert into said values ('REAPED', pg_temp.crops(w, 10, 10) || '|' || (select coalesce(sum(count), 0) from item where world_id = w and holder_uid = u and def = 'wheat')
    || '|' || coalesce(pg_temp.said(w, u, 'Harvested: %'), 'unsaid'));
  -- And from the ground, storey 1's is the ground floor's to work, covered and standing still: tended, not sown over.
  perform pg_temp.at(w, u, 10, 10, 0);
  insert into said values ('LOWTEND', coalesce(act_refusal(w, u, 'tend_crop', ${tile(10, 10)}), 'none'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the browser, on the same ground ------------------------------------------------------------ */
const game = Game.create(4252);
// The island's player's farming (above): sowing is gated by the crop (`CROP_GATE`).
game.skills.values.set('farming', 50);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
game.creatures.fromIsland = true;
const w = game.world;
for (let x = 6; x <= 16; x++) for (let y = 6; y <= 14; y++) { w.setHeight(x, y, 20); w.setTile(x, y, TileType.Grass); }
for (let x = 10; x <= 12; x++) w.setTile(x, 10, TileType.PackedDirt);
const bld = game.buildings;
const done = <T extends { needed: Record<string, number> }>(f: T): T => { for (const k of Object.keys(f.needed)) f.needed[k] = 0; return f; };
const house = bld.create('Greenhouse', 10, 10);
bld.addTile(house, 11, 10);
bld.addTile(house, 12, 10);
house.levels = 2;
house.roof = 'gable';
done(bld.setFloor(house, 0, 10, 10, BED));
done(bld.setFloor(house, 0, 11, 10, BED));
done(bld.setFloor(house, 0, 12, 10, 'plank'));
done(bld.setFloor(house, 1, 10, 10, BED));
done(bld.setFloor(house, 1, 11, 10, BED));
done(bld.setFloor(house, 1, 12, 10, 'plank', 'stairs', 'w'));
for (let x = 10; x <= 12; x++) done(bld.setFloor(house, 2, x, 10, 'glass', 'roof'));
bld.changed();
for (const t of [REAP_TOOL, TEND_TOOL]) if (!game.inventory.has(t)) game.inventory.add(t, { ql: 40 });
const seed = game.inventory.add('wheat_seed', { count: 10, ql: 50 });
const tgt = (x: number, y: number, extra: Record<string, unknown> = {}): Target => ({ kind: 'tile', x, y, cx: x, cy: y, ...extra } as Target);
const ask = (id: string, t: Target): string => ACTION_BY_ID.get(id)!.check?.(t, game) ?? 'none';
const offered = (id: string, t: Target): boolean => ACTION_BY_ID.get(id)!.applies(t, game);
const stand = (x: number, y: number, level: number): void => { game.player.x = x + 0.5; game.player.y = y + 0.5; game.player.level = level; };
const crops = (x: number, y: number): string =>
  game.cropsAt(x, y).map((c) => `${c.level ?? 0}:${c.id}:${c.stage}:${c.tended}:${!!c.glass}:${!!c.still}`).join(',') || 'none';

/* ---- the name ------------------------------------------------------------------------------------- */
const upFloor = bld.floor(1, 10, 10)!;
check('the line over a storey-2 bed names its floor by its material\'s name: "Garden bed floor"', floorSaid(upFloor) === 'Garden bed floor', floorSaid(upFloor));
const mineFloors = floorsSaid(bld, house, 10, 10);
check('Examine names both storeys\' floors so on the island: "Storey 1: Garden bed floor. Storey 2: Garden bed floor."',
  at('NAME').includes(' Storey 1: Garden bed floor. Storey 2: Garden bed floor.') && !at('NAME').includes(BED), at('NAME'));
const examine = (x: number, y: number): string => {
  ACTION_BY_ID.get('examine')!.perform(tgt(x, y), game);
  const text = game.log[game.log.length - 1]?.text ?? '';
  return text.slice(text.indexOf(' Building: '));
};
const mineLook = examine(10, 10);
const theirLook = at('NAME').slice(at('NAME').indexOf(' Building: '));
check('and in the browser, in the same words', mineLook === theirLook && mineFloors === ' Storey 1: Garden bed floor. Storey 2: Garden bed floor.',
  `browser "${mineLook}", island "${theirLook}"`);
check('a staircase and a plank floor by theirs', floorsSaid(bld, house, 12, 10) === ' Storey 1: Plank floor. Storey 2: Plank staircase.', floorsSaid(bld, house, 12, 10));

/* ---- storey 1 sown, then covered ------------------------------------------------------------------- */
check('storey 1\'s bed sown from the ground while the floor over it is planned, on the glass clock', at('LOWSOWN') === '0:wheat:0:0:true:false', at('LOWSOWN'));
check('the floor over it finished: storey 1\'s crop stands still', at('LOWSTILL') === '0:wheat:0:0:true:true', at('LOWSTILL'));
stand(10, 10, 0);
const sow = ACTION_BY_ID.get('plant_seed')!;
game.plantCrop(10, 10, 'wheat', 50, 1, 0);
game.cropAt(10, 10, 0)!.still = true;

/* ---- asked from the ground --------------------------------------------------------------------- */
const [groundUp, groundOwn, groundCovered] = at('FROMGROUND').split('|');
check(`a sowing naming storey 2 asked from the ground: refused on the island, "${bedStoreySaid(1)}"`, groundUp === bedStoreySaid(1), groundUp);
const upFromGround = tgt(10, 10, { level: 1, itemUid: seed.uid });
check('offered and allowed in the browser, which walks you up to storey 2 first: out of reach from the ground, in reach on storey 2',
  offered('plant_seed', upFromGround) && ask('plant_seed', upFromGround) === 'none' && !game.inRange(sow, upFromGround)
    && (stand(10, 10, 1), game.inRange(sow, upFromGround)), ask('plant_seed', upFromGround));
stand(10, 10, 0);
const mineOwn = ask('plant_seed', tgt(10, 10, { itemUid: seed.uid }));
check(`naming no storey, from the ground it is storey 1's bed, covered by storey 2's: "${BED_COVERED}" on both sides`,
  groundOwn === BED_COVERED && mineOwn === groundOwn, `browser "${mineOwn}", island "${groundOwn}"`);
const mineCovered = ask('plant_seed', tgt(11, 10, { itemUid: seed.uid }));
check(`and the empty one beside it the same: "${BED_COVERED}" on both sides`, groundCovered === BED_COVERED && mineCovered === BED_COVERED, `browser "${mineCovered}", island "${groundCovered}"`);

/* ---- from storey 2 ------------------------------------------------------------------------------- */
stand(10, 10, 1);
const up = tgt(10, 10, { level: 1, itemUid: seed.uid });
const mineUpAsk = ask('plant_seed', up);
check('from storey 2, over the crop under it: allowed on both sides', at('UPASK') === 'none' && mineUpAsk === 'none', `browser "${mineUpAsk}", island "${at('UPASK')}"`);
sow.perform(up, game);
const [upCrops, upSaid] = at('UPSOWN').split('|');
check('sown on storey 2 on the glass clock, storey 1\'s still standing under it, a crop each, on both sides',
  upCrops === '0:wheat:0:0:true:true,1:wheat:0:0:true:false' && crops(10, 10) === upCrops && (upSaid ?? '').startsWith('Sown: wheat'),
  `browser ${crops(10, 10)}, island ${at('UPSOWN')}`);
const mineAgain = ask('plant_seed', up);
check('and storey 2 sown again refused, "Already growing a crop.", on both sides', at('AGAIN') === 'Already growing a crop.' && mineAgain === at('AGAIN'), `browser "${mineAgain}", island "${at('AGAIN')}"`);
const upJob = tgt(10, 10, { level: 1 });
const mineTendAsk = ask('tend_crop', upJob);
check('Tend offered and allowed on storey 2\'s crop', at('TENDASK') === 'none' && offered('tend_crop', upJob) && mineTendAsk === 'none', `browser "${mineTendAsk}", island "${at('TENDASK')}"`);
ACTION_BY_ID.get('tend_crop')!.perform(upJob, game);
const [tendCrops, tendAgain] = at('TENDED').split('|');
check('tended: storey 2\'s crop, and not storey 1\'s under it, on both sides', tendCrops === '0:wheat:0:0:true:true,1:wheat:0:1:true:false' && crops(10, 10) === tendCrops,
  `browser ${crops(10, 10)}, island ${at('TENDED')}`);
const mineTendAgain = ask('tend_crop', upJob);
check('and not tended twice at the stage', tendAgain === 'Already tended at this growth stage.' && mineTendAgain === tendAgain, `browser "${mineTendAgain}", island "${tendAgain}"`);
check('in a winter under the glass roof storey 2\'s comes on a stage at the glass clock\'s pace; storey 1\'s, covered, stands still',
  at('WINTER') === '0:wheat:0:0:true:true,1:wheat:1:1:true:false', at('WINTER'));

/* ---- the ground read ------------------------------------------------------------------------------ */
const read = JSON.parse(at('GROUND') === '(not said)' ? '[]' : at('GROUND')) as Array<{ x: number; y: number; level?: number; still?: boolean; stage: number }>;
const here = read.filter((c) => c.x === 10 && c.y === 10).map((c) => `${c.level ?? '-'}:${c.stage}:${!!c.still}`).sort().join(',');
check('the ground read carries both crops of the tile, each by its storey', here === '0:0:true,1:1:false', here);
game.islandClock = () => 2e9;
game.sawGround({ placed: [], crates: [], lying: [], now: 2e9, crops: read } as unknown as IslandGround, undefined, 'me');
check('and the browser keeps both, each on its storey', game.cropAt(10, 10, 0)?.still === true && game.cropAt(10, 10, 1)?.stage === 1 && game.cropsAt(10, 10).length === 2,
  crops(10, 10));

/* ---- harvested from storey 2 --------------------------------------------------------------------- */
game.cropAt(10, 10, 1)!.stage = RIPE;
const mineReapAsk = ask('harvest_crop', upJob);
check('ripe on storey 2: Harvest offered and allowed on both sides', at('REAPASK') === 'none' && offered('harvest_crop', upJob) && mineReapAsk === 'none',
  `browser "${mineReapAsk}", island "${at('REAPASK')}"`);
ACTION_BY_ID.get('harvest_crop')!.perform(upJob, game);
const [reapCrops, reapGot, reapSaid] = at('REAPED').split('|');
check(`harvested, "… ${BED_NAME} ready to sow.", storey 1's crop left under it as it was, on both sides`,
  reapCrops === '0:wheat:0:0:true:true' && Number(reapGot) > 0 && (reapSaid ?? '').endsWith(`. ${BED_NAME} ready to sow.`)
    && crops(10, 10) === '0:wheat:0:0:true:true', `browser ${crops(10, 10)}, island ${at('REAPED')}`);
stand(10, 10, 0);
const mineLowTend = ask('tend_crop', tgt(10, 10));
check('from the ground, storey 1\'s crop is the ground floor\'s to tend, on both sides', at('LOWTEND') === 'none' && mineLowTend === 'none', `browser "${mineLowTend}", island "${at('LOWTEND')}"`);

/* ---- drawn ------------------------------------------------------------------------------------------ */
/** A Chromium to drive, as `storeyview.ts` finds one, or null. */
function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}
const options = browserOptions();
if (!options) {
  console.log('upperbed: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.STOREY_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/upperbed-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const pngs = process.env.UPPERBED_PNG;
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: pngs ? 2 : 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    // For the pictures, the tooltip in the game's own colours (`style.css`, `.tooltip`), over the canvas; no window drawn.
    if (pngs) {
      await tab.addStyleTag({ content: `
        body > div:last-of-type { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
        body > div:last-of-type > :not(.tooltip) { display: none !important; }
        .tooltip { position: absolute; padding: 4px 8px; background: rgba(34, 30, 25, 0.95); border: 1px solid #6b5836; white-space: nowrap;
          z-index: 9000; color: #d9d0bd; font: 13px/1.4 'Segoe UI', system-ui, sans-serif; }
        .tooltip-title { color: #e3b657; } .tooltip-line { color: #8f8574; font-size: 11px; }` });
    }
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Page = { look: (view: number | null, x: number, y: number, level: number) => UpperLook; gx: number; gy: number };
    const look = (view: number | null, x: number, y: number, level: number): Promise<UpperLook> =>
      tab.evaluate(([view, x, y, level]) => (window as unknown as { upperbed: Page }).upperbed.look(view, x, y, level), [view, x, y, level] as const);
    const g = await tab.evaluate(() => { const s = (window as unknown as { upperbed: Page }).upperbed; return { gx: s.gx, gy: s.gy }; });
    if (pngs) mkdirSync(pngs, { recursive: true });
    // The beds of storey 2, pinned, at every stage.
    await look(1, g.gx + 2, g.gy + 2, 1);
    if (pngs) {
      await tab.evaluate(() => document.querySelectorAll<HTMLElement>('.tooltip').forEach((e) => { e.hidden = true; }));
      await tab.screenshot({ path: join(pngs, 'crops-storey2.png') });
    }
    // Over a bed with a crop on it: the tooltip.
    const over = await look(1, g.gx + 2, g.gy, 1);
    if (pngs) await tab.screenshot({ path: join(pngs, 'tooltip.png') });
    check('pinned on storey 2, the pointer over a bed picks it on storey 2', over.pick?.level === 1 && over.pick?.x === g.gx + 2 && over.pick?.y === g.gy, JSON.stringify(over.pick));
    check('and the line over it says "Garden bed floor", and never the id', over.tip.includes('Garden bed floor') && !over.tip.some((l) => l.includes(BED)), over.tip.join(' | '));
    check('and the crop growing on it', over.tip.some((l) => l.startsWith(`Corn in a ${BED_NAME.toLowerCase()}`)), over.tip.join(' | '));
    const empty = await look(1, g.gx + 1, g.gy + 1, 1);
    check('an empty bed of storey 2, to somebody standing on the ground: its menu offers Sow', empty.rows.includes('Sow'), `${empty.title}: ${empty.rows.join(' / ')}`);
    const grown = await look(1, g.gx, g.gy + 1, 1);
    check('a bed of storey 2 with a crop on it, over a crop on storey 1: its own crop\'s jobs, Tend or Harvest, and no Sow',
      !grown.rows.includes('Sow') && grown.rows.some((r) => r === 'Tend' || r === 'Harvest'), `${grown.title}: ${grown.rows.join(' / ')}`);
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

finish('garden beds up a storey');
