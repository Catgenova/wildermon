/**
 * What is on your table, through a refresh.
 *
 * Reported: "browser refresh seems to reset nutritions". The island kept them:
 * `player.nutrition` was what had been eaten, and `rpc_join` handed the row
 * over with it. The browser read nutrition off the beat only, and the first
 * beat goes a `HEARTBEAT` after the join, so a refreshed page drew all four at
 * nought until then. This asks:
 *
 *   * on the island, what was eaten is on the row, on the row the join hands
 *     over, and on the first beat after it, by the browser's own feeds and
 *     helping (`helpingOf`);
 *   * in the browser, the join's row reads as the same four (`rowSaid`,
 *     `nutritionSaid`), and the page reads it at the join and on every beat;
 *   * a nutrient the island does not name is nought in the browser too, not
 *     whatever the page last held.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { readFileSync } from 'node:fs';
import { itemDef } from '../../src/game/items';
import { emptyNutrition, helpingOf, NUTRIENTS, nutritionSaid, type Nutrient } from '../../src/game/nutrition';
import { rowSaid, type PlayerRow } from '../../src/net/island';
import { psql, check, finish } from './harness';

const MIRA = 'f00d0000-0000-4000-8000-0000000000a1';
/** What is eaten, at what quality: greens are left out, so the island never names them. */
const MEALS: Array<[string, number]> = [['cooked_meat', 50], ['bread', 80]];

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_id bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Table', 166, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set nutrition = '{}'::jsonb where world_id = w and uid = u;
${MEALS.map(([def, ql]) => `  insert into item (world_id, def, ql, count, holder, holder_uid) values (w, '${def}', ${ql}, 1, 'player', u)
    returning id into v_id;
  perform act_perform(w, u, 'eat', jsonb_build_object('kind', 'item', 'uid', v_id));`).join('\n')}
  insert into said values ('ATE', (select nutrition::text from player where world_id = w and uid = u));
  -- The refresh: the page joins again, and its first beat asks for the book.
  insert into said values ('JOIN', (rpc_join(w, null)->'you')::text);
  insert into said values ('BEAT', (rpc_settle(p_world => w, p_book => true)->'nutrition')::text);
  insert into said values ('ROW', (select nutrition::text from player where world_id = w and uid = u));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const json = <T>(k: string): T => JSON.parse(isle.get(k) ?? 'null') as T;

/** What the meals put in, by the browser's own feeds and helping. */
const eaten = emptyNutrition();
for (const [def, ql] of MEALS) {
  for (const k of NUTRIENTS) eaten[k] = Math.min(1, eaten[k] + (itemDef(def).feeds?.[k] ?? 0) * helpingOf(ql));
}
const same = (n: Record<string, unknown> | null, named = true): boolean => !!n && NUTRIENTS.every((k) => {
  const v = n[k];
  return eaten[k] === 0 && !named ? v === undefined : typeof v === 'number' && Math.abs(v - eaten[k]) < 1e-6;
});
const show = (n: unknown): string => JSON.stringify(n);

/* ---- on the island --------------------------------------------------------------- */

check('eating puts the browser\'s feeds on the row', same(json('ATE'), false), `${isle.get('ATE')} against ${show(eaten)}`);
const you = json<PlayerRow>('JOIN');
check('the join hands the row over with them', same(you?.nutrition as Record<string, unknown>, false), show(you?.nutrition));
check('the first beat after it says them', same(json('BEAT'), false), isle.get('BEAT') ?? '');
check('and the row still holds them', same(json('ROW'), false), isle.get('ROW') ?? '');

/* ---- in the browser -------------------------------------------------------------- */

const atJoin = rowSaid(you).nutrition;
check('the join\'s row reads as the four eaten', !!atJoin && same(nutritionSaid(atJoin)), show(atJoin && nutritionSaid(atJoin)));
const page = emptyNutrition();
page.greens = 0.5;
const beat = json<Record<string, unknown>>('BEAT');
Object.assign(page, nutritionSaid(beat));
check('the beat sets all four, the one the island does not name to nought', same(page), show(page));
const greens: Nutrient = 'greens';
check('and the island names no greens here', !(greens in beat), isle.get('BEAT') ?? '');

const play = readFileSync('src/net/play.ts', 'utf8');
check('the page reads the join\'s row through the beat\'s door', play.includes('island.hooks.mine(rowSaid(me));'));
check('and every beat, wholesale', play.includes('if (what.nutrition) Object.assign(game.player.nutrition, nutritionSaid(what.nutrition));'));

finish('what is on your table, through a refresh');
