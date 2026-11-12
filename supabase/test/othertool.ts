/**
 * Somebody else at mining is drawn with their own pickaxe, in its metal.
 *
 * Asked for: "other players are shown mining with their own pickaxe's metal" (and its enchantment), not iron. A
 * sculpted figure at mining holds the Runestone Pickaxe in the metal of the pose's tool (`FigurePose.tool`); your own
 * browser takes it from your pack (`Inventory.tool`), and somebody else's comes from the island: `player.act_tool`,
 * which the island sets from the pack whenever a job starts or starts its next go (`private.act_tool_of`), says to
 * the one at work in `rpc_act`'s answer (`tool`) and `rpc_settle`'s (`act_tool`) for the body broadcast, and every
 * browser reads with the roster (`PEOPLE_COLUMNS`). This puts one body mining with a copper pickaxe and then an
 * enchanted gold one, and asks:
 *
 *   * the island: the row as another body on the island reads it, signed in as them (`player`'s policy), the answer
 *     to the one at work, and the row with no job;
 *   * the browser: the miner's own pickaxe out of the same pack (`Inventory.tool`, the piece `toolPiece` draws) and
 *     the watcher's piece out of the row (`toolFrom`, as `play.ts` reads the roster), the same metal and the same
 *     enchantment; and the figure drawn at mining with each in the metal's colour (`lowScene`, `metalShades`).
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { ACTION_BY_ID } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { DEFAULT_LOOK } from '../../src/game/look';
import { materialOf } from '../../src/game/materials';
import { toolFrom } from '../../src/game/worn';
import type { FigurePose, GearPiece } from '../../src/render/figure';
import { metalShades } from '../../src/render/figure';
import { lowScene } from '../../src/sculpt/lowpoly';
import { psql, ok, bad, check } from './harness';

const MINE = ACTION_BY_ID.get('mine');
if (!MINE?.tool) throw new Error('mining names no tool any more');
const PICK = MINE.tool;
/** The face at 3,3, worked from its 4,4 corner. */
const FACE = `jsonb_build_object('kind', 'tile', 'x', 3, 'y', 3, 'cx', 4, 'cy', 4)`;
/** An enchantment a pickaxe takes: Lodestone, as `enchant.ts` writes one into an item. */
const LODESTONE = { id: 'lodestone', ql: 40 };

/*
 * The island's side, in one transaction rolled back: the suite's first two bodies on Stonehaven, the first on flat
 * dirt beside a rock face with a copper pickaxe and nothing else, the second at the far side of the yard. Each line of
 * `said` is one reading: `ANSWER` the act's answer to the miner, `SEEN` the miner's row read as the watcher, `BEAT`
 * the settle's answer to the miner, `IDLE` the row with the job stopped.
 */
const out = psql(`
begin;
create temp table said (k text, v text);
grant all on said to authenticated;

do $$
declare w uuid; u uuid; o uuid; tx int; ty int; j jsonb; v_pick bigint;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  select p.uid into o from player p where p.world_id = w and p.uid <> u order by p.uid limit 1;
  if o is null then raise exception 'Stonehaven has one body on it'; end if;
  for tx in 0..15 loop for ty in 0..15 loop
    perform land_set_height(w, tx, ty, 40); perform land_set_dirt(w, tx, ty, 20);
    perform land_set_tile(w, tx, ty, tile_id('Dirt')); perform land_set_data(w, tx, ty, 0);
  end loop; end loop;
  for tx in 2..4 loop for ty in 2..4 loop
    perform land_set_tile(w, tx, ty, 4); perform land_set_rock(w, tx, ty, 0);
  end loop; end loop;
  for tx in 2..5 loop for ty in 2..5 loop perform land_set_dirt(w, tx, ty, 0); end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from caller where uid = u;
  update placed set driver = null where world_id = w and driver in (u, o);
  update placed set puller = null where world_id = w and puller in (u, o);
  update player set x = 3.5, y = 3.5, act = null, act_target = null, act_started = null, act_ends = null,
         act_left = null, act_goes = null, act_queue = '[]', away = false, body_at = now(), swim_at = now(),
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  update player set x = 12.5, y = 12.5, away = false where world_id = w and uid = o;
  insert into skill (world_id, uid, id, value) values (w, u, 'mining', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_pick := give(w, u, '${PICK}', 1, 50);
  update item set extra = 'copper' where id = v_pick;

  /* ---- copper: the job started, as the miner is told it and as the watcher reads it ---- */
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  j := rpc_act(w, 'mine', ${FACE});
  insert into said values ('COPPER_ANSWER', coalesce(j->>'why', '') || coalesce((j->'tool')::text, 'none'));
  perform set_config('othertool.w', w::text, true);
  perform set_config('othertool.u', u::text, true);
  perform set_config('othertool.o', o::text, true);
end $$;

/* The watcher reads the miner's row as a browser does, signed in as themselves: the roster's columns. */
select set_config('request.jwt.claims', json_build_object('sub', current_setting('othertool.o'))::text, true) \\g /dev/null
set local role authenticated;
insert into said select 'COPPER_SEEN', coalesce(act, '-') || ' ' || coalesce(act_tool::text, 'none')
  from player where world_id = current_setting('othertool.w')::uuid and uid = current_setting('othertool.u')::uuid;
reset role;

do $$
declare w uuid := current_setting('othertool.w')::uuid; u uuid := current_setting('othertool.u')::uuid; j jsonb; v_pick bigint;
begin
  /* ---- a go done and the next begun: the settle's answer says it with the job ---- */
  update player set act_started = now() - interval '2 seconds', act_ends = now() - interval '1 second', act_left = 3
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  j := rpc_settle(p_world => w);
  insert into said values ('COPPER_BEAT', coalesce(j->>'act', '-') || ' ' || coalesce((j->'act_tool')::text, 'none'));

  /* ---- stopped: no job, no tool ---- */
  perform rpc_cancel(w);
  insert into said select 'IDLE', coalesce(act, '-') || ' ' || coalesce(act_tool::text, 'none')
    from player where world_id = w and uid = u;

  /* ---- gold, enchanted: the copper one gone, the job started again ---- */
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = '${PICK}';
  v_pick := give(w, u, '${PICK}', 1, 50);
  update item set extra = 'gold', enchant = '${JSON.stringify(LODESTONE)}'::jsonb where id = v_pick;
  j := rpc_act(w, 'mine', ${FACE});
  insert into said values ('GOLD_ANSWER', coalesce(j->>'why', '') || coalesce((j->'tool')::text, 'none'));
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('othertool.o'))::text, true) \\g /dev/null
set local role authenticated;
insert into said select 'GOLD_SEEN', coalesce(act, '-') || ' ' || coalesce(act_tool::text, 'none')
  from player where world_id = current_setting('othertool.w')::uuid and uid = current_setting('othertool.u')::uuid;
reset role;

select k || '=' || v from said;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const get = (k: string): string => said.get(k) ?? '(nothing)';
/** The row's `act_tool` out of a `SEEN` or `BEAT` line, as JSON. */
const toolOf = (line: string): unknown => {
  const at = line.indexOf(' ');
  try {
    return JSON.parse(line.slice(at + 1));
  } catch {
    return null;
  }
};

/* ---- the browser's side: the miner's own pack, and the watcher's piece out of the row ---- */
const own = (metal: string, enchant?: object): GearPiece | undefined => {
  const game = Game.create(4242);
  game.inventory.add(PICK, { ql: 50, extra: metal, ...(enchant ? { enchant } : {}) } as Parameters<typeof game.inventory.add>[1]);
  const it = game.inventory.tool(PICK) as { id: string; extra?: string; enchant?: unknown } | undefined;
  if (!it) return undefined;
  // The piece your own figure is drawn holding (`toolPiece` in renderer.ts).
  const material = materialOf(it.extra)?.id;
  return { id: it.id, ...(material ? { material } : {}), ...(it.enchant ? { enchanted: true } : {}) };
};
const seen = (line: string, act = 'mine'): GearPiece | undefined => toolFrom(toolOf(line), ACTION_BY_ID.get(act)?.tool);
const same = (a: GearPiece | undefined, b: GearPiece | undefined): boolean =>
  !!a && !!b && a.id === b.id && a.material === b.material && !!a.enchanted === !!b.enchanted;

const copperSeen = seen(get('COPPER_SEEN'));
check('copper: the job starts, and the miner is told its pickaxe',
  get('COPPER_ANSWER') === JSON.stringify([PICK, 0, 'copper', false]).replace(/,/g, ', '), get('COPPER_ANSWER'));
check('copper: the watcher reads the miner at mining with a copper pickaxe',
  get('COPPER_SEEN').startsWith('mine ') && copperSeen?.material === 'copper' && !copperSeen.enchanted,
  get('COPPER_SEEN'));
check('copper: the watcher\'s piece is the miner\'s own, metal and enchantment',
  same(copperSeen, own('copper')), `${JSON.stringify(copperSeen)} / ${JSON.stringify(own('copper'))}`);
check('copper: the next go says it again in the beat\'s answer',
  get('COPPER_BEAT').startsWith('mine ') && same(seen(get('COPPER_BEAT')), copperSeen), get('COPPER_BEAT'));
check('stopped: no job and no tool', get('IDLE') === '- none', get('IDLE'));

const goldSeen = seen(get('GOLD_SEEN'));
check('gold: the miner is told the enchanted gold pickaxe',
  get('GOLD_ANSWER') === JSON.stringify([PICK, 0, 'gold', true]).replace(/,/g, ', '), get('GOLD_ANSWER'));
check('gold: the watcher reads gold, enchanted',
  get('GOLD_SEEN').startsWith('mine ') && goldSeen?.material === 'gold' && goldSeen.enchanted === true, get('GOLD_SEEN'));
check('gold: the watcher\'s piece is the miner\'s own, metal and enchantment',
  same(goldSeen, own('gold', LODESTONE)), `${JSON.stringify(goldSeen)} / ${JSON.stringify(own('gold', LODESTONE))}`);

/* ---- what a browser will not take ---- */
check('a tool that is not the job\'s is not drawn', toolFrom(toolOf(get('COPPER_SEEN')), 'hatchet') === undefined);
check('a thing nobody makes is not drawn', toolFrom(['no such thing', 0, 'gold', true]) === undefined);
check('an unknown material is drawn as no metal (iron)', toolFrom([PICK, 0, 'nonesuch', false])?.material === undefined);

/* ---- the figure drawn at mining: the pickaxe's head in the metal's colour, iron without one ---- */
const pose = (tool?: GearPiece): FigurePose => ({
  id: 'o1', phase: 0, moving: false, facing: 2, swimming: false, working: true, job: 'mine',
  act: { t: 0.3, length: 3 }, look: { ...DEFAULT_LOOK, gender: 'man' }, ...(tool ? { tool } : {}),
} as FigurePose);
/** A colour as the sculpted figure's materials write one. */
const hex = (c: readonly number[]): string => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const colours = (p: FigurePose): Set<string> => new Set(lowScene(p).materials.map((m) => (m as { colour?: string }).colour ?? ''));
/** The head's bevel drawn in the metal's lit edge (`metalTint`). */
const has = (p: FigurePose, metal: string): boolean => colours(p).has(hex(metalShades(metal).lit));
check('the watcher draws the miner\'s pickaxe head copper', has(pose(copperSeen), 'copper') && !has(pose(copperSeen), 'iron'));
check('the watcher draws the miner\'s pickaxe head gold', has(pose(goldSeen), 'gold') && !has(pose(goldSeen), 'copper'));
check('and iron with no word of it', has(pose(), 'iron'));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`somebody else at mining is drawn with their own pickaxe, its metal and its enchantment, the same on both sides — ${ok.length} of ${ok.length}`);
