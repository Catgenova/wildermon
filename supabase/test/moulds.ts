/**
 * A mould is the smith's: formed by blacksmithing, and poured to blacksmithing.
 *
 * Asked: "pouring moulds should give blacksmithing experience. mould QLs when
 * formed should be based off blacksmithing level not sand QL". This asks, of
 * both sides where both have a say:
 *
 *   * every mould is formed by blacksmithing, whatever it casts, and its QL is
 *     the smith's: QL 1 sand fired by a good smith with no weaponsmithing makes
 *     a good sword blade mould;
 *   * pouring a mould, and casting an anvil, raise blacksmithing on the island,
 *     where a pour used to teach nothing at all, and leave smelting where it was;
 *   * the browser forms and pours by the same trade.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { MOULD_SKILL, MOULDS } from '../../src/game/metal';
import { RECIPE_BY_ID } from '../../src/game/recipes';

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

/* ---- on the island --------------------------------------------------------------- */

const SMITH = '5a17a000-0000-4000-8000-0000000000a1';
const GOES = 6;
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Every go comes off, so what is measured is the quality and not the luck.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
do $t$
declare w uuid; u uuid := '${SMITH}'; v_smelter bigint; v_mould bigint; v_lump bigint; v_was double precision; v_smelt double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Moulds', 169, 32, 10, 10, true) returning id into w;
  perform land_blank(w, 32);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Smith');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 9.5, y = 9.5, body_at = now(), swim_at = now(),
         stats = jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1) where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'blacksmithing', 70), (w, u, 'weaponsmithing', 1), (w, u, 'smelting', 30)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    values (w, 'smelter', 10, 9, 0, 0, 10.375, 9.25, 50, 600, true, '{"jobs": [], "output": []}'::jsonb, u)
    returning id into v_smelter;

  -- QL 1 sand, fired into sword blade moulds by a smith with no weaponsmithing.
  perform give(w, u, 'sand', ${GOES * 3}, 1);
  for i in 1..${GOES} loop perform perform_craft(w, u, 'make_sword_blade_mould', null); end loop;
  insert into said select 'FORMED', count(*) || '|' || round(min(ql)::numeric, 1) || '|' || round(max(ql)::numeric, 1)
    from item where world_id = w and holder_uid = u and def = 'sword_blade_mould';
  insert into said values ('RECIPE', (select skill from recipe where id = 'make_sword_blade_mould'));

  -- A pour, and what it taught.
  select value into v_was from skill where world_id = w and uid = u and id = 'blacksmithing';
  select value into v_smelt from skill where world_id = w and uid = u and id = 'smelting';
  v_mould := give(w, u, 'shovel_head_mould', 1, 50);
  v_lump := give(w, u, 'copper_lump', 1, 40);
  perform act_perform(w, u, 'pour_mould', jsonb_build_object('kind', 'smelter', 'id', v_smelter, 'mouldUid', v_mould, 'itemUid', v_lump));
  insert into said values ('POURED', jsonb_array_length((select state->'jobs' from placed where id = v_smelter))::text);
  insert into said values ('POUR', ((select value from skill where world_id = w and uid = u and id = 'blacksmithing') > v_was)::text
    || '|' || ((select value from skill where world_id = w and uid = u and id = 'smelting') = v_smelt)::text);
  -- And an anvil cast, which is the anvil mould poured.
  update placed set state = '{"jobs": [], "output": []}'::jsonb where id = v_smelter;
  select value into v_was from skill where world_id = w and uid = u and id = 'blacksmithing';
  perform give(w, u, 'anvil_mould', 1, 50);
  v_lump := give(w, u, 'copper_lump', mould_lumps('anvil_mould', 'copper'), 40);
  perform act_perform(w, u, 'cast_anvil', jsonb_build_object('kind', 'smelter', 'id', v_smelter, 'itemUid', v_lump));
  insert into said values ('CAST', jsonb_array_length((select state->'jobs' from placed where id = v_smelter)) || '|'
    || ((select value from skill where world_id = w and uid = u and id = 'blacksmithing') > v_was)::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

const [made, low] = at('FORMED').split('|').map(Number);
check('on the island, a sword blade mould is formed by blacksmithing', at('RECIPE') === MOULD_SKILL, at('RECIPE'));
check(`QL 1 sand fired by a smith at 70 blacksmithing and 1 weaponsmithing makes good moulds, not QL 1 ones`,
  made === GOES && low >= 20, `${made} made, QL ${at('FORMED').split('|').slice(1).join(' to ')}`);
check('pouring a mould fills the furnace', at('POURED') === '1', at('POURED'));
check('and teaches blacksmithing, leaving smelting where it was', at('POUR') === 'true|true', at('POUR'));
check('casting an anvil teaches blacksmithing too', at('CAST') === '1|true', at('CAST'));

/* ---- in the browser ---------------------------------------------------------------- */

const forms = MOULDS.map((m) => RECIPE_BY_ID.get(`make_${m.id}`));
check('in the browser, every mould is formed by blacksmithing', forms.every((r) => r?.skill === MOULD_SKILL && MOULD_SKILL === 'blacksmithing'),
  forms.filter((r) => r?.skill !== MOULD_SKILL).map((r) => r?.id).join(', '));
check('and its QL is the smith\'s, not the sand\'s', forms.every((r) => !r?.qlFromInputs));
check('pouring a mould is blacksmithing work', ACTION_BY_ID.get('pour_mould')?.skill === MOULD_SKILL, ACTION_BY_ID.get('pour_mould')?.skill);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na mould is the smith's — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
