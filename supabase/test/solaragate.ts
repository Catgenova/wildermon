/**
 * A settlement grown to Solara's size (`tools/perf/sql`: twelve houses of two storeys, 82 pieces holding 300 things
 * each, 19 crates, 648 things lying about, 30 workers, 10 companions at heel, 10 crated) and what a browser standing in
 * the middle of it is sent. Gates on what is counted, never on time:
 *
 *   * a thing lying about is sent in at most `LYING_BYTES` (each was its whole row, 560 bytes);
 *   * asked again with nothing written, the crates are left out (they were 10 kB of every answer);
 *   * and no companion at heel is sent again, but one with panniers (each was written, and so sent, on every settle);
 *   * and the whole of that answer is at most `DELTA_KB` (it was 20 kB).
 *
 * On a copy of the database it is given (`template`), dropped after.
 */
import { execFileSync } from 'node:child_process';

const LYING_BYTES = 110;
const DELTA_KB = 10;

const env = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wildermon',
};
const base = process.env.PGDATABASE ?? 'postgres';
const COPY = 'solara_gate';
const admin = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-d', 'template1', '-c', sql], { encoding: 'utf8', env }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

admin(`drop database if exists ${COPY}`);
admin(`create database ${COPY} template ${base}`);
let m: Record<string, number | null>;
try {
  const copy = { ...env, PGDATABASE: COPY };
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', 'tools/perf/sql/world.sql'], { encoding: 'utf8', env: copy, stdio: ['ignore', 'ignore', 'inherit'] });
  const line = execFileSync('bash', ['tools/perf/sql/run.sh', 'solara', '12', '2', '82', '300', '19', '10', '648', '30', '10', '10'],
    { encoding: 'utf8', env: copy, maxBuffer: 64 * 1024 * 1024 }).trim().split('\n').pop()!;
  m = (JSON.parse(line) as { m: Record<string, number | null> }).m;
} finally {
  admin(`drop database if exists ${COPY}`);
}

const lyingN = m.lying_n ?? 0;
const lyingBytes = lyingN ? ((m.lying_kb ?? 0) * 1024) / lyingN : Infinity;
check(`a thing lying about is sent in at most ${LYING_BYTES} bytes`, lyingN >= 600 && lyingBytes <= LYING_BYTES,
  `${lyingN} things, ${lyingBytes.toFixed(0)} bytes each`);
check('asked again with nothing written, the crates are left out', m.delta_crates_kb === null, String(m.delta_crates_kb));
check('and no companion at heel is sent again, but one with panniers', m.delta_active === 0, `${m.delta_active} of ${m.delta_cre_rows} rows`);
check(`and that answer is at most ${DELTA_KB} kB`, (m.delta_kb ?? Infinity) <= DELTA_KB, `${m.delta_kb} kB`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na settlement grown to Solara's size, what it sends — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
