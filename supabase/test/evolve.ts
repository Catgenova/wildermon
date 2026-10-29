/**
 * Wildermon evolve.
 *
 * Asked for: "add 2 evolution stages for each with 2 new names for each
 * evolution. Each evolution add movement speed and task speed and base stats.
 * Evolutions happen at level 25 and 50." This asks, of both sides, that a kind
 * that evolves is at its second stage from the first of `EVOLVE_AT` and its
 * third from the second, its level being its skill; that each stage
 * multiplies its health, its blow, its pace and its task by `STAGE_MUL` over
 * the one before; that it is called by its stage's name; that reaching a
 * stage says so and fills its health out to the new size; and that a kind
 * that does not evolve is untouched at any level. The Snufflet, which was the
 * Rabba, is the first.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { packLand, packWorld, unpack } from '../../src/game/save';
import { Game } from '../../src/game/game';
import { BUTCHER_PARTS } from '../../src/game/butcher';
import { attackOf, bloodMul, EVOLVE_AT, kindName, levelSkill, maxHealth, SPECIES, STAGE_MUL, stageOf, type Creature } from '../../src/game/creatures';

/** A kind that does not evolve, and the skill it levels by: the first with no stages that levels at all. */
const STILL = Object.values(SPECIES).find((d) => !d.stages && !d.monster && levelSkill(d))!;
const STILL_SKILL = levelSkill(STILL)!;

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
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
const [AT1, AT2] = EVOLVE_AT;
const H = STAGE_MUL.hardy!, T = STAGE_MUL.tough!, S = STAGE_MUL.speed!, W = STAGE_MUL.work!, G = STAGE_MUL.grow!;

/* ---- on the island ----------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000f7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; v int; c creature; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Evolve', 177, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into said select 'NAMES', name || '|' || array_to_string(stages, ',') from species_def where id = 'rabba';
  insert into said select 'IRONEMOLE', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Mola')).id from species_def where id = 'mola';
  insert into said select 'SPORELING', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Vola')).id from species_def where id = 'vola';
  insert into said select 'CLOUDLET', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Woola')).id from species_def where id = 'woola';
  insert into said select 'PIGROOT', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Seavic')).id from species_def where id = 'seavic';
  insert into said select 'MUDCUT', string_agg(b.item || ':' || sb.n, ',' order by b.ord) from butcher_part b join species_butcher sb on sb.part = b.part where sb.species = 'noot';
  insert into said select 'SAPGNAW', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Bevere')).id from species_def where id = 'bevere';
  insert into said select 'BRICKLING', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Cobbe')).id from species_def where id = 'cobbe';
  insert into said select 'REEDPUP', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Sedra')).id from species_def where id = 'sedra';
  insert into said select 'PUDDLEHOP', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Holla')).id from species_def where id = 'holla';
  insert into said select 'PIPSEED', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Sappa')).id from species_def where id = 'sappa';
  insert into said select 'LEMLET', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Sprigga')).id from species_def where id = 'sprigga';
  insert into said select 'SNAREPUP', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Rowl')).id from species_def where id = 'rowl';
  insert into said select 'DIRTLET', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Snout')).id from species_def where id = 'snout';
  insert into said select 'GLIMMOTH', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Wicka')).id from species_def where id = 'wicka';
  insert into said select 'PEBBLETOOTH', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Thumpa')).id from species_def where id = 'thumpa';
  insert into said select 'ZEPHLET', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Stona')).id from species_def where id = 'stona';
  insert into said select 'BLUSHKIT', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Lungra')).id from species_def where id = 'lungra';
  insert into said select 'MOSSKIP', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Bogga')).id from species_def where id = 'bogga';
  insert into said select 'CHESTKIT', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Magga')).id from species_def where id = 'magga';
  insert into said select 'SPRIGMANT', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Grazza')).id from species_def where id = 'grazza';
  insert into said select 'BUDSCARAB', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Grubba')).id from species_def where id = 'grubba';
  insert into said select 'PEBBLEBEAK', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Wurla')).id from species_def where id = 'wurla';
  insert into said select 'SLIPLET', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Mudda')).id from species_def where id = 'mudda';
  insert into said select 'PAILBARA', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Dippa')).id from species_def where id = 'dippa';
  insert into said select 'SNAILEAF', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Middun')).id from species_def where id = 'middun';
  insert into said select 'DUMMICUB', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Sparra')).id from species_def where id = 'sparra';
  insert into said select 'VANARI', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Plucka')).id from species_def where id = 'plucka';
  insert into said select 'WHEATLEY', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Grista')).id from species_def where id = 'grista';
  insert into said select 'KINTSU', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Relka')).id from species_def where id = 'relka';
  insert into said select 'THISTLEKIT', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Orse')).id from species_def where id = 'orse';
  insert into said select 'STITCHKIT', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Tinka')).id from species_def where id = 'tinka';
  insert into said select 'CARTLING', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Roxxen')).id from species_def where id = 'roxxen';
  insert into said select 'SLUGLOW', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Embra')).id from species_def where id = 'embra';
  insert into said select 'MUDLET', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Noot')).id from species_def where id = 'noot';
  insert into said select 'SANDPIP', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Crawler')).id from species_def where id = 'crawler';
  insert into said select 'SKYLOOK', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Warda')).id from species_def where id = 'warda';
  insert into said select 'WHISPET', name || '|' || array_to_string(stages, ',') from species_def where id = 'whispet';
  insert into said select 'CHIPTAIL', name || '|' || array_to_string(stages, ',') || '|' || array_to_string(was, ',') || '|' || (corpse_species('Quarra')).id from species_def where id = 'quarra';
  insert into said values ('NUMBERS', evolve_at_1() || '|' || evolve_at_2() || '|' || stage_mul_hardy() || '|' || stage_mul_tough() || '|' || stage_mul_speed() || '|' || stage_mul_work() || '|' || stage_mul_grow());
  a := creature_spawn(w, 'rabba', 17, 16.5, 'deed', now() - interval '60 days', u);
  v := creature_spawn(w, '${STILL.id}', 18, 16.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null where world_id = w and id in (a, v);
  for i in 0..2 loop
    update creature set skills = jsonb_build_object('foraging', case i when 0 then ${AT1} - 0.01 when 1 then ${AT1} else ${AT2} end) where world_id = w and id = a;
    select * into c from creature where world_id = w and id = a;
    insert into said values ('STAGE:' || i, stage_of(c) || '|' || max_health(c) || '|' || round(attack_of(c)::numeric, 4)
      || '|' || round(beast_mul(c, 'speed')::numeric, 4) || '|' || round(beast_mul(c, 'work')::numeric, 4));
  end loop;
  update creature set skills = jsonb_build_object('${STILL_SKILL}', 80) where world_id = w and id = v;
  select * into c from creature where world_id = w and id = v;
  insert into said values ('STILL', stage_of(c) || '|' || round(beast_mul(c, 'speed')::numeric, 4));
  -- A Cloudborne grows its fleece back sooner by its stage (asked for: "Yes, faster regrowth").
  v := creature_spawn(w, 'woola', 19, 16.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, skills = jsonb_build_object('animal_husbandry', ${AT2}) where world_id = w and id = v;
  select * into c from creature where world_id = w and id = v;
  insert into said values ('FLEECE', stage_of(c) || '|' || round(beast_mul(c, 'grow')::numeric, 4));
  -- Learning across the line: it says so, and is as full of health as it was.
  update creature set mode = 'active', skills = jsonb_build_object('foraging', ${AT1} - 0.0001), health = 10, name = '${SPECIES.rabba.name}' where world_id = w and id = a;
  for i in 1..50 loop
    perform worker_learn(w, a, 'foraging', 5);
    exit when (select stage_of(cr) from creature cr where cr.world_id = w and cr.id = a) = 1;
  end loop;
  select * into c from creature where world_id = w and id = a;
  insert into said values ('CROSSED', stage_of(c) || '|' || round(c.health::numeric, 4));
  insert into said select 'TOLD', coalesce(string_agg(text, ' / '), '-') from event where world_id = w and uid = u and text like '% evolved: %';
  -- Called only its kind's name, it is called what it has become; one somebody named keeps the name.
  insert into said select 'RENAMED', name from creature where world_id = w and id = a;
  update creature set skills = jsonb_build_object('foraging', ${AT2} - 0.0001), name = 'Horn' where world_id = w and id = a;
  for i in 1..50 loop
    perform worker_learn(w, a, 'foraging', 5);
    exit when (select stage_of(cr) from creature cr where cr.world_id = w and cr.id = a) = 2;
  end loop;
  insert into said select 'KEPT', stage_of(cr) || '|' || cr.name from creature cr where cr.world_id = w and cr.id = a;
  -- And one past both stages still called its kind's first name, or the name its kind went by before, is put right.
  update creature set name = '${SPECIES.seavic.was![0]}', skills = jsonb_build_object('foraging', ${AT2}) where world_id = w and id = a;
  insert into said select 'NAMEDAT', kind_named(cr) || '|' || kind_name_at(cr) from creature cr where cr.world_id = w and cr.id = a;
  update creature set name = '${SPECIES.rabba.name}' where world_id = w and id = a;
  insert into said select 'NAMEDAT2', kind_named(cr) || '|' || kind_name_at(cr) from creature cr where cr.world_id = w and cr.id = a;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

const def = SPECIES.rabba;
check('the Rabba is the Snufflet now, a Snuffroot and a Snuffthorn after, on both sides',
  def.name === 'Snufflet' && def.stages?.map((x) => x.name).join(',') === 'Snuffroot,Snuffthorn' && at('NAMES') === 'Snufflet|Snuffroot,Snuffthorn', at('NAMES'));
const iron = SPECIES.mola;
check('the Mola is the Ironemole now, a Ferrodrill and an Oremander after, and an old Mola carcass is still one, on both sides',
  iron.name === 'Ironemole' && iron.stages?.map((x) => x.name).join(',') === 'Ferrodrill,Oremander'
    && at('IRONEMOLE') === 'Ironemole|Ferrodrill,Oremander|Mola|mola' && iron.stages[1].description.startsWith(`Evolution stage 3, level ${EVOLVE_AT[1]}+. Over an Ironemole:`), at('IRONEMOLE'));
const spore = SPECIES.vola;
check('the Vola is the Sporeling now, a Sporekin and a Sporelord after, and an old Vola carcass is still one, on both sides',
  spore.name === 'Sporeling' && spore.stages?.map((x) => x.name).join(',') === 'Sporekin,Sporelord'
    && at('SPORELING') === 'Sporeling|Sporekin,Sporelord|Vola|vola', at('SPORELING'));
const cloud = SPECIES.woola;
check('the Woola is the Cloudlet now, a Cloudram and a Cloudborne after, and an old Woola carcass is still one, on both sides',
  cloud.name === 'Cloudlet' && cloud.stages?.map((x) => x.name).join(',') === 'Cloudram,Cloudborne'
    && at('CLOUDLET') === 'Cloudlet|Cloudram,Cloudborne|Woola|woola', at('CLOUDLET'));
const pig = SPECIES.seavic;
check('the Seavic is the Pigroot now, a Plowhog and a Harvestusk after, and an old Seavic carcass is still one, on both sides',
  pig.name === 'Pigroot' && pig.stages?.map((x) => x.name).join(',') === 'Plowhog,Harvestusk'
    && at('PIGROOT') === 'Pigroot|Plowhog,Harvestusk|Seavic|seavic', at('PIGROOT'));
const gnaw = SPECIES.bevere;
check('the Bevere is the Sapgnaw now, a Logchewer and a Timberlord after, and an old Bevere carcass is still one, on both sides',
  gnaw.name === 'Sapgnaw' && gnaw.stages?.map((x) => x.name).join(',') === 'Logchewer,Timberlord'
    && at('SAPGNAW') === 'Sapgnaw|Logchewer,Timberlord|Bevere|bevere', at('SAPGNAW'));
const slug = SPECIES.embra;
check('the Embra is the Sluglow now, a Slugember and a Slugferno after, and an old Embra carcass is still one, on both sides',
  slug.name === 'Sluglow' && slug.stages?.map((x) => x.name).join(',') === 'Slugember,Slugferno'
    && at('SLUGLOW') === 'Sluglow|Slugember,Slugferno|Embra|embra', at('SLUGLOW'));
const brick = SPECIES.cobbe;
check('the Cobbe is the Brickling now, a Mortarback and a Bastiondrake after, and an old Cobbe carcass is still one, on both sides',
  brick.name === 'Brickling' && brick.stages?.map((x) => x.name).join(',') === 'Mortarback,Bastiondrake'
    && at('BRICKLING') === 'Brickling|Mortarback,Bastiondrake|Cobbe|cobbe', at('BRICKLING'));
const cart = SPECIES.roxxen;
check('the Roxxen is the Cartling now, a Wagonox and a Haulhorn after, and an old Roxxen carcass is still one, on both sides',
  cart.name === 'Cartling' && cart.stages?.map((x) => x.name).join(',') === 'Wagonox,Haulhorn'
    && at('CARTLING') === 'Cartling|Wagonox,Haulhorn|Roxxen|roxxen', at('CARTLING'));
const stitch = SPECIES.tinka;
check('the Tinka is the Stitchkit now, a Patchcoon and a Mendermask after, and an old Tinka carcass is still one, on both sides',
  stitch.name === 'Stitchkit' && stitch.stages?.map((x) => x.name).join(',') === 'Patchcoon,Mendermask'
    && at('STITCHKIT') === 'Stitchkit|Patchcoon,Mendermask|Tinka|tinka', at('STITCHKIT'));
const hare = SPECIES.orse;
check('the Orse is the Thistlekit now, a Bunnycourser and a Moonhare after, and an old Orse carcass is still one, on both sides',
  hare.name === 'Thistlekit' && hare.stages?.map((x) => x.name).join(',') === 'Bunnycourser,Moonhare'
    && at('THISTLEKIT') === 'Thistlekit|Bunnycourser,Moonhare|Orse|orse', at('THISTLEKIT'));
const frog = SPECIES.holla;
check('the Holla is the Puddlehop now, a Springcarrier and an Aquavoyager after, and an old Holla carcass is still one, on both sides',
  frog.name === 'Puddlehop' && frog.stages?.map((x) => x.name).join(',') === 'Springcarrier,Aquavoyager'
    && at('PUDDLEHOP') === 'Puddlehop|Springcarrier,Aquavoyager|Holla|holla', at('PUDDLEHOP'));
check('the Sappa is the Pipseed now, a Sprigwing and an Arborcrest after, and an old Sappa carcass is still one, on both sides',
  SPECIES.sappa.name === 'Pipseed' && SPECIES.sappa.stages?.map((x) => x.name).join(',') === 'Sprigwing,Arborcrest'
    && at('PIPSEED') === 'Pipseed|Sprigwing,Arborcrest|Sappa|sappa', at('PIPSEED'));
check('the Sprigga is the Lemlet now, a Lemleaf and a Lemorian after, and an old Sprigga carcass is still one, on both sides',
  SPECIES.sprigga.name === 'Lemlet' && SPECIES.sprigga.stages?.map((x) => x.name).join(',') === 'Lemleaf,Lemorian'
    && at('LEMLET') === 'Lemlet|Lemleaf,Lemorian|Sprigga|sprigga', at('LEMLET'));
check('the Rowl is the Snarepup now, a Lashrunner and a Vinehunter after, and an old Rowl carcass is still one, on both sides',
  SPECIES.rowl.name === 'Snarepup' && SPECIES.rowl.stages?.map((x) => x.name).join(',') === 'Lashrunner,Vinehunter'
    && at('SNAREPUP') === 'Snarepup|Lashrunner,Vinehunter|Rowl|rowl', at('SNAREPUP'));
check('the Snout is the Dirtlet now, a Tunnelclaw and an Earthrend after, and an old Snout carcass is still one, on both sides',
  SPECIES.snout.name === 'Dirtlet' && SPECIES.snout.stages?.map((x) => x.name).join(',') === 'Tunnelclaw,Earthrend'
    && at('DIRTLET') === 'Dirtlet|Tunnelclaw,Earthrend|Snout|snout', at('DIRTLET'));
check('the Wicka is the Glimmoth now, a Lurewing and a Noctilure after, and an old Wicka carcass is still one, on both sides',
  SPECIES.wicka.name === 'Glimmoth' && SPECIES.wicka.stages?.map((x) => x.name).join(',') === 'Lurewing,Noctilure'
    && at('GLIMMOTH') === 'Glimmoth|Lurewing,Noctilure|Wicka|wicka', at('GLIMMOTH'));
check('the Thumpa is the Pebbletooth now, a Shaleclaw and a Cragjaws after, and an old Thumpa carcass is still one, on both sides',
  SPECIES.thumpa.name === 'Pebbletooth' && SPECIES.thumpa.stages?.map((x) => x.name).join(',') === 'Shaleclaw,Cragjaws'
    && at('PEBBLETOOTH') === 'Pebbletooth|Shaleclaw,Cragjaws|Thumpa|thumpa', at('PEBBLETOOTH'));
check('the Stona is the Zephlet now, a Galecrest and a Tempestwyrm after, and an old Stona carcass is still one, on both sides',
  SPECIES.stona.name === 'Zephlet' && SPECIES.stona.stages?.map((x) => x.name).join(',') === 'Galecrest,Tempestwyrm'
    && at('ZEPHLET') === 'Zephlet|Galecrest,Tempestwyrm|Stona|stona', at('ZEPHLET'));
check('the Lungra is the Blushkit now, a Briarpounce and a Thornlance after, and an old Lungra carcass is still one, on both sides',
  SPECIES.lungra.name === 'Blushkit' && SPECIES.lungra.stages?.map((x) => x.name).join(',') === 'Briarpounce,Thornlance'
    && at('BLUSHKIT') === 'Blushkit|Briarpounce,Thornlance|Lungra|lungra', at('BLUSHKIT'));
check('the Bogga is the Mosskip now, a Craghopper and a Bastiontoad after, and an old Bogga carcass is still one, on both sides',
  SPECIES.bogga.name === 'Mosskip' && SPECIES.bogga.stages?.map((x) => x.name).join(',') === 'Craghopper,Bastiontoad'
    && at('MOSSKIP') === 'Mosskip|Craghopper,Bastiontoad|Bogga|bogga', at('MOSSKIP'));
check('the Magga is the Chestkit now, a Lootvent and a Hoardback after, and an old Magga carcass is still one, on both sides',
  SPECIES.magga.name === 'Chestkit' && SPECIES.magga.stages?.map((x) => x.name).join(',') === 'Lootvent,Hoardback'
    && at('CHESTKIT') === 'Chestkit|Lootvent,Hoardback|Magga|magga', at('CHESTKIT'));
check('the Grazza is the Sprigmant now, a Petalblade and a Bloomreaper after, and an old Grazza carcass is still one, on both sides',
  SPECIES.grazza.name === 'Sprigmant' && SPECIES.grazza.stages?.map((x) => x.name).join(',') === 'Petalblade,Bloomreaper'
    && at('SPRIGMANT') === 'Sprigmant|Petalblade,Bloomreaper|Grazza|grazza', at('SPRIGMANT'));
check('the Grubba is the Budscarab now, a Blossomhorn and a Florantler after, and an old Grubba carcass is still one, on both sides',
  SPECIES.grubba.name === 'Budscarab' && SPECIES.grubba.stages?.map((x) => x.name).join(',') === 'Blossomhorn,Florantler'
    && at('BUDSCARAB') === 'Budscarab|Blossomhorn,Florantler|Grubba|grubba', at('BUDSCARAB'));
check('the Wurla is the Pebblebeak now, a Soilwhistle and a Wormheron after, and an old Wurla carcass is still one, on both sides',
  SPECIES.wurla.name === 'Pebblebeak' && SPECIES.wurla.stages?.map((x) => x.name).join(',') === 'Soilwhistle,Wormheron'
    && at('PEBBLEBEAK') === 'Pebblebeak|Soilwhistle,Wormheron|Wurla|wurla', at('PEBBLEBEAK'));
check('the Mudda is the Sliplet now, a Wheelmote and a Rollterra after, and an old Mudda carcass is still one, on both sides',
  SPECIES.mudda.name === 'Sliplet' && SPECIES.mudda.stages?.map((x) => x.name).join(',') === 'Wheelmote,Rollterra'
    && at('SLIPLET') === 'Sliplet|Wheelmote,Rollterra|Mudda|mudda', at('SLIPLET'));
check('the Dippa is the Pailbara now, a Caskybara and a Reservara after, and an old Dippa carcass is still one, on both sides',
  SPECIES.dippa.name === 'Pailbara' && SPECIES.dippa.stages?.map((x) => x.name).join(',') === 'Caskybara,Reservara'
    && at('PAILBARA') === 'Pailbara|Caskybara,Reservara|Dippa|dippa', at('PAILBARA'));
check('the Middun is the Snaileaf now, a Middunsnail and a Hearthsnail after, and an old Middun carcass is still one, on both sides',
  SPECIES.middun.name === 'Snaileaf' && SPECIES.middun.stages?.map((x) => x.name).join(',') === 'Middunsnail,Hearthsnail'
    && at('SNAILEAF') === 'Snaileaf|Middunsnail,Hearthsnail|Middun|middun', at('SNAILEAF'));
check('the Sparra is the Dummicub now, a Dummibear and a Dummititan after, and an old Sparra carcass is still one, on both sides',
  SPECIES.sparra.name === 'Dummicub' && SPECIES.sparra.stages?.map((x) => x.name).join(',') === 'Dummibear,Dummititan'
    && at('DUMMICUB') === 'Dummicub|Dummibear,Dummititan|Sparra|sparra', at('DUMMICUB'));
check('the Plucka is the Vanari now, an Orchibelle and an Arboanari after, and an old Plucka carcass is still one, on both sides',
  SPECIES.plucka.name === 'Vanari' && SPECIES.plucka.stages?.map((x) => x.name).join(',') === 'Orchibelle,Arboanari'
    && at('VANARI') === 'Vanari|Orchibelle,Arboanari|Plucka|plucka', at('VANARI'));
check('the Grista is the Wheatley now, a Wheatwhirl and a Wheatcheeks after, and an old Grista carcass is still one, on both sides',
  SPECIES.grista.name === 'Wheatley' && SPECIES.grista.stages?.map((x) => x.name).join(',') === 'Wheatwhirl,Wheatcheeks'
    && at('WHEATLEY') === 'Wheatley|Wheatwhirl,Wheatcheeks|Grista|grista', at('WHEATLEY'));
check('the Relka is the Kintsu now, a Relicrawler and an Aureliax after, and an old Relka carcass is still one, on both sides',
  SPECIES.relka.name === 'Kintsu' && SPECIES.relka.stages?.map((x) => x.name).join(',') === 'Relicrawler,Aureliax'
    && at('KINTSU') === 'Kintsu|Relicrawler,Aureliax|Relka|relka', at('KINTSU'));
const reed = SPECIES.sedra;
check('the Sedra is the Reedpup now, a Reedweaver and a Marshreaper after, and an old Sedra carcass is still one, on both sides',
  reed.name === 'Reedpup' && reed.stages?.map((x) => x.name).join(',') === 'Reedweaver,Marshreaper'
    && at('REEDPUP') === 'Reedpup|Reedweaver,Marshreaper|Sedra|sedra', at('REEDPUP'));
const mud = SPECIES.noot;
check('the Noot is the Mudlet now, a Clayburrow and a Terramole after, and an old Noot carcass is still one, on both sides',
  mud.name === 'Mudlet' && mud.stages?.map((x) => x.name).join(',') === 'Clayburrow,Terramole'
    && at('MUDLET') === 'Mudlet|Clayburrow,Terramole|Noot|noot', at('MUDLET'));
const mudCut = BUTCHER_PARTS.filter(([p]) => (mud.butcher[p] ?? 0) > 0).map(([p, item]) => `${item}:${mud.butcher[p]}`).join(',');
check('and butchered it gives clay, not feathers, the same on both sides',
  mudCut.includes('clay:') && !mudCut.includes('feather') && at('MUDCUT') === mudCut, `browser ${mudCut}, island ${at('MUDCUT')}`);
const pip = SPECIES.crawler;
check('the Crawler is the Sandpip now, a Sandpincher and a Sandpinnacle after, and an old Crawler carcass is still one, on both sides',
  pip.name === 'Sandpip' && pip.stages?.map((x) => x.name).join(',') === 'Sandpincher,Sandpinnacle'
    && at('SANDPIP') === 'Sandpip|Sandpincher,Sandpinnacle|Crawler|crawler', at('SANDPIP'));
const sky = SPECIES.warda;
check('the Warda is the Skylooklet now, a Skywarden and a Skyrange after, an old Warda carcass is still one, and its stages are not said to work faster, on both sides',
  sky.name === 'Skylooklet' && sky.stages?.map((x) => x.name).join(',') === 'Skywarden,Skyrange' && !sky.stages[1].description.includes('task')
    && at('SKYLOOK') === 'Skylooklet|Skywarden,Skyrange|Warda|warda', at('SKYLOOK'));
const chip = SPECIES.quarra;
check('the Quarra is the Chiptail now, a Quarrybash and a Monolithump after, and an old Quarra carcass is still one, on both sides',
  chip.name === 'Chiptail' && chip.stages?.map((x) => x.name).join(',') === 'Quarrybash,Monolithump'
    && at('CHIPTAIL') === 'Chiptail|Quarrybash,Monolithump|Quarra|quarra', at('CHIPTAIL'));
const ghost = SPECIES.whispet;
check('the Whispet is new, a Lanternveil and a Hallowmire after, and as a guard\'s spar with a Sparra is a go at its task its stages are said to work faster, on both sides',
  ghost.name === 'Whispet' && ghost.stages?.map((x) => x.name).join(',') === 'Lanternveil,Hallowmire' && ghost.stages[1].description.includes('task speed')
    && ghost.stages[1].description.startsWith(`Evolution stage 3, level ${EVOLVE_AT[1]}+. Over a Whispet:`) && at('WHISPET') === 'Whispet|Lanternveil,Hallowmire', at('WHISPET'));
check(`it evolves at ${AT1} and ${AT2}, and each stage is ${H}, ${T}, ${S}, ${W} and ${G} over the last, on both sides`,
  at('NUMBERS') === `${AT1}|${AT2}|${H}|${T}|${S}|${W}|${G}`, at('NUMBERS'));
for (let i = 0; i < 3; i++) {
  const [stage, health, attack, speed, work] = at(`STAGE:${i}`).split('|').map(Number);
  const k = i;
  check(`on the island, at ${['just under the first', 'the first', 'the second'][i]} it is stage ${k}: health, blow, pace and task at their stage`,
    stage === k && health === Math.round(def.health * H ** k) && near(attack, Number((def.attack * T ** k).toFixed(4)))
      && near(speed, Number((S ** k).toFixed(4))) && near(work, Number((W ** k).toFixed(4))), at(`STAGE:${i}`));
}
check(`on the island, a Cloudborne grows its fleece back ${G} squared as fast`, at('FLEECE') === `2|${(G ** 2).toFixed(4)}`, at('FLEECE'));
check(`a ${STILL.name}, which does not evolve, is not touched at any level`, at('STILL') === '0|1.0000' || at('STILL') === '0|1', at('STILL'));
const [crossed, healthAfter] = at('CROSSED').split('|');
check(`learning across ${AT1}, it evolves, says so, and its health grows with it`,
  crossed === '1' && near(Number(healthAfter), 10 * H) && at('TOLD').includes('evolved: Snuffroot.'), `${at('CROSSED')} ${at('TOLD')}`);

check(`and called only its kind's name, it is called a ${SPECIES.rabba.stages![0].name} now; called Horn, it keeps Horn as a ${SPECIES.rabba.stages![1].name}`,
  at('RENAMED') === SPECIES.rabba.stages![0].name && at('KEPT') === '2|Horn', `${at('RENAMED')} ${at('KEPT')}`);
check(`a ${SPECIES.rabba.stages![1].name} still called ${SPECIES.rabba.name} is nobody's naming and goes by its stage; another kind's old name is somebody's`,
  at('NAMEDAT2') === `true|${SPECIES.rabba.stages![1].name}` && at('NAMEDAT') === `false|${SPECIES.rabba.stages![1].name}`, `${at('NAMEDAT2')} ${at('NAMEDAT')}`);

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4254);
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
const mine = (id: string): Creature => {
  const c = g.creatures.spawn(id, g.player.x + 1, g.player.y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  c.traits = [];
  c.rare = 0;
  return c;
};
const r = mine('rabba');
for (const [skill, stage, name] of [[AT1 - 0.01, 0, 'Snufflet'], [AT1, 1, 'Snuffroot'], [AT2, 2, 'Snuffthorn']] as const) {
  r.skills = { foraging: skill };
  check(`in the browser, at ${skill} it is a ${name}, stage ${stage}, at its stage's health, blow, pace and task`,
    stageOf(r) === stage && kindName(r) === name && maxHealth(r, def) === Math.round(def.health * H ** stage) && near(attackOf(r, def), def.attack * T ** stage)
      && near(g.creatures.speedMul(r), S ** stage) && near(g.creatures.workMul(r), W ** stage),
    `${stageOf(r)} ${kindName(r)} ${maxHealth(r, def)} ${attackOf(r, def)} ${g.creatures.speedMul(r)} ${g.creatures.workMul(r)}`);
}
{
  const sheep = mine('woola');
  sheep.skills = { animal_husbandry: AT2 };
  check(`in the browser, a Cloudborne grows its fleece back ${G} squared as fast`, stageOf(sheep) === 2 && near(bloodMul(sheep, 'grow'), G ** 2), `${stageOf(sheep)} ${bloodMul(sheep, 'grow')}`);
}
const still = mine(STILL.id);
still.skills = { [STILL_SKILL]: 80 };
check(`a ${STILL.name} is not touched at any level`, stageOf(still) === 0 && kindName(still) === STILL.name && near(g.creatures.speedMul(still), 1));
{
  r.skills = { foraging: AT1 - 0.0001 };
  r.health = 10;
  r.mode = 'active';
  let evolved = 0;
  g.events.on('evolve', () => { evolved += 1; });
  const acts: string[] = [];
  g.events.on('beast', (_id, act) => acts.push(act));
  for (let n = 0; n < 50 && stageOf(r) === 0; n++) g.creatures.gainSkill(g, r, 'foraging', 5);
  check(`learning across ${AT1}, it evolves, says so, and its health grows with it`,
    stageOf(r) === 1 && near(r.health, 10 * H) && evolved === 1 && acts.includes('evolve')
      && g.log.some((e) => e.text.includes('evolved: Snuffroot.')), `${stageOf(r)} ${r.health} ${evolved} ${acts}`);
}

{
  // Called only its kind's name, it is called what it has become; one somebody named keeps the name.
  check(`and called only its kind's name, it is called a ${SPECIES.rabba.stages![0].name} now`, r.name === SPECIES.rabba.stages![0].name, r.name);
  r.name = 'Horn';
  for (let n = 0; n < 200 && stageOf(r) < 2; n++) { r.skills = { foraging: Math.max(r.skills.foraging ?? 0, AT2 - 0.0001) }; g.creatures.gainSkill(g, r, 'foraging', 5); }
  check(`called Horn, it keeps Horn as a ${SPECIES.rabba.stages![1].name}`, stageOf(r) === 2 && r.name === 'Horn', `${stageOf(r)} ${r.name}`);
  // And a save holding a Harvestusk still called a Pigroot comes back calling it a Harvestusk.
  const old = Game.create(5);
  for (const c of [...old.creatures.list.values()]) old.creatures.list.delete(c.id);
  const tusk = old.creatures.spawn('seavic', old.player.x + 2, old.player.y, 'deed', old.rand, old.time - 3600 * 24 * 30);
  tusk.skills = { farming: AT2 };
  tusk.name = SPECIES.seavic.name;
  const back = await unpack(await packLand(old), packWorld(old));
  check(`a save holding a ${SPECIES.seavic.stages![1].name} still called ${SPECIES.seavic.name} comes back calling it a ${SPECIES.seavic.stages![1].name}`,
    back?.creatures.get(tusk.id)?.name === SPECIES.seavic.stages![1].name, back?.creatures.get(tusk.id)?.name);
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nwildermon evolve — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
