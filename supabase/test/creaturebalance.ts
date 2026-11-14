/**
 * Every creature's health ×3 and blow ×0.4.
 *
 * Asked for: "PvE combat is out of balance. Both sides do way too much damage and have too little health. Reduce
 * monster base damage figures by 60% but increase monster base hp by 3x", for every creature: wildermon and monsters,
 * wild and tamed. Measured on both sides:
 *
 *   * every kind's base health and attack are its row's ×`CREATURE_HEALTH_MUL` and ×`CREATURE_ATTACK_MUL`, the island's
 *     `species_def` agreeing with the browser for every kind, and no kind does no damage;
 *   * what a creature lands on you, and what it can take, off those figures (`attackOf`, `attack_of`, `maxHealth`,
 *     `max_health`);
 *   * the health a creature gets back a second is ×3 too, so hurt to whole takes as long (`REGEN_WILD`, `REGEN_KEPT`,
 *     `creature_settle`);
 *   * the bed a kind sleeps in, a treasure map's odds and QL off a monster and a carcass's yields are what they were;
 *   * the migration keeps every creature's health on the island the same share of its full health: wild, out, on a
 *     settlement and crated.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Game } from '../../src/game/game';
import {
  attackOf, BLOW_SHARE, CREATURE_ATTACK_MUL, CREATURE_HEALTH_MUL, DEN_HEALTH, denClass, HEAL_BELOW, maxHealth, MONSTERS, REGEN_AFTER,
  REGEN_KEPT, REGEN_WILD, SPAR_SLACK, SPECIES,
} from '../../src/game/creatures';
import { MAP_KILL_CAP, MAP_KILL_SCALE, mapChanceFromBeast, mapQlFromBeast } from '../../src/game/treasure';
import { check, finish, psql } from './harness';

const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));
/** What the island keeps a `real` as. */
const real = (x: number): number => Math.fround(x);

/* ---- The figures, on the rule ------------------------------------------------------------------------------------ */

check('every kind\'s health ×3 and blow ×0.4: the multipliers asked for', CREATURE_HEALTH_MUL === 3 && CREATURE_ATTACK_MUL === 0.4);
// The rows as they were written, before the multipliers: the four monsters and a few wildermon.
const WRITTEN: Record<string, [number, number]> = {
  goblin: [40, 14], orc: [95, 22], ogre: [170, 34], dragon: [700, 70], rabba: [20, 3], roxxen: [80, 11], spitta: [24, 6], sparra: [60, 2],
};
const wrong = Object.entries(WRITTEN).filter(([id, [h, a]]) => SPECIES[id].health !== h * 3 || !near(SPECIES[id].attack, a * 0.4));
check('goblin, orc, ogre, dragon and four wildermon: health and blow ×3 and ×0.4 their rows',
  wrong.length === 0, Object.entries(WRITTEN).map(([id]) => `${id} ${SPECIES[id].health}/${SPECIES[id].attack}`).join(', '));
check('the monsters: health 120, 285, 510, 2100; blow 5.6, 8.8, 13.6, 28',
  MONSTERS.map(([id]) => `${SPECIES[id].health}/${SPECIES[id].attack}`).join(' ') === '120/5.6 285/8.8 510/13.6 2100/28',
  MONSTERS.map(([id]) => `${id} ${SPECIES[id].health}/${SPECIES[id].attack}`).join(', '));
const kinds = Object.values(SPECIES);
const weakest = kinds.reduce((a, b) => (b.attack < a.attack ? b : a));
check('no kind does no damage: every blow over 0, kept to the hundredth',
  kinds.every((d) => d.attack > 0 && near(d.attack * 100, Math.round(d.attack * 100))), `weakest ${weakest.id} ${weakest.attack}`);
check('every kind\'s health a whole number, a multiple of 3', kinds.every((d) => Number.isInteger(d.health) && d.health % 3 === 0));

/* ---- The browser: what a blow lands for, what it can take ------------------------------------------------------ */

const g = Game.create(2611);
const plain = (id: string) => {
  const c = g.creatures.spawn(id, 10, 10, 'wild', () => 0.5);
  c.traits = [];
  c.rare = 0;
  return c;
};
const gob = plain('goblin');
check('a plain goblin: health 120, blow 5.6, 6.72% of an unarmoured life a blow (was 16.8%)',
  maxHealth(gob, SPECIES.goblin) === 120 && near(attackOf(gob, SPECIES.goblin), 5.6) && near(attackOf(gob, SPECIES.goblin) * BLOW_SHARE, 0.0672),
  `${maxHealth(gob, SPECIES.goblin)} / ${attackOf(gob, SPECIES.goblin)}`);
const life = 1;
const blowsToKill = (id: string): number => Math.ceil(life / (SPECIES[id].attack * BLOW_SHARE));
check('unarmoured blows to kill you: goblin 15 (was 6), orc 10 (was 4), ogre 7 (was 3), dragon 3 (was 2)',
  ['goblin', 'orc', 'ogre', 'dragon'].map(blowsToKill).join(',') === '15,10,7,3', ['goblin', 'orc', 'ogre', 'dragon'].map(blowsToKill).join(','));

/* ---- The browser: what stays as it was ----------------------------------------------------------------------- */

// A bed: the bands scaled with the health, so every kind sleeps where it did (the written 25 and 40).
const bedWas = (written: number): number => (written < 25 ? 0 : written < 40 ? 1 : 2);
const bedsMoved = kinds.filter((d) => !d.stages && denClass({ species: d.id, skills: {} }) !== bedWas(d.health / 3));
check('every kind that does not evolve sleeps in the bed it did: bands 75 and 120 (were 25 and 40)',
  bedsMoved.length === 0 && DEN_HEALTH[0] === 75 && DEN_HEALTH[1] === 120, bedsMoved.map((d) => d.id).join(', '));
// A treasure map: the odds and the QL off the row's health, as before.
const mapsMoved = MONSTERS.filter(([id]) => !near(mapChanceFromBeast(SPECIES[id].health), Math.min(MAP_KILL_CAP, WRITTEN[id][0] / MAP_KILL_SCALE)));
check('a treasure map off a monster: odds as before, goblin 1 in 35, dragon 1 in 2', mapsMoved.length === 0
  && near(mapChanceFromBeast(SPECIES.goblin.health), 1 / 35) && near(mapChanceFromBeast(SPECIES.dragon.health), 0.5),
  MONSTERS.map(([id]) => `${id} ${mapChanceFromBeast(SPECIES[id].health).toFixed(4)}`).join(', '));
check('and its QL as before: goblin 17 and dragon 99.5 at the middle of the roll',
  near(mapQlFromBeast(SPECIES.goblin.health, () => 0.5), 12 + 40 / 8) && near(mapQlFromBeast(SPECIES.dragon.health, () => 0.5), 12 + 700 / 8),
  `${mapQlFromBeast(SPECIES.goblin.health, () => 0.5)} / ${mapQlFromBeast(SPECIES.dragon.health, () => 0.5)}`);
check('a carcass yields what it did: goblin 2 meat, 3 leather, 4 bone, 2 sinew; dragon 40 meat, 24 scales, a hoard',
  JSON.stringify(SPECIES.goblin.butcher) === JSON.stringify({ meat: 2, leather: 3, bone: 4, sinew: 2 })
  && SPECIES.dragon.butcher.meat === 40 && SPECIES.dragon.butcher.scale === 24 && SPECIES.dragon.butcher.hoard === 1);
// Health back a second: ×3, so hurt to whole takes as long: half of a rabba's health, wild, 40 seconds as before.
const halfRabba = SPECIES.rabba.health / 2;
check('health back a second ×3: wild 0.75 (was 0.25), yours 1.8 (was 0.6); half a rabba back in 40 s wild, as before',
  near(REGEN_WILD, 0.75) && near(REGEN_KEPT, 1.8) && near(halfRabba / REGEN_WILD, 10 / 0.25) && near(halfRabba / REGEN_KEPT, 10 / 0.6),
  `${halfRabba / REGEN_WILD} s, ${halfRabba / REGEN_KEPT} s`);
check('a sparring partner yields within 0.5 of its floor, as before: under the weakest blow, a Sparra\'s', near(SPAR_SLACK, 0.5)
  && SPAR_SLACK < SPECIES.sparra.attack * 0.7);
{
  const r = plain('rabba');
  const top = maxHealth(r, SPECIES.rabba);
  r.health = top / 2;
  r.attackedAt = g.time - REGEN_AFTER - 1;
  const before = r.health;
  // Its body's turn, 10 seconds banked.
  (g.creatures as unknown as { body: (g: Game, c: typeof r, s: number) => void }).body(g, r, 10);
  check('the browser gives a hurt wild rabba 7.5 health in 10 seconds (was 2.5)', near(r.health - before, 10 * REGEN_WILD, 1e-3), `${r.health - before}`);
}

/* ---- The island ---------------------------------------------------------------------------------------------- */

const rows = psql(`select id || '|' || health || '|' || attack from species_def order by id;`).split('\n').filter(Boolean);
const island = new Map(rows.map((l) => {
  const [id, h, a] = l.split('|');
  return [id, [Number(h), Number(a)] as [number, number]];
}));
const disagree = kinds.filter((d) => {
  const i = island.get(d.id);
  return !i || i[0] !== d.health || !near(i[1], real(d.attack), 1e-6);
});
check(`the island's species_def has the same health and blow as the browser for every one of the ${kinds.length} kinds`,
  disagree.length === 0 && island.size === kinds.length, disagree.map((d) => `${d.id} ${island.get(d.id)} vs ${d.health}/${d.attack}`).join(', '));
const hybrids = kinds.filter((d) => d.hybrid);
check(`those kinds include the ${hybrids.length} hybrids, each on the island at the browser's health and blow`,
  hybrids.length === 50 && hybrids.every((d) => island.has(d.id) && !disagree.includes(d)), hybrids.filter((d) => !island.has(d.id)).map((d) => d.id).join(', '));
check('and no kind on the island does no damage', [...island.values()].every(([, a]) => a > 0));
const fns = psql(`select creature_health_mul() || '|' || creature_attack_mul() || '|' || regen_wild() || '|' || regen_kept() || '|' || regen_after()
  || '|' || den_health_1() || '|' || den_health_2() || '|' || spar_slack();`);
check('the island reads the same multipliers, health back a second, bed bands and sparring slack',
  fns === [CREATURE_HEALTH_MUL, CREATURE_ATTACK_MUL, REGEN_WILD, REGEN_KEPT, REGEN_AFTER, DEN_HEALTH[0], DEN_HEALTH[1], SPAR_SLACK].join('|'), fns);

// The migration's own statement, read off its file, so what is measured is what ran on the project.
const MIGRATIONS = 'supabase/migrations';
const file = readdirSync(MIGRATIONS).filter((f) => f.endsWith('_creature_health_x3_blow_x04.sql'))[0];
const scale = (readFileSync(join(MIGRATIONS, file), 'utf8').match(/update creature c\s[\s\S]*?;/) ?? [''])[0];
check('the migration scales the health kept on every creature on the island', scale.includes('where c.health > 0'), file);

const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; v_id int; v_old double precision; v_t text; c creature; v_at double precision; v_was double precision;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  create or replace function rarity_roll() returns text language sql as 'select null::text';

  -- What lands and what it can take, a plain one of each monster.
  for v_t in select unnest(array['goblin', 'orc', 'ogre', 'dragon', 'rabba']) loop
    v_id := creature_spawn(w, v_t, 30.5, 30.5, 'wild', null, null);
    -- Put down at the full health its blood gives it; then its plain figures, with no blood.
    select * into c from creature where world_id = w and id = v_id;
    v_was := c.health - max_health(c);
    update creature set traits = '{}', form_size = null where world_id = w and id = v_id;
    select * into c from creature where world_id = w and id = v_id;
    insert into said values ('FIG|' || v_t, max_health(c) || '|' || round(attack_of(c)::numeric, 4) || '|' || v_was);
    delete from creature where world_id = w and id = v_id;
  end loop;

  -- Health back a second: a hurt wild rabba and one of yours, 10 seconds since their last settle.
  for v_t in select unnest(array['wild', 'active']) loop
    v_id := creature_spawn(w, 'rabba', 31.5, 31.5, v_t, null, case when v_t = 'wild' then null else u end);
    update creature set traits = '{}', form_size = null, hurt_at = null where world_id = w and id = v_id;
    select * into c from creature where world_id = w and id = v_id;
    v_was := max_health(c) / 2;
    update creature set health = v_was, settled_at = now() - interval '10 seconds' where world_id = w and id = v_id;
    perform creature_settle(w, v_id);
    select * into c from creature where world_id = w and id = v_id;
    insert into said values ('REGEN|' || v_t, round((c.health - v_was)::numeric, 3) || '|' || round(beast_mul(c, 'mend')::numeric, 6) || '|' || max_health(c));
    delete from creature where world_id = w and id = v_id;
  end loop;

  -- The bed a kind sleeps in, on the island.
  for v_t in select unnest(array['rabba', 'roxxen', 'sparra', 'goblin', 'dragon']) loop
    v_id := creature_spawn(w, v_t, 32.5, 32.5, 'wild', null, null);
    select * into c from creature where world_id = w and id = v_id;
    insert into said values ('DEN|' || v_t, den_class(c)::text);
    delete from creature where world_id = w and id = v_id;
  end loop;

  -- A treasure map off a body, the roll held: the odds and the QL off the row's health.
  insert into said select 'MAP|' || id, round(map_chance_beast(health)::numeric, 6)::text from species_def where monster;
  perform setseed(0.25);
  v_at := random();
  perform setseed(0.25);
  insert into said values ('MAPQL|goblin', round(map_ql_beast(species_health('goblin'))::numeric, 6) || '|' || round(((12 + 40.0 / 8) * (0.8 + v_at * 0.4))::numeric, 6));

  -- The migration: creatures kept at the health they had before it, full and half, wild, out, on a settlement, crated.
  for v_t in select unnest(array['wild', 'active', 'deed', 'stored']) loop
    for i in 1 .. 2 loop
      v_id := creature_spawn(w, 'roxxen', 33.5 + i, 33.5, v_t, null, case when v_t = 'wild' then null else u end);
      update creature set traits = array['thick_hided'], rare = case when i = 2 then 'rare' else null end where world_id = w and id = v_id;
      select * into c from creature where world_id = w and id = v_id;
      -- Its full health before: off its row's own figure.
      v_old := round(species_health('roxxen') / creature_health_mul() * beast_mul(c, 'hardy') * class_mul(c.world_id, c.keeper, 'hide', 'soul_strength'));
      update creature set health = case when i = 1 then v_old else v_old / 2 end where world_id = w and id = v_id;
      insert into said values ('MIG|' || v_t || '|' || i, v_id || '|' || v_old);
    end loop;
  end loop;
end $$;
${scale}
select k || '=' || v from said where k not like 'MIG|%' order by k;
select 'AFTER|' || s.k || '=' || c.health || '|' || max_health(c) || '|' || split_part(s.v, '|', 2)
  from said s join creature c on c.id = split_part(s.v, '|', 1)::int and c.world_id = (select id from world where name = 'Stonehaven')
  where s.k like 'MIG|%' order by s.k;
rollback;
`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const figs = ['goblin', 'orc', 'ogre', 'dragon', 'rabba'].map((id) => (said.get(`FIG|${id}`) ?? '').split('|').map(Number));
check('on the island a plain one of each: health 120, 285, 510, 2100, 60; blow 5.6, 8.8, 13.6, 28, 1.2; put down at full health',
  ['goblin', 'orc', 'ogre', 'dragon', 'rabba'].every((id, i) => figs[i][0] === SPECIES[id].health && near(figs[i][1], SPECIES[id].attack, 1e-5) && Math.abs(figs[i][2]) <= 0.5),
  figs.map((f) => f.join('/')).join(', '));
const regen = (k: string): number[] => (said.get(`REGEN|${k}`) ?? '').split('|').map(Number);
check('the island gives a hurt wild rabba health back at 0.75 a second, one of yours at 1.8, by its mend',
  near(regen('wild')[0], 10 * REGEN_WILD * regen('wild')[1], 2e-3) && near(regen('active')[0], 10 * REGEN_KEPT * regen('active')[1], 2e-3),
  `${said.get('REGEN|wild')} | ${said.get('REGEN|active')}`);
check('so half a rabba back takes as long as before: 40 s wild, 16.7 s yours, at a mend of 1',
  near((regen('wild')[2] / 2) / (regen('wild')[0] / 10 / regen('wild')[1]), (regen('wild')[2] / 3 / 2) / 0.25, 0.02)
  && near((regen('active')[2] / 2) / (regen('active')[0] / 10 / regen('active')[1]), (regen('active')[2] / 3 / 2) / 0.6, 0.02));
const dens = ['rabba', 'roxxen', 'sparra', 'goblin', 'dragon'];
check('the island beds every kind where the browser does', dens.every((id) => Number(said.get(`DEN|${id}`)) === denClass({ species: id, skills: {} })),
  dens.map((id) => `${id} ${said.get(`DEN|${id}`)}`).join(', '));
check('a treasure map off a monster on the island: the odds as before',
  MONSTERS.every(([id]) => near(Number(said.get(`MAP|${id}`)), Math.min(MAP_KILL_CAP, WRITTEN[id][0] / MAP_KILL_SCALE), 1e-5)),
  MONSTERS.map(([id]) => `${id} ${said.get(`MAP|${id}`)}`).join(', '));
const ql = (said.get('MAPQL|goblin') ?? '').split('|').map(Number);
check('and the QL as before, the roll held', ql.length === 2 && near(ql[0], ql[1], 1e-5), said.get('MAPQL|goblin'));

const after = [...said.entries()].filter(([k]) => k.startsWith('AFTER|')).map(([k, v]) => {
  const [health, top, old] = v.split('|').map(Number);
  return { k: k.slice('AFTER|MIG|'.length), health, top, old };
});
check('the migration: 8 creatures, wild, out, on a settlement and crated', after.length === 8, after.map((a) => a.k).join(', '));
check('every one that was at full health is at full health', after.filter((a) => a.k.endsWith('|1')).every((a) => a.health === a.top),
  after.map((a) => `${a.k} ${a.health}/${a.top} (was full ${a.old})`).join(', '));
check('every one at half its health is at half its health, and the heal task dresses it as it did (under 75%)',
  after.filter((a) => a.k.endsWith('|2')).every((a) => near(a.health / a.top, 0.5, 1e-9) && a.health < a.top * HEAL_BELOW),
  after.filter((a) => a.k.endsWith('|2')).map((a) => `${a.k} ${a.health}/${a.top}`).join(', '));
check('none at a third of its health', after.every((a) => a.health / a.top >= 0.5 - 1e-9));

finish('Creature health ×3, blow ×0.4');
