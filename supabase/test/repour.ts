/**
 * A repeated mould pour takes the metal the first pour took.
 *
 * Reported: "If you repeat a mold filling option that used a specific metal it will not necessarily use that same
 * metal, ie when i just filled a mold using lower QL mithril from a nearby wagon then repeated the action it used the
 * higher QL mithril in my inventory for the repeat action."
 *
 * The repeat named the wagon's lumps, as the first pour did. Asked while the first pour was still in hand it was
 * queued on the island, and the queue stamped what the lumps were (`was`) for a stand-in; `act_retarget` took a stack
 * that is not carried for a stack that is gone, and stood the pack's mithril in for the wagon's. A stand-in is for a
 * thing you carry now, as the browser's `retarget` has it; a stack in a store is the one named, or the job is refused.
 *
 * Asks, in the browser, that the repeat key names the wagon's stack again, and still names it once that stack is
 * gone; and on the island, in a rolled-back transaction, that a pour from a wagon with its repeat queued behind it
 * takes both pours from the wagon and none from the pack, and that a repeat queued behind a pour that empties the
 * wagon's stack is refused rather than poured from the pack.
 */
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import type { Item } from '../../src/game/items';
import { MOULD_BY_ID, mouldLumps } from '../../src/game/metal';
import { psql, ok, bad, check } from './harness';

const MOULD = 'shovel_head_mould';
const def = MOULD_BY_ID.get(MOULD);
if (!def) throw new Error(`${MOULD} is missing`);
const NEED = mouldLumps(def, 'mithril');
check('a mithril pour takes the same lumps on both sides', Number(psql(`select mould_lumps('${MOULD}', 'mithril')`)) === NEED, `${NEED}`);

/* ---- the browser --------------------------------------------------------- */

{
  const g = Game.create(4242);
  let spot: [number, number] | null = null;
  for (let r = 0; r < 80 && !spot; r++) {
    for (let dx = -r; dx <= r && !spot; dx++) {
      for (const dy of [-r, r]) {
        const [x, y] = [64 + dx, 64 + dy];
        let dry = true;
        for (let j = -2; j <= 2 && dry; j++) {
          for (let i = -2; i <= 3 && dry; i++) dry = g.world.isPassable(x + i, y + j) && !g.world.hasWater(x + i, y + j);
        }
        if (dry) {
          spot = [x, y];
          break;
        }
      }
    }
  }
  const [px, py] = spot ?? [64, 64];
  g.player.x = px + 0.5;
  g.player.y = py + 0.5;
  for (const c of [...g.crates.values()]) g.removeCrate(c.id);
  for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
  const pack = g.inventory;
  const smelter = g.addSmelter(px + 1, py, 0, 0, 50);
  smelter.fuel = 600;
  smelter.lit = true;
  const low: Item = { uid: pack.nextUid++, id: 'mithril_lump', ql: 20, dmg: 0, count: NEED * 3, extra: 'Mithril' };
  const wagon = g.addFurniture('wagon', px + 2, py, 0, 0, 40, [low], 'Pine');
  const high = pack.add('mithril_lump', { ql: 80, count: NEED * 3, extra: 'Mithril' });
  const mould = pack.add(MOULD, { ql: 50 });
  pack.add('hammer', { ql: 50 });
  const pour = ACTION_BY_ID.get('pour_mould');
  if (!pour) throw new Error('pour_mould is missing');
  // What goes to the island, as `play.ts` sends it.
  const sent: Target[] = [];
  g.ask = (_d, t) => void sent.push(t);
  const t: Target = { kind: 'smelter', id: smelter.id, mouldUid: mould.uid, itemUid: low.uid };
  check('in the browser the pour from the wagon can be asked for', !pour.check?.(t, g), pour.check?.(t, g) ?? 'nothing in the way');
  g.requestAction(pour, t);
  g.repeatLast();
  const again = sent[1] as Target & { itemUid?: number };
  check('in the browser the repeat names the wagon\'s lumps, not the pack\'s', sent.length === 2 && again.itemUid === low.uid,
    `${sent.length} asked, lumps ${again?.itemUid} (wagon ${low.uid}, pack ${high.uid})`);
  wagon.items.length = 0;
  g.repeatLast();
  const gone = sent[2] as Target & { itemUid?: number };
  check('and still names them once the wagon\'s stack is gone, to be refused', gone?.itemUid === low.uid,
    `lumps ${gone?.itemUid} (wagon ${low.uid}, pack ${high.uid})`);
}

/* ---- the island ----------------------------------------------------------- */

const SMITH = '5a17a000-0000-4000-8000-00000000e9a1';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${SMITH}'; v_smelter bigint; v_wagon bigint; v_mould bigint; v_low bigint; v_high bigint;
        v_t jsonb; r jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Repour', 171, 32, 10, 10, true) returning id into w;
  perform land_blank(w, 32);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Smith');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 9.5, y = 9.5, body_at = now(), swim_at = now(),
         stats = jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1) where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'blacksmithing', 50), (w, u, 'smelting', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, state, made_by)
    values (w, 'smelter', 10, 9, 0, 0, 10.375, 9.25, 50, 600, true, '{"jobs": [], "output": []}'::jsonb, u)
    returning id into v_smelter;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, material, made_by)
    values (w, 'furniture', 'wagon', 7, 9, 7.5, 9.5, 40, 'Pine', u) returning id into v_wagon;
  insert into item (world_id, holder, placed, def, ql, count, extra)
    values (w, 'furniture', v_wagon, 'mithril_lump', 20, ${NEED * 3}, 'Mithril') returning id into v_low;
  v_high := give(w, u, 'mithril_lump', ${NEED * 3}, 80);
  v_mould := give(w, u, '${MOULD}', 1, 50);
  perform give(w, u, 'hammer', 1, 50);
  v_t := jsonb_build_object('kind', 'smelter', 'id', v_smelter, 'mouldUid', v_mould, 'itemUid', v_low);

  -- The pour, and the repeat asked while it is in hand.
  r := rpc_act(w, 'pour_mould', v_t, 1);
  insert into said values ('FIRST', coalesce(r->>'started', 'null') || '|' || coalesce(r->>'why', ''));
  r := rpc_act(w, 'pour_mould', v_t, 1);
  insert into said values ('QUEUED', coalesce(r->>'queued', 'null') || '|' || coalesce(r->>'why', ''));
  -- Both come due.
  update player set act_started = now() - interval '1 hour', act_ends = now() - interval '59 minutes'
    where world_id = w and uid = u;
  perform settle(w, u);
  insert into said values ('POURS', jsonb_array_length((select state->'jobs' from placed where id = v_smelter))::text);
  insert into said values ('WAGON', coalesce((select count from item where id = v_low), 0)::text);
  insert into said values ('PACK', coalesce((select count from item where id = v_high), 0)::text);

  -- A pour that empties the wagon's stack, and a repeat behind it: refused, and the pack left alone.
  update item set count = ${NEED} where id = v_low;
  update placed set state = '{"jobs": [], "output": []}'::jsonb where id = v_smelter;
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null, act_goes = null,
         act_queue = '[]'::jsonb where world_id = w and uid = u;
  delete from public.caller where uid = u;
  r := rpc_act(w, 'pour_mould', v_t, 1);
  r := rpc_act(w, 'pour_mould', v_t, 1);
  update player set act_started = now() - interval '1 hour', act_ends = now() - interval '59 minutes'
    where world_id = w and uid = u;
  perform settle(w, u);
  insert into said values ('EMPTIED', jsonb_array_length((select state->'jobs' from placed where id = v_smelter))
    || '|' || (select count(*) from item where id = v_low) || '|' || coalesce((select count from item where id = v_high), 0));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => isle.get(k) ?? 'unsaid';

check('on the island the pour from the wagon starts', say('FIRST').startsWith('true'), say('FIRST'));
check('and its repeat is queued behind it', say('QUEUED').startsWith('true'), say('QUEUED'));
check('both are poured', say('POURS') === '2', say('POURS'));
check(`both from the wagon's lumps: ${NEED * 3} → ${NEED}`, say('WAGON') === String(NEED), say('WAGON'));
check('and none from the pack\'s', say('PACK') === String(NEED * 3), say('PACK'));
check('a repeat behind a pour that empties the wagon\'s stack is refused, the pack left alone',
  say('EMPTIED') === `1|0|${NEED * 3}`, `pours|wagon stacks|pack lumps: ${say('EMPTIED')}`);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`a repeated pour takes the first pour's metal — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
