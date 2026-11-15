/**
 * Why it failed: a failed skill check's line names the term that cost it most
 * (`20261120000080_failwhy.sql`, `src/game/failwhy.ts`).
 *
 * The island's dice are pinned to fail (`dice.random`, first on the search
 * path, at 0.99: over every chance's 0.98 top), and the line read back:
 *
 *   * a craft (Carve a mallet): a knife of QL 5 at carpentry 90 names the tool
 *     QL; carpentry 5 with a knife of QL 100 names the skill; a long bow in oak
 *     at bowyery 95 with a knife of QL 100 names the material's difficulty;
 *   * a gather (Cut down): a hatchet of QL 5 at woodcutting 90 names the tool
 *     QL; woodcutting 5 with a hatchet of QL 90 names the skill; woodcutting
 *     100 with a hatchet of QL 100 says nothing past "Cut failed."; stamina
 *     is not a term, so a body nearly out of it is told the same as a rested one;
 *   * a perk's share of failures (`perk_pass`) scales the cost; a check that
 *     came off leaves nothing to say;
 *   * and the browser's reckoning (`failFactor`, `failFactorSaid`,
 *     `skillOdds`) is the island's (`fail_factor`, `fail_factor_said`,
 *     `skill_odds`), over a grid of skills, difficulties, tools, eases, perk
 *     shares, materials and mind logic, word for word; the labels and the
 *     tops are the same on both sides.
 *
 * Makes its own island and rolls it back.
 */
import { failFactor, failFactorSaid, FAIL_FACTORS, FAIL_LEAST, FAIL_WHY_JOBS, mindEaseAt, skillOdds, type CheckAt } from '../../src/game/failwhy';
import { ACTION_BY_ID } from '../../src/game/actions';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { MATERIAL_BY_ID } from '../../src/game/materials';
import { QL_TOP } from '../../src/game/limits';
import { SKILL_TOP } from '../../src/game/skills';
import { psql, check, finish } from './harness';

const A = 'fa170000-0000-4000-8000-0000000f0001';
const DICE_FAIL = 0.99;

/** The pack emptied of a tool and one put in at a QL, worn by nothing yet. */
const tool = (def: string, ql: number): string =>
  `delete from item where world_id = w and holder_uid = a and def = '${def}';
  perform give(w, a, '${def}', 1, ${ql});`;
const skillAt = (id: string, v: number): string =>
  `insert into skill (world_id, uid, id, value) values (w, a, '${id}', ${v}) on conflict (world_id, uid, id) do update set value = excluded.value;`;
const inputs = (recipe: string, extra: string): string =>
  (RECIPE_BY_ID.get(recipe)?.inputs ?? []).map((i, k) =>
    `perform give(w, a, '${i.item}', ${(i.count ?? 1) * 2}, 30${k === 0 ? `, '${extra}'` : ''});`).join('\n  ');
/** A go of `perf`, the dice at a fail, and what it said and what it was rolled at. */
const go = (k: string, skill: string, tl: string, perf: string, extra = 'null'): string => `
  delete from event where world_id = w and uid = a;
  -- The skill as it was rolled at, before the go's own gain; the tool as it was, after the go's wear (worn first).
  v_s := skill_of(w, a, '${skill}');
  perform pg_temp.dice('${DICE_FAIL}');
  ${perf};
  perform pg_temp.nodice();
  insert into said values ('${k}', concat_ws('#',
    (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a and kind = 'event'),
    v_s, tool_ql(w, a, '${tl}'), mat_difficulty(${extra})));`;

/* The grid both sides reckon. */
type Row = Required<Omit<CheckAt, 'mind'>> & { mind: number | null };
const grid: Row[] = [];
for (const skill of [1, 20, 55, 90, 100])
  for (const difficulty of [0, 8, 30, 60])
    for (const tl of [0, 5, 50, 100])
      for (const ease of [0, 6])
        for (const fail of [1, 0.5])
          for (const material of [0, 8])
            for (const mind of [null, 30])
              grid.push({ skill, difficulty, tool: tl, ease, fail, material, mind });
const gridValues = grid.map((g, k) =>
  `(${k}, ${g.skill}::float8, ${g.difficulty}::float8, ${g.tool}::float8, ${g.ease}::float8, ${g.fail}::float8, ${g.material}::float8, ${g.mind ?? 'null'}::float8)`).join(',\n  ');

const mallet = 'make_mallet', bow = 'make_long_bow';
const bowWood = RECIPE_BY_ID.get(bow)?.wood ?? 'Oak';
const target = `jsonb_build_object('kind', 'item', 'uid', null)`;
const tile = `jsonb_build_object('kind', 'tile', 'x', 8, 'y', 8)`;

const out = psql(`
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wildermon.dice'), ',');
        n int := coalesce(nullif(current_setting('wildermon.dice_n', true), ''), '0')::int;
begin
  perform set_config('wildermon.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wildermon.dice', v, true);
  perform set_config('wildermon.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
do $t$
declare w uuid; a uuid := '${A}'; v_ok boolean; v_s double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Failwhy', 67, 16, 8, 8, true) returning id into w;
  perform land_blank(w, 16);
  perform land_set_height(w, i, j, 100) from generate_series(0, 16) i, generate_series(0, 16) j;
  perform land_set_tile(w, i, j, 0) from generate_series(0, 15) i, generate_series(0, 15) j;
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  perform rpc_join(w, 'Failer');
  update player set x = 8.5, y = 8.5, craft_class = null, combat_class = null, class_mul = null,
         stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1')
   where world_id = w and uid = a;
  delete from player_node where world_id = w and uid = a;

  -- A craft: Carve a mallet in pine (its difficulty under the mallet's own), and a long bow in its wood.
  ${skillAt('carpentry', 90)}
  ${tool('carving_knife', 5)}
  ${inputs(mallet, 'Pine')}
  ${go('CRAFT_TOOL', 'carpentry', 'carving_knife', `perform perform_craft(w, a, '${mallet}', ${target})`, `'Pine'`)}
  ${skillAt('carpentry', 5)}
  ${tool('carving_knife', 100)}
  ${inputs(mallet, 'Pine')}
  ${go('CRAFT_SKILL', 'carpentry', 'carving_knife', `perform perform_craft(w, a, '${mallet}', ${target})`, `'Pine'`)}
  ${skillAt('bowyery', 95)}
  ${tool('carving_knife', 100)}
  ${inputs(bow, bowWood)}
  insert into said values ('BOW_HARD', craft_hardness('${bow}', '${bowWood}')::text);
  insert into said values ('MALLET_HARD', craft_hardness('${mallet}', 'Pine')::text);
  ${go('CRAFT_MAT', 'bowyery', 'carving_knife', `perform perform_craft(w, a, '${bow}', ${target})`, `'${bowWood}'`)}

  -- A gather: Cut down.
  ${skillAt('woodcutting', 90)}
  ${tool('hatchet', 5)}
  ${go('CUT_TOOL', 'woodcutting', 'hatchet', `perform perform_gather(w, a, 'cut_down', ${tile})`)}
  ${tool('hatchet', 5)}
  update player set stats = jsonb_set(stats, '{stamina}', '0.05') where world_id = w and uid = a;
  ${go('CUT_TIRED', 'woodcutting', 'hatchet', `perform perform_gather(w, a, 'cut_down', ${tile})`)}
  update player set stats = jsonb_set(stats, '{stamina}', '1') where world_id = w and uid = a;
  ${skillAt('woodcutting', 5)}
  ${tool('hatchet', 90)}
  ${go('CUT_SKILL', 'woodcutting', 'hatchet', `perform perform_gather(w, a, 'cut_down', ${tile})`)}
  ${skillAt('woodcutting', 100)}
  ${tool('hatchet', 100)}
  ${go('CUT_NONE', 'woodcutting', 'hatchet', `perform perform_gather(w, a, 'cut_down', ${tile})`)}

  -- A perk's share of failures (the check's roll a fail, the perk's under its half), a failure the perk
  -- passed, and a check that came off.
  perform pg_temp.dice('${DICE_FAIL},0.2');
  v_ok := perk_pass(skill_check(5, 10, 90), 0.5);
  insert into said values ('PERK', v_ok::text || '#' || fail_why());
  perform pg_temp.dice('${DICE_FAIL}');
  v_ok := perk_pass(skill_check(5, 10, 90), 0.5);
  insert into said values ('RESCUED', v_ok::text || '#' || fail_why());
  perform pg_temp.dice('0.01');
  v_ok := skill_check(5, 10, 90);
  insert into said values ('PASSED', v_ok::text || '#' || fail_why());
  perform pg_temp.dice('${DICE_FAIL}');
  perform skill_check(5, 10, 90);
  perform pg_temp.dice('0.01');
  perform skill_check(5, 10, 90);
  insert into said values ('STALE', fail_why());
  perform pg_temp.nodice();
end $t$;
select 'GRID|' || g.k || '|' || coalesce(fail_factor_said(f.id, f.n, f.cost), '') || '|' || skill_odds(g.s, g.d, g.t, g.e)::text
  from (values
  ${gridValues}) g(k, s, d, t, e, f, m, mind)
  left join lateral fail_factor(g.s, g.d, g.t, g.e, g.f, g.m, g.mind) f on true
 order by g.k;
select 'LABELS|' || string_agg(coalesce(fail_factor_label(x), '?'), ',' order by o)
  from unnest(array[${FAIL_FACTORS.map((f) => `'${f.id}'`).join(', ')}]) with ordinality u(x, o);
select 'TOPS|' || concat_ws(',', skill_top(), ql_top(), fail_least(), mind_ease_at(skill_top()));
select k || '|' || coalesce(v, '') from said;
rollback;
`);

const field = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}|`))?.slice(k.length + 1) ?? '';

/* ---- the lines ------------------------------------------------------------------------- */

/** A go's line, and the factor the browser reckons off what the island says it was rolled at. */
const told = (k: string, difficulty: number, fail = 1): { line: string; want: ReturnType<typeof failFactor>; said: string } => {
  const [line, s, t, m] = field(k).split('#');
  const want = failFactor({ skill: Number(s), difficulty, tool: Number(t), fail, material: Number(m) });
  return { line: line ?? '', want, said: failFactorSaid(want) };
};

const malletHard = Number(field('MALLET_HARD'));
const bowHard = Number(field('BOW_HARD'));
check('the craft\'s difficulty is the recipe\'s and its material\'s, on both sides',
  malletHard === (RECIPE_BY_ID.get(mallet)?.difficulty ?? 0) + (MATERIAL_BY_ID.get('pine')?.difficulty ?? 0)
    && bowHard === (RECIPE_BY_ID.get(bow)?.difficulty ?? 0) + (MATERIAL_BY_ID.get(bowWood.toLowerCase())?.difficulty ?? 0),
  `mallet in pine ${malletHard}, long bow in ${bowWood.toLowerCase()} ${bowHard}`);

for (const [k, what, hard, id] of [
  ['CRAFT_TOOL', 'a mallet carved with a knife of QL 5 at carpentry 90', malletHard, 'tool'],
  ['CRAFT_SKILL', 'a mallet carved at carpentry 5 with a knife of QL 100', malletHard, 'skill'],
  ['CRAFT_MAT', `a long bow in ${bowWood.toLowerCase()} at bowyery 95 with a knife of QL 100`, bowHard, 'material'],
  ['CUT_TOOL', 'a tree cut with a hatchet of QL 5 at woodcutting 90', ACTION_BY_ID.get('cut_down')?.difficulty ?? 0, 'tool'],
  ['CUT_SKILL', 'a tree cut at woodcutting 5 with a hatchet of QL 90', ACTION_BY_ID.get('cut_down')?.difficulty ?? 0, 'skill'],
] as const) {
  const t = told(k, hard);
  check(`${what}, failed: its line names the ${id === 'tool' ? 'tool QL' : id === 'skill' ? 'skill' : 'material\'s difficulty'}, with the browser's number`,
    t.want?.id === id && t.said !== '' && t.line.includes(t.said) && t.line.includes(' Biggest factor: '), `"${t.line}"; the browser: "${t.said.trim()}"`);
}
{
  const t = told('CRAFT_MAT', bowHard);
  const [, s] = field('CRAFT_MAT').split('#');
  const skillCost = skillOdds(SKILL_TOP, bowHard, QL_TOP) - skillOdds(Number(s), bowHard, QL_TOP);
  check('the material named because it cost more than the skill did', !!t.want && t.want.cost > skillCost,
    `material ${t.want?.cost.toFixed(4)}, skill ${skillCost.toFixed(4)}`);
}
check('a failed craft\'s line: the factor after the craft\'s own words, before what was damaged',
  /^Failed: mallet\. Biggest factor: tool QL \d+ \(−\d+%\)\./.test(told('CRAFT_TOOL', malletHard).line), told('CRAFT_TOOL', malletHard).line);
check('a failed cut\'s line: "Cut failed. Biggest factor: …"',
  /^Cut failed\. Biggest factor: tool QL \d+ \(−\d+%\)\.$/.test(told('CUT_TOOL', ACTION_BY_ID.get('cut_down')?.difficulty ?? 0).line), told('CUT_TOOL', ACTION_BY_ID.get('cut_down')?.difficulty ?? 0).line);
check('nothing costing a point (woodcutting 100, hatchet QL 100): "Cut failed." and nothing more',
  field('CUT_NONE').split('#')[0] === 'Cut failed.', field('CUT_NONE'));
check('stamina is not a term: nearly out of it, the same line as rested',
  field('CUT_TIRED').split('#')[0] === field('CUT_TOOL').split('#')[0], `${field('CUT_TIRED').split('#')[0]} // ${field('CUT_TOOL').split('#')[0]}`);
{
  const [okd, said] = field('PERK').split('#');
  const want = failFactorSaid(failFactor({ skill: 5, difficulty: 10, tool: 90, fail: 0.5 }));
  check('a perk that lets half of failures stand: half the cost, as the browser has it', okd === 'false' && said === want && want !== '',
    `"${said}"; the browser "${want}"`);
}
check('a failure a perk passed: nothing to say', field('RESCUED') === 'true#', field('RESCUED'));
check('a check that came off: nothing to say',field('PASSED') === 'true#', field('PASSED'));
check('a failure followed by a check that came off: the failure forgotten', field('STALE') === '', field('STALE'));

/* ---- the browser's reckoning is the island's ----------------------------------------- */

const rows = out.split('\n').filter((l) => l.startsWith('GRID|')).map((l) => l.split('|'));
let same = 0, named = 0;
const diffs: string[] = [];
for (const [, k, said, odds] of rows) {
  const g = grid[Number(k)];
  const mine = failFactorSaid(failFactor(g));
  const myOdds = skillOdds(g.skill, g.difficulty, g.tool, g.ease);
  if (mine === said && Math.abs(myOdds - Number(odds)) < 1e-12) same++;
  else if (diffs.length < 6) diffs.push(`${JSON.stringify(g)}: island "${said}" ${odds}, browser "${mine}" ${myOdds}`);
  if (said) named++;
}
check(`the browser's factor and odds are the island's, word for word, over ${grid.length} checks`,
  rows.length === grid.length && same === grid.length && named > 0 && named < grid.length,
  `${same} of ${rows.length} the same, ${named} naming a factor${diffs.length ? `: ${diffs.join('; ')}` : ''}`);
const kinds = new Set<string>(grid.map((g) => failFactor(g)?.id ?? 'none'));
check('the grid has every factor named somewhere, and a check with none', ['skill', 'tool', 'material', 'mind', 'none'].every((x) => kinds.has(x)),
  [...kinds].join(', '));
check('the labels are the same on both sides, in the same order', field('LABELS') === FAIL_FACTORS.map((f) => f.label).join(','),
  `island ${field('LABELS')}; browser ${FAIL_FACTORS.map((f) => f.label).join(',')}`);
check('the tops and the least named are the same on both sides',
  field('TOPS') === [SKILL_TOP, QL_TOP, FAIL_LEAST, mindEaseAt(SKILL_TOP)].join(','), field('TOPS'));
check('every job the help names is an action', FAIL_WHY_JOBS.every((id) => ACTION_BY_ID.has(id)),
  FAIL_WHY_JOBS.filter((id) => !ACTION_BY_ID.has(id)).join(', '));

finish('Why it failed');
