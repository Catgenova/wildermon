/**
 * A restored statuette enchanted into a patron's statue, and a prayer said with one from the pack.
 *
 * Asked for: "The restored statue can be Enchanted using one of each mote to
 * be statue of x diety and can be used for mobile prayer instead of needing to
 * be at an altar". And decided: one option for each patron, anybody any of the
 * three; only a follower of the statue's patron prays with it. This asks, of
 * both sides, in the same words:
 *
 *   * that a statuette is enchanted into the statue of each patron with
 *     `STATUE_MOTES` of every element's mote, one of each used up, its QL kept,
 *     and says so;
 *   * that a mote short is refused, naming every element short, and nothing is
 *     spent; that a fragment of a statuette, or no patron, is refused;
 *   * that a statue of your own patron is prayed with from the pack: the favour
 *     `prayerWorth` gives at the statue's QL, the same as an altar of that QL,
 *     the wait started, faith and Prayer trained; that a second prayer within the
 *     wait is refused in the altar's words;
 *   * that a statue of another patron, or with no patron, is refused;
 *   * that the altar's prayer is as it was;
 *   * and that the three statues and the statuette are named and described
 *     the same on both sides.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { FAITH, PRAYER, PRAYER_REST, prayerRestWords, prayerWorth, statueFollowers } from '../../src/game/faith';
import { itemDef, type Item } from '../../src/game/items';
import { MOTE_ELEMENTS, moteItem, STATUE_MOTES } from '../../src/game/motes';
import { PATRONS, patronStatue, STATUETTE, statueName, type PatronId } from '../../src/game/patronlist';
import { ENCHANT_STATUE, STATUE_SAID, statueMadeSays, statueMotesNeed } from '../../src/game/relicuse';
import { psql, ok, bad, check } from './harness';

/** To within what a real holds: one part in 2^23 of it. */
const near = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 2 ** -23);

/** Each patron's statuette, at a quality of its own, so that the one kept shows. */
const QL: Record<PatronId, number> = { blessing: 35, justice: 40, chaos: 45 };
/** The two elements taken out of the pack to be short of. */
const SHORT = ['dark', 'light'] as const;
const [FAITH_AT, PRAYER_AT, ENCHANTING_AT] = [50, 60, 30];
const ALTAR_QL = QL.chaos;
const U = 'a9c1e000-0000-4000-8000-0000000000b7';

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v bigint; r record; p jsonb; ids jsonb := '{}'; f bigint; altar bigint; mark bigint; st bigint;
        soul double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Patron statues', 979, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Kneeler');
  insert into skill (world_id, uid, id, value)
    values (w, u, faith_skill(), ${FAITH_AT}), (w, u, praying_skill(), ${PRAYER_AT}), (w, u, enchanting_skill(), ${ENCHANTING_AT})
    on conflict (world_id, uid, id) do update set value = excluded.value;

  insert into said select 'NAMES', string_agg(d.id || ':' || d.name, ',' order by d.id) from item_def d
    where d.id = statuette() or statue_patron(d.id) is not null;
  insert into said select 'DESC:' || d.id, d.description from item_def d where d.id = statuette() or statue_patron(d.id) is not null;
  insert into said select 'ACTS', string_agg(a.id || ':' || coalesce(a.skill, '-') || ':' || a.base_time || ':' || a.stamina, ',' order by a.id)
    from action_def a where a.id in ('enchant_statue', 'pray_statue', 'pray');
  insert into said values ('MOTES', statue_motes() || '|' || array_to_string(mote_elements(), ','));

  -- A statuette for each patron, and the motes for all three.
  for r in select e from unnest(mote_elements()) e loop
    perform give(w, u, r.e || '_mote', statue_motes() * 3, 50);
  end loop;
  for r in select id from patron_def loop
    v := give(w, u, statuette(), 1, case r.id when 'blessing' then ${QL.blessing} when 'justice' then ${QL.justice} else ${QL.chaos} end);
    ids := ids || jsonb_build_object(r.id, v);
  end loop;

  -- Each made: asked through the door every browser asks by, then done.
  for r in select id from patron_def order by id loop
    update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
           act_goes = null, act_queue = '[]' where world_id = w and uid = u;
    p := jsonb_build_object('kind', 'item', 'uid', (ids->>r.id)::bigint, 'patron', r.id);
    insert into said values ('NO:' || r.id, coalesce(act_refusal(w, u, 'enchant_statue', p), 'ALLOWED'));
    p := rpc_act(w, 'enchant_statue', p);
    insert into said values ('ACT:' || r.id, coalesce(p->>'why', '-') || '|' || coalesce((select act from player where world_id = w and uid = u), 'idle'));
    select max(n) into mark from event where world_id = w;
    perform act_perform(w, u, 'enchant_statue', jsonb_build_object('kind', 'item', 'uid', (ids->>r.id)::bigint, 'patron', r.id));
    insert into said select 'MADE:' || r.id, i.def || ':' || i.ql from item i where i.id = (ids->>r.id)::bigint;
    insert into said select 'LEFT:' || r.id, string_agg(e || ':' || pack_count(w, u, e || '_mote'), ',' order by n)
      from unnest(mote_elements()) with ordinality m(e, n);
    insert into said select 'TOLD:' || r.id, string_agg(e.text, ' / ' order by e.n) from event e
      where e.world_id = w and e.n > mark and e.uid = u and e.kind = 'event';
  end loop;
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]' where world_id = w and uid = u;
  insert into said select 'TRAINED', (value > ${ENCHANTING_AT})::text from skill where world_id = w and uid = u and id = enchanting_skill();

  -- Short of motes: two elements gone, a statuette, and nothing spent at the door or done anyway.
  for r in select e from unnest(mote_elements()) e where e not in ('${SHORT[0]}', '${SHORT[1]}') loop
    perform give(w, u, r.e || '_mote', statue_motes(), 50);
  end loop;
  v := give(w, u, statuette(), 1, 50);
  p := jsonb_build_object('kind', 'item', 'uid', v, 'patron', 'chaos');
  insert into said values ('SHORT', coalesce(act_refusal(w, u, 'enchant_statue', p), 'ALLOWED'));
  p := rpc_act(w, 'enchant_statue', p);
  insert into said values ('SHORT:ACT', coalesce(p->>'why', '-') || '|' || coalesce((select act from player where world_id = w and uid = u), 'idle'));
  perform act_perform(w, u, 'enchant_statue', jsonb_build_object('kind', 'item', 'uid', v, 'patron', 'chaos'));
  insert into said select 'SHORT:AFTER', (select def from item where id = v) || '|' || pack_count(w, u, 'earth_mote');
  -- No patron, and a patron that is none.
  insert into said values ('NOPATRON', coalesce(act_refusal(w, u, 'enchant_statue', jsonb_build_object('kind', 'item', 'uid', v)), 'ALLOWED')
    || '|' || coalesce(act_refusal(w, u, 'enchant_statue', jsonb_build_object('kind', 'item', 'uid', v, 'patron', 'nobody')), 'ALLOWED'));
  -- A statuette's fragment, nobody's restored thing.
  f := give(w, u, 'fragment', 1, 50, 'statuette 1/4');
  insert into said values ('FRAGMENT', coalesce(act_refusal(w, u, 'enchant_statue', jsonb_build_object('kind', 'item', 'uid', f, 'patron', 'chaos')), 'ALLOWED'));

  -- Praying: a follower of Chaos with the Statue of Chaos, no prayer said yet and no favour banked.
  st := (ids->>'chaos')::bigint;
  p := jsonb_build_object('kind', 'item', 'uid', st);
  update player set patron = 'chaos', prayed_at = null, favour = 0, favour_at = now() where world_id = w and uid = u;
  insert into said values ('PRAY:FIRST', coalesce(act_refusal(w, u, 'pray_statue', p), 'HEARD'));
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]' where world_id = w and uid = u;
  select rpc_act(w, 'pray_statue', p) as a into r;
  insert into said values ('PRAY:ACT', coalesce(r.a->>'why', '-') || '|' || coalesce((select act from player where world_id = w and uid = u), 'idle'));
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]', prayed_at = null, favour = 0, favour_at = now() where world_id = w and uid = u;
  insert into said values ('SOUL', soul_mul(w, u)::text);
  soul := skill_of(w, u, 'soul_strength');
  select max(n) into mark from event where world_id = w;
  perform act_perform(w, u, 'pray_statue', p);
  insert into said select 'PRAY:BANKED', favour::double precision || '|' || hour_of_day(w) || '|' || favour_cap(${FAITH_AT}) from player where world_id = w and uid = u;
  insert into said select 'PRAY:TOLD', string_agg(e.text, ' / ' order by e.n) from event e where e.world_id = w and e.n > mark and e.uid = u and e.kind = 'event';
  insert into said select 'PRAY:TRAINED', string_agg(id || ':' || (value > case when id = faith_skill() then ${FAITH_AT} else ${PRAYER_AT} end), '|' order by id)
    from skill where world_id = w and uid = u and id in (faith_skill(), praying_skill());
  insert into said values ('PRAY:WAIT', coalesce(act_refusal(w, u, 'pray_statue', p), 'HEARD'));
  insert into said values ('PRAY:KEPT', (select def from item where id = st));

  -- The altar, the same wait, and the same prayer at the same QL.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql)
    select w, 'furniture', 'altar', floor(pl.x)::int, floor(pl.y)::int, pl.x, pl.y, ${ALTAR_QL} from player pl where pl.world_id = w and pl.uid = u
    returning id into altar;
  insert into said values ('ALTAR:WAIT', coalesce(faith_refusal(w, u, 'pray', jsonb_build_object('kind', 'furniture', 'id', altar)), 'HEARD'));
  -- Faith, Prayer and soul strength as the statue's prayer found them.
  update skill set value = case when id = faith_skill() then ${FAITH_AT} when id = praying_skill() then ${PRAYER_AT} else soul end
    where world_id = w and uid = u and id in (faith_skill(), praying_skill(), 'soul_strength');
  update player set prayed_at = null, favour = 0, favour_at = now() where world_id = w and uid = u;
  insert into said values ('ALTAR:FIRST', coalesce(faith_refusal(w, u, 'pray', jsonb_build_object('kind', 'furniture', 'id', altar)), 'HEARD'));
  perform perform_faith(w, u, 'pray', jsonb_build_object('kind', 'furniture', 'id', altar));
  insert into said select 'ALTAR:BANKED', favour::double precision::text from player where world_id = w and uid = u;
  -- And with no patron, an altar is prayed at as ever.
  update player set patron = null, prayed_at = null, favour = 0, favour_at = now() where world_id = w and uid = u;
  insert into said values ('ALTAR:NOPATRON', coalesce(faith_refusal(w, u, 'pray', jsonb_build_object('kind', 'furniture', 'id', altar)), 'HEARD'));

  -- Another patron's follower, and nobody's, with the Statue of Chaos: refused, and nothing banked if done anyway.
  for r in select x.pat from unnest(array['blessing', 'justice', null]) x(pat) loop
    update player set patron = r.pat, prayed_at = null, favour = 0, favour_at = now() where world_id = w and uid = u;
    insert into said values ('OTHER:' || coalesce(r.pat, 'none'), coalesce(act_refusal(w, u, 'pray_statue', p), 'HEARD'));
    perform perform_faith(w, u, 'pray_statue', p);
    insert into said select 'OTHER:' || coalesce(r.pat, 'none') || ':AFTER', favour || '|' || (prayed_at is null) from player where world_id = w and uid = u;
  end loop;
  -- And a statuette is no statue to pray with.
  update player set patron = 'chaos', prayed_at = null where world_id = w and uid = u;
  insert into said values ('PRAY:STATUETTE', coalesce(act_refusal(w, u, 'pray_statue', jsonb_build_object('kind', 'item', 'uid', v)), 'HEARD'));
end $t$;
select k || '=' || coalesce(v, 'null') from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(979);
g.inventory.items.splice(0);
g.skills.values.set(FAITH, FAITH_AT);
g.skills.values.set(PRAYER, PRAYER_AT);
g.skills.values.set('enchanting', ENCHANTING_AT);
const enchant = ACTION_BY_ID.get(ENCHANT_STATUE)!;
const pray = ACTION_BY_ID.get('pray_statue')!;
const on = (it: Item, patron?: PatronId): Target => (patron ? { kind: 'item', uid: it.uid, patron } : { kind: 'item', uid: it.uid });
const motesLeft = (): string => MOTE_ELEMENTS.map((e) => `${e}:${g.inventory.count(moteItem(e))}`).join(',');

/* ---- both ---------------------------------------------------------------------------- */

// What they are called and what they say.
check('a statuette and a statue for each patron, named off the patrons, the same on both sides',
  at('NAMES') === [STATUETTE, ...PATRONS.map((p) => patronStatue(p.id))].sort().map((id) => `${id}:${itemDef(id).name}`).join(',')
    && PATRONS.every((p) => itemDef(patronStatue(p.id)).name === `Statue of ${p.name}` && statueName(p) === `Statue of ${p.name}`), at('NAMES'));
for (const id of [STATUETTE, ...PATRONS.map((p) => patronStatue(p.id))]) {
  const says = itemDef(id).description ?? '';
  check(`${itemDef(id).name} describes itself the same on both sides, every number put in`,
    at(`DESC:${id}`) === says && !says.includes('{') && says.length > 0, at(`DESC:${id}`));
}
check(`the statuette says ${STATUE_MOTES} of each of the ${MOTE_ELEMENTS.length} motes, and the three statues`,
  (itemDef(STATUETTE).description ?? '').includes(`${STATUE_MOTES} mote of each of the ${MOTE_ELEMENTS.length} elements`)
    && PATRONS.every((p) => (itemDef(STATUETTE).description ?? '').includes(statueName(p))), itemDef(STATUETTE).description);
check('the island takes the same motes, one of each element', at('MOTES') === `${STATUE_MOTES}|${MOTE_ELEMENTS.join(',')}` && STATUE_MOTES === 1, at('MOTES'));
check('enchanting is done with enchanting, and a statue prayed with in an altar prayer\'s time and wind, on both sides',
  at('ACTS') === [enchant, pray, ACTION_BY_ID.get('pray')!].map((d) => `${d.id}:${d.skill ?? '-'}:${d.baseTime}:${d.stamina}`).sort().join(',')
    && pray.baseTime === ACTION_BY_ID.get('pray')!.baseTime && pray.stamina === ACTION_BY_ID.get('pray')!.stamina && pray.skill === PRAYER, at('ACTS'));

// Enchanting each.
for (const e of MOTE_ELEMENTS) g.inventory.add(moteItem(e), { count: STATUE_MOTES * PATRONS.length, ql: 50 });
const made: Partial<Record<PatronId, Item>> = {};
for (const [i, p] of [...PATRONS].sort((a, b) => a.id.localeCompare(b.id)).entries()) {
  const it = g.inventory.add(STATUETTE, { ql: QL[p.id] });
  const why = enchant.check?.(on(it, p.id), g) ?? null;
  check(`a statuette is enchanted into the ${statueName(p)} by anybody, on both sides`,
    why === null && enchant.applies(on(it, p.id), g) && at(`NO:${p.id}`) === 'ALLOWED' && at(`ACT:${p.id}`) === `-|${ENCHANT_STATUE}`, `${why} | ${at(`NO:${p.id}`)} | ${at(`ACT:${p.id}`)}`);
  const logged = g.log.length;
  enchant.perform(on(it, p.id), g);
  made[p.id] = it;
  check(`it becomes the ${statueName(p)} at its own QL ${QL[p.id]}, on both sides`,
    it.id === patronStatue(p.id) && it.ql === QL[p.id] && at(`MADE:${p.id}`) === `${patronStatue(p.id)}:${QL[p.id]}`, at(`MADE:${p.id}`));
  const left = STATUE_MOTES * (PATRONS.length - i - 1);
  check(`one mote of each element used up, ${left} of each left, on both sides`,
    motesLeft() === MOTE_ELEMENTS.map((e) => `${e}:${left}`).join(',') && at(`LEFT:${p.id}`) === motesLeft(), `${motesLeft()} | ${at(`LEFT:${p.id}`)}`);
  const said = g.log.slice(logged).map((l) => l.text).join(' / ');
  check(`and says so in the same words: "${statueMadeSays(p, QL[p.id])}"`,
    said === statueMadeSays(p, QL[p.id]) && at(`TOLD:${p.id}`) === said, `${said} | ${at(`TOLD:${p.id}`)}`);
}
check('making one trains enchanting on the island', at('TRAINED') === 'true', at('TRAINED'));

// Short of motes.
for (const e of MOTE_ELEMENTS) if (!(SHORT as readonly string[]).includes(e)) g.inventory.add(moteItem(e), { count: STATUE_MOTES, ql: 50 });
const spare = g.inventory.add(STATUETTE, { ql: 50 });
const shortSays = statueMotesNeed(SHORT);
check(`short of ${SHORT.join(' and ')} motes it is refused, naming both, in the same words: "${shortSays}"`,
  enchant.check?.(on(spare, 'chaos'), g) === shortSays && at('SHORT') === shortSays && shortSays === `Need 1 ${SHORT[0]} mote and 1 ${SHORT[1]} mote.`,
  `${enchant.check?.(on(spare, 'chaos'), g)} | ${at('SHORT')}`);
check('the island turns it away at the door, nothing started', at('SHORT:ACT') === `${shortSays}|idle`, at('SHORT:ACT'));
enchant.perform(on(spare, 'chaos'), g);
check('and done anyway, nothing is spent and the statuette is a statuette, on both sides',
  spare.id === STATUETTE && g.inventory.count('earth_mote') === STATUE_MOTES && at('SHORT:AFTER') === `${STATUETTE}|${STATUE_MOTES}`, at('SHORT:AFTER'));
check(`no patron chosen, or one that is none, it is refused: "${STATUE_SAID.patron}"`,
  enchant.check?.(on(spare), g) === STATUE_SAID.patron && enchant.check?.({ kind: 'item', uid: spare.uid, patron: 'nobody' as PatronId }, g) === STATUE_SAID.patron
    && at('NOPATRON') === `${STATUE_SAID.patron}|${STATUE_SAID.patron}`, at('NOPATRON'));
{
  const frag = g.inventory.add('fragment', { ql: 50, extra: 'statuette 1/4' });
  check(`a statuette's fragment is not enchanted, on both sides: "${STATUE_SAID.statuette}"`,
    enchant.check?.(on(frag, 'chaos'), g) === STATUE_SAID.statuette && at('FRAGMENT') === STATUE_SAID.statuette && !enchant.applies(on(frag, 'chaos'), g),
    `${enchant.check?.(on(frag, 'chaos'), g)} | ${at('FRAGMENT')}`);
}

// Praying with the Statue of Chaos, a follower of Chaos.
const chaos = PATRONS.find((p) => p.id === 'chaos')!;
const statue = made.chaos!;
g.player.patron = 'chaos';
g.player.favour = 0;
check('a follower of Chaos prays with the Statue of Chaos from the pack, on both sides, anywhere',
  (pray.check?.(on(statue), g) ?? null) === null && pray.applies(on(statue), g) && at('PRAY:FIRST') === 'HEARD' && at('PRAY:ACT') === '-|pray_statue',
  `${pray.check?.(on(statue), g)} | ${at('PRAY:FIRST')} | ${at('PRAY:ACT')}`);
check('it is offered on the statue\'s own menu as Pray',
  g.actionsFor(on(statue)).some(({ def, reason }) => def.id === 'pray_statue' && def.label === 'Pray' && reason === null));
{
  const [banked, hour, cap] = at('PRAY:BANKED').split('|').map(Number);
  const want = prayerWorth(QL.chaos, hour, PRAYER_AT) * Number(at('SOUL'));
  check(`it banks what Prayer ${PRAYER_AT} says at the statue's QL ${QL.chaos}, times soul strength's share, the same on both sides`,
    near(banked, want) && banked < cap, `island ${banked}, browser ${want} at hour ${hour}`);
  check(`the same favour an altar of QL ${ALTAR_QL} banks on the island`, near(Number(at('ALTAR:BANKED')), banked), `${at('ALTAR:BANKED')} | ${banked}`);
  check('it trains faith and Prayer on the island', at('PRAY:TRAINED') === [FAITH, PRAYER].sort().map((id) => `${id}:true`).join('|'), at('PRAY:TRAINED'));
  check('it says what an altar\'s prayer says', /^Prayed( \(dawn or dusk bonus\))?\. Favour \d+\/\d+\.$/.test(at('PRAY:TOLD')), at('PRAY:TOLD'));
  check('and the statue is kept', at('PRAY:KEPT') === patronStatue('chaos'), at('PRAY:KEPT'));
}
{
  const before = g.player.favour;
  const hour = g.hourOfDay();
  // Soul strength's share as the prayer finds it: the prayer then raises it.
  const want = prayerWorth(QL.chaos, hour, PRAYER_AT) * (1 + g.wornEnchant('favour')) * g.soulMul();
  pray.perform(on(statue), g);
  check(`in the browser too: prayerWorth at QL ${QL.chaos}, and the wait started`,
    Math.abs(g.player.favour - before - want) < 1e-9 && g.player.prayedAt === g.time && g.inventory.get(statue.uid)?.id === patronStatue('chaos'),
    `${g.player.favour - before} against ${want}`);
}
const waitSays = prayerRestWords(PRAYER_REST);
check(`a second prayer within the wait is refused in the altar's words, on both sides: "${waitSays}"`,
  pray.check?.(on(statue), g) === waitSays && at('PRAY:WAIT') === waitSays && at('ALTAR:WAIT') === waitSays,
  `${pray.check?.(on(statue), g)} | ${at('PRAY:WAIT')} | ${at('ALTAR:WAIT')}`);

// Another patron's follower, and nobody's.
g.player.prayedAt = -1e9;
const followers = statueFollowers(chaos);
for (const pat of ['blessing', 'justice', null] as const) {
  g.player.patron = pat;
  check(`${pat ? `a follower of ${PATRONS.find((p) => p.id === pat)!.name}` : 'somebody with no patron'} is refused the Statue of Chaos in the same words: "${followers}"`,
    pray.check?.(on(statue), g) === followers && at(`OTHER:${pat ?? 'none'}`) === followers && followers === 'Statue of Chaos: followers of Chaos only.',
    `${pray.check?.(on(statue), g)} | ${at(`OTHER:${pat ?? 'none'}`)}`);
  check('and done anyway on the island, nothing is banked and no wait started', at(`OTHER:${pat ?? 'none'}:AFTER`) === '0|true', at(`OTHER:${pat ?? 'none'}:AFTER`));
}
g.player.patron = 'chaos';
check('a statuette is no statue to pray with, on both sides', !pray.applies(on(spare), g) && pray.check?.(on(spare), g) === 'It is gone.' && at('PRAY:STATUETTE') === 'It is gone.',
  `${pray.check?.(on(spare), g)} | ${at('PRAY:STATUETTE')}`);

// The altar as it was.
check('an altar is prayed at as ever, by a follower and by somebody with no patron', at('ALTAR:FIRST') === 'HEARD' && at('ALTAR:NOPATRON') === 'HEARD',
  `${at('ALTAR:FIRST')} | ${at('ALTAR:NOPATRON')}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`patron statues — ${ok.length} of ${ok.length}`);
