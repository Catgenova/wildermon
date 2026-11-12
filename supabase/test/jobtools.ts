/**
 * Jobs that went without a tool take one.
 *
 * Asked, from a review of the jobs that needed no tool: sewing cloth clothes takes a needle; fitting a head or a blade
 * to a shaft a hammer; cutting grass, moss and a vine and harvesting a field or a patch a sickle; tending a field or a
 * patch and clearing a field a rake; paving with cobblestones and mixing mortar and concrete a trowel; glazing and
 * painting a wall or a floor a brush (`jobtools.ts`).
 *
 * Asked of both sides, job by job:
 *   * its tool is the browser's constant, on the browser's recipe or action and on the island's (`recipe.tool`,
 *     `action_def.tool`);
 *   * without it, the job is refused in the island's words, the browser's `Need a sickle.`, on both sides — on a
 *     field and in a planter, a tile, a wall and a pot;
 *   * and with it, that refusal is not what it says.
 * And a settlement worker that mixes mortar or concrete still needs none (`workerSkipsTools`).
 *
 * Read only: the island's half is rolled back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { workerSkipsTools } from '../../src/game/creatures';
import { itemDef } from '../../src/game/items';
import { MORTAR_TOOL, needToolSaid, REAP_TOOL, TOOL_JOBS } from '../../src/game/jobtools';
import { RECIPE_BY_ID, recipeReason } from '../../src/game/recipes';
import { CUTTING_TOOL, VINE_SAID } from '../../src/game/vineyard';
import { psql, ok, bad, check } from './harness';

// The jobs, off the list the help and the news name them from (`TOOL_JOBS`): the recipes, and the actions.
const all = Object.entries(TOOL_JOBS).flatMap(([tool, ids]) => ids.map((id) => [id, tool] as const));
const recipes = all.filter(([id]) => RECIPE_BY_ID.has(id));
const ACTION_TOOLS = all.filter(([id]) => !RECIPE_BY_ID.has(id));
const RECIPE_TOOLS = Object.fromEntries([...new Set(recipes.map(([, t]) => t))].map((t) => [t, recipes.filter(([, x]) => x === t).map(([id]) => id)]));
check('the jobs asked for, each once: 5 sewn, 18 fitted, 2 mixed, and 12 actions', recipes.length === 25 && ACTION_TOOLS.length === 12
  && new Set(all.map(([id]) => id)).size === all.length, `${recipes.length} / ${ACTION_TOOLS.length}`);

// ---- Each job's tool, on both sides.
const wrongRecipe = recipes.filter(([id, tool]) => RECIPE_BY_ID.get(id)?.tool !== tool).map(([id]) => id);
check(`each recipe's tool in the browser (${recipes.length})`, !wrongRecipe.length, wrongRecipe.join(', ') || 'all');
const wrongAction = ACTION_TOOLS.filter(([id, tool]) => ACTION_BY_ID.get(id)?.tool !== tool).map(([id]) => id);
check(`each action's tool in the browser (${ACTION_TOOLS.length})`, !wrongAction.length, wrongAction.join(', ') || 'all');
check('cutting a vine and cutting grass take the same tool', CUTTING_TOOL === REAP_TOOL, `${CUTTING_TOOL} / ${REAP_TOOL}`);
const sqlList = (xs: readonly string[]): string => xs.map((x) => `'${x}'`).join(', ');
const islandRecipes = psql(`select coalesce(string_agg(id || '=' || coalesce(tool, '-'), ',' order by id collate "C"), '') from recipe
  where id in (${sqlList(recipes.map(([id]) => id))});`);
const wantRecipes = recipes.map(([id, tool]) => `${id}=${tool}`).sort().join(',');
check('and on the island (`recipe.tool`)', islandRecipes === wantRecipes, islandRecipes === wantRecipes ? '' : islandRecipes);
const islandActions = psql(`select coalesce(string_agg(id || '=' || coalesce(tool, '-'), ',' order by id collate "C"), '') from action_def
  where id in (${sqlList(ACTION_TOOLS.map(([id]) => id))});`);
const wantActions = ACTION_TOOLS.map(([id, tool]) => `${id}=${tool}`).sort().join(',');
check('and on the island (`action_def.tool`)', islandActions === wantActions, islandActions === wantActions ? '' : islandActions);
check('the island cuts a vine with the browser\'s tool (`cutting_tool`)', psql('select cutting_tool();') === CUTTING_TOOL);

// ---- The browser: refused without the tool, in the island's words, and not for that with it.
const g = Game.create(4111, 96);
g.perkFx = { glaze_item: 1, tend_patch: 1, harvest_patch: 1 };
const strip = (tool: string): void => {
  for (const it of [...g.inventory.items]) if (it.id === tool) g.inventory.remove(it.uid, it.count);
};
const give = (tool: string): void => {
  if (!g.inventory.has(tool)) g.inventory.add(tool, { ql: 30 });
};
const tx = g.player.tileX;
const ty = g.player.tileY;
const tileAt: Target = { kind: 'tile', x: tx, y: ty, cx: tx, cy: ty, side: 'n' } as Target;
const pot = g.inventory.add('clay_bowl', { ql: 30 });
const said = (id: string): string | null => {
  const def = ACTION_BY_ID.get(id);
  if (!def?.check) return 'no check';
  return def.check(id === 'glaze_item' ? { kind: 'item', uid: pot.uid } : tileAt, g);
};
const browserBad: string[] = [];
for (const [id, tool] of ACTION_TOOLS) {
  if (id === 'cut_vine') continue; // asked after the wild vine, and before this change; the island's words below
  strip(tool);
  const without = said(id);
  give(tool);
  const withIt = said(id);
  if (without !== needToolSaid(tool) || withIt === needToolSaid(tool)) browserBad.push(`${id}: ${without} / ${withIt}`);
}
check('the browser refuses each action without its tool, in the island\'s words, and not with it', !browserBad.length, browserBad.join('; ') || 'all');
const recipeBad: string[] = [];
for (const [id, tool] of recipes) {
  const r = RECIPE_BY_ID.get(id);
  if (!r) { recipeBad.push(`${id}: no recipe`); continue; }
  strip(tool);
  const without = recipeReason(r, g);
  give(tool);
  const withIt = recipeReason(r, g);
  if (without !== needToolSaid(tool) || withIt === needToolSaid(tool)) recipeBad.push(`${id}: ${without} / ${withIt}`);
}
check('the browser refuses each recipe without its tool, and not with it', !recipeBad.length, recipeBad.join('; ') || 'all');
check('a wild vine is refused without a sickle in the island\'s words (`vine_said`)', psql(`select vine_said('noTool');`) === VINE_SAID.noTool
  && VINE_SAID.noTool === needToolSaid(CUTTING_TOOL));
check('the words are the island\'s `need_tool`, off the item\'s name',
  [...new Set([...Object.keys(RECIPE_TOOLS), ...ACTION_TOOLS.map(([, t]) => t)])]
    .every((t) => psql(`select need_tool(gen_random_uuid(), gen_random_uuid(), '${t}');`) === needToolSaid(t)
      && needToolSaid(t) === `Need a ${itemDef(t).name.toLowerCase()}.`));

// ---- The island: the same, through `act_refusal`, on a body with none of these tools and then with each.
const tools = [...new Set([...Object.keys(RECIPE_TOOLS), ...ACTION_TOOLS.map(([, t]) => t)])];
const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; v_pot bigint; v_cloth bigint; v_box bigint; t jsonb; r record;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  update player set x = 9.5, y = 9.5, level = 0, act = null, act_queue = '[]',
         class_mul = jsonb_set(coalesce(class_mul, '{}'::jsonb), '{fx}',
           coalesce(class_mul->'fx', '{}'::jsonb) || '{"glaze_item": 1, "tend_patch": 1, "harvest_patch": 1}'::jsonb)
   where world_id = w and uid = u;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def in (${sqlList(tools)});
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, 'clay_bowl', 30) returning id into v_pot;
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'cloth', 30, 4) returning id into v_cloth;
  delete from placed where world_id = w and x between 8 and 11 and y between 8 and 11;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'planter', 10, 9, 0, 0, 10.25, 9.25, 30, u) returning id into v_box;
  insert into planter_crop (placed, world_id, id, stage, tended, ql, sown_by) values (v_box, w, 'wheat', 1, 0, 40, u);
  for r in select * from (values
    ('cut_grass', 'Grass', null), ('cut_moss', 'Moss', null), ('pave_cobble', 'Packed dirt', null),
    ('tend_crop', 'Field', null), ('harvest_crop', 'Field', null), ('clear_field', 'Field', null),
    ('tend_patch', 'Field', null), ('harvest_patch', 'Field', null), ('paint_wall', 'Packed dirt', null),
    ('paint_floor', 'Packed dirt', null), ('glaze_item', null, 'pot'),
    ('tend_crop', null, 'planter'), ('harvest_crop', null, 'planter'), ('clear_field', null, 'planter')
    ${recipes.map(([id]) => `, ('${id}', null, 'cloth')`).join('')}
  ) as v(job, tile, aim) loop
    if r.tile is not null then perform land_set_tile(w, 9, 9, tile_id(r.tile)); end if;
    t := case r.aim when 'pot' then jsonb_build_object('kind', 'item', 'uid', v_pot)
                    when 'cloth' then jsonb_build_object('kind', 'item', 'uid', v_cloth)
                    when 'planter' then jsonb_build_object('kind', 'furniture', 'id', v_box)
                    else jsonb_build_object('kind', 'tile', 'x', 9, 'y', 9, 'cx', 9, 'cy', 9, 'side', 'n') end;
    insert into said values (r.job || coalesce('@' || r.aim, ''), coalesce(act_refusal(w, u, r.job, t), '-'));
    insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', u, (select tool from action_def where id = r.job), 30);
    insert into said values (r.job || coalesce('@' || r.aim, '') || '+', coalesce(act_refusal(w, u, r.job, t), '-'));
    delete from item where world_id = w and holder = 'player' and holder_uid = u and def in (${sqlList(tools)});
  end loop;
end $$;
select string_agg(k || '=' || v, E'\\n' order by k) from said;
rollback;
`);
const island = new Map(out.split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as const));
const asked: Array<[string, string]> = [
  ...ACTION_TOOLS.filter(([id]) => id !== 'cut_vine').map(([id, tool]) => [id === 'glaze_item' ? 'glaze_item@pot' : id, tool] as [string, string]),
  ...(['tend_crop', 'harvest_crop', 'clear_field'] as const).map((id) => [`${id}@planter`, ACTION_BY_ID.get(id)?.tool ?? ''] as [string, string]),
  ...recipes.map(([id, tool]) => [`${id}@cloth`, tool] as [string, string]),
];
const islandBad = asked.filter(([k, tool]) => island.get(k) !== needToolSaid(tool) || island.get(`${k}+`) === needToolSaid(tool))
  .map(([k]) => `${k}: ${island.get(k)} / ${island.get(`${k}+`)}`);
check(`the island refuses each job without its tool in the same words, and not with it (${asked.length}: a field, a planter, a tile, a wall, a pot, a recipe)`,
  !islandBad.length, islandBad.join('; ') || 'all');

// ---- And a worker still needs none of it.
const skips = workerSkipsTools();
check('a worker mixing mortar or concrete needs no trowel (`workerSkipsTools`)', skips.includes(itemDef(MORTAR_TOOL).name.toLowerCase()), skips.join(', '));

const asks = psql(`select coalesce(string_agg(p.proname, ',' order by p.proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and (p.proname like 'errand%' or p.proname like 'worker%')
    and pg_get_functiondef(p.oid) ~ 'need_tool|tool_ql|action_tool|act_refusal\\(';`);
check('nor does any worker\'s errand on the island ask for a tool: a mossnib cuts moss and a bedda harvests without one', asks === '', asks);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`jobs take their tools — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
