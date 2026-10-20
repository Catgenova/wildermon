/**
 * A weapon reaches as far as its family.
 *
 * Both sides off the same names (`WEAPON_REACH`, `FIST_REACH`, `THROWN_PAST`
 * in `src/game/gear.ts`, and `weapon_reach`, `fist_reach`, `thrown_past` and
 * `melee_reach` on the island). What this asks:
 *
 *   * every weapon reaches the same on both sides, its family's reach, a
 *     thrown one its range and `THROWN_PAST` past it, a bow and bare hands
 *     `FIST_REACH`;
 *   * a polearm is a tile past a sword, and a knife short of one;
 *   * a goblin a sword cannot reach is refused in the same words on both
 *     sides, and a spear strikes it from where the sword stood;
 *   * the weapon's card and the help say the reach.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { FIST_REACH, meleeReach, reachOf, reachSays, THROWN_PAST, WEAPON_REACH } from '../../src/game/fight';
import { Game } from '../../src/game/game';
import { WEAPON_BY_ID, WEAPONS, type HeldKind } from '../../src/game/gear';
import { itemDef } from '../../src/game/items';
import { compareLines } from '../../src/ui/compare';
import { TileType } from '../../src/world/tiles';

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
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));

const SWORD = WEAPON_BY_ID.get('sword')!;
const SPEAR = WEAPON_BY_ID.get('spear')!;
/** Where the goblin stands: past a sword's reach and inside a spear's. */
const GAP = (reachOf(SWORD) + reachOf(SPEAR)) / 2;
const OUT_OF_REACH = 'Out of reach.';

/* ---- The island's half ------------------------------------------------- */

const out = psql(`
begin;
create temp table said (k text, v text);
do $b$
declare w record; v_px double precision; v_py double precision; g int; i int; tx int; ty int; wd weapon_def;
        v_id bigint; v_sword bigint; v_spear bigint; v_h0 double precision;
begin
  perform setseed(0.27);
  select p.world_id, p.uid, wo.size, wo.spawn_x, wo.spawn_y into w
    from player p join world wo on wo.id = p.world_id
   where exists (select 1 from land_tile t where t.world_id = wo.id)
   order by wo.size desc, p.world_id, p.uid limit 1;
  v_px := case when w.spawn_x + peace_reach() + 10 < w.size then w.spawn_x + peace_reach() + 6.5
               else w.spawn_x - peace_reach() - 9.5 end;
  v_py := w.spawn_y + 0.5;
  for tx in greatest(0, floor(v_px)::int - 6)..least(w.size - 1, floor(v_px)::int + 10) loop
    for ty in greatest(0, floor(v_py)::int - 6)..least(w.size - 1, floor(v_py)::int + 6) loop
      perform land_set_height(w.world_id, tx, ty, 4); perform land_set_dirt(w.world_id, tx, ty, 5);
      perform land_set_tile(w.world_id, tx, ty, tile_id('Grass'));
    end loop;
  end loop;
  update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null,
         act_queue = '[]'::jsonb, equipped = '{}'::jsonb, fight_stance = 'balanced', fight_back = false,
         moved_at = now() - interval '1 minute', x = v_px, y = v_py, level = 0, wounds = '[]'::jsonb, away = false,
         blessings = '{}'::jsonb, craft_class = null, combat_class = null, class_mul = null, class_level = 0,
         stats = (coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 0)) - 'hurtAt' - 'hurtBy'
    where world_id = w.world_id and uid = w.uid;
  delete from player_node where world_id = w.world_id and uid = w.uid;
  update creature set hunting = null, brawl = null where world_id = w.world_id and hunting = w.uid;
  delete from creature where world_id = w.world_id and to_x between v_px - 20 and v_px + 20 and to_y between v_py - 20 and v_py + 20;

  insert into said values ('NUMS', fist_reach() || '|' || thrown_past());
  insert into said values ('MR:none', melee_reach(w.world_id, w.uid)::text);
  -- Each weapon's reach, and what a swing reaches with it in the hand.
  for wd in select * from weapon_def loop
    insert into said values ('WR:' || wd.id, coalesce(weapon_reach(wd.id)::text, 'none'));
    v_id := give(w.world_id, w.uid, wd.id, 1, 40);
    update player set equipped = jsonb_build_object('weapon', v_id) where world_id = w.world_id and uid = w.uid;
    insert into said values ('MR:' || wd.id, melee_reach(w.world_id, w.uid)::text);
  end loop;

  -- A goblin standing still ${GAP} tiles off: past a sword, inside a spear.
  g := creature_spawn(w.world_id, 'goblin', v_px + ${GAP}, v_py, 'wild', now() - interval '2 hours');
  update creature set traits = '{}', health = 1e6, hunting = null, from_x = v_px + ${GAP}, from_y = v_py, to_x = v_px + ${GAP}, to_y = v_py,
      leg_at = now(), leg_ends = now(), until = now() + interval '1 hour', settled_at = now()
    where world_id = w.world_id and id = g;
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'polearms', 100), (w.world_id, w.uid, 'swords', 100), (w.world_id, w.uid, 'fighting', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_sword := give(w.world_id, w.uid, 'sword', 1, 40);
  v_spear := give(w.world_id, w.uid, 'spear', 1, 40);
  update player set equipped = jsonb_build_object('weapon', v_sword) where world_id = w.world_id and uid = w.uid;
  insert into said values ('REFUSE:sword', coalesce(fight_refusal(w.world_id, w.uid, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', g)), 'none'));
  update player set equipped = jsonb_build_object('weapon', v_spear) where world_id = w.world_id and uid = w.uid;
  insert into said values ('REFUSE:spear', coalesce(fight_refusal(w.world_id, w.uid, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', g)), 'none'));
  insert into said select 'DIST', sqrt((creature_x(c) - v_px) ^ 2 + (creature_y(c) - v_py) ^ 2)::text from creature c where c.world_id = w.world_id and c.id = g;
  select health into v_h0 from creature where world_id = w.world_id and id = g;
  delete from event where uid = w.uid;
  i := 0;
  while i < 10 and not exists (select 1 from event where uid = w.uid and text like 'Hit%: goblin%') loop
    i := i + 1;
    perform perform_fight(w.world_id, w.uid, 'attack_creature', jsonb_build_object('kind', 'creature', 'id', g));
  end loop;
  insert into said select 'STRUCK', (v_h0 - health)::text || '|' || i from creature where world_id = w.world_id and id = g;
  delete from creature where world_id = w.world_id and id = g;
end $b$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';

/* ---- The table ------------------------------------------------------------------- */

check(`a polearm reaches a tile past a sword: ${WEAPON_REACH.polearms} and ${WEAPON_REACH.swords}`, near(WEAPON_REACH.polearms - WEAPON_REACH.swords, 1));
check(`a knife reaches short of a sword, as far as bare hands: ${WEAPON_REACH.knives}`,
  WEAPON_REACH.knives < WEAPON_REACH.swords && WEAPON_REACH.knives === FIST_REACH);
check('every weapon swung from the hand has a family with a reach',
  WEAPONS.filter((w) => !w.ammo && !w.thrown).every((w) => WEAPON_REACH[w.kind as HeldKind] !== undefined));
check('a thrown weapon reaches its range and past it',
  WEAPONS.filter((w) => w.thrown).every((w) => near(reachOf(w), (w.range ?? 0) + THROWN_PAST)) && WEAPONS.some((w) => w.thrown));

/* ---- Both sides ------------------------------------------------------------------ */

check('bare hands and a thrown weapon\'s past are the same on both sides',
  island('NUMS').split('|').map(Number).every((v, i) => near(v, [FIST_REACH, THROWN_PAST][i])), island('NUMS'));
{
  const off = WEAPONS.filter((w) => {
    const want = w.ammo ? 'none' : String(reachOf(w));
    const got = island(`WR:${w.id}`);
    return got === 'MISSING' || (want === 'none' ? got !== 'none' : !near(Number(got), Number(want)));
  });
  check('every weapon has the same reach on both sides, and a bow none of its own', off.length === 0,
    off.map((w) => `${w.id} ${island(`WR:${w.id}`)}`).join(', ') || WEAPONS.map((w) => `${w.id} ${island(`WR:${w.id}`)}`).join(', '));
}
{
  const g0 = Game.create(4242);
  const swing = (id: string | null): number => {
    if (id) g0.equip('weapon', g0.inventory.add(id, { ql: 40 }).uid);
    else g0.equip('weapon', null);
    return meleeReach(g0);
  };
  const off: string[] = [];
  for (const w of WEAPONS) {
    const mine = swing(w.id);
    const want = w.ammo ? FIST_REACH : reachOf(w);
    if (!near(mine, want) || !near(Number(island(`MR:${w.id}`)), want)) off.push(`${w.id} browser ${mine} island ${island(`MR:${w.id}`)} want ${want}`);
  }
  const bare = swing(null);
  check(`a swing reaches the same with each weapon in the hand on both sides: ${[...new Set(WEAPONS.filter((w) => !w.ammo).map((w) => `${w.kind} ${reachOf(w)}`))].join(', ')}, bows and bare hands ${FIST_REACH}`,
    off.length === 0 && near(bare, FIST_REACH) && near(Number(island('MR:none')), FIST_REACH), off.join('; ') || `bare ${bare} / ${island('MR:none')}`);
}

/* ---- A spear where a sword is refused --------------------------------------- */

check(`on the island, a goblin ${GAP} tiles off is out of the sword's reach, and in the spear's`,
  near(Number(island('DIST')), GAP, 1e-3) && island('REFUSE:sword') === OUT_OF_REACH && island('REFUSE:spear') === 'none',
  `${island('DIST')}: ${island('REFUSE:sword')} / ${island('REFUSE:spear')}`);
{
  const [took, goes] = island('STRUCK').split('|').map(Number);
  check('and the spear strikes it from there', took > 0 && goes <= 10, island('STRUCK'));
}
{
  const g = Game.create(4242);
  const w = g.world;
  for (let y = 14; y <= 28; y++) for (let x = 14; x <= 30; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); w.setTile(x, y, TileType.Grass, 0); }
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.player.stats.stamina = 1;
  g.settings.fightBack = false;
  const gob = g.creatures.spawn('goblin', 20.5 + GAP, 20.5, 'wild', () => 0.5, 0);
  gob.traits = [];
  gob.health = 5000;
  const attack = ACTION_BY_ID.get('attack_creature')!;
  const target = { kind: 'creature' as const, id: gob.id };
  g.equip('weapon', g.inventory.add('sword', { ql: 40 }).uid);
  const sword = attack.check?.(target, g) ?? null;
  g.equip('weapon', g.inventory.add('spear', { ql: 40 }).uid);
  const spear = attack.check?.(target, g) ?? null;
  g.rand = () => 0;
  attack.perform(target, g);
  check(`in the browser, the sword is refused "${OUT_OF_REACH}" and the spear strikes from the same spot`,
    sword === OUT_OF_REACH && spear === null && gob.health < 5000, `${sword} / ${spear} / ${gob.health}`);
  check('the same words on both sides', sword === island('REFUSE:sword'), `"${sword}" / "${island('REFUSE:sword')}"`);

  const card = (it: string): string[] => (compareLines(g, g.inventory.add(it, { ql: 40 })) ?? []).map((l) => (typeof l === 'string' ? l : l.text));
  check(`the spear's card says it reaches ${reachOf(SPEAR)} tiles, and the sword's ${reachOf(SWORD)}`,
    card('spear').includes(`Reaches ${reachOf(SPEAR)} tiles`) && card('sword').includes(`Reaches ${reachOf(SWORD)} tiles`),
    `${card('spear').join(' / ')}`);
}
{
  const says = reachSays();
  check('the help says every family\'s reach and every thrown weapon\'s, off the table',
    (Object.keys(WEAPON_REACH) as HeldKind[]).every((k) => says.includes(k) && says.includes(`${WEAPON_REACH[k]} tiles`))
      && WEAPONS.filter((w) => w.thrown).every((w) => says.includes(`${itemDef(w.id).name.toLowerCase()} ${reachOf(w)}`)), says);
  const spear = itemDef('spear').description ?? '';
  check('the spear says how far it reaches', spear.includes(`${reachOf(SPEAR)} tiles`) && !spear.includes('{'), spear);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a weapon reaches as far as its family — ${ok.length} of ${ok.length}`);
