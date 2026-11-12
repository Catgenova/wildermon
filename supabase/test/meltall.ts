/**
 * Melt down all, and what comes back said.
 *
 * Reported: "putting all to melt down doesn't work, or it doesn't give game
 * messages when something is returned." Both were so. "All" of a stack whose
 * lumps were more than the furnace had room for was refused whole, "Smelter
 * full.", however empty it stood; and the lumps a melt gave back came out
 * told to the smelter's maker alone, with no count of each kind and no QL.
 *
 *   * the island: three hundred nails, all of them, into an empty smelter: the
 *     most whose lumps fit go in, the rest stay in the pack, and the line says
 *     how many did not fit; a hauberk and twenty nails into another, built by
 *     somebody else; the heat passes, and the one who melted them is told
 *     what came out, in one line, and the maker is not; drawn off, into the
 *     pack;
 *   * the browser: the same stack melted the same way, and every line word
 *     for word the island's.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import type { Item } from '../../src/game/items';
import { MELT_SHARE, meltFits, meltLumps, meltQl } from '../../src/game/melt';
import { furnaceMadeSaid, meltingSaid, smelterCapacity } from '../../src/game/smelter';
import { psql, ok, bad, check } from './harness';

const NAILS = 300;
const NAIL_QL = 40;
const HAUBERK_QL = 50;
const FEW = 20;
const CAP = smelterCapacity({});
const nails = (count: number): Item => ({ uid: 1, id: 'nail', ql: NAIL_QL, dmg: 0, count, extra: 'Iron' });
const hauberk: Item = { uid: 2, id: 'chain_hauberk', ql: HAUBERK_QL, dmg: 0, count: 1, extra: 'Iron' };

/* ---- the island ----------------------------------------------------------- */

const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; other uuid; tx int; ty int; v_a bigint; v_b bigint; v_it bigint; v_e bigint; r jsonb;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  select p.uid into other from player p where p.world_id = w and p.uid <> u order by p.uid limit 1;
  for tx in 0..15 loop for ty in 0..15 loop
    perform land_set_height(w, tx, ty, 40); perform land_set_tile(w, tx, ty, tile_id('Dirt'));
  end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from player_node where world_id = w and uid = u;
  delete from placed where world_id = w and x between 6 and 15 and y between 6 and 13;
  update player set x = 9.5, y = 9.5, act = null, act_target = null, act_started = null, act_ends = null,
         act_left = null, act_goes = null, act_queue = '[]', craft_class = null
   where world_id = w and uid = u;
  perform class_fold(w, u);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  -- Two lit smelters beside the body: one nobody built, one somebody else did.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    values (w, 'smelter', 10, 9, 0, 0, 10.375, 9.25, 50, 3600, true, '{"jobs": [], "output": []}'::jsonb, null)
    returning id into v_a;
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    values (w, 'smelter', 9, 10, 0, 0, 9.375, 10.25, 50, 3600, true, '{"jobs": [], "output": []}'::jsonb, other)
    returning id into v_b;
  select coalesce(max(n), 0) into v_e from event where world_id = w;

  -- All of a stack too big for one furnaceful, the way the menu asks it.
  v_it := give(w, u, 'nail', ${NAILS}, ${NAIL_QL}, 'Iron');
  insert into said values ('ALL?', coalesce(act_refusal(w, u, 'melt_down', jsonb_build_object('kind', 'smelter', 'id', v_a, 'itemUid', v_it, 'count', ${NAILS})), 'ALLOWED'));
  r := rpc_act(w, 'melt_down', jsonb_build_object('kind', 'smelter', 'id', v_a, 'itemUid', v_it, 'count', ${NAILS}), 1);
  insert into said values ('ALL', (select jsonb_array_length(state->'jobs') from placed where id = v_a) || '|'
    || coalesce((select count from item where id = v_it), 0) || '|'
    || (select e.text from event e where e.world_id = w and e.uid = u and e.n > v_e and e.text like 'Melting:%' order by e.n desc limit 1));
  -- And a full one refuses the rest.
  insert into said values ('FULL', coalesce(act_refusal(w, u, 'melt_down', jsonb_build_object('kind', 'smelter', 'id', v_a, 'itemUid', v_it, 'count', 1)), 'ALLOWED'));
  delete from item where id = v_it;

  -- Several things into the one somebody else built.
  select coalesce(max(n), 0) into v_e from event where world_id = w;
  v_it := give(w, u, 'nail', ${FEW}, ${NAIL_QL}, 'Iron');
  r := rpc_act(w, 'melt_down', jsonb_build_object('kind', 'smelter', 'id', v_b, 'itemUid', v_it, 'count', ${FEW}), 1);
  v_it := give(w, u, 'chain_hauberk', 1, ${HAUBERK_QL}, 'Iron');
  r := rpc_act(w, 'melt_down', jsonb_build_object('kind', 'smelter', 'id', v_b, 'itemUid', v_it, 'count', 1), 1);
  insert into said values ('SOME', (select string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.n > v_e and e.text like 'Melting:%'));
  -- The heat passes, with nobody asking: the clock's sweep.
  update placed set since = since - interval '30 minutes' where id = v_b;
  perform furnace_sweep(w);
  insert into said values ('MADE', coalesce((select string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.n > v_e and e.text like 'Smelter made:%'), 'nothing'));
  insert into said values ('MAKER', coalesce((select string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = other and e.n > v_e and e.text like 'Smelter made:%'), 'nothing'));
  -- Drawn off, into the pack.
  r := rpc_act(w, 'smelter_take_all', jsonb_build_object('kind', 'smelter', 'id', v_b), 1);
  update player set act_started = now() - interval '30 seconds', act_ends = now() - interval '1 second' where world_id = w and uid = u;
  perform settle(w, u);
  insert into said values ('TAKEN', (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'iron_lump') || '|'
    || coalesce((select e.text from event e where e.world_id = w and e.uid = u and e.n > v_e and e.text like 'Taken from smelter:%' order by e.n desc limit 1), 'nothing'));
  -- And the island's own words for it, off the browser's numbers.
  insert into said values ('SAID', melting_said(3, 'Nails', 2, 'Iron', 27.25, 5) || '#' || furnace_made_said('kiln', '[{"def": "clay_bowl", "count": 4, "ql": 30.04}, {"def": "iron_lump", "count": 1, "ql": 7}]'::jsonb));
end $$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const say = (k: string): string => said.get(k) ?? '';

const fit = meltFits(nails(NAILS), NAILS, CAP);
const allLine = meltingSaid(fit, 'Nails', meltLumps(nails(NAILS), fit), 'Iron', meltQl(nails(NAILS)), NAILS - fit);
check(`all of ${NAILS} nails is allowed into an empty smelter`, say('ALL?') === 'ALLOWED', say('ALL?'));
check(`and ${fit} go in, ${meltLumps(nails(NAILS), fit)} lumps of the ${CAP} it holds, ${NAILS - fit} kept in the pack`,
  say('ALL') === `${meltLumps(nails(NAILS), fit)}|${NAILS - fit}|${allLine}`, say('ALL'));
check(`said: "${allLine}"`, say('ALL').endsWith(allLine));
check('and the full smelter refuses one more', say('FULL') === 'Smelter full.', say('FULL'));

const fewLumps = meltLumps(nails(FEW), FEW);
const mailLumps = meltLumps(hauberk, 1);
const someLines = [
  meltingSaid(FEW, 'Nails', fewLumps, 'Iron', meltQl(nails(FEW)), 0),
  meltingSaid(1, 'Chain hauberk', mailLumps, 'Iron', meltQl(hauberk), 0),
];
check(`several things melted: "${someLines.join('" and "')}"`, say('SOME') === someLines.join('#'), say('SOME'));
const madeQl = (meltQl(nails(FEW)) * fewLumps + meltQl(hauberk) * mailLumps) / (fewLumps + mailLumps);
const madeLine = furnaceMadeSaid('smelter', [{ count: fewLumps + mailLumps, name: 'Iron lump', ql: madeQl }]);
check(`what came back is told to the one who melted it, in one line: "${madeLine}"`, say('MADE') === madeLine, say('MADE'));
check('and not to the smelter\'s maker, who put none of it in', say('MAKER') === 'nothing', say('MAKER'));
check(`drawn off, ${fewLumps + mailLumps} lumps in the pack`,
  say('TAKEN') === `${fewLumps + mailLumps}|Taken from smelter: ${fewLumps + mailLumps} × iron lump.`, say('TAKEN'));
const browserSaid = `${meltingSaid(3, 'Nails', 2, 'Iron', 27.25, 5)}#${furnaceMadeSaid('kiln', [{ count: 4, name: 'Clay bowl', ql: 30.04 }, { count: 1, name: 'Iron lump', ql: 7 }])}`;
check(`the island's words are the browser's: "${browserSaid.replace('#', '" and "')}"`, say('SAID') === browserSaid, say('SAID'));

/* ---- the browser ---------------------------------------------------------- */

const game = Game.create(4242);
let spot: [number, number] | null = null;
for (let r = 0; r < 80 && !spot; r++) {
  for (let dx = -r; dx <= r && !spot; dx++) {
    for (const dy of [-r, r]) {
      const [x, y] = [64 + dx, 64 + dy];
      let dry = true;
      for (let j = -1; j <= 2 && dry; j++) {
        for (let i = -1; i <= 3 && dry; i++) dry = game.world.isPassable(x + i, y + j) && !game.world.hasWater(x + i, y + j);
      }
      if (dry) {
        spot = [x, y];
        break;
      }
    }
  }
}
const [px, py] = spot ?? [64, 64];
game.player.x = px + 0.5;
game.player.y = py + 0.5;
for (const it of [...game.inventory.items]) if (it.id === 'nail' || it.id === 'chain_hauberk') game.inventory.remove(it.uid, it.count);
const smelter = game.addSmelter(px + 1, py, 0, 0, 50);
smelter.fuel = 3600;
smelter.lit = true;
const stack = game.inventory.add('nail', { count: NAILS, ql: NAIL_QL, extra: 'Iron' });
const def = ACTION_BY_ID.get('melt_down')!;
const t = { kind: 'smelter', id: smelter.id, itemUid: stack.uid, count: NAILS } as Target;
const why = def.check?.(t, game) ?? null;
if (!why) def.perform(t, game);
const last = game.log[game.log.length - 1]?.text ?? '';
check(`in the browser, all of ${NAILS} nails: ${fit} in, ${NAILS - fit} kept, and the island's line`,
  why === null && smelter.jobs.length === meltLumps(nails(NAILS), fit) && (game.inventory.get(stack.uid)?.count ?? 0) === NAILS - fit && last === allLine,
  `${why} ${smelter.jobs.length} ${game.inventory.get(stack.uid)?.count} "${last}"`);
check('and refuses one more, full', def.check?.({ ...t, count: 1 } as Target, game) === 'Smelter full.');
check('and the share is the one the island melts at', MELT_SHARE === Number(psql('select melt_share();')));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`melt down all — ${ok.length} of ${ok.length}`);
