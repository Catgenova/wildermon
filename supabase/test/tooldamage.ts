/**
 * Every job that takes a tool wears it.
 *
 * Asked: "Enforce that any task that requires a tool also damages that tool". The jobs that take a tool are the
 * browser's actions and recipes with one (`ActionDef.tool`), the building jobs whose tool is their material's or a
 * mallet (`ActionDef.toolFor`), and improving, which takes every tool its material asks for. On both sides a go wears
 * the tool a go's worth (`wearPerUse`, the island's `wear_tool`) by the job's `wear` — whether the go came off or not,
 * once, and not on a settlement worker's errand.
 *
 * Asked of both sides:
 *   * the lists: every job with a tool in the browser is one on the island with the same tool, and the same `wear`
 *     (`private.job_wear`); a building job's tool is the same for each material (`private.job_tool`);
 *   * the browser: a go of every job with a tool wears its best copy by `wear`, and improving wears each of its tools;
 *   * the island: every go is `private.act_go`'s, and a go of one job of each family — crafting, the ground, the
 *     terrain, a field and a planter, an item, a building, the forge, the smelter, a lock, a beast, a mount, a vine,
 *     improving — wears it by the browser's amount, once, where its performer wore it already or not;
 *   * a worker's errand wears nothing.
 *
 * Read only: the island's half is rolled back.
 */
import { Game } from '../../src/game/game';
import { ACTIONS, ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { MATERIALS } from '../../src/game/building';
import { IMPROVE_ACTIONS } from '../../src/game/improve';
import { wearPerUse } from '../../src/game/limits';
import { psql, ok, bad, check } from './harness';

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const QL = 30;
/** One go's wear on a plain tool at `QL`, by a job's `wear`: the browser's `wearPerUse`, the island's `wear_tool`. */
const goWear = (wear = 1): number => wearPerUse(QL) * wear;

// ---- The lists. Ordered by code point on both sides (`collate "C"`, as JavaScript's sort): CI's Postgres sorts '_' by its locale.
const tooled = ACTIONS.filter((a) => a.tool);
const fitted = ACTIONS.filter((a) => a.toolFor);
const island = psql(`select coalesce(string_agg(id || '=' || tool, ',' order by id collate "C"), '') from action_def where tool is not null;`);
const browser = tooled.map((a) => `${a.id}=${a.tool}`).sort().join(',');
check(`every job with a tool in the browser has it on the island, and none more (${tooled.length})`, island === browser,
  island === browser ? '' : `island only: ${island.split(',').filter((x) => !browser.split(',').includes(x)).join(' ')}; browser only: ${browser.split(',').filter((x) => !island.split(',').includes(x)).join(' ')}`);
const wears = psql(`select string_agg(id || '=' || private.job_wear(id), ',' order by id collate "C") from action_def;`);
const wantWears = ACTIONS.map((a) => `${a.id}=${a.wear ?? 1}`).sort().join(',');
check('a go wears it by the browser\'s `wear` on the island (`private.job_wear`)', wears === wantWears,
  wears === wantWears ? '' : wears.split(',').filter((x) => !wantWears.split(',').includes(x)).join(' '));
const jobTool = psql(`select coalesce(string_agg(id, ','), '') from action_def
  where tool is distinct from private.job_tool(gen_random_uuid(), gen_random_uuid(), id, '{}'::jsonb) and tool is not null;`);
check('the island\'s go asks for every job\'s own tool (`private.job_tool`)', jobTool === '', jobTool);

// A building job's tool, by every material, on both sides.
const g = Game.create(4112, 96);
g.perkFx = {};
const tx = g.player.tileX;
const ty = g.player.tileY;
const bare = (extra: Record<string, unknown> = {}): Target => ({ kind: 'tile', x: tx, y: ty, cx: tx, cy: ty, side: 'n', ...extra }) as Target;
const fence = ACTION_BY_ID.get('plan_fence');
const byMaterial = MATERIALS.map((m) => `${m.id}=${fence?.toolFor?.(bare({ material: m.id, wallType: 'fence' }), g) ?? '-'}`).sort().join(',');
const islandByMaterial = psql(`select string_agg(id || '=' || coalesce(private.job_tool(gen_random_uuid(), gen_random_uuid(), 'plan_fence',
    jsonb_build_object('material', id)), '-'), ',' order by id) from build_material_def where id in (${MATERIALS.map((m) => `'${m.id}'`).join(', ')});`);
check(`a fence is planned with its material's tool on both sides (${MATERIALS.length} materials)`, byMaterial === islandByMaterial,
  byMaterial === islandByMaterial ? '' : `${byMaterial} / ${islandByMaterial}`);
const planned = fitted.filter((a) => a.toolFor?.(bare(), g)).map((a) => `${a.id}=${a.toolFor?.(bare(), g)}`).sort().join(',');
const islandPlanned = psql(`select string_agg(id || '=' || private.job_tool(gen_random_uuid(), gen_random_uuid(), id,
    '{"x": 0, "y": 0, "side": "n"}'::jsonb), ',' order by id) from unnest(array[${fitted.map((a) => `'${a.id}'`).join(', ')}]) id
  where private.job_tool(gen_random_uuid(), gen_random_uuid(), id, '{"x": 0, "y": 0, "side": "n"}'::jsonb) is not null;`);
check('a building, a wall, a floor, a storey, a column and a change are planned with the same tool on both sides', planned === islandPlanned && planned !== '',
  `${planned} / ${islandPlanned}`);

// ---- The browser: a go of every job with a tool wears its best copy, by `wear`.
const only = (tool: string): number => {
  for (const it of [...g.inventory.items]) if (it.id === tool) g.inventory.remove(it.uid, it.count);
  return g.inventory.add(tool, { ql: QL }).uid;
};
const go = (def: ActionDef, t: Target): void => {
  g.action = { def, target: t, state: 'performing', elapsed: 1, duration: 1 };
  (g as unknown as { completeAction(): void }).completeAction();
};
const unworn: string[] = [];
for (const a of [...tooled, ...fitted]) {
  const t = bare({ material: 'plank', wallType: 'fence' });
  const tool = a.tool ?? a.toolFor?.(t, g);
  if (!tool) continue;
  const uid = only(tool);
  const spare = g.inventory.add(tool, { ql: 5 }).uid;
  g.player.stats.stamina = 1;
  go({ ...a, applies: () => true, check: () => null, perform: () => undefined }, t);
  const got = g.inventory.get(uid)?.dmg ?? -1;
  const other = g.inventory.get(spare)?.dmg ?? -1;
  if (!near(got, goWear(a.wear)) || other !== 0) unworn.push(`${a.id}: ${got} (want ${goWear(a.wear)}), poorer copy ${other}`);
  g.inventory.remove(spare, 1);
}
check(`a go of every job with a tool wears its best copy once, by \`wear\`, in the browser (${tooled.length + fitted.length})`, !unworn.length, unworn.join('; ') || 'all');

// Improving wears every tool its material asks for: a mallet bettered with a plank, a carving knife and a file.
{
  const improve = IMPROVE_ACTIONS.find((a) => a.id === 'improve_item');
  const knife = only('carving_knife');
  const file = only('file');
  g.perkFx = { 'floor:improve': 50 };
  const piece = g.inventory.add('mallet', { ql: 10, extra: 'Pine' });
  g.inventory.add('plank', { ql: 20, extra: 'Pine', count: 3 });
  g.player.stats.stamina = 1;
  if (improve) go(improve, { kind: 'item', uid: piece.uid });
  const k = g.inventory.get(knife)?.dmg ?? -1;
  const f = g.inventory.get(file)?.dmg ?? -1;
  check('improving wears each of its material\'s tools once in the browser', near(k, goWear()) && near(f, goWear()), `${k} ${f}`);
}

// ---- The island: a go of a job of each family wears its tool by the browser's amount, once.
const FAMILY_GOES: Array<[string, string, string]> = [
  // [label, job, tool]
  ['crafting, whose performer wears it', 'make_cloth_tunic', 'needle'],
  ['the ground', 'cut_grass', 'sickle'],
  ['the terrain, whose performer wears it', 'pave_cobble', 'trowel'],
  ['a field, whose performer wears it', 'till', 'rake'],
  ['a planter', 'tend_crop', 'rake'],
  ['an item', 'glaze_item', 'brush'],
  ['a building, a mallet', 'plan_building', 'mallet'],
  ['a wall, its material\'s tool', 'build_wall', 'mallet'],
];
const DIRECT: Array<[string, string, string]> = [
  ['the forge', 'smith', 'hammer'],
  ['the forge', 'strike_coins', 'hammer'],
  ['the smelter', 'pour_mould', 'hammer'],
  ['the smelter', 'cast_anvil', 'hammer'],
  ['a lock', 'fit_lock', 'hammer'],
  ['a mount', 'shoe_creature', 'mallet'],
  ['a beast', 'groom', 'brush'],
  ['a vine', 'cut_vine', 'sickle'],
];
const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.go(w uuid, u uuid, a text, t jsonb) returns text language plpgsql as $f$
declare why text;
begin
  why := act_refusal(w, u, a, t);
  update player set act = a, act_target = t, act_started = now() - interval '2 seconds',
         act_ends = now() - interval '1 second', act_left = 1, act_goes = 1, act_queue = '[]'
   where world_id = w and uid = u;
  perform settle(w, u);
  return why;
end $f$;
create function pg_temp.only(w uuid, u uuid, d text) returns bigint language plpgsql as $f$
declare v bigint;
begin
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = d;
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, d, ${QL}) returning id into v;
  -- And a poorer copy, which a go does not reach for.
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, d, 5);
  return v;
end $f$;
create function pg_temp.dmg(w uuid, u uuid, d text) returns text language sql as $f$
  select coalesce((select string_agg(dmg::text, '/' order by ql desc) from item
    where world_id = w and holder = 'player' and holder_uid = u and def = d), 'gone')
$f$;
do $$
declare w uuid; u uuid; v_tool bigint; v_why text; v_box bigint; v_b int; r record; t jsonb;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  for tx in 4..15 loop for ty in 4..15 loop
    perform land_set_height(w, tx, ty, 40); perform land_set_dirt(w, tx, ty, 20);
    perform land_set_tile(w, tx, ty, tile_id('Packed dirt')); perform land_set_data(w, tx, ty, 0);
  end loop; end loop;
  delete from placed where world_id = w and x between 4 and 15 and y between 4 and 15;
  delete from building_tile where world_id = w and x between 4 and 15 and y between 4 and 15;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 9.5, y = 9.5, level = 0, act = null, act_queue = '[]', class_mul = jsonb_build_object('fx',
           jsonb_build_object('glaze_item', 1)) where world_id = w and uid = u;
  -- Plenty of wind, and no skill check that fails the go before the tool is reached: the wear is what is asked.
  update player set wind_until = null where world_id = w and uid = u;

  -- Crafting: a tunic out of four cloth.
  v_tool := pg_temp.only(w, u, 'needle');
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'cloth', 30, 4);
  v_why := pg_temp.go(w, u, 'make_cloth_tunic', jsonb_build_object('kind', 'item', 'uid',
    (select id from item where world_id = w and holder = 'player' and holder_uid = u and def = 'cloth' limit 1)));
  insert into said values ('make_cloth_tunic', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'needle'));
  -- The ground: grass cut.
  v_tool := pg_temp.only(w, u, 'sickle');
  perform land_set_tile(w, 9, 8, tile_id('Grass'));
  v_why := pg_temp.go(w, u, 'cut_grass', '{"kind": "tile", "x": 9, "y": 8, "cx": 9, "cy": 8}');
  insert into said values ('cut_grass', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'sickle'));
  -- The terrain: cobblestones laid on packed dirt.
  v_tool := pg_temp.only(w, u, 'trowel');
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'stone_brick', 30);
  v_why := pg_temp.go(w, u, 'pave_cobble', '{"kind": "tile", "x": 10, "y": 9, "cx": 10, "cy": 9}');
  insert into said values ('pave_cobble', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'trowel'));
  -- A field tilled out of dirt.
  v_tool := pg_temp.only(w, u, 'rake');
  perform land_set_tile(w, 8, 9, tile_id('Dirt'));
  v_why := pg_temp.go(w, u, 'till', '{"kind": "tile", "x": 8, "y": 9, "cx": 8, "cy": 9}');
  insert into said values ('till', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'rake'));
  -- A planter's crop tended.
  v_tool := pg_temp.only(w, u, 'rake');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'planter', 10, 10, 0, 0, 10.25, 10.25, 30, u) returning id into v_box;
  insert into planter_crop (placed, world_id, id, stage, tended, ql, sown_by) values (v_box, w, 'wheat', 1, 0, 40, u);
  v_why := pg_temp.go(w, u, 'tend_crop', jsonb_build_object('kind', 'furniture', 'id', v_box));
  insert into said values ('tend_crop', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'rake'));
  -- An item: a bowl glazed.
  v_tool := pg_temp.only(w, u, 'brush');
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'ash', 30, 2);
  v_why := pg_temp.go(w, u, 'glaze_item', jsonb_build_object('kind', 'item', 'uid', (select id from item i where i.world_id = w
    and i.holder = 'player' and i.holder_uid = u and i.def = 'ash')));
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'clay_bowl', 30) returning id into v_b;
  v_why := pg_temp.go(w, u, 'glaze_item', jsonb_build_object('kind', 'item', 'uid', v_b));
  insert into said values ('glaze_item', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'brush'));
  -- A building planned, then a plank wall planned on it and a go of building it.
  v_tool := pg_temp.only(w, u, 'mallet');
  v_why := pg_temp.go(w, u, 'plan_building', '{"kind": "tile", "x": 9, "y": 10, "cx": 9, "cy": 10, "name": "Shed"}');
  insert into said values ('plan_building', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'mallet'));
  v_tool := pg_temp.only(w, u, 'mallet');
  v_why := pg_temp.go(w, u, 'plan_wall', '{"kind": "tile", "x": 9, "y": 10, "side": "s", "wallType": "solid", "material": "plank"}');
  insert into said values ('plan_wall', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'mallet'));
  v_tool := pg_temp.only(w, u, 'mallet');
  insert into item (world_id, holder, holder_uid, def, ql, count, extra) values (w, 'player', u, 'plank', 30, 20, 'Pine'),
    (w, 'player', u, 'nail', 30, 20, 'Iron');
  insert into said values ('build_wall:tool', coalesce(private.job_tool(w, u, 'build_wall',
    '{"kind": "tile", "x": 9, "y": 10, "side": "s"}'), '-'));
  v_why := pg_temp.go(w, u, 'build_wall', '{"kind": "tile", "x": 9, "y": 10, "side": "s"}');
  insert into said values ('build_wall', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'mallet'));
  -- Improving a mallet with a plank: the carving knife and the file, each once.
  perform pg_temp.only(w, u, 'carving_knife');
  perform pg_temp.only(w, u, 'file');
  insert into item (world_id, holder, holder_uid, def, ql, extra) values (w, 'player', u, 'mallet', 10, 'Pine') returning id into v_b;
  v_why := pg_temp.go(w, u, 'improve_item', jsonb_build_object('kind', 'item', 'uid', v_b));
  insert into said values ('improve_item', coalesce(v_why, '-') || '|' || pg_temp.dmg(w, u, 'carving_knife') || '|' || pg_temp.dmg(w, u, 'file'));

  -- The families whose jobs want a forge, a smelter, a padlock, a beast or a wild vine set up: a go of each as the clock
  -- has it (\`private.act_go\`), aimed at nothing there, so that its performer does nothing and the go wears all the same.
  for r in select * from (values ${DIRECT.map(([, job, tool]) => `('${job}', '${tool}')`).join(', ')}) as v(job, tool) loop
    perform pg_temp.only(w, u, r.tool);
    t := jsonb_build_object('kind', case r.job when 'groom' then 'creature' when 'shoe_creature' then 'creature'
      when 'cut_vine' then 'tile' when 'fit_lock' then 'crate' when 'smith' then 'anvil' when 'strike_coins' then 'anvil'
      else 'smelter' end, 'id', -1, 'x', 4, 'y', 4, 'cx', 4, 'cy', 4);
    perform private.act_go(w, u, r.job, t);
    insert into said values (r.job, '-|' || pg_temp.dmg(w, u, r.tool));
  end loop;

  -- A worker's errand wears nothing.
  insert into said values ('errand', (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname like 'errand%' and pg_get_functiondef(p.oid) ~ 'wear_tool|act_go'));
end $$;
select string_agg(k || '=' || v, E'\\n' order by k) from said;
rollback;
`);
const said = new Map(out.split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as const));
const worn = (job: string, wear = ACTION_BY_ID.get(job)?.wear ?? 1): { pass: boolean; detail: string } => {
  const v = said.get(job) ?? 'missing';
  const [why, best, poor] = v.split(/\|/)[1] !== undefined ? [v.split('|')[0], ...v.split('|')[1].split('/')] : [v, '', ''];
  return { pass: why === '-' && near(Number(best), goWear(wear)) && Number(poor) === 0, detail: v };
};
for (const [label, job] of FAMILY_GOES) {
  const r = worn(job);
  check(`on the island, a go of ${job} (${label}) wears it once, by the browser's amount (${goWear(ACTION_BY_ID.get(job)?.wear).toFixed(4)})`, r.pass, r.detail);
}
check('a building job asks its wall\'s material\'s tool on the island (`private.job_tool`)', said.get('build_wall:tool') === 'mallet', said.get('build_wall:tool'));
{
  const v = (said.get('plan_wall') ?? '').split('|');
  check('planning a wall wears the mallet once', v[0] === '-' && near(Number(v[1]?.split('/')[0]), goWear()), said.get('plan_wall'));
  const im = (said.get('improve_item') ?? '').split('|');
  check('improving wears each of its material\'s tools once on the island', im[0] === '-' && near(Number(im[1]?.split('/')[0]), goWear())
    && near(Number(im[2]?.split('/')[0]), goWear()), said.get('improve_item'));
}
for (const [label, job] of DIRECT) {
  const r = worn(job);
  check(`on the island, a go of ${job} (${label}) wears it once, by the browser's amount (${goWear(ACTION_BY_ID.get(job)?.wear).toFixed(4)})`, r.pass, r.detail);
}
check('a settlement worker\'s errand wears no tool', said.get('errand') === '0', said.get('errand'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`every job with a tool wears it — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
