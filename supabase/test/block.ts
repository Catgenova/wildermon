/**
 * A shield blocks.
 *
 * Both sides off the same names (`src/game/fight.ts` and
 * `shields_block_and_weapons_reach.sql`). What this asks:
 *
 *   * the numbers behind a block are the same numbers, and each shield's
 *     chance worked from them is the same chance, at the ends of quality and
 *     skill and between;
 *   * a blocked blow takes nothing off you, wears the shield `SHIELD_WEAR` for
 *     every whole health of the blow, and says "You block the blow with your
 *     shield." in the same words on both sides;
 *   * the dodge is rolled first: a dodged blow never reaches the shield, so
 *     blows are dodged as often as the dodge says and blocked as often as the
 *     shield says of what is left;
 *   * the shield's card and its description say its chance in exact numbers.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import {
  BLOCK_MOST, BLOCK_PER_SKILL, BLOCK_QL_FROM, BLOCK_QL_SPAN, blockChance, BLOCKED_SAID, CROWD_BLOCK, dodgeChance, SHIELD_WEAR,
} from '../../src/game/fight';
import { Game } from '../../src/game/game';
import { SHIELDS } from '../../src/game/gear';
import { itemDef } from '../../src/game/items';
import { finePercent, percent } from '../../src/game/words';
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
const none = (_k: string, d: number): number => d;

/** The quality and the shields skill each shield's chance is asked at, on both sides. */
const AT: Array<[number, number]> = [[1, 0], [40, 50], [100, 100]];
/** The blow a forced block is struck with, as a share of health. */
const RAW = 0.1;
/** Blows struck to see which is rolled first, and the share of health each one is. */
const BLOWS = 400;
const TINY = 0.001;

/* ---- The island's half ------------------------------------------------- */

const out = psql(`
begin;
create temp table said (k text, v text);
do $b$
declare w record; v_px double precision; v_py double precision; g int; i int; tx int; ty int; sh shield_def;
        v_wood bigint; v_metal bigint; v_h0 double precision; v_h1 double precision; v_d0 double precision; v_d1 double precision;
        v_tries int; v_said text;
begin
  perform setseed(0.31);
  -- Off the beach of the biggest island there is, where things may come for you (\`at_peace\`).
  select p.world_id, p.uid, wd.size, wd.spawn_x, wd.spawn_y into w
    from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile t where t.world_id = wd.id)
   order by wd.size desc, p.world_id, p.uid limit 1;
  v_px := case when w.spawn_x + peace_reach() + 6 < w.size then w.spawn_x + peace_reach() + 6.5
               else w.spawn_x - peace_reach() - 5.5 end;
  v_py := w.spawn_y + 0.5;
  -- Its own ground: grass at one height all round. The whole test is rolled back.
  for tx in greatest(0, floor(v_px)::int - 6)..least(w.size - 1, floor(v_px)::int + 6) loop
    for ty in greatest(0, floor(v_py)::int - 6)..least(w.size - 1, floor(v_py)::int + 6) loop
      perform land_set_height(w.world_id, tx, ty, 4); perform land_set_dirt(w.world_id, tx, ty, 5);
      perform land_set_tile(w.world_id, tx, ty, tile_id('Grass'));
    end loop;
  end loop;
  -- Nobody near to take a blow on their own shield, and nothing on this one from a trade, a faith or a ward.
  update player set x = v_px - 60 where world_id = w.world_id and uid <> w.uid and (x - v_px) ^ 2 + (y - v_py) ^ 2 < 60 ^ 2;
  update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null,
         act_queue = '[]'::jsonb, equipped = '{}'::jsonb, fight_stance = 'balanced', fight_back = false,
         moved_at = now() - interval '1 minute', x = v_px, y = v_py, level = 0, wounds = '[]'::jsonb, away = false,
         blessings = '{}'::jsonb, craft_class = null, combat_class = null, class_mul = null, class_level = 0,
         stats = (coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 0)) - 'hurtAt' - 'hurtBy'
    where world_id = w.world_id and uid = w.uid;
  delete from player_node where world_id = w.world_id and uid = w.uid;
  update creature set hunting = null, brawl = null where world_id = w.world_id and hunting = w.uid;
  delete from creature where world_id = w.world_id and to_x between v_px - 20 and v_px + 20 and to_y between v_py - 20 and v_py + 20;
  delete from faith_zone where world_id = w.world_id;

  -- The numbers.
  insert into said values ('NUMS', block_ql_from() || '|' || block_ql_span() || '|' || block_per_skill() || '|' || shield_wear()
    || '|' || block_most() || '|' || crowd_block());
  insert into said select 'SHIELD:' || id, block::text from shield_def;

  -- Each shield's chance at each quality and skill.
  ${AT.map(([ql, skill]) => `
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'shields', ${skill})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  for sh in select * from shield_def loop
    insert into said values ('CHANCE:' || sh.id || ':${ql}:${skill}', shield_block(w.world_id, w.uid, sh, ${ql})::text);
  end loop;`).join('')}

  -- A forced block: no dodge (body control where it starts), a wooden shield, and blows until one is blocked.
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'body_control', dodge_from()), (w.world_id, w.uid, 'shields', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_wood := give(w.world_id, w.uid, 'wooden_shield', 1, 40);
  update player set equipped = jsonb_build_object('offhand', v_wood) where world_id = w.world_id and uid = w.uid;
  delete from event where uid = w.uid;
  v_tries := 0;
  loop
    v_tries := v_tries + 1;
    update player set wounds = '[]'::jsonb, stats = jsonb_set(stats, '{health}', '1') where world_id = w.world_id and uid = w.uid;
    select (stats->>'health')::double precision into v_h0 from player where world_id = w.world_id and uid = w.uid;
    select dmg into v_d0 from item where id = v_wood;
    perform hurt_player(w.world_id, w.uid, ${RAW}, 'Something is on you', 'cut');
    select (stats->>'health')::double precision into v_h1 from player where world_id = w.world_id and uid = w.uid;
    select dmg into v_d1 from item where id = v_wood;
    select text into v_said from event where uid = w.uid order by n desc limit 1;
    exit when v_said = '${BLOCKED_SAID}' or v_tries >= 60;
  end loop;
  insert into said values ('BLOCK', (v_h0 - v_h1) || '|' || (v_d1 - v_d0) || '|' || v_tries || '|' || coalesce(v_said, 'unsaid'));

  -- The dodge first: body control 100 and a metal shield at QL 100 and shields 100, and ${BLOWS} blows from a goblin.
  v_metal := give(w.world_id, w.uid, 'metal_shield', 1, 100);
  update player set equipped = jsonb_build_object('offhand', v_metal) where world_id = w.world_id and uid = w.uid;
  g := creature_spawn(w.world_id, 'goblin', v_px + 0.8, v_py, 'wild', now() - interval '2 hours');
  update creature set traits = '{}' where world_id = w.world_id and id = g;
  select * into sh from shield_def where id = 'metal_shield';
  insert into skill (world_id, uid, id, value) values (w.world_id, w.uid, 'body_control', 100), (w.world_id, w.uid, 'shields', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into said values ('ODDS', dodge_chance(skill_of(w.world_id, w.uid, 'body_control'), worn_kg(w.world_id, w.uid))
    || '|' || shield_block(w.world_id, w.uid, sh, 100));
  delete from event where uid = w.uid;
  for i in 1..${BLOWS} loop
    update skill set value = 100 where world_id = w.world_id and uid = w.uid and id in ('body_control', 'shields');
    update player set wounds = '[]'::jsonb, stats = jsonb_set(stats, '{health}', '1') where world_id = w.world_id and uid = w.uid;
    update creature set hunting = null, brawl = null where world_id = w.world_id and id <> g and hunting = w.uid;
    perform mark_attacker(w.world_id, w.uid, g);
    perform hurt_player(w.world_id, w.uid, ${TINY}, 'The goblin is on you', 'cut');
  end loop;
  insert into said values ('FIRST', (select count(*) from event where uid = w.uid and text = 'Dodged: goblin.')
    || '|' || (select count(*) from event where uid = w.uid and text = '${BLOCKED_SAID}'));
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

/* ---- Both sides off the same numbers ----------------------------------------- */

{
  const nums = [BLOCK_QL_FROM, BLOCK_QL_SPAN, BLOCK_PER_SKILL, SHIELD_WEAR, BLOCK_MOST, CROWD_BLOCK];
  check('the numbers behind a block are the same on both sides', island('NUMS').split('|').map(Number).every((v, i) => near(v, nums[i])),
    `island ${island('NUMS')}, browser ${nums.join('|')}`);
  check('the same shields, each with the same share of its own',
    Object.values(SHIELDS).every((sh) => near(Number(island(`SHIELD:${sh.id}`)), sh.block, 1e-6))
      && [...said.keys()].filter((k) => k.startsWith('SHIELD:')).length === Object.keys(SHIELDS).length,
    Object.values(SHIELDS).map((sh) => `${sh.id} ${island(`SHIELD:${sh.id}`)}`).join(', '));
  check('the heavier shield blocks more', (() => {
    const byKg = Object.values(SHIELDS).sort((a, b) => itemDef(a.id).weight - itemDef(b.id).weight);
    return byKg.every((sh, i) => i === 0 || sh.block > byKg[i - 1].block);
  })());
  for (const sh of Object.values(SHIELDS)) {
    const want = AT.map(([ql, skill]) => blockChance(sh.block, ql, skill, none));
    const got = AT.map(([ql, skill]) => Number(island(`CHANCE:${sh.id}:${ql}:${skill}`)));
    check(`a ${itemDef(sh.id).name.toLowerCase()} blocks ${AT.map(([ql, skill], i) => `${finePercent(want[i])} at QL ${ql} and shields ${skill}`).join(', ')}, on both sides`,
      got.every((v, i) => near(v, want[i], 1e-5)), `island ${got.join('|')}`);
  }
}

/* ---- The island ---------------------------------------------------------------- */

{
  const [lost, worn, tries, text] = island('BLOCK').split('|');
  check(`on the island, a blocked blow takes nothing, wears the shield ${SHIELD_WEAR} × the blow, and says "${BLOCKED_SAID}"`,
    Number(lost) === 0 && near(Number(worn), RAW * SHIELD_WEAR, 1e-4) && text === BLOCKED_SAID, `${island('BLOCK')} (${tries} blows)`);
  const [dodge, block] = island('ODDS').split('|').map(Number);
  check('the island has the same dodge and block for body control 100, and a metal shield at QL 100 and shields 100',
    near(dodge, dodgeChance(100, 0)) && near(block, blockChance(SHIELDS.metal_shield.block, 100, 100, none), 1e-5), island('ODDS'));
  const [dodged, blocked] = island('FIRST').split('|').map(Number);
  const wantDodged = BLOWS * dodge;
  const wantBlocked = BLOWS * (1 - dodge) * block;
  // Were the shield rolled first, a dodge would be had only of what it let through, and a block of every blow.
  check(`the dodge is rolled first: about ${Math.round(wantDodged)} of ${BLOWS} dodged and ${Math.round(wantBlocked)} blocked, `
    + `not ${Math.round(BLOWS * (1 - block) * dodge)} and ${Math.round(BLOWS * block)}`,
    Math.abs(dodged - wantDodged) <= 20 && Math.abs(blocked - wantBlocked) <= 30
      && Math.abs(dodged - wantDodged) < Math.abs(dodged - BLOWS * (1 - block) * dodge)
      && Math.abs(blocked - wantBlocked) < Math.abs(blocked - BLOWS * block), island('FIRST'));
}

/* ---- The browser ---------------------------------------------------------------- */

const field = (): Game => {
  const g = Game.create(4242);
  const w = g.world;
  for (let y = 4; y <= 40; y++) for (let x = 4; x <= 40; x++) { w.setHeight(x, y, 4); w.setDirt(x, y, 3); w.setTile(x, y, TileType.Grass, 0); }
  g.player.x = 20.5;
  g.player.y = 20.5;
  g.player.stats.stamina = 1;
  g.player.stats.health = 1;
  g.settings.fightBack = false;
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  return g;
};
const lines = (g: Game): string[] => g.log.map((l) => l.text);
const lastLine = (g: Game): string => g.log[g.log.length - 1]?.text ?? '';

{
  const g = field();
  g.skills.values.set('body_control', 0);
  g.skills.values.set('shields', 50);
  const shield = g.inventory.add('wooden_shield', { ql: 40 });
  g.equip('offhand', shield.uid);
  g.rand = () => 0;
  const before = shield.dmg;
  g.hurtPlayer(RAW, 'Something is on you', 'cut');
  check(`in the browser, a forced block takes nothing, wears the shield ${SHIELD_WEAR} × the blow, and says "${BLOCKED_SAID}"`,
    g.player.stats.health === 1 && near(shield.dmg - before, RAW * SHIELD_WEAR) && lastLine(g) === BLOCKED_SAID,
    `health ${g.player.stats.health}, wear ${shield.dmg - before}, "${lastLine(g)}"`);
  check('the same words on both sides', lastLine(g) === island('BLOCK').split('|')[3], `"${lastLine(g)}" / "${island('BLOCK').split('|')[3]}"`);
}
{
  const g = field();
  g.skills.values.set('body_control', 100);
  const shield = g.inventory.add('metal_shield', { ql: 100 });
  g.equip('offhand', shield.uid);
  const gob = g.creatures.spawn('goblin', 21.2, 20.5, 'wild', () => 0.5, 0);
  gob.traits = [];
  g.player.attackedBy = gob.id;
  // Every roll under both chances: the dodge has it, and the shield is never asked.
  g.rand = () => 0;
  g.hurtPlayer(TINY, 'The goblin is on you', 'cut');
  const dodgedFirst = lastLine(g) === 'Dodged: goblin.' && shield.dmg === 0 && !lines(g).includes(BLOCKED_SAID);
  // The dodge's roll over its chance, and every roll after it under: the shield's has it.
  let first = true;
  g.rand = () => (first ? ((first = false), 0.99) : 0);
  g.hurtPlayer(TINY, 'The goblin is on you', 'cut');
  check('in the browser, the dodge is rolled first, and the shield only for a blow not dodged',
    dodgedFirst && lastLine(g) === BLOCKED_SAID && shield.dmg > 0 && g.player.stats.health === 1, lines(g).slice(-2).join(' / '));
}
{
  const g = field();
  g.skills.values.set('shields', 50);
  for (const sh of Object.values(SHIELDS)) {
    const it = g.inventory.add(sh.id, { ql: 40 });
    const card = (compareLines(g, it) ?? []).map((l) => (typeof l === 'string' ? l : l.text));
    const chance = blockChance(sh.block, 40, 50, none);
    check(`the ${itemDef(sh.id).name.toLowerCase()}'s card says it blocks ${finePercent(chance)} at QL 40 and shields 50, and how`,
      card.includes(`Blocks ${finePercent(chance)} of blows`) && card.some((l) => l.startsWith(`Block: ${percent(sh.block)} × `) && l.includes('(shields 50)')),
      card.join(' / '));
    const text = itemDef(sh.id).description ?? '';
    check(`and its description the chance at QL 1 and QL 100`,
      text.includes(`${percent(blockChance(sh.block, 1, 0, none))} of blows at QL 1`) && text.includes(`${percent(blockChance(sh.block, 100, 0, none))} at QL 100`)
        && !text.includes('{'), text);
  }
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a shield blocks — ${ok.length} of ${ok.length}`);
