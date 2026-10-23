/**
 * Wildermon gear: a pack, a harness and barding.
 *
 * Asked for: "wildermon gear (#17), player-crafted gear fitted on a wildermon, one item per slot", a pack for a load
 * more a trip, a harness for a team's pace and barding for less damage taken, in the beds' three sizes, by QL, worn
 * with use and repaired as other gear. This asks, of both sides:
 *
 *   * that the nine pieces and their recipes are the same, each piece knows its slot and its size, and the numbers agree;
 *   * that fitting is refused in the same words with nothing to fit, the wrong size, the wrong slot, a slot taken and on
 *     somebody else's, and taking off with nothing fitted;
 *   * that a pack puts `PACK_LOADS` on its loads a trip at a trade that carries loads and nothing at one that does not,
 *     and nothing once it has grown out of it;
 *   * that a harness puts `HARNESS_PACE` at its QL's share on its team's pace, and wears a tile pulled;
 *   * that barding takes `BARDING_CUT` at its QL's share off a blow, wears a blow, and is gone at `DAMAGE_MAX`;
 *   * that one taken off is back in the pack at its QL and damage, and repairs as anything does; that a release gives it
 *     back; and that the card and the log say the same as the island.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { denClass, harnessTeam, stageLoads, type Creature } from '../../src/game/creatures';
import { ITEM_DEFS } from '../../src/game/items';
import { RECIPES } from '../../src/game/recipes';
import { DAMAGE_MAX, wearPerUse, WORN_FLOOR, WORN_SPAN } from '../../src/game/limits';
import {
  BARDING_CUT, GEAR_FLOOR, gearId, gearOf, gearSays, gearShare, GEAR_SIZES, GEAR_SLOTS, HARNESS_PACE, PACK_LOADS, type GearSize,
} from '../../src/game/wildgear';
import { fitGearId, gearTags, removeGearId } from '../../src/game/wildgearActions';

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
const near = (a: number, b: number, tol = 1e-6): boolean => Math.abs(a - b) < tol * Math.max(1, Math.abs(b));
const U = '64646464-6464-4464-8464-646464646464';
const V = '65656565-6565-4565-8565-656565656565';
/** The QLs each piece is made at: a poor harness, a fine barding, a middling pack. */
const QL = { pack: 40, harness: 30, barding: 80 };
/** Tiles the cart is driven, each a harness's wear. */
const TILES = 4;

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v uuid := '${V}'; a int; b int; r int; c creature; px double precision; py double precision;
        cls int; v_it bigint; v_cart bigint; v_h0 double precision; v_h1 double precision; v_s0 double precision;
        v_s1 double precision; ash jsonb := jsonb_build_object('kind', 'creature', 'id', 0);
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Wildermon gear', 1717, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  perform rpc_join(w, 'Other');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Fitter');
  update player set x = 16.5, y = 16.5, level = 0, aboard = null, away = false, moved_at = now() - interval '10 seconds'
   where world_id = w and uid = u;
  select x, y into px, py from player where world_id = w and uid = u;
  insert into said values ('NUMBERS', pack_loads() || '|' || harness_pace() || '|' || barding_cut() || '|' || gear_floor()
    || '|' || worn_span() || '|' || worn_floor() || '|' || damage_max());
  insert into said select 'ITEMS', string_agg(d.id || ':' || d.name || ':' || gear_slot_of(d.id) || ':' || gear_size_of(d.id), ',' order by d.id)
    from item_def d where d.id like 'wild\\_%';
  insert into said select 'RECIPES', string_agg(r.id || ':' || r.skill || ':' || r.tool || ':' || r.difficulty || ':'
    || (select string_agg(i.item || 'x' || i.count, '+' order by i.ord) from recipe_input i where i.recipe = r.id), ',' order by r.id)
    from recipe r where r.result like 'wild\\_%';
  insert into said select 'PORTED', string_agg(t.act || ':' || act_ported(t.act) || ':' || exists (select 1 from action_def d where d.id = t.act), ',' order by t.act)
    from unnest(array['fit_gear_pack', 'fit_gear_harness', 'fit_gear_barding', 'remove_gear_pack', 'remove_gear_harness', 'remove_gear_barding']) as t(act);
  insert into said values ('SHARES', gear_share('{"ql": 0, "dmg": 0}') || '|' || gear_share('{"ql": 20, "dmg": 0}') || '|'
    || gear_share('{"ql": 90, "dmg": 50}') || '|' || gear_share('{"ql": 100, "dmg": 100}') || '|' || wear_per_use(30));
  insert into said values ('SAYS', gear_says('pack', '{"ql": 20, "dmg": 0}') || '|' || gear_says('harness', '{"ql": 30, "dmg": 0}')
    || '|' || gear_says('barding', '{"ql": 90, "dmg": 50}'));

  -- Ash, yours; Bo, somebody else's; both beside you.
  a := creature_spawn(w, 'rabba', px + 0.5, py, 'active', now() - interval '60 days', u);
  b := creature_spawn(w, 'rabba', px, py + 0.5, 'active', now() - interval '60 days', v);
  update creature set traits = '{}', rare = null, name = 'Ash', kept = null, boosts = null, gear = null, hunger = 1 where world_id = w and id = a;
  update creature set traits = '{}', rare = null, name = 'Bo', kept = null, boosts = null, gear = null where world_id = w and id = b;
  ash := jsonb_build_object('kind', 'creature', 'id', a);
  select * into c from creature where world_id = w and id = a;
  cls := den_class(c);
  insert into said values ('CLASS', cls::text);

  -- The refusals.
  insert into said values ('R:NONE', coalesce(act_refusal(w, u, 'fit_gear_pack', ash), '-') || '|' || coalesce(act_refusal(w, u, 'fit_gear_barding', ash), '-'));
  perform give(w, u, gear_id('pack', (cls + 1) % 3), 1, 40);
  insert into said values ('R:SIZE', coalesce(act_refusal(w, u, 'fit_gear_pack', ash), '-'));
  v_it := give(w, u, gear_id('harness', cls), 1, ${QL.harness});
  insert into said values ('R:SLOT', coalesce(act_refusal(w, u, 'fit_gear_pack', ash || jsonb_build_object('itemUid', v_it)), '-'));
  perform give(w, u, gear_id('pack', cls), 1, ${QL.pack});
  insert into said values ('R:THEIRS', coalesce(act_refusal(w, u, 'fit_gear_pack', jsonb_build_object('kind', 'creature', 'id', b)), '-')
    || '|' || coalesce(act_refusal(w, u, 'remove_gear_pack', jsonb_build_object('kind', 'creature', 'id', b)), '-'));
  insert into said values ('R:NOTHING', coalesce(act_refusal(w, u, 'remove_gear_barding', ash), '-'));
  insert into said values ('R:OK', coalesce(act_refusal(w, u, 'fit_gear_pack', ash), '-'));

  -- The pack: its loads, at a trade that carries them and at one that does not.
  insert into said values ('LOADS0', stage_loads(c)::text);
  perform act_perform(w, u, 'fit_gear_pack', ash);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('LOADS1', stage_loads(c)::text);
  insert into said values ('R:TAKEN', coalesce(act_refusal(w, u, 'fit_gear_pack', ash), '-'));
  update creature set job = 'groom' where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('LOADS:GROOM', stage_loads(c)::text);
  update creature set job = null where world_id = w and id = a;
  insert into said values ('PACKWEAR', (gear_wear(w, c, 'pack', 1)->'pack'->>'dmg'));
  -- Worn where a worker's cycle is counted, at its task and at an errand, and written down with the row each time.
  insert into said select 'PACKHOOK', ((length(d) - length(replace(d, $$gear_wear(p_world, c, 'pack', 1)$$, ''))) / length($$gear_wear(p_world, c, 'pack', 1)$$))
    || '|' || ((length(d) - length(replace(d, 'gear = c.gear', ''))) / length('gear = c.gear'))
    from (select pg_get_functiondef('worker_settle'::regproc) d) x;

  -- The barding: a blow before and after, and its wear.
  select health into v_h0 from creature where world_id = w and id = a;
  perform hurt_creature(w, a, 1.0, null);
  select health into v_h1 from creature where world_id = w and id = a;
  v_s0 := v_h0 - v_h1;
  perform give(w, u, gear_id('barding', cls), 1, ${QL.barding});
  perform act_perform(w, u, 'fit_gear_barding', ash);
  perform hurt_creature(w, a, 1.0, null);
  select health into v_h0 from creature where world_id = w and id = a;
  insert into said values ('BARDED', ((v_h1 - v_h0) / v_s0)::text);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('BWEAR', c.gear->'barding'->>'dmg');
  insert into said values ('CARD', gear_says('pack', c.gear->'pack') || '|' || gear_says('barding', c.gear->'barding'));
  insert into said values ('SENT', (select jsonb_build_object('pack', g->'pack', 'barding', g->'barding')::text from gear_sent(c.gear) g));
  -- Worn out: one more blow at the brink, and it is gone.
  update creature set gear = jsonb_set(gear, '{barding,dmg}', to_jsonb(${DAMAGE_MAX} - 0.01)) where world_id = w and id = a;
  perform hurt_creature(w, a, 1.0, null);
  select * into c from creature where world_id = w and id = a;
  insert into said values ('BGONE', coalesce(c.gear->>'barding', '-') || '|' || (c.gear ? 'pack')::text);

  -- The harness: a cart's pace with it and without, and a tile's wear for each tile driven.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, driver)
    values (w, 'furniture', 'large_cart', floor(px)::int, floor(py)::int, floor(px) + 0.5, floor(py) + 0.5, 50, u) returning id into v_cart;
  r := creature_spawn(w, 'rabba', px + 1, py, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, name = 'Rue', kept = null, boosts = null, gear = null, hunger = 1, skills = '{}',
         hitched_to = v_cart where world_id = w and id = r;
  v_s0 := vehicle_speed(w, v_cart);
  perform act_perform(w, u, 'fit_gear_harness', jsonb_build_object('kind', 'creature', 'id', r, 'itemUid', v_it));
  v_s1 := vehicle_speed(w, v_cart);
  insert into said values ('HARNESSED', (v_s1 / nullif(v_s0, 0))::text || '|' || harness_team(w, v_cart));
  perform rpc_move(w, px + ${TILES}, py, 0);
  insert into said select 'HWEAR', coalesce(gear->'harness'->>'dmg', '-') from creature where world_id = w and id = r;
  insert into said select 'MOVED', (floor(x) - floor(px))::text from player where world_id = w and uid = u;
  -- Taken off: in the pack at its QL and damage, and repaired as anything is.
  update player set body_at = now(), x = px + ${TILES}, y = py where world_id = w and uid = u;
  update creature set from_x = px + ${TILES} + 1, to_x = px + ${TILES} + 1, from_y = py, to_y = py where world_id = w and id = r;
  perform act_perform(w, u, 'remove_gear_harness', jsonb_build_object('kind', 'creature', 'id', r));
  select id into v_it from item where world_id = w and holder = 'player' and holder_uid = u and def = gear_id('harness', cls);
  insert into said select 'REMOVED', ql || '|' || dmg || '|' || coalesce((select gear::text from creature where world_id = w and id = r), '-')
    from item where id = v_it;
  insert into said values ('R:REPAIR', coalesce(act_refusal(w, u, 'repair_item', jsonb_build_object('kind', 'item', 'uid', v_it)), '-'));
  perform act_perform(w, u, 'repair_item', jsonb_build_object('kind', 'item', 'uid', v_it));
  insert into said select 'REPAIRED', (dmg < (${TILES} * wear_per_use(${QL.harness})))::text from item where id = v_it;

  -- Released: the pack back to you.
  update player set body_at = now(), x = px, y = py where world_id = w and uid = u;
  perform act_perform(w, u, 'release_creature', ash);
  insert into said select 'RELEASED', count(*)::text || '|' || coalesce((select gear::text from creature where world_id = w and id = a), '-')
    from item where world_id = w and holder = 'player' and holder_uid = u and def = gear_id('pack', cls);

  insert into said select 'TOLD', string_agg(text, ' / ' order by n) from event where world_id = w and uid = u
    and (text like '% fitted on %' or text like '% removed from %' or text like '%, gone.');
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(1717);
g.time = 3600 * 24 * 60;
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const make = (name: string, x: number, y: number): Creature => {
  const c = g.creatures.spawn('rabba', x, y, 'active', g.rand, g.time - 3600 * 24 * 30);
  Object.assign(c, { traits: [], rare: 0, name, boosts: undefined, gear: undefined, hunger: 1 });
  return c;
};
const ash = make('Ash', g.player.x + 0.5, g.player.y);
const bo = make('Bo', g.player.x, g.player.y + 0.5);
bo.mine = false;
const A = { kind: 'creature' as const, id: ash.id };
const B = { kind: 'creature' as const, id: bo.id };
const cls = denClass(ash) as GearSize;
const act = (id: string) => ACTION_BY_ID.get(id)!;
const told: string[] = [];
const said = (): void => {
  for (const e of g.log) if (/ fitted on | removed from |, gone\.$/.test(e.text) && !told.includes(e.text)) told.push(e.text);
};

/* ---- both ---------------------------------------------------------------------------- */

check('the numbers are the same on both sides',
  at('NUMBERS') === `${PACK_LOADS}|${HARNESS_PACE}|${BARDING_CUT}|${GEAR_FLOOR}|${WORN_SPAN}|${WORN_FLOOR}|${DAMAGE_MAX}`, at('NUMBERS'));
{
  const items = GEAR_SLOTS.flatMap((slot) => ([0, 1, 2] as const).map((size) => gearId(slot, size))).sort()
    .map((id) => `${id}:${ITEM_DEFS[id].name}:${gearOf(id)!.slot}:${gearOf(id)!.size}`).join(',');
  check(`${GEAR_SLOTS.length} slots in ${GEAR_SIZES.length} sizes: the same pieces, slots and sizes on both sides`,
    items === at('ITEMS') && Object.keys(ITEM_DEFS).filter((id) => gearOf(id)).length === GEAR_SLOTS.length * GEAR_SIZES.length, `${items} | ${at('ITEMS')}`);
  const recipes = RECIPES.filter((r) => gearOf(r.result)).sort((x, y) => (x.id < y.id ? -1 : 1))
    .map((r) => `${r.id}:${r.skill}:${r.tool}:${r.difficulty}:${r.inputs.map((i) => `${i.item}x${i.count ?? 1}`).join('+')}`).join(',');
  check('a recipe for each, in the crafting window, the same bills on both sides', recipes === at('RECIPES'), `${recipes} | ${at('RECIPES')}`);
}
check('the six actions are ones the island does and prices, and the browser has',
  at('PORTED') === ['fit_gear_barding', 'fit_gear_harness', 'fit_gear_pack', 'remove_gear_barding', 'remove_gear_harness', 'remove_gear_pack']
    .map((id) => `${id}:true:true`).join(',') && GEAR_SLOTS.every((s) => ACTION_BY_ID.has(fitGearId(s)) && ACTION_BY_ID.has(removeGearId(s))), at('PORTED'));
{
  const shares = [gearShare({ ql: 0, dmg: 0 }), gearShare({ ql: 20, dmg: 0 }), gearShare({ ql: 90, dmg: 50 }), gearShare({ ql: 100, dmg: 100 }), wearPerUse(30)];
  const isle5 = at('SHARES').split('|').map(Number);
  check(`QL puts a piece between ${GEAR_FLOOR} and the whole, damage drags it as a tool's, the same on both sides`,
    shares.every((s, i) => near(s, isle5[i])) && near(shares[0], GEAR_FLOOR) && near(gearShare({ ql: 100, dmg: 0 }), 1), `${shares.join('|')} | ${at('SHARES')}`);
  const says = `${gearSays('pack', { ql: 20, dmg: 0 })}|${gearSays('harness', { ql: 30, dmg: 0 })}|${gearSays('barding', { ql: 90, dmg: 50 })}`;
  check('what each does is said the same on both sides', says === at('SAYS'), `${says} | ${at('SAYS')}`);
}
check('the same size on both sides', String(cls) === at('CLASS'), `${cls} | ${at('CLASS')}`);

// The refusals.
{
  const fitPack = act(fitGearId('pack'));
  const none = `${fitPack.check?.(A, g) ?? '-'}|${act(fitGearId('barding')).check?.(A, g) ?? '-'}`;
  g.inventory.add(gearId('pack', ((cls + 1) % 3) as GearSize), { ql: 40 });
  const size = fitPack.check?.(A, g) ?? '-';
  const harness = g.inventory.add(gearId('harness', cls), { ql: QL.harness });
  const slot = fitPack.check?.({ ...A, itemUid: harness.uid }, g) ?? '-';
  g.inventory.add(gearId('pack', cls), { ql: QL.pack });
  const theirs = `${fitPack.check?.(B, g) ?? '-'}|${act(removeGearId('pack')).check?.(B, g) ?? '-'}`;
  const nothing = act(removeGearId('barding')).check?.(A, g) ?? '-';
  const fine = fitPack.check?.(A, g) ?? '-';
  check('nothing to fit: refused in the same words', none === at('R:NONE') && none === `Need a ${GEAR_SIZES[cls]} wildermon pack.|Need ${GEAR_SIZES[cls]} wildermon barding.`, `${none} | ${at('R:NONE')}`);
  check('the wrong size: refused in the same words', size === at('R:SIZE') && size === `Ash: ${GEAR_SIZES[cls]} gear only.`, `${size} | ${at('R:SIZE')}`);
  check('the wrong slot: refused in the same words', slot === at('R:SLOT') && slot === `${ITEM_DEFS[harness.id].name}: not a wildermon pack.`, `${slot} | ${at('R:SLOT')}`);
  check('not yours: fitting and taking off refused in the same words', theirs === at('R:THEIRS') && theirs === 'Bo: not yours.|Bo: not yours.', `${theirs} | ${at('R:THEIRS')}`);
  check('nothing fitted to take off: refused in the same words', nothing === at('R:NOTHING') && nothing === 'Ash: no barding fitted.', `${nothing} | ${at('R:NOTHING')}`);
  check('the right piece is fitted on both sides', fine === '-' && at('R:OK') === '-', `${fine} | ${at('R:OK')}`);
}

// The pack.
{
  const loads0 = stageLoads(ash);
  act(fitGearId('pack')).perform(A, g);
  said();
  const loads1 = stageLoads(ash);
  const taken = act(fitGearId('pack')).check?.(A, g) ?? '-';
  ash.trade = 'groom';
  const groom = stageLoads(ash);
  ash.trade = null;
  check(`a pack: loads a trip +${PACK_LOADS} at a trade that carries loads, none at one that does not, on both sides`,
    loads1 === loads0 + PACK_LOADS && groom === loads0 && at('LOADS0') === String(loads0) && at('LOADS1') === String(loads1) && at('LOADS:GROOM') === String(groom),
    `${loads0}/${loads1}/${groom} | ${at('LOADS0')}/${at('LOADS1')}/${at('LOADS:GROOM')}`);
  check('a slot taken: refused in the same words', taken === at('R:TAKEN') && taken === 'Ash: pack already fitted.', `${taken} | ${at('R:TAKEN')}`);
  const before = ash.gear!.pack!.dmg;
  const copy = { gear: { pack: { ...ash.gear!.pack! } } };
  g.creatures.wearGear(g, copy as unknown as Creature, 'pack');
  check('a pack wears a cycle as a tool of its QL does, on both sides',
    before === 0 && near(copy.gear.pack.dmg, wearPerUse(QL.pack)) && near(Number(at('PACKWEAR')), wearPerUse(QL.pack))
      && at('PACKHOOK') === '2|4', `${copy.gear.pack.dmg} | ${at('PACKWEAR')} (worker_settle: ${at('PACKHOOK')})`);
  // Grown out of it: a stage up, and the pack fits no more.
  const was = { ...ash.skills };
  ash.skills = { ...ash.skills, foraging: 30 };
  const outgrown = denClass(ash) !== cls;
  check('one grown out of its pack carries no more for it, and its card says so',
    outgrown && stageLoads(ash) === stageLoads({ ...ash, gear: undefined }) && gearTags(ash)[0]?.text === `Pack: outgrown (${GEAR_SIZES[cls]}), no effect`,
    `${outgrown} ${gearTags(ash)[0]?.text}`);
  ash.skills = was;
}

// The barding.
{
  const h0 = ash.health;
  g.creatures.hurt(g, ash, 1.0, 'player');
  const bare = h0 - ash.health;
  g.inventory.add(gearId('barding', cls), { ql: QL.barding });
  act(fitGearId('barding')).perform(A, g);
  said();
  const h1 = ash.health;
  g.creatures.hurt(g, ash, 1.0, 'player');
  const barded = (h1 - ash.health) / bare;
  const want = 1 - BARDING_CUT * gearShare({ ql: QL.barding, dmg: 0 });
  check(`barding at QL ${QL.barding}: a blow at ${want.toFixed(4)} of itself, on both sides`,
    near(barded, want) && near(Number(at('BARDED')), want), `${barded} | ${at('BARDED')}`);
  check('barding wears a blow as a tool of its QL does, on both sides',
    near(ash.gear!.barding!.dmg, wearPerUse(QL.barding)) && near(Number(at('BWEAR')), wearPerUse(QL.barding)), `${ash.gear!.barding!.dmg} | ${at('BWEAR')}`);
  const card = gearTags(ash).map((t) => t.text).join('|');
  const [isPack, isBarding] = at('CARD').split('|');
  check('the card says what each does, as the island says it', card === `Pack: ${isPack}|Barding: ${isBarding}`, `${card} | ${at('CARD')}`);
  const sent = JSON.parse(at('SENT')) as Record<string, { def: string; ql: number; dmg: number }>;
  check('the island sends your own its gear, its QL and damage a slot',
    sent.pack?.def === gearId('pack', cls) && sent.pack.ql === QL.pack && sent.barding?.def === gearId('barding', cls) && near(sent.barding.dmg, wearPerUse(QL.barding)),
    at('SENT'));
  ash.gear!.barding!.dmg = DAMAGE_MAX - 0.01;
  g.creatures.hurt(g, ash, 1.0, 'player');
  said();
  check(`at ${DAMAGE_MAX} damage it is gone, the rest kept, on both sides`,
    !ash.gear?.barding && !!ash.gear?.pack && at('BGONE') === '-|true', `${JSON.stringify(Object.keys(ash.gear ?? {}))} | ${at('BGONE')}`);
}

// The harness.
{
  const rue = make('Rue', g.player.x + 1, g.player.y);
  rue.skills = {};
  const R = { kind: 'creature' as const, id: rue.id };
  const team0 = harnessTeam([rue]);
  const harness = g.inventory.items.find((it) => it.id === gearId('harness', cls))!;
  act(fitGearId('harness')).perform({ ...R, itemUid: harness.uid }, g);
  said();
  const want = 1 + HARNESS_PACE * gearShare({ ql: QL.harness, dmg: 0 });
  const [isleRatio, isleTeam] = at('HARNESSED').split('|').map(Number);
  check(`a harness at QL ${QL.harness}: team pace ×${want.toFixed(4)}, on both sides, and on the island's cart`,
    team0 === 1 && near(harnessTeam([rue]), want) && near(isleTeam, want) && near(isleRatio, want, 1e-4)
      && near(harnessTeam([rue, ash]), 1 + (want - 1) / 2), `${harnessTeam([rue])} | ${at('HARNESSED')}`);
  for (let i = 0; i < TILES; i++) g.creatures.wearGear(g, rue, 'harness');
  check(`a harness wears a tile pulled, ${TILES} tiles driven, on both sides`,
    at('MOVED') === String(TILES) && near(rue.gear!.harness!.dmg, TILES * wearPerUse(QL.harness), 1e-4) && near(Number(at('HWEAR')), TILES * wearPerUse(QL.harness), 1e-4),
    `${rue.gear!.harness!.dmg} | ${at('HWEAR')} (moved ${at('MOVED')})`);
  act(removeGearId('harness')).perform(R, g);
  said();
  const back = g.inventory.items.find((it) => it.id === gearId('harness', cls))!;
  const [ql, dmg, left] = at('REMOVED').split('|');
  check('taken off: back in the pack at its QL and damage, on both sides',
    back.ql === QL.harness && near(back.dmg, TILES * wearPerUse(QL.harness), 1e-4) && !rue.gear
      && Number(ql) === QL.harness && near(Number(dmg), TILES * wearPerUse(QL.harness), 1e-4) && left === '-', `${back.ql}|${back.dmg} | ${at('REMOVED')}`);
  const repair = act('repair_item');
  const before = back.dmg;
  const may = repair.check?.({ kind: 'item', uid: back.uid }, g) ?? '-';
  repair.perform({ kind: 'item', uid: back.uid }, g);
  check('and repaired as anything is, on both sides', may === '-' && at('R:REPAIR') === '-' && back.dmg < before && at('REPAIRED') === 'true',
    `${may} ${back.dmg} | ${at('R:REPAIR')} ${at('REPAIRED')}`);
}

// Released: the pack back to you.
{
  const packs = (): number => g.inventory.items.filter((it) => it.id === gearId('pack', cls)).length;
  const was = packs();
  act('release_creature').perform(A, g);
  said();
  check('released: its gear back in your pack, on both sides', packs() === was + 1 && !ash.gear && at('RELEASED') === '1|-', `${packs()} | ${at('RELEASED')}`);
}

check('both sides say the same as each is fitted, taken off and worn out', told.join(' / ') === at('TOLD'), `${told.join(' / ')} | ${at('TOLD')}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`wildermon gear — ${ok.length} of ${ok.length}`);
