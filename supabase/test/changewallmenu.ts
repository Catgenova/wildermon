/**
 * Change wall the way a player does it: the game's own tile menu in Chromium, asked of a real island.
 *
 * Reported twice: "change wall seems to do nothing". The page (`changewallmenu-page.ts`) is the game with its UI;
 * what it holds is laid from the island's own answers (the ground read, the skills, the pack, the lines said), and
 * what its menu asks for is asked of the island here as a page asks it (`rpc_act`, the job's goes run out by
 * `settle`), then laid again. A player who owns a house of finished plank walls, two storeys, the second the one being
 * worked on (as Plan another storey leaves it), at ordinary skills:
 *
 *   * clicks a side of the house's tile and opens Change wall (side, storey N) → type → material, for the ground
 *     floor's wall and for storey 2's, a change of type and one of material. It was offered for the storey being
 *     worked on only, and named none, so the ground floor's wall -- under a storey, what Change wall is for -- could
 *     not be changed from the menu, and choosing Change wall on it changed the wall above;
 *   * the island plans it on that storey's wall and says so in the log, the storey named;
 *   * the menu then has Build change first, open once the bill is in the pack, and Fit all builds it: the wall is the
 *     new one on the island and on the page;
 *   * the change planned is still in Change wall's list, shut, noted "planned" and pointing at Build change. It was
 *     left out, so a player looking for Solid > Marble did not find it.
 *
 * Makes its own island, and takes it away again.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from './pagebuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { MATERIAL_BY_ID, SIDE_NAMES, WALL_TYPE_BY_ID, wallBill, type Side, type WallType } from '../../src/game/building';
import { CHANGE_PLANNED, CHANGE_PLANNED_HINT, changeLine } from '../../src/game/gates';
import type { Row } from './changewallmenu-page';
import { bad, check, finish, psql } from './harness';

const U = '7e5b0000-0000-4000-8000-000000000c81';
const ISLE = 'Changemenu';
const W = `(select id from world where name = '${ISLE}')`;
const as = `select set_config('request.jwt.claims', json_build_object('sub', '${U}')::text, false) \\g /dev/null\n`;
const T = 40;
const HOUSE = [T + 2, T + 2] as const;
const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

/* ---- the island: a player, a settlement of theirs, and a house of finished plank walls, two storeys ----------- */

const drop = (): void => {
  psql(`do $d$ declare w uuid; begin
    select id into w from world where name = '${ISLE}';
    if w is null then return; end if;
    delete from wall where world_id = w;
    delete from floor_tile where world_id = w;
    delete from building_tile where world_id = w;
    delete from building where world_id = w;
    delete from world where id = w;
  end $d$;`);
};
drop();
const standing = wallBill('plank', 'solid');
const done = Object.fromEntries(Object.keys(standing.total).map((k) => [k, 0]));
psql(`${as}do $t$
declare w uuid; u uuid := '${U}';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('${ISLE}', 654, 80, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 80);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 8}, ${T + 8}) x, generate_series(${T - 8}, ${T + 8}) y;
  perform rpc_join(w, 'Builder');
  update player set x = ${HOUSE[0]} + 0.5, y = ${HOUSE[1]} + 0.5, level = 0, body_at = now(), swim_at = now(),
      stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1') where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Menustead', ${T}, ${T}, 10, 1, u);
  -- Ordinary skills: a plank wall's and a door's and a window's gates met (craftgates.ts), and a second storey.
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 30) on conflict (world_id, uid, id) do update set value = 30;
  perform give(w, u, 'mallet', 1, 40);
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 1, 'Hall', 2, 1, u);
  insert into building_tile (world_id, building, x, y) values (w, 1, ${HOUSE[0]}, ${HOUSE[1]});
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
  select w, lv, bd.dir, bd.x, bd.y, 1, 'solid', 'plank', ${j(done)}, ${j(standing.total)}, u
    from generate_series(0, 1) lv, (values ('n'), ('s'), ('e'), ('w')) s(sd), border_of(${HOUSE[0]}, ${HOUSE[1]}, s.sd) bd;
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total, planned_by)
    values (w, 1, ${HOUSE[0]}, ${HOUSE[1]}, 1, 'plank', 'floor', '{"plank": 0}', '{"plank": 4}', u);
end $t$;`);

let heard = Number(psql(`select coalesce(max(n), 0) from event where world_id = ${W} and uid = '${U}';`));
/** What the island holds now, as the page is handed it: the ground read, the skills, the pack, and the lines said since. */
const island = (): [unknown, Record<string, number>, Array<{ id: string; count: number; ql: number }>, Array<{ text: string; kind: string }>] => {
  const ground = JSON.parse(psql(`${as}delete from caller where uid = '${U}';\nselect rpc_ground(${W}, 40, true)::text;`));
  const skills = Object.fromEntries(psql(`select id || '=' || value from skill where world_id = ${W} and uid = '${U}';`)
    .split('\n').filter(Boolean).map((r) => [r.split('=')[0], Number(r.split('=')[1])]));
  const pack = psql(`select def || '=' || sum(count) || '=' || max(ql) from item where world_id = ${W} and holder = 'player' and holder_uid = '${U}' group by def;`)
    .split('\n').filter(Boolean).map((r) => { const [id, n, ql] = r.split('='); return { id, count: Number(n), ql: Number(ql) }; });
  const lines = psql(`select n || '|' || kind || '|' || text from event where world_id = ${W} and uid = '${U}' and n > ${heard} order by n;`)
    .split('\n').filter(Boolean).map((r) => {
      const [n, kind, ...text] = r.split('|');
      heard = Math.max(heard, Number(n));
      return { kind, text: text.join('|') };
    });
  return [ground, skills, pack, lines];
};
/** An ask as a page makes it: `rpc_act` with the target as the menu made it, and the job run out. What it said. */
const ask = (a: { action: string; target: unknown; goes?: number }): string => {
  try {
    psql(`${as}delete from caller where uid = '${U}';
select rpc_act(${W}, '${a.action}', ${j(a.target)}, ${a.goes ?? 1});
do $g$ declare i int; begin
  for i in 1 .. 200 loop
    exit when (select act from player where world_id = ${W} and uid = '${U}') is null;
    update player set act_ends = now() - interval '1 second', stats = jsonb_set(stats, '{stamina}', '1') where world_id = ${W} and uid = '${U}';
    perform settle(${W}, '${U}');
  end loop;
end $g$;`);
    return '';
  } catch (e) {
    // A call that raised, said in the island's words as `Island.act` says it.
    return String((e as { stderr?: string }).stderr ?? e).split('\n').find((l) => l.startsWith('ERROR')) ?? String(e);
  }
};
const wallOnIsland = (level: number, side: Side): string => {
  const [bx, by, dir] = side === 'e' ? [HOUSE[0] + 1, HOUSE[1], 'v'] : side === 's' ? [HOUSE[0], HOUSE[1] + 1, 'h'] : [HOUSE[0], HOUSE[1], side === 'n' ? 'h' : 'v'];
  return psql(`select wl.type || '|' || wl.material || '|' || coalesce((select ch.type || '|' || ch.material from wall_change ch
      where ch.world_id = wl.world_id and ch.level = wl.level and ch.dir = wl.dir and ch.x = wl.x and ch.y = wl.y), '-')
    from wall wl where wl.world_id = ${W} and wl.level = ${level} and wl.dir = '${dir}' and wl.x = ${bx} and wl.y = ${by};`);
};

const CASES: Array<{ name: string; level: number; side: Side; type: WallType; material: string }> = [
  { name: 'on the ground, to a door', level: 0, side: 'n', type: 'door', material: 'plank' },
  { name: 'on the ground, to log', level: 0, side: 'e', type: 'solid', material: 'log' },
  { name: 'a storey up, to a window', level: 1, side: 'n', type: 'window', material: 'plank' },
  { name: 'a storey up, to log', level: 1, side: 'e', type: 'solid', material: 'log' },
];

/* ---- the page ---------------------------------------------------------------------------------------------------- */

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}
const options = browserOptions();
if (!options) {
  console.log('changewallmenu: no Chromium here (set CHROME_PATH), so the menu was not driven.');
  if (process.env.STOREY_STRICT) bad.push('FAIL driven: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/changewallmenu-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Page = {
      stand: (x: number, y: number) => void;
      lay: (...a: ReturnType<typeof island>) => void;
      menu: (x: number, y: number, side?: Side) => Row[];
      choose: (x: number, y: number, side: Side | undefined, path: string[]) => string;
      asks: () => Array<{ action: string; target: unknown; goes?: number }>;
      wall: (level: number, x: number, y: number, side: Side) => { type: string; material: string; change?: unknown } | null;
      log: (n: number) => string[];
    };
    const page = <K extends keyof Page>(k: K, ...a: Parameters<Page[K]>): Promise<ReturnType<Page[K]>> =>
      tab.evaluate(([k2, a2]) => {
        const p = (window as unknown as { cwm: Record<string, (...x: unknown[]) => unknown> }).cwm;
        return p[k2 as string](...(a2 as unknown[]));
      }, [k, a] as const) as Promise<ReturnType<Page[K]>>;
    const lay = async (): Promise<void> => {
      await page('lay', ...island());
    };
    /** Choose down the menu of a side of the house, ask the island what it asked, and lay what comes back. */
    const choose = async (side: Side, path: string[]): Promise<{ chose: string; asked: string[]; raised: string[] }> => {
      const chose = await page('choose', HOUSE[0], HOUSE[1], side, path);
      const asks = await page('asks');
      const raised = asks.map(ask).filter(Boolean);
      await lay();
      return { chose, asked: asks.map((a) => `${a.action} ${JSON.stringify(a.target)}`), raised };
    };
    const shown = (rows: Row[]): string => rows.map((r) => `${r.label}${r.disabled ? ` [${r.hint}]` : ''}`).join(' / ');

    await page('stand', HOUSE[0] + 0.5, HOUSE[1] + 0.5);
    await lay();
    for (const c of CASES) {
      const sideName = SIDE_NAMES[c.side];
      const typeName = WALL_TYPE_BY_ID.get(c.type)!.name;
      const matName = MATERIAL_BY_ID.get(c.material)!.name;
      const where = `${sideName}, storey ${c.level + 1}`;
      const rows = await page('menu', HOUSE[0], HOUSE[1], c.side);
      const menu = rows.find((r) => r.label === `Change wall (${where})`);
      const typeRow = menu?.children?.find((r) => r.label === typeName);
      const matRow = typeRow?.children?.find((r) => r.label === matName);
      check(`${c.name}: the tile's menu has Change wall (${where}) → ${typeName} → ${matName}, open`,
        !!matRow && !matRow.disabled && !typeRow!.disabled && !menu!.disabled,
        menu ? `${shown(menu.children ?? [])}${typeRow ? `; ${typeName}: ${shown(typeRow.children ?? [])}` : ''}` : shown(rows));
      const planned = await choose(c.side, [`Change wall (${where})`, typeName, matName]);
      check(`${c.name}: chosen, the page asks the island for it`, planned.chose === 'chosen' && planned.asked.length === 1 && planned.raised.length === 0,
        `${planned.chose}; ${planned.asked.join(', ')}; ${planned.raised.join(', ')}`);
      const said = await page('log', 3);
      const want = changeLine(c.type, matName, sideName, c.level + 1);
      check(`${c.name}: the island plans it, and the page's log says so: "${want} …"`, said.some((l) => l.startsWith(`${want} Needs `)), said.join(' // '));
      check(`${c.name}: the change is on the wall on the island`, wallOnIsland(c.level, c.side) === `solid|plank|${c.type}|${c.material}`,
        wallOnIsland(c.level, c.side));
      const after = await page('menu', HOUSE[0], HOUSE[1], c.side);
      const buildRow = after.find((r) => r.label.startsWith(`Build change (${where})`));
      check(`${c.name}: the menu has Build change`, !!buildRow, shown(after));
      // The change planned stays in the list, shut, noted planned and pointing at Build change (`CHANGE_PLANNED`).
      const plannedRow = after.find((r) => r.label === `Change wall (${where})`)?.children?.find((r) => r.label === typeName)
        ?.children?.find((r) => r.label === matName);
      check(`${c.name}: and Change wall → ${typeName} → ${matName} still listed, shut: "${CHANGE_PLANNED}", "${CHANGE_PLANNED_HINT}"`,
        !!plannedRow && plannedRow.disabled && plannedRow.note === CHANGE_PLANNED && plannedRow.hint === CHANGE_PLANNED_HINT, JSON.stringify(plannedRow));
      psql(`${as}do $g$ begin ${Object.entries(wallBill(c.material, c.type).total).map(([id, n]) => `perform give(${W}, '${U}', '${id}', ${n}, 40);`).join(' ')} end $g$;`);
      await lay();
      const open = (await page('menu', HOUSE[0], HOUSE[1], c.side)).find((r) => r.label.startsWith(`Build change (${where})`));
      const all = open?.children?.find((r) => r.label.startsWith('Fit all'));
      check(`${c.name}: with its bill in the pack, Build change → Fit all is open`, !!open && !open.disabled && !!all && !all.disabled,
        open ? `${open.label} [${open.hint ?? ''}] ${shown(open.children ?? [])}` : 'none');
      const fitted = await choose(c.side, [`Build change (${where})`, 'Fit all']);
      check(`${c.name}: fitted, the wall is the new one on the island`, wallOnIsland(c.level, c.side) === `${c.type}|${c.material}|-`,
        `${wallOnIsland(c.level, c.side)}; ${fitted.chose}; ${(await page('log', 3)).join(' // ')}`);
      const wl = await page('wall', c.level, HOUSE[0], HOUSE[1], c.side);
      check(`${c.name}: and on the page`, wl?.type === c.type && wl.material === c.material && !wl.change, JSON.stringify(wl));
    }
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

drop();
finish('Change wall through the menu, asked of the island');
