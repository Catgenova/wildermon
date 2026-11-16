/**
 * A prune gives a log of the tree's kind, and a pruner carries it to the settlement stores.
 *
 * Asked for: "Implement that pruning a tree also gives 1 log of that type. Wildermon that prune bring that log to
 * settlement storage." So this asks, of the island:
 *
 *   * a player's Prune of an old oak gives exactly `PRUNE_LOGS` log, the felled tree's item and wood (`log`, Oak), at
 *     the prune's quality, says so, and takes the tree back a stage;
 *   * a sapling pruned gives none, as it fells for none (`pruneLogs`);
 *   * a Saplingreach's prune of a very old oak puts `PRUNE_LOGS` oak log in its arms and walks it home, and once
 *     there it is in the settlement's crate and its arms are empty;
 *   * pruning carries loads as felling does (`load_trade`, `LOAD_TRADES`), and Examine on a tree to prune says the log;
 *
 * and of the browser: a pruner's go hands it the same log (`finishPruning`), and the words say the number.
 *
 * Makes its own island inside one transaction and rolls it back.
 */
import { Game } from '../../src/game/game';
import { treeOutlook } from '../../src/game/actions';
import { GATHER_DO, LOAD_TRADES, SPECIES } from '../../src/game/creatures';
import type { Item } from '../../src/game/items';
import { packTreeData, PRUNE_LOGS, pruneLogs, TileType, TREE_AGES, TREE_DEFS } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const age = (name: string): number => TREE_AGES.findIndex((a) => a.name === name);
const [OLD, MATURE, SAPLING, VERY_OLD] = ['Old', 'Mature', 'Sapling', 'Very old'].map(age);
const OAK = TREE_DEFS.findIndex((t) => t.name === 'Oak');
const T = 30;
const U = '7e5b0000-0000-4000-8000-000000000f17';

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Every skill check passes: the prune is what is asked of, not the dice.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
do $t$
declare w uuid; u uuid := '${U}'; s int; i int;
  at jsonb := jsonb_build_object('kind', 'tile', 'x', ${T + 1}, 'y', ${T});
  at2 jsonb := jsonb_build_object('kind', 'tile', 'x', ${T - 1}, 'y', ${T});
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Prunelog', 191, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Pruner');
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), act = null, act_queue = '[]',
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  perform give(w, u, 'sickle', 1, 50);
  insert into said values ('RULE', prune_logs()::text || '|' || load_trade('prune'));

  -- A player's prune of an old oak.
  perform land_set_tile(w, ${T + 1}, ${T}, tile_id('Tree'));
  perform land_set_data(w, ${T + 1}, ${T}, tree_pack(${OAK}, ${OLD}));
  insert into said values ('REFUSED', coalesce(act_refusal(w, u, 'prune', at), 'ALLOWED'));
  perform act_perform(w, u, 'prune', at);
  insert into said select 'LOGS', coalesce(sum(i.count), 0) || '|' || coalesce(string_agg(distinct i.extra, ','), '-')
    || '|' || coalesce(min(i.ql) > 0, false)
    from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = 'log';
  insert into said values ('AGE', tree_age(land_data(w, ${T + 1}, ${T}))::text || '|' || tree_species(land_data(w, ${T + 1}, ${T})));
  insert into said select 'SAID', e.text from event e where e.world_id = w and e.uid = u and e.text like 'Pruned %' order by e.n desc limit 1;

  -- A sapling gives none.
  perform land_set_tile(w, ${T - 1}, ${T}, tile_id('Tree'));
  perform land_set_data(w, ${T - 1}, ${T}, tree_pack(${OAK}, ${SAPLING}));
  perform act_perform(w, u, 'prune', at2);
  insert into said select 'SAPLING', coalesce(sum(i.count), 0)::text
    from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = 'log';

  -- Examine on a tree to prune.
  insert into said select 'OUTLOOK', tree_outlook(w, a) from tree_age_def a where a.id = ${VERY_OLD};

  -- A Saplingreach on its settlement, beside a very old oak, its crate at the token.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Prunestead', ${T}, ${T}, 10, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', ${T}, ${T + 3}, 0, 0, true, u);
  perform land_set_tile(w, ${T + 4}, ${T + 4}, tile_id('Tree'));
  perform land_set_data(w, ${T + 4}, ${T + 4}, tree_pack(${OAK}, ${VERY_OLD}));
  s := creature_spawn(w, 'snedda', ${T + 3} + 0.5, ${T + 4} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, care = 0, hunger = 1, stance = 'passive', carrying = null,
         skills = jsonb_build_object('forestry', 10) where world_id = w and id = s;
  insert into said values ('WOULD', worker_gatherable(w, ${T + 4}, ${T + 4}, 'prune', (select c from creature c where c.world_id = w and c.id = s))::text);
  update creature set phase = 'out', work_x = ${T + 4}, work_y = ${T + 4}, until = now() - interval '0.3 seconds',
         leg_at = now() - interval '0.3 seconds', leg_ends = now() - interval '0.3 seconds'
   where world_id = w and id = s;
  -- The go and the walk home, as the ticks would find them: what is in its arms the moment it has any.
  for i in 1..8 loop
    if i > 1 then
      update creature set until = now() - interval '0.3 seconds', leg_at = now() - interval '0.4 seconds', leg_ends = now() - interval '0.3 seconds',
             from_x = to_x, from_y = to_y
       where world_id = w and id = s and phase <> 'idle';
    end if;
    perform worker_settle(w, s);
    if not exists (select 1 from said where k = 'ARMS') then
      insert into said select 'ARMS', c.carrying->>'def' || '|' || (c.carrying->>'count') || '|' || coalesce(c.carrying->>'extra', '-')
        || '|' || c.phase || '|' || tree_age(land_data(w, ${T + 4}, ${T + 4}))
        from creature c where c.world_id = w and c.id = s and c.carrying is not null;
    end if;
  end loop;
  insert into said select 'CRATE', coalesce(sum(i.count), 0) || '|' || coalesce(string_agg(distinct i.extra, ','), '-')
    from item i where i.world_id = w and i.holder = 'crate' and i.crate = 1 and i.def = 'log';
  insert into said select 'EMPTY', (c.carrying is null)::text from creature c where c.world_id = w and c.id = s;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';
const logs = (n: number): string => `${n} ${n === 1 ? 'log' : 'logs'}`;

check(`the island's number is the browser's: ${PRUNE_LOGS} log a prune, and pruning carries loads on both sides`,
  at('RULE') === `${PRUNE_LOGS}|true` && LOAD_TRADES.has('prune'), at('RULE'));
check('on the island, a player may prune an old oak with a sickle', at('REFUSED') === 'ALLOWED', at('REFUSED'));
{
  const [n, wood, ql] = at('LOGS').split('|');
  check(`a player's prune of an old oak gives exactly ${logs(PRUNE_LOGS)}, oak, with a quality`,
    Number(n) === PRUNE_LOGS && wood === 'Oak' && ql === 'true', at('LOGS'));
}
check('and takes the tree a stage back, an oak still', at('AGE') === `${MATURE}|${OAK}`, at('AGE'));
check(`and says so: "${logs(PRUNE_LOGS)}, QL"`, new RegExp(`^Pruned oak: old to mature\\. ${logs(PRUNE_LOGS)}, QL \\d+\\.\\d\\.$`).test(at('SAID')), at('SAID'));
check(`a sapling pruned gives none (${pruneLogs(TREE_AGES[SAPLING])}), as it fells for none`,
  Number(at('SAPLING')) === PRUNE_LOGS && pruneLogs(TREE_AGES[SAPLING]) === 0, at('SAPLING'));
check(`Examine on a very old tree: "Prune to keep it alive: +${logs(PRUNE_LOGS)}.", on both sides`,
  at('OUTLOOK').endsWith(` Prune to keep it alive: +${logs(PRUNE_LOGS)}.`)
    && treeOutlook(TREE_AGES[VERY_OLD], 0).endsWith(` Prune to keep it alive: +${logs(PRUNE_LOGS)}.`), at('OUTLOOK'));
check('a Saplingreach on its settlement would prune a very old oak', at('WOULD') === 'true', at('WOULD'));
check(`its prune takes the oak a stage back, puts ${logs(PRUNE_LOGS)} of oak in its arms and it heads home`,
  at('ARMS') === `log|${PRUNE_LOGS}|Oak|home|${TREE_AGES[VERY_OLD].pruned}`, at('ARMS'));
check(`and the log arrives in the settlement's crate: ${logs(PRUNE_LOGS)}, oak, its arms empty`,
  at('CRATE') === `${PRUNE_LOGS}|Oak` && at('EMPTY') === 'true', `${at('CRATE')}; arms empty ${at('EMPTY')}`);

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

{
  const g = Game.create(4271);
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  g.world.setTile(20, 20, TileType.Tree, packTreeData(OAK, VERY_OLD));
  const c = g.creatures.spawn('snedda', 21.5, 20.5, 'active', g.rand, g.time - 3600 * 24 * 60);
  c.workX = 20;
  c.workY = 20;
  const got = (g.creatures as unknown as { finishPruning(g: Game, c: unknown): Item | null }).finishPruning(g, c);
  check(`in the browser, a pruner's go hands it ${logs(PRUNE_LOGS)} of oak`, got?.id === 'log' && got.count === PRUNE_LOGS && got.extra === 'Oak',
    `${got?.id}:${got?.count}:${got?.extra}`);
}
check(`the words say it: the trade "${GATHER_DO.prune}", the Saplingreach's "${PRUNE_LOGS} log of its kind a tree"`,
  GATHER_DO.prune.includes(`${PRUNE_LOGS} log of its kind a tree to your settlement stores`)
    && SPECIES.snedda.description.includes(`${PRUNE_LOGS} log of its kind a tree; output to your settlement stores`),
  SPECIES.snedda.description);

finish('a prune gives a log, and a pruner carries it home');
