/**
 * A dressing goes on the worst wound it would do good.
 *
 * Reported: "Bandages don't seem to want to dress a wound if any of your
 * wounds have gone bad, or at least maybe it prioritizes dressing certain body
 * parts." Both. A dressing went on the worst wound, and the worst wound counts
 * one gone bad a whole life worse than any other, so with one on you it was
 * always the one picked; nothing holds on a wound gone bad, so the dressing
 * was refused, and a bleeding cut beside it went undressed. And a second
 * dressing went over the first whatever the two were, so cloth would take the
 * herb that suited a wound off it.
 *
 * So the same bodies are put to both sides. A bite to the leg gone bad and a
 * deep cut to the arm still bleeding: may a bandage go on, which wound it went
 * on, what it left the bite as, and what it said; the bite all that is left,
 * and what the refusal says. A cut under the herb that suits it with only
 * cloth in the pack: refused, in the same words, and with a bruise beside it
 * the cloth goes on the bruise. A cut under cloth with a thyme cover in the
 * pack: the cover goes over the cloth. The dressings rank by one number on
 * each side, and the two are held to it; and the pickers are asked the same
 * lists, somebody else's wounds included.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { DRESSED_AS_WELL, dressRefusal } from '../../src/game/firstaid';
import { Game } from '../../src/game/game';
import { dressingPace, woundToDress, type Wound } from '../../src/game/wounds';

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

const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
/** Whoever else is on Hoarding, the first of them: somebody for Dane to dress. */
const OTHER = `(select uid from player where world_id = ${W} and uid <> ${DANE} order by uid limit 1)`;

/** A bite to the leg gone bad, the worst thing on him, and a deep cut to the arm still bleeding, deep enough that one dressing does not close it. */
const BITE: Wound = { id: 1, kind: 'bite', part: 'legs', severity: 0.3, bleeding: false, infected: true, dressing: null, at: 0 };
const CUT: Wound = { id: 2, kind: 'cut', part: 'arms', severity: 0.6, bleeding: true, infected: false, dressing: null, at: 0 };
/** The cut under the herb that suits it, under cloth, and under the wrong herb. */
const CUT_THYME: Wound = { ...CUT, bleeding: false, dressing: 'thyme' };
const CUT_CLOTH: Wound = { ...CUT, bleeding: false, dressing: '' };
const CUT_SAGE: Wound = { ...CUT, bleeding: false, dressing: 'sage' };
/** A bruise to the chest with nothing on it, deep enough that one dressing does not close it either. */
const BRUISE: Wound = { id: 3, kind: 'crush', part: 'chest', severity: 0.5, bleeding: false, infected: false, dressing: null, at: 0 };
/** What is in the pack: bandages, or covers of one herb. */
type Pack = 'bandage' | 'thyme' | 'sage';

const jsonSql = (m: unknown): string => `'${JSON.stringify(m).replace(/'/g, "''")}'::jsonb`;
const read = (ws: Wound[]): string => ws.map((w) => `${w.id}:${w.infected ? 'bad' : w.bleeding ? 'bleeding' : `dressed ${JSON.stringify(w.dressing)}`}`).join(',');
/** The island's wounds on somebody, read the way `read` reads the browser's. */
const theirs = (who: string): string => `(select coalesce(string_agg((wd->>'id') || ':' || case when (wd->>'infected')::boolean then 'bad'
    when (wd->>'bleeding')::boolean then 'bleeding' else 'dressed ' || coalesce(wd->'dressing', 'null'::jsonb)::text end, ',' order by (wd->>'id')::int), '')
  from player p, jsonb_array_elements(p.wounds) t(wd) where p.world_id = ${W} and p.uid = ${who})`;
/** Somebody with these wounds on them, settled to this moment so none turns while they are asked. */
const SET_WOUNDS = (who: string, wounds: Wound[]): string => `
  update player set wounds = ${jsonSql(wounds)}, act = null, act_target = null, act_queue = '[]',
      stats = jsonb_set(jsonb_set(coalesce(stats, '{}'::jsonb), '{health}', '0.5'), '{hurtSettled}', to_jsonb(now()))
    where world_id = ${W} and uid = ${who};`;
/** Dane with these wounds on him, nothing in his pack to dress with but `pack`, first aid at 100 and nothing said yet. */
const SET_DANE = (wounds: Wound[], pack: Pack = 'bandage'): string => `
  ${SET_WOUNDS(DANE, wounds)}
  delete from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def in ('bandage', 'cover');
  insert into item (world_id, holder, holder_uid, def, ql, count, extra)
    values (${W}, 'player', ${DANE}, ${pack === 'bandage' ? "'bandage'" : "'cover'"}, 50, 5, ${pack === 'bandage' ? 'null' : `'${pack}'`});
  insert into skill (world_id, uid, id, value) values (${W}, ${DANE}, 'first_aid', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  delete from event where world_id = ${W} and uid = ${DANE};`;

/* ---- the ranking: one number a side, the same numbers ---- */
for (const dressing of [null, '', 'thyme', 'sage']) {
  const mine = dressingPace(CUT, dressing);
  const isle = Number(psql(`select dressing_pace(${jsonSql(CUT)}, ${dressing === null ? 'null' : `'${dressing}'`})`));
  check(`a cut under ${dressing === null ? 'nothing' : dressing === '' ? 'cloth' : dressing} ranks the same on both sides`, mine === isle, `browser ${mine}, island ${isle}`);
}

/* ---- the pickers, on the same lists and the same packs ---- */
const lists: [string, Wound[], Pack, string][] = [
  ['a bite gone bad and a cut bleeding', [BITE, CUT], 'bandage', '2'],
  ['the cut first in the list', [CUT, BITE], 'bandage', '2'],
  ['a bruise under cloth beside them', [BITE, CUT, { ...BRUISE, severity: 0.4, dressing: '' }], 'bandage', '2'],
  ['nothing but the bite', [BITE], 'bandage', 'none'],
  ['nothing at all', [], 'bandage', 'none'],
  ['a cut under thyme and cloth in the pack', [CUT_THYME], 'bandage', 'none'],
  ['a cut under thyme and a bruise, cloth in the pack', [CUT_THYME, BRUISE], 'bandage', '3'],
  ['a cut under cloth and cloth in the pack', [CUT_CLOTH], 'bandage', 'none'],
  ['a cut under cloth and thyme in the pack', [CUT_CLOTH], 'thyme', '2'],
  ['a cut under cloth and the wrong herb in the pack', [CUT_CLOTH], 'sage', '2'],
  ['a cut under the wrong herb and cloth in the pack', [CUT_SAGE], 'bandage', 'none'],
  ['a cut under the wrong herb and the wrong herb in the pack', [CUT_SAGE], 'sage', 'none'],
  ['a cut under the wrong herb and thyme in the pack', [CUT_SAGE], 'thyme', '2'],
];
for (const [what, ws, pack, want] of lists) {
  const mine = String(woundToDress(ws, () => (pack === 'bandage' ? '' : pack))?.id ?? 'none');
  const isle = psql(`do $$ begin ${SET_DANE([], pack)} end $$;
    select coalesce(wound_to_dress(${W}, ${DANE}, ${jsonSql(ws)})->>'id', 'none');`);
  check(`a dressing picks the same wound on both sides: ${what}`, mine === want && isle === want, `browser ${mine}, island ${isle}, wanted ${want}`);
}

/* ---- Dane, in a game of his own and on the island ---- */
const game = Game.create(4242);
game.skills.values.set('first_aid', 100);
const def = ACTION_BY_ID.get('bind_wound');
if (!def) throw new Error('there is no bind_wound any more');
const said: string[] = [];
game.logMsg = ((text: string) => { said.push(text); }) as Game['logMsg'];
// A clean dressing in the browser, so its sentence is the one the island says when it goes on cleanly.
game.rand = () => 0.01;
/** The browser's Dane with these wounds and this pack, and the dressing to right-click. */
const browserDane = (wounds: Wound[], pack: Pack = 'bandage'): { kind: 'item'; uid: number } => {
  for (const it of game.inventory.items.filter((i) => i.id === 'bandage' || i.id === 'cover')) game.inventory.remove(it.uid, it.count);
  game.player.stats.health = 0.5;
  game.player.wounds = wounds.map((w) => ({ ...w }));
  const it = pack === 'bandage' ? game.inventory.add('bandage', { ql: 50, count: 5 }) : game.inventory.add('cover', { ql: 50, count: 5, extra: pack });
  return { kind: 'item', uid: it.uid };
};
/** May Dane dress himself, asked of both sides. */
const asked = (wounds: Wound[], pack: Pack = 'bandage'): [string, string] => [
  def.check?.(browserDane(wounds, pack), game) ?? 'ALLOWED',
  psql(`do $$ begin ${SET_DANE(wounds, pack)} end $$;
    select coalesce(act_refusal(${W}, ${DANE}, 'bind_wound', '{"kind":"item"}'), 'ALLOWED');`),
];
/** Dane dresses himself on both sides: whether the browser would go again, what each said, and what each left on him. */
const dressed = (wounds: Wound[], pack: Pack = 'bandage') => {
  const target = browserDane(wounds, pack);
  const label = def.labelFor?.(target, game) ?? '';
  const again = !!def.perform?.(target, game);
  // The island's dice are its own: asked until one goes on cleanly, from the same start each time.
  const line = psql(`do $$
  begin
    for i in 1..40 loop
      ${SET_DANE(wounds, pack)}
      perform act_perform(${W}, ${DANE}, 'bind_wound', '{"kind":"item"}');
      exit when not exists (select 1 from event where world_id = ${W} and uid = ${DANE} and text like 'The dressing slips%');
    end loop;
  end $$;
  select text from event where world_id = ${W} and uid = ${DANE} order by n desc limit 1;`);
  return { label, again, mine: said[said.length - 1], line, left: read(game.player.wounds), theirsLeft: psql(`select ${theirs(DANE)}`) };
};

/* A bite gone bad and a cut bleeding. */
{
  const [mine, isle] = asked([BITE, CUT]);
  check('a bandage goes on with a wound gone bad on you', mine === 'ALLOWED' && isle === 'ALLOWED', `browser "${mine}", island "${isle}"`);
  const d = dressed([BITE, CUT]);
  check('and the menu names the wound it will go on', d.label === 'Dress the cut on your arm', d.label);
  check('it went on the cut and left the bite as it was, on both sides',
    d.left === '1:bad,2:dressed ""' && d.theirsLeft === d.left, `browser ${d.left}, island ${d.theirsLeft}`);
  check('and both say which wound, in the same sentence',
    d.mine === d.line && d.line === 'Dressed: the cut on your arm, cloth. Bleeding stopped; heals slowly.',
    `browser "${d.mine}", island "${d.line}"`);
  check('and the browser does not go again: the cut is under cloth and the bite has gone bad', !d.again);
}

/* The bite all that is left. */
{
  const [mine, isle] = asked([BITE]);
  check('with only the bite left, it is refused, and says which and why, in the same words',
    mine === 'The bite on your leg: infected. Clean it with lye first.' && isle === mine,
    `browser "${mine}", island "${isle}"`);
}

/* The bite all that is left, and nothing in the pack at all: the lye is what wants doing first, and both say so. */
{
  browserDane([BITE]);
  for (const it of game.inventory.items.filter((i) => i.id === 'bandage' || i.id === 'cover')) game.inventory.remove(it.uid, it.count);
  const mine = dressRefusal(game) ?? 'ALLOWED';
  const isle = psql(`do $$ begin ${SET_DANE([BITE])}
      delete from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def in ('bandage', 'cover'); end $$;
    select coalesce(act_refusal(${W}, ${DANE}, 'bind_wound', '{"kind":"item"}'), 'ALLOWED');`);
  check('with only the bite and no dressings, the refusal still names the bite, the same on both sides',
    mine === 'The bite on your leg: infected. Clean it with lye first.' && isle === mine, `browser "${mine}", island "${isle}"`);
  browserDane([CUT]);
  for (const it of game.inventory.items.filter((i) => i.id === 'bandage' || i.id === 'cover')) game.inventory.remove(it.uid, it.count);
  const none = dressRefusal(game) ?? 'ALLOWED';
  const noneIsle = psql(`do $$ begin ${SET_DANE([CUT])}
      delete from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def in ('bandage', 'cover'); end $$;
    select coalesce(act_refusal(${W}, ${DANE}, 'bind_wound', '{"kind":"item"}'), 'ALLOWED');`);
  check('and with a cut and no dressings, it says there is nothing to dress it with, the same on both sides',
    none === 'Nothing to dress it with.' && noneIsle === none, `browser "${none}", island "${noneIsle}"`);
}

/* A cover is not replaced by cloth. */
{
  const [mine, isle] = asked([CUT_THYME]);
  check('cloth does not go over the herb that suits the wound, and both sides say why in the same words',
    mine === DRESSED_AS_WELL && isle === mine, `browser "${mine}", island "${isle}"`);
  const [clothMine, clothIsle] = asked([CUT_CLOTH]);
  check('nor over cloth', clothMine === DRESSED_AS_WELL && clothIsle === clothMine, `browser "${clothMine}", island "${clothIsle}"`);
  const d = dressed([CUT_THYME, BRUISE]);
  check('with a bruise beside it, the cloth goes on the bruise and the thyme stays on the cut, on both sides',
    d.left === '2:dressed "thyme",3:dressed ""' && d.theirsLeft === d.left && d.label === 'Dress the bruise on your chest',
    `browser ${d.left} (${d.label}), island ${d.theirsLeft}`);
  check('and the browser does not go again after it', !d.again);
  const [both, bothIsle] = asked([CUT_THYME, BITE]);
  check('a cut under thyme and a bite gone bad: the refusal names the bite, the same on both sides',
    both === 'The bite on your leg: infected. Clean it with lye first.' && bothIsle === both,
    `browser "${both}", island "${bothIsle}"`);
}

/* Cloth upgrades to a cover. */
{
  const [mine, isle] = asked([CUT_CLOTH], 'thyme');
  check('a thyme cover goes over cloth', mine === 'ALLOWED' && isle === 'ALLOWED', `browser "${mine}", island "${isle}"`);
  const d = dressed([CUT_CLOTH], 'thyme');
  check('and it is on the cut afterwards, on both sides', d.left === '2:dressed "thyme"' && d.theirsLeft === d.left, `browser ${d.left}, island ${d.theirsLeft}`);
  check('and both say so in the same sentence',
    d.mine === d.line && d.line === 'Dressed: the cut on your arm, thyme cover. Bleeding stopped; heals fast.',
    `browser "${d.mine}", island "${d.line}"`);
  const [sage, sageIsle] = asked([CUT_SAGE], 'thyme');
  check('and over the wrong herb', sage === 'ALLOWED' && sageIsle === 'ALLOWED', `browser "${sage}", island "${sageIsle}"`);
}

/* Somebody else. */
const otherDressed = (wounds: Wound[], pack: Pack = 'bandage'): string => psql(`do $$
declare me player;
begin
  ${SET_DANE([], pack)}
  select * into me from player where world_id = ${W} and uid = ${DANE};
  update player set x = me.x + 1, y = me.y where world_id = ${W} and uid = ${OTHER};
  ${SET_WOUNDS(OTHER, wounds)}
  drop table if exists dress_said;
  create temp table dress_said as
    select coalesce(act_refusal(${W}, ${DANE}, 'bind_wound', jsonb_build_object('kind', 'person', 'uid', ${OTHER})), 'ALLOWED') as why;
  perform act_perform(${W}, ${DANE}, 'bind_wound', jsonb_build_object('kind', 'person', 'uid', ${OTHER}));
end $$;
select why || ' | ' || ${theirs(OTHER)} from dress_said;`);
{
  const got = otherDressed([BITE, CUT]);
  check('somebody else with a wound gone bad is dressed too, on the cut', /^ALLOWED \| 1:bad,2:(dressed ""|bleeding)$/.test(got), got);
  const name = psql(`select coalesce(name, 'them') from player where world_id = ${W} and uid = ${OTHER}`);
  const thyme = otherDressed([CUT_THYME]);
  check('and cloth does not go over thyme on them either, and says why',
    thyme === `Every uninfected wound on ${name} is already dressed as well or better. `
      + `A dressing only replaces one that heals slower. | 2:dressed "thyme"`, thyme);
  const up = otherDressed([CUT_CLOTH], 'thyme');
  check('and a thyme cover goes over cloth on them', /^ALLOWED \| 2:dressed "(thyme|)"$/.test(up), up);
  // A person's uid is a uuid, and `target_item` cast it to a number. With `item` read by its primary key that cast is
  // made first, and dressing somebody else was an error; which index the planner took was a matter of the statistics.
  const keyed = psql(`begin;
    drop index item_creature;
    do $$ begin ${SET_WOUNDS(OTHER, [CUT])} end $$;
    select coalesce(act_refusal(${W}, ${DANE}, 'bind_wound', jsonb_build_object('kind', 'person', 'uid', ${OTHER})), 'ALLOWED')
      || ' | ' || coalesce(target_item(jsonb_build_object('kind', 'person', 'uid', ${OTHER}))::text, 'no item')
      || ' | ' || target_item('{"kind":"item","uid":42}');
    rollback;`);
  check('and asking about somebody else never casts their uid to an item, whichever way the items are read',
    keyed === 'ALLOWED | no item | 42', keyed);
}

// And everybody on Hoarding put back whole, with nothing of this left in Dane's pack, for whatever runs next.
psql(`update player set wounds = '[]'::jsonb, stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{health}', '1')
    where world_id = ${W} and (uid = ${DANE} or uid = ${OTHER});
  delete from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def in ('bandage', 'cover');
  delete from event where world_id = ${W} and uid = ${DANE};`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a dressing goes on the worst wound it would do good, the same on both sides — ${ok.length} of ${ok.length}`);
