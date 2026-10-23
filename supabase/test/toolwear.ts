/**
 * Every tool wears with its action.
 *
 * Asked for: "Butchering knife should take dmg from butchering", and then "sweep other tools for missing actions". The
 * browser wears an action's tool a go's worth after every action that names one (`Game.wearTool`, off `ActionDef.tool`).
 * The island has a performer for each sort of action, and each wears its tool where it does: the butcher, shear, till,
 * investigate, repoint, ivy and moss, and the foundation's four never did.
 *
 * This asks it of every action with a tool, off the island's own function bodies: the branch that does the action
 * (an `if`/`elsif` naming it) wears a tool (`wear_tool`), or hands it to a performer that does, or the performer wears
 * every action's tool before it branches at all; a recipe is the crafting performer's, which wears the recipe's tool;
 * and a few are a performer's without its naming them (`WHOLE`). `butchery` asks the knife's wear by the number.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { ACTIONS } from '../../src/game/actions';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
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

// The island's performers, their bodies, and the recipes the crafting performer does.
const fns = new Map<string, string[]>(
  (JSON.parse(psql(`select json_agg(json_build_array(p.proname, pg_get_functiondef(p.oid))) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'perform%' or p.proname = 'act_perform') and p.prokind = 'f'`)) as [string, string][])
    .map(([name, def]) => [name, def.split('\n')]));
const recipes = new Set(psql(`select string_agg(id, ',') from recipe`).split(','));
const crafted = fns.get('perform_craft')?.some((l) => l.includes('wear_tool(')) ?? false;

const indent = (l: string): number => l.length - l.trimStart().length;
const WEARS = /wear_tool\(/;
/** Whether a performer wears a tool before it branches on what it was asked to do. */
const wearsFirst = (lines: string[]): boolean => {
  for (const l of lines) {
    if (/p_action\s*(=|in\b)/.test(l)) return false;
    if (WEARS.test(l)) return true;
  }
  return false;
};
/** The branches of the performers that name an action, as their lines. */
const branches = (id: string): Array<{ fn: string; lines: string[] }> => {
  const out: Array<{ fn: string; lines: string[] }> = [];
  const named = new RegExp(`'${id}'`);
  for (const [fn, lines] of fns) {
    lines.forEach((l, i) => {
      if (!/\b(if|elsif)\b/.test(l) || !/p_action/.test(l) || !named.test(l)) return;
      let j = i + 1;
      while (j < lines.length && !(lines[j].trim() && indent(lines[j]) <= indent(l) && /^\s*(elsif|else|end if)\b/.test(lines[j]))) j++;
      out.push({ fn, lines: lines.slice(i, j) });
    });
  }
  return out;
};
/** Whether a branch wears, itself or in the performer it hands the action to. */
const branchWears = (b: { fn: string; lines: string[] }): boolean => {
  if (b.lines.some((l) => WEARS.test(l))) return true;
  if (wearsFirst(fns.get(b.fn) ?? [])) return true;
  const to = b.lines.map((l) => l.match(/perform (perform_[a-z_]+)\(/)?.[1]).filter((f): f is string => !!f);
  return to.some((f) => {
    const lines = fns.get(f) ?? [];
    return wearsFirst(lines) || lines.some((l) => WEARS.test(l));
  });
};

/**
 * The actions a performer does without naming them: the whole of it, or what it does when it is not asked for any of
 * the actions it names. These wear if the performer does.
 */
const WHOLE: Record<string, string> = {
  dig: 'act_perform', dig_tile: 'perform_dig_tile', unearth: 'perform_treasure', stop_spring: 'perform_spring',
  engrave_memorial: 'perform_memorial', pour_foundation: 'perform_foundation', scrub_moss: 'perform_green',
};
const wholeWears = (id: string): boolean => {
  const lines = fns.get(WHOLE[id]) ?? [];
  if (id === 'pour_foundation') return lines.join('\n').includes("if not consume(p_world, p_uid, 'concrete', 1) then return; end if;\n  -- Its tool takes a go's wear");
  if (id === 'dig') return branches('dig').some(branchWears);
  return wearsFirst(lines) || lines.some((l) => WEARS.test(l));
};

const tooled = ACTIONS.filter((a) => a.tool);
const missing: string[] = [];
for (const a of tooled) {
  if (recipes.has(a.id)) {
    if (!crafted) missing.push(`${a.id} (recipe)`);
    continue;
  }
  if (WHOLE[a.id]) {
    if (!wholeWears(a.id)) missing.push(`${a.id} (${a.tool}, ${WHOLE[a.id]})`);
    continue;
  }
  const bs = branches(a.id);
  if (!bs.length || !bs.some(branchWears)) missing.push(`${a.id} (${a.tool}${bs.length ? `, ${[...new Set(bs.map((b) => b.fn))].join(', ')}` : ', no branch'})`);
}
check(`every action with a tool wears it on the island as in the browser (${tooled.length} actions)`, !missing.length, missing.join('; ') || 'all');
// The ten the sweep found wearing nothing, each by name.
for (const id of ['butcher', 'shear', 'till', 'investigate', 'repoint_wall', 'clear_ivy', 'plan_foundation', 'dig_pool', 'fill_pool']) {
  check(`${id}: its branch wears its tool`, branches(id).some(branchWears));
}
for (const id of ['scrub_moss', 'pour_foundation']) check(`${id}: its performer wears its tool`, wholeWears(id));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`every tool wears with its action — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
