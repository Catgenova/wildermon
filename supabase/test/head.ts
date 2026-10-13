/**
 * Head work raises mind logic, on both sides.
 *
 * Mind logic was raised by a finished craft, a restored find and a book and
 * nothing else, so its knacks came to crafters alone. Four jobs that are
 * worked out in the head raise it now, beside their own trade: a go of
 * prospecting (`PROSPECT_HEAD`), an offering to a wild creature
 * (`TAME_HEAD`), a scroll set (`ENCHANT_HEAD`) and a treasure map's hoard dug
 * up (`HOARD_HEAD`). What this asks:
 *
 *   * each base is the island's under the same name, generated from the
 *     browser's constant (`prospect_head()` and so on);
 *   * in the browser, a go of each raises mind logic;
 *   * on the island, a go of prospecting, an offering and a hoard dug up
 *     (`perform_ground`, `perform_creature`, `perform_treasure`) raise it;
 *   * and every way a scroll is set on the island -- into a weapon, a crate
 *     or a placed thing -- raises it by `enchant_head()`, `try_gain` of it by
 *     whether it took, as each of the three performers reads.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on
 * it. The island's half is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { CHAR_START, Game } from '../../src/game/game';
import { ENCHANT_HEAD, HOARD_HEAD, PROSPECT_HEAD, TAME_HEAD } from '../../src/game/learn';
import { ENCHANTMENT_LIST } from '../../src/game/enchant';
import { enchantable } from '../../src/game/enchanting';
import { buryTreasure } from '../../src/game/treasure';
import type { Creature } from '../../src/game/creatures';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

const HEADS: Array<[string, number]> = [['prospect_head', PROSPECT_HEAD], ['tame_head', TAME_HEAD], ['enchant_head', ENCHANT_HEAD], ['hoard_head', HOARD_HEAD]];

/* ---- the island ------------------------------------------------------------ */

const out = psql(`
begin;
create temp table said (k text, v text);
${HEADS.map(([fn]) => `insert into said values ('C:${fn}', ${fn}()::text);`).join('\n')}
do $b$
declare w uuid; me uuid; v_x double precision; v_y double precision; v_c int; v_map bigint; v_tries int; v_was double precision;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  update player set act = null, act_queue = '[]'::jsonb where world_id = w and uid = me;
  select x, y into v_x, v_y from player where world_id = w and uid = me;

  -- A go of prospecting where Dane stands.
  insert into skill (world_id, uid, id, value) values (w, me, 'mind_logic', char_start())
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform give(w, me, 'pickaxe', 1, 30);
  perform act_perform(w, me, 'prospect', jsonb_build_object('kind', 'tile', 'x', floor(v_x)::int, 'y', floor(v_y)::int,
    'cx', floor(v_x)::int, 'cy', floor(v_y)::int));
  insert into said values ('PROSPECT', skill_of(w, me, 'mind_logic')::text);

  -- An offering to a rabba, taken or refused.
  update creature set mode = 'wild', keeper = null where world_id = w and keeper = me and mode in ('active', 'stored', 'deed');
  insert into skill (world_id, uid, id, value) values (w, me, 'mind_logic', char_start())
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into skill (world_id, uid, id, value) values (w, me, 'taming', 90)
    on conflict (world_id, uid, id) do update set value = 90;
  perform give(w, me, 'potato', 5, 30);
  v_c := creature_spawn(w, 'rabba', v_x + 0.3, v_y, 'wild', now() - interval '3 hours');
  perform act_perform(w, me, 'tame', jsonb_build_object('kind', 'creature', 'id', v_c));
  insert into said values ('TAME', skill_of(w, me, 'mind_logic')::text);

  -- A worn map's hoard under Dane's feet, dug up.
  insert into skill (world_id, uid, id, value) values (w, me, 'mind_logic', char_start())
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into item (world_id, holder, holder_uid, def, ql) values (w, 'player', me, 'treasure_map', 50) returning id into v_map;
  insert into treasure (item_id, world_id, x, y, tier) values (v_map, w, floor(v_x)::int, floor(v_y)::int, 'worn');
  perform act_perform(w, me, 'unearth', jsonb_build_object('kind', 'item', 'uid', v_map));
  insert into said values ('HOARD', skill_of(w, me, 'mind_logic')::text || '|'
    || (not exists (select 1 from item where id = v_map))::text);
end $b$;
${['perform_enchant', 'perform_enchant_crate', 'perform_enchant_placed'].map((fn) => `insert into said values ('F:${fn}', pg_get_functiondef('${fn}'::regproc));`).join('\n')}
select k || '=' || replace(v, E'\\n', ' ') from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';

for (const [fn, v] of HEADS) check(`${fn}() is the browser's ${v}`, Number(island(`C:${fn}`)) === v, island(`C:${fn}`));
check('on the island, a go of prospecting raises mind logic', Number(island('PROSPECT')) > CHAR_START, island('PROSPECT'));
check('on the island, an offering to a wild creature raises mind logic', Number(island('TAME')) > CHAR_START, island('TAME'));
{
  const [ml, dug] = island('HOARD').split('|');
  check('on the island, a hoard dug up raises mind logic', dug === 'true' && Number(ml) > CHAR_START, island('HOARD'));
}
for (const fn of ['perform_enchant', 'perform_enchant_crate', 'perform_enchant_placed']) {
  const def = island(`F:${fn}`);
  check(`on the island, ${fn} raises mind logic by enchant_head(), whole when it takes and try_gain(false) of it when not`,
    def.includes("'mind_logic', try_gain(true, enchant_head())") && def.includes("'mind_logic', try_gain(false, enchant_head())"));
}

/* ---- the browser ----------------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(4242);
  // Every roll lands, so an offering is taken and a scroll takes.
  g.rand = () => 0;
  g.skills.values.set('mind_logic', CHAR_START);
  return g;
};
const act = (id: string) => {
  const a = ACTION_BY_ID.get(id);
  if (!a) throw new Error(`no ${id}`);
  return a;
};
const raised = (g: Game): number => g.skills.get('mind_logic') - CHAR_START;

{
  const g = fresh();
  g.inventory.add('pickaxe', { ql: 30 });
  const x = Math.floor(g.player.x);
  const y = Math.floor(g.player.y);
  act('prospect').perform({ kind: 'tile', x, y, cx: x, cy: y }, g);
  check('in the browser, a go of prospecting raises mind logic', raised(g) > 0, `${raised(g)}`);
}
{
  const g = fresh();
  g.skills.values.set('taming', 90);
  g.inventory.add('potato', { count: 5, ql: 30 });
  const c: Creature = g.creatures.spawn('rabba', g.player.x + 0.3, g.player.y, 'wild', g.rand, 0);
  act('tame').perform({ kind: 'creature', id: c.id }, g);
  check('in the browser, an offering to a wild creature raises mind logic', raised(g) > 0 && c.mode !== 'wild', `${raised(g)}, ${c.mode}`);
}
{
  const g = fresh();
  g.atStation = () => true;
  const sword = g.inventory.add('short_sword', { ql: 40, extra: 'Iron' });
  const e = ENCHANTMENT_LIST.find((k) => enchantable(g, k).some((it) => it.uid === sword.uid));
  if (!e) throw new Error('nothing goes on a short sword');
  const scroll = g.inventory.add(e.scroll, { ql: 50 });
  act('enchant').perform({ kind: 'item', uid: sword.uid, scroll: scroll.uid } as Target, g);
  check(`in the browser, the ${e.name} scroll set into a short sword raises mind logic`, raised(g) > 0 && !!sword.enchant, `${raised(g)}`);
}
{
  const g = fresh();
  const map = buryTreasure(g, 50, g.player.x, g.player.y);
  if (!map) throw new Error('nowhere to bury a hoard');
  act('unearth').perform({ kind: 'item', uid: map.uid }, g);
  check('in the browser, a hoard dug up raises mind logic', raised(g) > 0 && !g.inventory.get(map.uid), `${raised(g)}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`head work raises mind logic — ${ok.length} of ${ok.length}`);
