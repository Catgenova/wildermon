/**
 * Every blacksmithing job takes a hammer.
 *
 * Reported by a player: "i've yet to use a hammer to do so and have been smithing by sheer force of will". Asked: all
 * smithing needs a hammer.
 *
 * Asked of both sides:
 *   * the tool is the browser's `SMITH_TOOL`, the island's `smith_tool()`;
 *   * every mould is fired with it (`recipe.tool`), in the browser's recipes and the island's;
 *   * pouring a mould, casting an anvil, smithing a casting, striking coins and fitting a padlock (to a store or a
 *     gate) each refuse without one, in the island's words the browser's `Need a hammer.`;
 *   * and every blacksmithing job on the island takes it, one way or the other.
 *
 * Read only.
 */
import { execFileSync } from 'node:child_process';
import '../../src/game/game';
import { itemDef } from '../../src/game/items';
import { SMITH_TOOL } from '../../src/game/metal';
import { RECIPES } from '../../src/game/recipes';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

const island = psql('select smith_tool();');
check('the island smiths with the browser\'s tool', island === SMITH_TOOL, `${island} / ${SMITH_TOOL}`);

const moulds = RECIPES.filter((r) => r.result.endsWith('_mould'));
check('every mould in the browser is fired with it', moulds.length > 0 && moulds.every((r) => r.tool === SMITH_TOOL),
  moulds.filter((r) => r.tool !== SMITH_TOOL).map((r) => r.id).join(',') || `${moulds.length} moulds`);
const islandMoulds = psql(`select count(*) || '|' || count(*) filter (where tool is distinct from smith_tool())
  from recipe where result like '%\\_mould';`);
check('and on the island', islandMoulds === `${moulds.length}|0`, islandMoulds);

// Each refusal that answers before the general tool check says it, once per job.
const says = psql(`select string_agg(proname || ':' || (length(def) - length(replace(def, 'need_tool(p_world, p_uid, smith_tool())', '')))
                                           / length('need_tool(p_world, p_uid, smith_tool())') / 2, ',' order by proname)
  from (select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('forge_refusal', 'firing_refusal', 'lock_refusal_for', 'gate_lock_refusal')) f;`);
check('pouring, casting an anvil, smithing, striking coins and fitting a padlock each ask for it on the island',
  says === 'firing_refusal:2,forge_refusal:1,gate_lock_refusal:1,lock_refusal_for:1', says);
check('in the browser\'s words', psql('select need_tool(gen_random_uuid(), gen_random_uuid(), smith_tool());')
  === `Need a ${itemDef(SMITH_TOOL).name.toLowerCase()}.`);

// Every other blacksmithing job takes it as its own tool.
const loose = psql(`select coalesce(string_agg(id, ',' order by id), '') from (
  select id from recipe where skill = 'blacksmithing' and tool is distinct from smith_tool()
  union all
  select id from action_def where skill = 'blacksmithing' and tool is distinct from smith_tool()
     and id not in ('pour_mould', 'cast_anvil', 'smith', 'strike_coins', 'fit_lock')) x;`);
check('no other blacksmithing job on the island goes without it', loose === '', loose);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`smithing takes a hammer — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
