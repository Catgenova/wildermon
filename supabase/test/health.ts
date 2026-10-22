/**
 * The Health window, and a wound you point at.
 *
 * Asked: a Health window listing ailments and nutrition, where a wound is
 * clicked to be bandaged or treated, clear about what has to be carried for
 * each. A dressing, the lye and a salve each used to pick their own wound, so
 * a click on one wound could treat another. An ask may now name the wound
 * (`Target.wound`, `woundKey`): that one is treated, or the ask is refused
 * saying why, on both sides in the same words. This asks:
 *
 *   * on the island, a dressing named for the lesser of two cuts goes on that
 *     one and leaves the worse alone; named for neither, it goes on the worse;
 *   * the island and the browser name a wound by the same key;
 *   * a wound closed since, a lye named for a wound not gone bad and a salve
 *     named for an undressed wound are refused in the same words on both sides;
 *   * in the browser, the same: the named wound, and no other;
 *   * the window's own reckoning offers the lye for a wound gone bad and only
 *     that, a dressing for an open one with the ask it would send, says what is
 *     carried and how to make what is not from the recipe itself, and the
 *     window has a key, a place on the menu and a frame of its own.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { NEED_LYE } from '../../src/game/placeables';
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { BIND_BY_ID } from '../../src/game/keybinds';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { WOUND_CLOSED, woundKey, type Wound } from '../../src/game/wounds';
import { caresFor, recipeWords } from '../../src/ui/health';
import { FRAMES } from '../../src/ui/runecut-frames';

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

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '4ea17000-0000-4000-8000-0000000000a1';
const ARM = { kind: 'cut', part: 'arms', severity: 0.2, bleeding: true, infected: false, dressing: null, at: '2026-10-16T10:00:00+00:00' };
const LEG = { kind: 'cut', part: 'legs', severity: 0.3, bleeding: true, infected: false, dressing: null, at: '2026-10-16T10:05:00+00:00' };
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Every go comes off, so what is measured is where the dressing went and not the luck.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_ws jsonb := jsonb_build_array('${JSON.stringify(ARM)}'::jsonb, '${JSON.stringify(LEG)}'::jsonb);
        v_arm text; v_leg text; v_band bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Mending', 174, 32, 10, 10, true) returning id into w;
  perform land_blank(w, 32);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 10.5, y = 10.5, wounds = v_ws, stats = '{"health":0.6,"stamina":1,"hunger":1,"thirst":1}'::jsonb
    where world_id = w and uid = u;
  v_arm := wound_key(v_ws->0);
  v_leg := wound_key(v_ws->1);
  insert into said values ('KEY', v_arm);
  v_band := give(w, u, 'bandage', 3, 40);

  -- Named for the arm: the arm, and the leg left as it was.
  insert into said values ('ASK', coalesce(act_refusal(w, u, 'bind_wound', jsonb_build_object('kind', 'item', 'uid', v_band, 'wound', v_arm)), 'none'));
  perform act_perform(w, u, 'bind_wound', jsonb_build_object('kind', 'item', 'uid', v_band, 'wound', v_arm));
  insert into said select 'NAMED', string_agg((wd->>'part') || ':' || coalesce(wd->>'dressing', 'none') || ':' || round((wd->>'severity')::numeric, 3), ' ' order by wd->>'part')
    from player p, jsonb_array_elements(p.wounds) wd where p.world_id = w and p.uid = u;
  -- Named for the arm again: it is bound with cloth already, and that says so.
  insert into said values ('AGAIN', coalesce(act_refusal(w, u, 'bind_wound', jsonb_build_object('kind', 'item', 'uid', v_band, 'wound', v_arm)), 'none'));
  -- Named for neither: the worse, as it always was.
  perform act_perform(w, u, 'bind_wound', jsonb_build_object('kind', 'item', 'uid', v_band));
  insert into said select 'PICKED', string_agg((wd->>'part') || ':' || coalesce(wd->>'dressing', 'none'), ' ' order by wd->>'part')
    from player p, jsonb_array_elements(p.wounds) wd where p.world_id = w and p.uid = u;

  -- A wound closed since, the lye on one not gone bad, a salve on one not dressed.
  update player set wounds = jsonb_build_array('${JSON.stringify(ARM)}'::jsonb) where world_id = w and uid = u;
  perform give(w, u, 'lye_bucket', 1, 30);
  perform give(w, u, 'salve', 1, 30);
  insert into said values ('CLOSED', coalesce(act_refusal(w, u, 'bind_wound', jsonb_build_object('kind', 'item', 'uid', v_band, 'wound', v_leg)), 'none'));
  insert into said values ('LYE', coalesce(act_refusal(w, u, 'clean_wound', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'lye_bucket'), 'wound', v_arm)), 'none'));
  insert into said values ('SALVE', coalesce(act_refusal(w, u, 'apply_salve', jsonb_build_object('kind', 'item', 'uid', (select id from item where world_id = w and holder_uid = u and def = 'salve'), 'wound', v_arm)), 'none'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

const named = Object.fromEntries(at('NAMED').split(' ').map((x) => x.split(':')).map(([part, dressing, sev]) => [part, { dressing, sev: Number(sev) }]));
check('on the island, a dressing asked for the lesser cut is not refused', at('ASK') === 'none', at('ASK'));
check('and goes on that cut, bound with cloth and less deep', named.arms?.dressing === '' && named.arms.sev < ARM.severity, at('NAMED'));
check('leaving the worse cut as it was', named.legs?.dressing === 'none' && named.legs.sev === LEG.severity, at('NAMED'));
check('asked for again, it says the arm is dressed as well as cloth would', at('AGAIN') === 'The cut on your arm: already dressed as well or better.', at('AGAIN'));
check('asked for neither, it goes on the worse, as before', at('PICKED').includes('legs:') && !at('PICKED').includes('legs:none'), at('PICKED'));

/* ---- both sides name a wound alike ----------------------------------------------- */

check('the island and the browser name a wound by the same key', at('KEY') === woundKey(ARM as unknown as Wound), `${at('KEY')} / ${woundKey(ARM as unknown as Wound)}`);

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(4251);
const t = g.time;
const arm: Wound = { id: 1, kind: 'cut', part: 'arms', severity: 0.2, bleeding: true, infected: false, dressing: null, at: t - 50 };
const leg: Wound = { id: 2, kind: 'cut', part: 'legs', severity: 0.3, bleeding: true, infected: false, dressing: null, at: t - 30 };
g.player.wounds = [arm, leg];
g.player.stats.health = 0.6;
for (const it of [...g.inventory.items]) if (['bandage', 'cover', 'lye_bucket', 'salve'].includes(it.id)) g.inventory.remove(it.uid, it.count);
const band = g.inventory.add('bandage', { ql: 40 });
g.inventory.add('bandage', { ql: 40 });
g.skillCheck = () => true;
const bind = ACTION_BY_ID.get('bind_wound');
const toArm: Target = { kind: 'item', uid: band.uid, wound: woundKey(arm) };
check('in the browser, a dressing asked for the lesser cut is not refused', (bind?.check?.(toArm, g) ?? null) === null, String(bind?.check?.(toArm, g)));
bind?.perform(toArm, g);
check('and goes on that cut and no other', arm.dressing === '' && arm.severity < 0.2 && leg.dressing === null && leg.severity === 0.3,
  `${arm.dressing}/${arm.severity.toFixed(3)} ${leg.dressing}/${leg.severity}`);
check('asked for again, in the island\'s words', bind?.check?.(toArm, g) === at('AGAIN'), String(bind?.check?.(toArm, g)));
g.player.wounds = [arm];
const lye = g.inventory.add('lye_bucket', { ql: 30 });
const salve = g.inventory.add('salve', { ql: 30 });
const fresh: Wound = { ...arm, dressing: null, at: t - 5 };
g.player.wounds = [fresh];
const toGone: Target = { kind: 'item', uid: band.uid, wound: woundKey(leg) };
check('a wound closed since is refused in the island\'s words', bind?.check?.(toGone, g) === at('CLOSED') && at('CLOSED') === WOUND_CLOSED, `${bind?.check?.(toGone, g)} / ${at('CLOSED')}`);
const lyeAsk: Target = { kind: 'item', uid: lye.uid, wound: woundKey(fresh) };
check('the lye on a wound not gone bad, the same', ACTION_BY_ID.get('clean_wound')?.check?.(lyeAsk, g) === at('LYE'), `${ACTION_BY_ID.get('clean_wound')?.check?.(lyeAsk, g)} / ${at('LYE')}`);
const salveAsk: Target = { kind: 'item', uid: salve.uid, wound: woundKey(fresh) };
check('a salve on a wound not dressed, the same', ACTION_BY_ID.get('apply_salve')?.check?.(salveAsk, g) === at('SALVE'), `${ACTION_BY_ID.get('apply_salve')?.check?.(salveAsk, g)} / ${at('SALVE')}`);

/* ---- the window's reckoning ---------------------------------------------------------- */

g.inventory.remove(lye.uid, 1);
const gone: Wound = { ...fresh, infected: true, bleeding: false, at: t - 9 };
g.player.wounds = [gone, fresh];
const forGone = caresFor(g, gone);
const lyeR = RECIPE_BY_ID.get('make_lye');
check('for a wound gone bad it offers the lye, and only that', forGone.length === 1 && forGone[0].id === 'clean_wound', forGone.map((c) => c.id).join());
check('and with none carried, says so, how lye is made, and why it cannot be done',
  !forGone[0].holding && !!lyeR && forGone[0].make === `Lye: ${recipeWords(lyeR)}.` && forGone[0].why === NEED_LYE,
  `${forGone[0].make} / ${forGone[0].why}`);
const forOpen = caresFor(g, fresh);
const dress = forOpen.find((c) => c.id === 'bind_wound');
check('for an open wound it offers a dressing, asked for that wound with a bandage carried',
  !!dress && dress.holding && dress.why === null && dress.target?.kind === 'item' && dress.target.wound === woundKey(fresh), JSON.stringify(dress?.target));
check('it says what is carried and what would go on', !!dress && dress.have === 'Carried: 1 bandage. Uses: bandage (QL 40).', dress?.have);
const coverR = RECIPE_BY_ID.get('make_cover_thyme');
check('and how to make the cover that suits it, from the recipe', !!dress && !!coverR && (dress.make ?? '').includes(`Thyme cover: ${recipeWords(coverR)}.`), dress?.make ?? 'none');

check('the window has a key', (BIND_BY_ID.get('win_health')?.keys.length ?? 0) > 0);
check('and a frame of its own', FRAMES.some((f) => f.for.includes('health')));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na wound you point at — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
