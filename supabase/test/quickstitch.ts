/**
 * Quick Stitch closes the deepest wound, by its share of that wound's depth.
 *
 * Reported: "quick stitch isn't working at all to lower wound severity". It
 * closed the wound `worst_wound` ranks first, which scores bleeding (+0.5) and
 * gone bad (+1) over depth: once the deep wound was dressed, a light cut still
 * bleeding came first, and the stitch took 30% of 3% off it. Asked here, on the
 * island through the door the spell bar uses (`rpc_cast_spell`), in a world of
 * its own and a transaction that is rolled back:
 *
 *   * on yourself, with a deep burn dressed, a light cut bleeding and a light
 *     bite gone bad: the burn, and only the burn, goes to its share of what it
 *     was; the line names it and its depth before and after;
 *   * the stamina it costs is spent and the spell rests: cast again at once,
 *     it is refused and nothing more is closed;
 *   * the next beat (`rpc_settle`) keeps it: the burn goes on closing from the
 *     stitched depth, and the beat's answer, which the browser draws its wound
 *     window from, says so;
 *   * on somebody within its reach: their deepest wound (a bruise, which never
 *     bleeds) and not their bleeding cut;
 *   * on somebody past its reach, and on somebody with no wound: refused, and
 *     nothing spent;
 *   * a wound stitched to nothing is gone, and the line says closed;
 *
 * and in the browser: the spell's text says the share it closes by, the same
 * text the island holds, and the wound window drawn from the island's wounds
 * shows the burn at the depth the line says, and a wound the beat sent with
 * its null `dressing` left out as open.
 */
import { execFileSync } from 'node:child_process';
// The rulebook first: `firstaid` is a part of it and cannot be loaded on its own.
import '../../src/game/actions';
import { Game } from '../../src/game/game';
import { SPELL_BAR } from '../../src/game/patrons';
import { CLASS_SPELL_BY_ID } from '../../src/game/talents';
import { CLOSE_BARE, dressingPace, PART_NAMES, WOUND_KINDS, type Wound } from '../../src/game/wounds';
import { woundView } from '../../src/ui/health';

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
const near = (a: number, b: number, by = 1e-9): boolean => Math.abs(a - b) <= by;
/** A depth as the wound window shows it, and as the island's line says it (`faith_pct`). */
const pct = (x: number): string => `${Math.round(x * 100)}%`;

const STITCH = CLASS_SPELL_BY_ID.get('chirurgeon_quick_stitch')!;
const CLOSE = STITCH.fx.close;
const REACH = STITCH.fx.reach;
const SLOT = SPELL_BAR.indexOf('class');
const left = (x: number): number => x * (1 - CLOSE);
/** The wound as the island names it in the line: its kind and where it is. */
const named = (kind: keyof typeof WOUND_KINDS, part: string): string => `${WOUND_KINDS[kind].name} (${PART_NAMES[part] ?? part})`;

/* ---- The island's half ------------------------------------------------- */
const A = '44444444-4444-4444-4444-444444444444';
const B = '55555555-5555-5555-5555-555555555555';
const C = '66666666-6666-6666-6666-666666666666';
/** A wound with the keys `hurt_player` gives one. */
const wound = (kind: string, part: string, severity: number, bleeding: boolean, infected: boolean, dressing: string | null): string =>
  `jsonb_build_object('kind', '${kind}', 'part', '${part}', 'severity', ${severity}, 'bleeding', ${bleeding}, 'infected', ${infected}, `
  + `'dressing', ${dressing === null ? 'null' : `'${dressing}'`}, 'at', now())`;
/** What a body's wounds read as: kind:severity, in their order. */
const WOUNDS_OF = (who: string): string => `(select coalesce(string_agg((wd->>'kind') || ':' || (wd->>'severity'), ',' order by t.i), 'none')
  from player pl, jsonb_array_elements(pl.wounds) with ordinality t(wd, i) where pl.world_id = w and pl.uid = '${who}')`;
const STAMINA_OF = `(select stats->>'stamina' from player where world_id = w and uid = '${A}')`;
const cast = (target: string): string => `(select coalesce(r->>'why', r->>'said') from (select rpc_cast_spell(w, ${SLOT}, ${target}) r) q)`;
const again = `update player set used_at = '{}'::jsonb, stats = jsonb_set(stats, '{stamina}', '1') where world_id = w and uid = '${A}';
  delete from caller where uid = '${A}';`;

const out = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare w uuid;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stitch', 193, 64, 8, 8, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', '${B}')::text, true);
  perform rpc_join(w, 'Bea');
  perform set_config('request.jwt.claims', json_build_object('sub', '${C}')::text, true);
  perform rpc_join(w, 'Cal');
  perform set_config('request.jwt.claims', json_build_object('sub', '${A}')::text, true);
  perform rpc_join(w, 'Ash');
  update player set x = 30.5, y = 30.5, level = 0, body_at = now(), moved_at = now() - interval '1 hour', wounds = '[]'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('health', 1, 'stamina', 1, 'hurtSettled', now())
   where world_id = w;
  update player set x = 30.5 + ${REACH - 0.5} where world_id = w and uid = '${B}';
  update player set x = 30.5 + ${REACH + 1} where world_id = w and uid = '${C}';
  insert into said values ('TAKE', coalesce(rpc_take_class(w, 'chirurgeon')->>'why', 'took'));
  insert into player_node (world_id, uid, node) values (w, '${A}', '${STITCH.id}') on conflict do nothing;
  insert into said values ('BAR', coalesce(rpc_spell_bar(w, ${SLOT}, '${STITCH.id}')->>'why', 'set'));
  insert into said select 'NOTE', note from class_spell where id = '${STITCH.id}';

  /* ---- On yourself: a deep burn dressed, a light cut bleeding, a light bite gone bad ---- */
  update player set wounds = jsonb_build_array(${wound('cut', 'arms', 0.03, true, false, null)},
      ${wound('burn', 'chest', 0.5, false, false, '')}, ${wound('bite', 'legs', 0.05, false, true, null)})
   where world_id = w and uid = '${A}';
  ${again}
  insert into said values ('SELF', ${cast(`jsonb_build_object('kind', 'self')`)});
  insert into said values ('SELF:WOUNDS', ${WOUNDS_OF(A)});
  insert into said select 'SELF:ROWS', wounds::text from player where world_id = w and uid = '${A}';
  insert into said values ('SELF:STAMINA', ${STAMINA_OF});
  insert into said select 'SELF:USED', (used_at ? 'spell:${STITCH.id}')::text from player where world_id = w and uid = '${A}';
  -- At once again: it rests, and nothing more is closed or spent.
  delete from caller where uid = '${A}';
  insert into said values ('RESTS', ${cast(`jsonb_build_object('kind', 'self')`)});
  insert into said values ('RESTS:WOUNDS', ${WOUNDS_OF(A)});
  insert into said values ('RESTS:STAMINA', ${STAMINA_OF});
  -- A minute on, the wounds brought up to date (\`wounds_settle\`, as a job's or a fight's settle does) and the next beat:
  -- the stitched burn goes on closing from where the stitch left it.
  -- A cloth-dressed burn festers by chance (\`fester_chance\`, about one minute in sixty here), and a festered wound
  -- stops closing: the draw is seeded so the beat is the same every run.
  perform setseed(0.25);
  update player set stats = jsonb_set(stats, '{hurtSettled}', to_jsonb(now() - interval '60 seconds')) where world_id = w and uid = '${A}';
  perform wounds_settle(w, '${A}');
  delete from caller where uid = '${A}';
  insert into said select 'BEAT', (select string_agg(wd::text, ';' order by t.i) from jsonb_array_elements(r->'wounds') with ordinality t(wd, i))
    from (select rpc_settle(p_world => w, p_seen => null, p_said => null, p_book => false, p_ticked => null) r) q;
  insert into said values ('BEAT:WOUNDS', ${WOUNDS_OF(A)});

  /* ---- On somebody within reach: their deepest, a bruise that never bleeds, and not their bleeding cut ---- */
  update player set wounds = jsonb_build_array(${wound('cut', 'legs', 0.03, true, false, null)}, ${wound('crush', 'head', 0.4, false, false, null)})
   where world_id = w and uid = '${B}';
  ${again}
  insert into said values ('NEAR', ${cast(`jsonb_build_object('kind', 'player', 'uid', '${B}')`)});
  insert into said values ('NEAR:WOUNDS', ${WOUNDS_OF(B)});

  /* ---- Past its reach, and nobody hurt: refused, nothing spent ---- */
  update player set wounds = jsonb_build_array(${wound('crush', 'head', 0.4, false, false, null)}) where world_id = w and uid = '${C}';
  ${again}
  insert into said values ('FAR', ${cast(`jsonb_build_object('kind', 'player', 'uid', '${C}')`)});
  insert into said values ('FAR:WOUNDS', ${WOUNDS_OF(C)});
  insert into said values ('FAR:STAMINA', ${STAMINA_OF});
  update player set wounds = '[]'::jsonb where world_id = w and uid = '${B}';
  ${again}
  insert into said values ('NONE', ${cast(`jsonb_build_object('kind', 'player', 'uid', '${B}')`)});
  insert into said values ('NONE:STAMINA', ${STAMINA_OF});

  /* ---- A wound stitched to nothing is gone ---- */
  update player set wounds = jsonb_build_array(${wound('cut', 'arms', 0.0055, false, false, '')}) where world_id = w and uid = '${A}';
  ${again}
  insert into said values ('SHUT', ${cast(`jsonb_build_object('kind', 'self')`)});
  insert into said values ('SHUT:WOUNDS', ${WOUNDS_OF(A)});
end $t$;
select k || '=' || coalesce(v, '') from said;
rollback;
`);

const isle = new Map<string, string>();
for (const line of out.split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) isle.set(line.slice(0, at), line.slice(at + 1));
}
const island = (k: string): string => isle.get(k) ?? '(missing)';
/** "cut:0.03,burn:0.35" as pairs. */
const wounds = (k: string): Array<[string, number]> =>
  island(k) === 'none' ? [] : island(k).split(',').map((p) => { const [kind, sev] = p.split(':'); return [kind, Number(sev)]; });

check('the Chirurgeon taken and Quick Stitch on the bar', island('TAKE') === 'took' && island('BAR') === 'set', `${island('TAKE')} / ${island('BAR')}`);

/* ---- On yourself ---- */
const self = wounds('SELF:WOUNDS');
check(`on yourself: the deepest wound (a dressed burn at 50%) goes to ${pct(left(0.5))}, the bleeding cut and the bad bite as they were`,
  self.length === 3 && self[0][0] === 'cut' && near(self[0][1], 0.03) && self[1][0] === 'burn' && near(self[1][1], left(0.5))
    && self[2][0] === 'bite' && near(self[2][1], 0.05), island('SELF:WOUNDS'));
check('and the line names the wound and its depth before and after',
  island('SELF') === `${STITCH.name} on you: ${named('burn', 'chest')} depth ${pct(0.5)} → ${pct(left(0.5))}.`, island('SELF'));
check(`and it costs ${pct(STITCH.cost)} of your stamina, and the spell rests`,
  near(Number(island('SELF:STAMINA')), 1 - STITCH.cost) && island('SELF:USED') === 'true', `${island('SELF:STAMINA')} ${island('SELF:USED')}`);
check('cast again at once: refused, nothing more closed or spent',
  island('RESTS') === `${STITCH.name}: cooldown ${STITCH.rest} s.`, island('RESTS'));
check('  (the wounds and stamina as the first cast left them)',
  island('RESTS:WOUNDS') === island('SELF:WOUNDS') && island('RESTS:STAMINA') === island('SELF:STAMINA'), `${island('RESTS:WOUNDS')} ${island('RESTS:STAMINA')}`);

/* ---- The next beat ---- */
const beat = wounds('BEAT:WOUNDS');
const burnAfter = beat.find(([k]) => k === 'burn')?.[1] ?? NaN;
check(`a minute on, the burn has closed further from ${pct(left(0.5))}, and not back towards 50%`,
  burnAfter < left(0.5) && burnAfter > left(0.5) * 0.9, island('BEAT:WOUNDS'));
const beatRows = island('BEAT').split(';').filter(Boolean).map((s) => JSON.parse(s) as Wound);
check('and the beat\'s answer carries the wounds as the island has them', beatRows.length === beat.length
  && beatRows.every((w, i) => w.kind === beat[i][0] && near(w.severity, beat[i][1])), island('BEAT'));

/* ---- The browser draws the island's wounds, wholesale (`sawWounds`) ---- */
const g = Game.create(4252);
const burnShown = (rows: Wound[]): string => {
  g.sawWounds(rows);
  const burn = g.player.wounds.find((w) => w.kind === 'burn');
  return burn ? woundView(g, burn).depth : 'no burn';
};
const stitched = burnShown(JSON.parse(isle.get('SELF:ROWS') ?? '[]') as Wound[]);
check(`the wound window shows the stitched burn at ${pct(left(0.5))} deep, as the line said`, stitched === pct(left(0.5)), stitched);
const beaten = burnShown(beatRows);
check(`and after the beat at the depth the beat says (${pct(burnAfter)})`, beaten === pct(burnAfter), beaten);
// The beat drops null keys: the open cut came without its `dressing`, and is drawn open, not under a herb.
const cut = g.player.wounds.find((w) => w.kind === 'cut');
check('and a wound with nothing on it drawn open, though the beat left its dressing out',
  !!cut && !('dressing' in (beatRows.find((w) => w.kind === 'cut') ?? {})) && cut.dressing === null
    && dressingPace(cut, cut.dressing) === CLOSE_BARE, JSON.stringify(cut));

/* ---- On somebody within reach ---- */
const near2 = wounds('NEAR:WOUNDS');
check(`on somebody ${REACH - 0.5} tiles off: their deepest (a bruise at 40%, not bleeding) goes to ${pct(left(0.4))}, their bleeding cut as it was`,
  near2.length === 2 && near2[0][0] === 'cut' && near(near2[0][1], 0.03) && near2[1][0] === 'crush' && near(near2[1][1], left(0.4)),
  island('NEAR:WOUNDS'));
check('and the line names them, the wound and its depth before and after',
  island('NEAR') === `${STITCH.name} on Bea: ${named('crush', 'head')} depth ${pct(0.4)} → ${pct(left(0.4))}.`, island('NEAR'));

/* ---- Refused ---- */
check(`past its ${REACH} tiles: refused, their wound as it was, nothing spent`,
  island('FAR') === `Too far: max ${REACH} tiles.` && island('FAR:WOUNDS') === 'crush:0.4' && island('FAR:STAMINA') === '1',
  `${island('FAR')} ${island('FAR:WOUNDS')} ${island('FAR:STAMINA')}`);
check('on somebody with no wound: refused, nothing spent',
  island('NONE') === 'Bea has no wound.' && island('NONE:STAMINA') === '1', `${island('NONE')} ${island('NONE:STAMINA')}`);

/* ---- Stitched to nothing ---- */
check('a wound stitched to nothing is gone, and the line says closed',
  island('SHUT:WOUNDS') === 'none' && island('SHUT') === `${STITCH.name} on you: ${named('cut', 'arms')} depth ${pct(0.0055)} → closed.`,
  `${island('SHUT')} ${island('SHUT:WOUNDS')}`);

/* ---- The text ---- */
check(`the spell's text says the share it closes the deepest wound by (×${Number((1 - CLOSE).toFixed(2))})`,
  STITCH.note.includes('deepest wound depth') && STITCH.note.includes(`×${Number((1 - CLOSE).toFixed(2))}`), STITCH.note);
check('and the island holds the same text', island('NOTE') === STITCH.note, `${island('NOTE')} / ${STITCH.note}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`Quick Stitch: the deepest wound by its share — ${ok.length} of ${ok.length}`);
