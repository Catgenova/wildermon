/**
 * What changed in the generated definitions, and nothing else.
 *
 * Every `*_defs.sql` was a complete snapshot of the rulebook — truncate and
 * refill, four hundred kilobytes of it — written afresh whenever any one
 * number moved. Twenty-five of them came to **8.7 MB of the repository's 10**,
 * and every fresh database and every CI run replayed all twenty-five to arrive
 * at the last one.
 *
 * The snapshot is not the problem; keeping twenty-five is. So the snapshot
 * lives once, in `supabase/defs-state.sql`, outside `migrations/` where it can
 * be rewritten, and a migration carries the difference.
 *
 * ## What may safely be a difference
 *
 * Every statement in the dump is idempotent **except the inserts and
 * updates**, which only mean anything after the `delete from` that clears
 * their table.
 *
 * So the rule is per table. The data statements are grouped by the table they
 * write (`delete from t`, `insert into t`, `update t`), and a table is
 * reloaded -- its delete and every insert and update for it, in the dump's own
 * order -- when that group differs from the last snapshot's. A table whose
 * group is unchanged is left alone. A reloaded table drags in every table
 * with a foreign key to it (read off the dump's `references`): those keys are
 * `on delete cascade`, so emptying the parent empties the child too. Every
 * statement that is not data goes in only if it is new or changed.
 *
 * This used to reload *every* table if any one row moved, which made 290 of
 * the definitions migrations whole one-megabyte copies of the rulebook that
 * differed from their neighbours by a handful of lines. A data statement this
 * cannot place on a table (or a `truncate`, which can name several) falls back
 * to that: every data statement goes in.
 *
 * ## Why the other statements have to be left out
 *
 * That last clause used to read "the migration is the whole snapshot", and it
 * was wrong in a way that only a live island could show. The snapshot opens
 * with seventy pieces of DDL — `create table if not exists`, `alter table ...
 * add column if not exists`, `enable row level security` — every one of them
 * idempotent, and every one of them a no-op on a project that has run them
 * before.
 *
 * A no-op `alter table` is not free. Postgres takes ACCESS EXCLUSIVE *before*
 * it looks to see whether there is anything to do, and holds it to the end of
 * the transaction. ACCESS EXCLUSIVE conflicts with the ACCESS SHARE every
 * reader takes, so on `tile_def` -- which the clock and every land read touch
 * constantly -- the alter can only get in during a gap that never comes. Worse,
 * the moment it starts waiting, every reader queues behind it.
 *
 * Measured, on the real project: `alter table tile_def add column if not
 * exists paved ...` could not get the lock in three seconds and the deploy
 * failed. That was the `lock_timeout` doing its job -- the alternative is an
 * island that stops until the deploy gives up -- but the deploy has to land,
 * and the way it lands is by not asking for the lock at all. A change to a
 * number has no business touching the shape of a table.
 */

/** Split generated SQL into statements, respecting dollar quoting. */
export function statements(sql) {
  const out = [];
  let buf = [];
  let tag = null;
  for (const line of sql.split('\n')) {
    buf.push(line);
    let rest = line;
    for (;;) {
      if (tag) {
        const end = rest.indexOf(tag);
        if (end < 0) break;
        rest = rest.slice(end + tag.length);
        tag = null;
      } else {
        const m = /\$[A-Za-z_]*\$/.exec(rest);
        if (!m) break;
        tag = m[0];
        rest = rest.slice(m.index + m[0].length);
      }
    }
    if (!tag && /;\s*$/.test(line)) {
      out.push(buf.join('\n'));
      buf = [];
    }
  }
  if (buf.join('\n').trim()) out.push(buf.join('\n'));
  return out;
}

/**
 * A statement that only means anything beside the others in its group.
 *
 * `delete from` is in here for the same reason `truncate` was, and the reason
 * is worth stating plainly because getting it wrong is silent. These
 * statements are the ones that clear a table before its inserts refill it. If
 * one of them is ever judged "unchanged since last time, so already applied"
 * and left out, the inserts behind it land in a table that was never emptied
 * -- and every rulebook table doubles, on every deploy, with nothing said.
 *
 * `truncate` stays on the list though nothing emits one any more: an old
 * snapshot in `defs-state.sql` may still carry them, and the comparison is
 * made against whatever is there.
 *
 * The `m` flag is load-bearing for the same reason -- it was added when the
 * truncate was wrapped in a retry loop, so that the wrapper did not read as
 * ordinary DDL. A plain `delete from` needs no wrapper, but the flag costs
 * nothing and the next thing that wants wrapping will want it.
 */
const DATA = /^\s*(insert\s+into|update\s|truncate\s|delete\s+from)/im;

/** The statements that only mean anything next to their truncate. */
export const dataOnly = (list) => list.filter((s) => DATA.test(s));

/**
 * The table a data statement writes, or null when it cannot be told: read off
 * the first line `DATA` matches. A `truncate` is null too, since it can name
 * several tables.
 */
const TARGET = /^\s*(?:insert\s+into|update|delete\s+from)\s+(?:only\s+)?([\w.]+)/i;
export const tableOf = (s) => {
  const line = DATA.exec(s);
  if (!line) return null;
  return TARGET.exec(s.slice(line.index))?.[1] ?? null;
};

/** Each table's data statements, in the dump's order; null if one has no table. */
const byTable = (list) => {
  const out = new Map();
  for (const s of dataOnly(list)) {
    const t = tableOf(s);
    if (!t) return null;
    if (!out.has(t)) out.set(t, []);
    out.get(t).push(s);
  }
  return out;
};

/**
 * Child tables by parent, from the `references` in the dump's own
 * `create table` and `alter table` statements.
 */
const OWNER = /^\s*(?:create\s+table\s+(?:if\s+not\s+exists\s+)?|alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?)([\w.]+)/im;
const children = (list) => {
  const out = new Map();
  for (const s of list) {
    if (DATA.test(s)) continue;
    const owner = OWNER.exec(s)?.[1];
    if (!owner) continue;
    for (const m of s.matchAll(/\breferences\s+([\w.]+)/gi)) {
      if (m[1] === owner) continue;
      if (!out.has(m[1])) out.set(m[1], new Set());
      out.get(m[1]).add(owner);
    }
  }
  return out;
};

const same = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);

/**
 * The migration to write, given the last snapshot and the new one.
 *
 * Returns `{ sql, tables, whole, count, ddl }`: `tables` the tables reloaded,
 * in the order the dump first writes them; `whole` whether that is every
 * table the dump writes; `count` the statements carried; `ddl` the statements
 * carried that are not data, set only when a table is reloaded.
 */
export function delta(oldSql, newSql) {
  const older = statements(oldSql);
  const newer = statements(newSql);
  const had = new Set(older);
  const oldTables = byTable(older);
  const newTables = byTable(newer);

  /*
   * The tables to reload: every table whose data statements differ, then
   * every table with a key to one of those, until nothing more is added (a
   * Set visits what is added to it during the loop). A data statement with no
   * table, in either snapshot, makes it every data statement.
   */
  const reload = new Set();
  const all = !oldTables || !newTables;
  if (all) {
    if (dataOnly(older).join('\n') !== dataOnly(newer).join('\n')) reload.add('*');
  } else {
    for (const [t, list] of newTables) if (!same(list, oldTables.get(t) ?? [])) reload.add(t);
    const kids = children(newer);
    for (const t of reload) for (const k of kids.get(t) ?? []) reload.add(k);
  }
  const reloaded = (s) => reload.has('*') || reload.has(tableOf(s));

  /*
   * In the dump's own order. A table's data goes in entire or not at all;
   * the statements that are not data go in only if they are new, which on an
   * established project is none of them: see the note above on what a no-op
   * `alter table` costs.
   */
  const kept = newer.filter((s) => (DATA.test(s) ? reloaded(s) : !had.has(s)));
  const ddl = kept.filter((s) => !DATA.test(s)).length;
  const tables = [...new Set(dataOnly(kept).map((s) => tableOf(s) ?? '(truncate)'))];
  const head = reload.size
    ? [
      '-- Generated by scripts/dump-defs.ts from the TypeScript definitions.',
      '-- Do not edit: run `npm run defs` instead.',
      '--',
      '-- What changed since the last one. Tables reloaded (emptied, every row put',
      '-- back) because a row of theirs changed or they point at a table that did:',
      ...tables.map((t) => `--   ${t}`),
      '-- Every other table is left as it is. Of the statements that are not data,',
      '-- only the new or changed ones are here: a no-op `alter table` still takes',
      '-- ACCESS EXCLUSIVE to find out it has nothing to do. The whole snapshot',
      '-- lives in supabase/defs-state.sql.',
      '--',
      '-- Nothing in here asks for a lock a reader would have to wait behind:',
      '-- `delete` takes ROW EXCLUSIVE, which does not conflict with the ACCESS',
      '-- SHARE a read takes. A deploy of this can land while the island is busy.',
      '',
    ]
    : [
      '-- Generated by scripts/dump-defs.ts from the TypeScript definitions.',
      '-- Do not edit: run `npm run defs` instead.',
      '--',
      '-- What changed since the last one. The rulebook itself did not move, so',
      '-- this is only the statements that did — every one of them idempotent, in',
      '-- the order the dump writes them. The whole snapshot lives in',
      '-- supabase/defs-state.sql.',
      '',
    ];
  return {
    sql: `${head.join('\n')}${kept.join('\n')}\n`,
    tables,
    whole: reload.has('*') || (reload.size > 0 && tables.length === newTables.size),
    count: kept.length,
    ddl: reload.size ? ddl : undefined,
  };
}
