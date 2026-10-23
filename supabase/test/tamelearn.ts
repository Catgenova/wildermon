/**
 * A harder tame teaches more taming.
 *
 * Asked for: "Taming attempts on harder to tame wildermon should grant more experience". An attempt's gain is taken
 * once over and once more for every `TAME_HARD` taming the one tried needs (`tameLearn`, the island's `tame_learn`):
 * an offering, taken or refused, taking one out of a trap, and on the island the Beastmaster's Call of the Wild.
 *
 * Asks that `tame_hard()` is the browser's number; that the island's `tame_learn` is the browser's for every kind at
 * every stage; that each of the island's four gains is multiplied by it; and, in the browser, that an offering taken
 * by a Lume teaches what one taken by a Rabba does, by the two kinds' `tameLearn`.
 *
 * Runs against the database the suite leaves behind. The island's half is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { EVOLVE_AT, SPECIES, TAME_HARD, tameLearn, levelSkill } from '../../src/game/creatures';

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

/* ---- the island ------------------------------------------------------------ */

const KINDS = Object.values(SPECIES).filter((d) => !d.monster);
/** Each kind at each of its stages: the skill it evolves by, at what each stage asks. */
const AT = KINDS.flatMap((d) => {
  const skill = levelSkill(d);
  return [0, ...(skill && d.stages?.length ? EVOLVE_AT.slice(0, d.stages.length) : [])].map((v) => ({
    species: d.id, skills: skill && v ? { [skill]: v } : {},
  }));
});

const out = psql(`
begin;
create temp table said (k text, v text);
insert into said values ('HARD', tame_hard()::text);
do $$
declare w uuid; c int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Tamelearn', 182, 20, 10, 10, true) returning id into w;
${AT.map((a, i) => `  c := creature_spawn(w, '${a.species}', 5.5, 5.5, 'wild', now() - interval '30 days');
  update creature set skills = '${JSON.stringify(a.skills)}'::jsonb where world_id = w and id = c;
  insert into said select 'L${i}', tame_learn(cc)::text from creature cc where world_id = w and id = c;`).join('\n')}
end $$;
${['perform_creature', 'perform_trap', 'class_spell_cast'].map((fn) => `insert into said values ('F:${fn}', pg_get_functiondef('${fn}'::regproc));`).join('\n')}
select k || '=' || replace(v, E'\\n', ' ') from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) said.set(line.slice(0, at), line.slice(at + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';

check(`tame_hard() is the browser's ${TAME_HARD}`, Number(island('HARD')) === TAME_HARD, island('HARD'));
const off = AT.map((a, i) => ({ a, mine: tameLearn(a), theirs: Number(island(`L${i}`)) }))
  .filter((x) => !(Math.abs(x.mine - x.theirs) < 1e-9));
check(`tame_learn is the browser's tameLearn for every kind at every stage (${AT.length})`, !off.length,
  off.slice(0, 5).map((x) => `${x.a.species} ${JSON.stringify(x.a.skills)}: ${x.mine} vs ${x.theirs}`).join('; '));
const count = (s: string, sub: string): number => s.split(sub).length - 1;
check('an offering, taken or refused, teaches tame_gain() * tame_learn(c)',
  count(island('F:perform_creature'), "'taming', try_gain(true, tame_gain() * tame_learn(c))") === 1
  && count(island('F:perform_creature'), "'taming', try_gain(false, tame_gain() * tame_learn(c))") === 1);
check('taking one out of a trap teaches free_gain() * tame_learn(c)',
  count(island('F:perform_trap'), "'taming', try_gain(v_clean, free_gain() * tame_learn(c))") === 1);
check('the Call of the Wild teaches tame_gain() * tame_learn(c)',
  count(island('F:class_spell_cast'), "'taming', try_gain(true, tame_gain() * tame_learn(c))") === 1);
for (const fn of ['perform_creature', 'perform_trap', 'class_spell_cast']) {
  check(`${fn}: no taming gain left unscaled`, !/'taming', try_gain\([a-z_]+, (tame|free)_gain\(\)\)/.test(island(`F:${fn}`)));
}

/* ---- the browser ----------------------------------------------------------- */

/** Taming taught by an offering taken by one of a kind, at the same taming and the same roll. */
const taught = (species: string): { gain: number; tamed: boolean } => {
  const g = Game.create(4242);
  g.rand = () => 0;
  const at = 60;
  g.skills.values.set('taming', at);
  g.inventory.add(SPECIES[species].diet[0], { count: 5, ql: 30 });
  const c = g.creatures.spawn(species, g.player.x + 0.3, g.player.y, 'wild', g.rand, 0);
  ACTION_BY_ID.get('tame')!.perform({ kind: 'creature', id: c.id }, g);
  return { gain: g.skills.get('taming') - at, tamed: c.mode !== 'wild' };
};
const easy = taught('rabba');
const hard = taught('lume');
const want = tameLearn({ species: 'lume', skills: {} }) / tameLearn({ species: 'rabba', skills: {} });
check(`in the browser, a Lume taken teaches ×${want.toFixed(3)} what a Rabba does`,
  easy.tamed && hard.tamed && Math.abs(hard.gain / easy.gain - want) < 1e-6, `${hard.gain} / ${easy.gain}`);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`a harder tame teaches more — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
