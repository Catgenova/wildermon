/**
 * A Healer's poultice: first aid with a life mote, on the island
 * (`20261103110002_healers_poultice.sql`) and in the browser's rulebook
 * (`firstaid.ts`), held together.
 *
 * What this asks, of the same body on both sides -- a deep cut bleeding (deep
 * enough that a poultice does not close it by its heal alone), a
 * bite gone bad, a burn bleeding and a light bruise, first aid at 100 and a
 * bandage at QL 50:
 *
 *   * Dress a wound with a life mote heals ×`POULTICE_HEAL` what Dress a wound
 *     does at the same skill, cloth and roll, closes one more wound -- the
 *     burn, the next worst past the cut it dresses, never the bite gone bad --
 *     and uses one life mote; the plain dressing uses none; both say so in
 *     the same words;
 *   * a dressing with a life mote that slips keeps the mote, closes nothing
 *     more and says so in the same words;
 *   * without a life mote the entry is refused, in the same words, on you and
 *     on a wildermon; with one it is refused as the dressing would be;
 *   * on somebody else beside you (the island's alone to do) the heal is ×2,
 *     their next worst wound is closed, and both of you are told;
 *   * on a wildermon (no wounds to close) Treat its wounds with a life mote
 *     heals ×2 and uses one, on both sides;
 *   * the entries take the dressing's and the treatment's time, never repeat,
 *     are sped by the same perks, and the life mote's description, the same
 *     on both sides, names them and the ×2.
 *
 * Every roll is pinned: the browser's `rand`, the island's `setseed`. Runs
 * against the database the suite leaves behind (Hoarding, and Dane on it),
 * each island half in a transaction rolled back.
 */
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { POULTICE_KEPT, poulticeSays } from '../../src/game/firstaid';
import { Game } from '../../src/game/game';
import { itemDef } from '../../src/game/items';
import { LIFE_MOTE, LIFE_MOTE_NEED, POULTICE_HEAL } from '../../src/game/motes';
import { PERK_BY_ID } from '../../src/game/perks';
import { maxHealth, SPECIES } from '../../src/game/creatures';
import type { Wound } from '../../src/game/wounds';
import { psql, ok, bad, check } from './harness';

const near = (a: number, b: number, by = 1e-9): boolean => Math.abs(a - b) <= by;

const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
/** Whoever else is on Hoarding, the first of them: somebody for Dane to dress. */
const OTHER = `(select uid from player where world_id = ${W} and uid <> ${DANE} order by uid limit 1)`;

/**
 * The body: a deep cut to the arm bleeding (what a dressing goes on), a bite to the leg gone bad (the worst, which no
 * dressing takes and no poultice closes), a burn to the chest bleeding (the next worst: what a poultice closes) and a
 * light bruise to the head.
 */
const CUT: Wound = { id: 1, kind: 'cut', part: 'arms', severity: 0.9, bleeding: true, infected: false, dressing: null, at: 0 };
const BITE: Wound = { id: 2, kind: 'bite', part: 'legs', severity: 0.3, bleeding: false, infected: true, dressing: null, at: 1 };
const BURN: Wound = { id: 3, kind: 'burn', part: 'chest', severity: 0.2, bleeding: true, infected: false, dressing: null, at: 2 };
const BRUISE: Wound = { id: 4, kind: 'crush', part: 'head', severity: 0.05, bleeding: false, infected: false, dressing: null, at: 3 };
const BODY = [CUT, BITE, BURN, BRUISE];
const HEALTH = 0.2;
const QL = 50;

const jsonSql = (m: unknown): string => `'${JSON.stringify(m).replace(/'/g, "''")}'::jsonb`;
/** What is left on a body: each wound's id and whether it is dressed, bad or open. */
const read = (ws: Wound[]): string => ws.map((w) => `${w.id}:${w.infected ? 'bad' : w.dressing !== null ? 'dressed' : 'open'}`).sort().join(',');
const theirs = (who: string): string => `(select coalesce(string_agg((wd->>'id') || ':' || case when (wd->>'infected')::boolean then 'bad'
    when wd->>'dressing' is not null then 'dressed' else 'open' end, ',' order by wd->>'id'), '')
  from player p, jsonb_array_elements(p.wounds) t(wd) where p.world_id = ${W} and p.uid = ${who})`;
/** Somebody with these wounds and this much health, settled to this moment so nothing turns while they are asked. */
const SET_WOUNDS = (who: string, wounds: Wound[]): string => `
  update player set wounds = ${jsonSql(wounds)}, act = null, act_target = null, act_queue = '[]', blessings = '{}'::jsonb,
      body_at = now(), stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('health', ${HEALTH}, 'hunger', 1, 'thirst', 1, 'stamina', 1,
        'hurtSettled', now())
    where world_id = ${W} and uid = ${who};`;
/** Dane with these wounds, bandages at QL 50, this many life motes, first aid at `skill`, no trade, nothing said yet. */
const SET_DANE = (wounds: Wound[], motes: number, skill = 100): string => `
  ${SET_WOUNDS(DANE, wounds)}
  update player set class_mul = null, craft_class = null, combat_class = null where world_id = ${W} and uid = ${DANE};
  delete from item i where i.world_id = ${W} and i.holder = 'player' and i.holder_uid = ${DANE} and i.def in ('bandage', 'cover', 'life_mote');
  insert into item (world_id, holder, holder_uid, def, ql, count) values (${W}, 'player', ${DANE}, 'bandage', ${QL}, 5);
  ${motes ? `insert into item (world_id, holder, holder_uid, def, ql, count) values (${W}, 'player', ${DANE}, 'life_mote', ${QL}, ${motes});` : ''}
  insert into skill (world_id, uid, id, value) values (${W}, ${DANE}, 'first_aid', ${skill})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  delete from event where world_id = ${W} and uid in (${DANE}, ${OTHER});`;
/** What Dane carries of life motes, and the last thing he was told. */
const MOTES = `pack_count(${W}, ${DANE}, 'life_mote')`;
const LAST = (who: string): string => `coalesce((select text from event where world_id = ${W} and uid = ${who} order by n desc limit 1), '')`;

const BIND = ACTION_BY_ID.get('bind_wound');
const POULTICE = ACTION_BY_ID.get('dress_poultice');
const TREAT = ACTION_BY_ID.get('treat_creature');
const TREAT_P = ACTION_BY_ID.get('treat_poultice');
if (!BIND || !POULTICE || !TREAT || !TREAT_P) throw new Error('no dressing, treatment or poultice');

/* ---- the browser's Dane ---- */
const game = Game.create(4242);
game.skills.values.set('first_aid', 100);
const said: string[] = [];
game.logMsg = ((text: string) => { said.push(text); }) as Game['logMsg'];
/** The browser's Dane with the body, bandages and this many life motes, and the bandage to right-click. */
const browserDane = (motes: number, wounds: Wound[] = BODY): Target => {
  for (const it of game.inventory.items.filter((i) => ['bandage', 'cover', LIFE_MOTE].includes(i.id))) game.inventory.remove(it.uid, it.count);
  game.player.stats.health = HEALTH;
  game.player.wounds = wounds.map((w) => ({ ...w }));
  if (motes) game.inventory.add(LIFE_MOTE, { ql: QL, count: motes });
  return { kind: 'item', uid: game.inventory.add('bandage', { ql: QL, count: 5 }).uid };
};
/** One go in the browser at this roll: health back, what is left on him, motes left, what it said, whether it goes again. */
const browserGo = (def: typeof BIND, roll: number) => {
  const t = browserDane(2);
  game.rand = () => roll;
  const label = def.labelFor?.(t, game) ?? def.label;
  const again = !!def.perform(t, game);
  return { label, again, gain: game.player.stats.health - HEALTH, left: read(game.player.wounds), motes: game.inventory.count(LIFE_MOTE), line: said[said.length - 1] };
};

/* ---- the island's Dane: one go from a seed, rolled back ---- */
const islandGo = (action: string, seed: number, skill = 100): { gain: number; left: string; motes: number; line: string } => {
  const [gain, left, motes, line] = psql(`begin;
    do $$ begin ${SET_DANE(BODY, 2, skill)} end $$;
    select setseed(${seed});
    do $$ begin perform act_perform(${W}, ${DANE}, '${action}', '{"kind":"item"}'); end $$;
    select ((stats->>'health')::double precision - ${HEALTH}) || '¦' || ${theirs(DANE)} || '¦' || ${MOTES} || '¦' || ${LAST(DANE)}
      from player where world_id = ${W} and uid = ${DANE};
    rollback;`).split('¦');
  return { gain: Number(gain), left, motes: Number(motes), line };
};

/* ---- A dressing that takes, with a life mote and without ---- */
{
  const plain = browserGo(BIND, 0.01);
  const mote = browserGo(POULTICE, 0.01);
  check('browser: the entry names the wound and the mote',
    mote.label === 'Dress the cut on your arm with a life mote' && plain.label === 'Dress the cut on your arm', `${plain.label} / ${mote.label}`);
  check(`browser: a dressing with a life mote heals ×${POULTICE_HEAL} what one without does at the same skill, cloth and roll`,
    plain.gain > 0 && near(mote.gain, plain.gain * POULTICE_HEAL), `${plain.gain} / ${mote.gain}`);
  check('browser: and closes one more wound, the burn (next worst past the cut), never the bite gone bad',
    plain.left === '1:dressed,2:bad,3:open,4:open' && mote.left === '1:dressed,2:bad,4:open', `${plain.left} / ${mote.left}`);
  check('browser: the poultice uses one life mote and the dressing none', plain.motes === 2 && mote.motes === 1, `${plain.motes} / ${mote.motes}`);
  check('browser: the dressing repeats, the poultice never does', plain.again && !mote.again);

  const isle = islandGo('bind_wound', 0.37);
  const islePoultice = islandGo('dress_poultice', 0.37);
  check('island: the dressing at that seed took', !isle.line.startsWith('Dressing failed'), isle.line);
  check(`island: a dressing with a life mote heals ×${POULTICE_HEAL} what one without does, from the same seed`,
    isle.gain > 0 && near(islePoultice.gain, isle.gain * POULTICE_HEAL), `${isle.gain} / ${islePoultice.gain}`);
  check('island: and closes one more wound, the burn, never the bite gone bad',
    isle.left === '1:dressed,2:bad,3:open,4:open' && islePoultice.left === '1:dressed,2:bad,4:open', `${isle.left} / ${islePoultice.left}`);
  check('island: the poultice uses one life mote and the dressing none', isle.motes === 2 && islePoultice.motes === 1, `${isle.motes} / ${islePoultice.motes}`);
  check('both sides heal the same, with the mote and without', near(isle.gain, plain.gain) && near(islePoultice.gain, mote.gain), `${plain.gain}, ${mote.gain} / ${isle.gain}, ${islePoultice.gain}`);
  check('both sides leave the same wounds', isle.left === plain.left && islePoultice.left === mote.left);
  const want = `Dressed: the cut on your arm, cloth. Bleeding stopped; heals slowly.${poulticeSays('the burn on your chest')}`;
  check('both say what it did, in the same words', mote.line === want && islePoultice.line === want && isle.line === plain.line,
    `browser "${mote.line}", island "${islePoultice.line}"`);
}

/* ---- A dressing with a life mote that slips: the mote kept, nothing more closed ---- */
{
  game.skills.values.set('first_aid', 0);
  const mote = browserGo(POULTICE, 0.99);
  game.skills.values.set('first_aid', 100);
  check('browser: a poultice that slips keeps the mote and closes nothing more',
    mote.motes === 2 && mote.left === '1:open,2:bad,3:open,4:open' && mote.line.endsWith(` ${POULTICE_KEPT}`), `${mote.motes} ${mote.left} "${mote.line}"`);
  // The island's dice from seeds a step apart, the first that slips.
  const [seed, gain, left, motes, line] = psql(`begin;
    do $$
    declare s int;
    begin
      for s in 1..200 loop
        ${SET_DANE(BODY, 2, 0)}
        perform setseed(s / 201.0);
        perform act_perform(${W}, ${DANE}, 'dress_poultice', '{"kind":"item"}');
        if ${LAST(DANE)} like 'Dressing failed:%' then
          perform set_config('poultice.seed', s::text, true);
          exit;
        end if;
      end loop;
    end $$;
    select current_setting('poultice.seed', true) || '¦' || ((stats->>'health')::double precision - ${HEALTH}) || '¦' || ${theirs(DANE)} || '¦' || ${MOTES} || '¦' || ${LAST(DANE)}
      from player where world_id = ${W} and uid = ${DANE};
    rollback;`).split('¦');
  check('island: a poultice that slips keeps the mote and closes nothing more',
    seed !== '' && Number(motes) === 2 && left === '1:open,2:bad,3:open,4:open', `seed ${seed}: ${motes} ${left}`);
  check('and both say so in the same words', line === mote.line && line.startsWith('Dressing failed: a deep cut to the arm, bleeding remains.'),
    `browser "${mote.line}", island "${line}"`);
  check('and heal the same as a plain slipped dressing', near(Number(gain), mote.gain), `${mote.gain} / ${gain}`);
}

/* ---- Refused without a life mote; with one, as the dressing is ---- */
{
  const target = browserDane(0);
  const mine = POULTICE.check?.(target, game) ?? 'ALLOWED';
  const isle = psql(`begin; do $$ begin ${SET_DANE(BODY, 0)} end $$;
    select coalesce(act_refusal(${W}, ${DANE}, 'dress_poultice', '{"kind":"item"}'), 'ALLOWED'); rollback;`);
  check('without a life mote the entry is refused, in the same words on both sides', mine === LIFE_MOTE_NEED && isle === mine, `browser "${mine}", island "${isle}"`);
  check('and the browser does not offer it', !POULTICE.applies(target, game));
  const asked = browserDane(1);
  const allowed = POULTICE.check?.(asked, game) ?? 'ALLOWED';
  const isleAllowed = psql(`begin; do $$ begin ${SET_DANE(BODY, 1)} end $$;
    select coalesce(act_refusal(${W}, ${DANE}, 'dress_poultice', '{"kind":"item"}'), 'ALLOWED'); rollback;`);
  check('with one, it is allowed on both sides, and offered from the bandage and from the mote',
    allowed === 'ALLOWED' && isleAllowed === 'ALLOWED' && POULTICE.applies(asked, game)
      && POULTICE.applies({ kind: 'item', uid: game.inventory.find(LIFE_MOTE)!.uid }, game), `browser "${allowed}", island "${isleAllowed}"`);
  const unhurt = browserDane(1, []);
  game.player.stats.health = 1;
  const whole = POULTICE.check?.(unhurt, game) ?? 'ALLOWED';
  const isleWhole = psql(`begin; do $$ begin ${SET_DANE([], 1)}
      update player set stats = jsonb_set(stats, '{health}', '1') where world_id = ${W} and uid = ${DANE}; end $$;
    select coalesce(act_refusal(${W}, ${DANE}, 'dress_poultice', '{"kind":"item"}'), 'ALLOWED'); rollback;`);
  check('and with nothing to dress it is refused as the dressing is, in the same words', whole === 'Not hurt.' && isleWhole === whole,
    `browser "${whole}", island "${isleWhole}"`);
}

/* ---- Somebody else beside you: the island's to do ---- */
{
  const go = (action: string): string[] => psql(`begin;
    do $$
    declare me player;
    begin
      ${SET_DANE([], 2)}
      select * into me from player where world_id = ${W} and uid = ${DANE};
      update player set body_at = now(), x = me.x + 1, y = me.y where world_id = ${W} and uid = ${OTHER};
      ${SET_WOUNDS(OTHER, BODY)}
      perform setseed(0.37);
      perform act_perform(${W}, ${DANE}, '${action}', jsonb_build_object('kind', 'person', 'uid', ${OTHER}));
    end $$;
    select ((stats->>'health')::double precision - ${HEALTH}) || '¦' || ${theirs(OTHER)} || '¦' || ${MOTES} || '¦' || ${LAST(DANE)} || '¦' || ${LAST(OTHER)}
      || '¦' || coalesce(name, 'their')
      from player where world_id = ${W} and uid = ${OTHER};
    rollback;`).split('¦');
  const [g0, left0] = go('bind_wound');
  const [g1, left1, motes, mine, theirsSaid, name] = go('dress_poultice');
  check(`on somebody else: ×${POULTICE_HEAL} the heal, the burn closed, one mote used`,
    Number(g0) > 0 && near(Number(g1), Number(g0) * POULTICE_HEAL) && left0 === '1:dressed,2:bad,3:open,4:open' && left1 === '1:dressed,2:bad,4:open' && motes === '1',
    `${g0} / ${g1}, ${left0} / ${left1}, ${motes}`);
  check('and both of you are told',
    mine === `Dressed: cut on ${name}'s arm, cloth.${poulticeSays(`the burn on ${name}'s chest`)}`
      && theirsSaid === `Dane dressed the cut on your arm.${poulticeSays('the burn on your chest')}`, `"${mine}" / "${theirsSaid}"`);
}

/* ---- A wildermon: no wounds to close, the heal ×2 ---- */
{
  // The browser's: a tame rabba beside him at a fifth of its health.
  const c = game.creatures.spawn('rabba', game.player.x + 1, game.player.y, 'active', () => 0.5, game.time - 3600 * 24 * 30);
  const top = maxHealth(c, SPECIES[c.species]);
  const treat = (def: typeof TREAT): { gain: number; motes: number; line: string } => {
    browserDane(2);
    c.health = top / 5;
    game.rand = () => 0.01;
    def.perform({ kind: 'creature', id: c.id }, game);
    return { gain: (c.health - top / 5) / top, motes: game.inventory.count(LIFE_MOTE), line: said[said.length - 1] };
  };
  const plain = treat(TREAT);
  const mote = treat(TREAT_P);
  check(`browser: Treat its wounds with a life mote heals ×${POULTICE_HEAL} and uses one`,
    plain.gain > 0 && near(mote.gain, plain.gain * POULTICE_HEAL) && plain.motes === 2 && mote.motes === 1 && mote.line.endsWith(poulticeSays(null)),
    `${plain.gain} / ${mote.gain}, "${mote.line}"`);
  browserDane(0);
  const mine = TREAT_P.check?.({ kind: 'creature', id: c.id }, game) ?? 'ALLOWED';

  const go = (action: string, motes: number): string[] => psql(`begin;
    do $$
    declare me player; v_id int;
    begin
      ${SET_DANE([], motes)}
      select * into me from player where world_id = ${W} and uid = ${DANE};
      v_id := creature_spawn(${W}, 'rabba', me.x + 1, me.y, 'active', now() - interval '30 days', ${DANE});
      update creature set health = max_health(creature) / 5, settled_at = now() where world_id = ${W} and id = v_id;
      perform set_config('poultice.creature', v_id::text, true);
      perform set_config('poultice.why', coalesce(act_refusal(${W}, ${DANE}, '${action}', jsonb_build_object('kind', 'creature', 'id', v_id)), 'ALLOWED'), true);
      if current_setting('poultice.why') = 'ALLOWED' then
        perform setseed(0.37);
        perform act_perform(${W}, ${DANE}, '${action}', jsonb_build_object('kind', 'creature', 'id', v_id));
      end if;
    end $$;
    select ((health - max_health(creature) / 5) / max_health(creature)) || '¦' || ${MOTES} || '¦' || ${LAST(DANE)} || '¦' || current_setting('poultice.why')
      from creature where world_id = ${W} and id = current_setting('poultice.creature')::int;
    rollback;`).split('¦');
  const [g0, m0, , why0] = go('treat_creature', 2);
  const [g1, m1, line1] = go('treat_poultice', 2);
  const [, , , isleWhy] = go('treat_poultice', 0);
  check(`island: Treat its wounds with a life mote heals ×${POULTICE_HEAL} and uses one`,
    why0 === 'ALLOWED' && Number(g0) > 0 && near(Number(g1), Number(g0) * POULTICE_HEAL, 1e-6) && m0 === '2' && m1 === '1' && line1.endsWith(poulticeSays(null)),
    `${why0}: ${g0} / ${g1}, ${m0} / ${m1}, "${line1}"`);
  check('and both sides heal the same share of its health', near(Number(g0), plain.gain, 1e-6) && near(Number(g1), mote.gain, 1e-6), `${plain.gain}, ${mote.gain} / ${g0}, ${g1}`);
  check('without a life mote it is refused, in the same words on both sides', mine === LIFE_MOTE_NEED && isleWhy === mine, `browser "${mine}", island "${isleWhy}"`);
}

/* ---- The entries, their time and the life mote's text ---- */
{
  const [rows, desc] = psql(`select string_agg(id || ':' || base_time || ':' || stamina || ':' || skill || ':' || repeatable, ',' order by id)
      from action_def where id in ('bind_wound', 'dress_poultice', 'treat_creature', 'treat_poultice');
    select description from item_def where id = 'life_mote';`).split('\n');
  const row = (d: typeof BIND, repeat: boolean): string => `${d.id}:${d.baseTime}:${d.stamina}:${d.skill}:${repeat}`;
  check('the entries take the dressing\'s and the treatment\'s time, stamina and trade, and never repeat, on both sides',
    rows === [row(BIND, true), row(POULTICE, false), row(TREAT, false), row(TREAT_P, false)].join(',')
      && POULTICE.baseTime === BIND.baseTime && TREAT_P.baseTime === TREAT.baseTime && !POULTICE.repeat, rows);
  const quick = ['naturalist_quick_dressing', 'chirurgeon_quick_bandage'].map((id) => PERK_BY_ID.get(id)?.fx ?? {});
  check('and the perks that quicken a dressing quicken the poultice as much',
    quick.every((fx) => fx['time:bind_wound'] !== undefined && fx['time:dress_poultice'] === fx['time:bind_wound']));
  const text = itemDef(LIFE_MOTE).description ?? '';
  check('the life mote\'s description names both entries and the ×2, the same on both sides',
    desc === text && text.includes(`Healer's poultice (${POULTICE.label}, ${TREAT_P.label})`) && text.includes(`health healed ×${POULTICE_HEAL}`), text);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a Healer's poultice heals ×${POULTICE_HEAL} and closes one more wound, the same on both sides — ${ok.length} of ${ok.length}`);
