/**
 * How the Unity client ran, and what the island keeps of it.
 *
 * `rpc_perf_report` writes a report down (its minutes and spikes as sent, texts cut to length), refuses one with no
 * minutes or too much in it, hears one account twelve times an hour and no more, and nobody reads the table back
 * through the API.
 */
import { execFileSync } from 'node:child_process';
import { ok, bad, check } from './harness';

const WHO = '45454545-4545-4545-4545-454545454545';

const psql = (sql: string, as = WHO): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
    input: `select set_config('request.jwt.claims', '{"sub":"${as}"}', false) \\g /dev/null\n${sql}\n`,
    encoding: 'utf8',
  }).trim();

const MINUTE = { t: 1, f: 3600, fps: 60, avg: 16.7, med: 16.6, p99: 22, worst: 80, spikes: 1, gc: 2, top: [['LandRenderer.Chunks', 900, 40]], ctx: 'at 10,12 L0' };
const SPIKE = { t: 0.8, ms: 80, top: [['LandRenderer.Build', 52.1], ['GC.Collect', 11]], gc: 1, kb: 300, ctx: 'walking; at 10,12 L0' };
const json = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const report = (minutes: unknown, spikes: unknown = [SPIKE], build = 'unity 0.0.9.12'): string =>
  `select rpc_perf_report('abc123', '${build}', 'GPU | CPU', ${json(minutes)}, ${json(spikes)}, null)`;

psql(`delete from perf_report where uid = '${WHO}'`);
psql(report([MINUTE]));
const row = psql(`select session || '|' || build || '|' || device || '|' || (minutes->0->>'fps') || '|' || (spikes->0->'top'->0->>0)
                    from perf_report where uid = '${WHO}'`);
check('a report is written down with its session, build, machine, minutes and spikes',
  row === 'abc123|unity 0.0.9.12|GPU | CPU|60|LandRenderer.Build', row);

psql(`select rpc_perf_report(repeat('s', 500), repeat('b', 500), repeat('d', 5000), ${json([MINUTE])}, '[]'::jsonb)`);
const lengths = psql(`select length(session) || ',' || length(build) || ',' || length(device) from perf_report where uid = '${WHO}' order by id desc limit 1`);
check('and cut to length', lengths === '40,40,400', lengths);

const before = Number(psql(`select count(*) from perf_report where uid = '${WHO}'`));
psql(report([]));
psql(`select rpc_perf_report('a', 'b', 'c', '{"t":1}'::jsonb, '[]'::jsonb)`);
psql(report(Array.from({ length: 61 }, () => MINUTE)));
const after = Number(psql(`select count(*) from perf_report where uid = '${WHO}'`));
check('one with no minutes, not a list of them, or more than an hour of them is not written', after === before, `${after - before} written`);

psql(report([MINUTE], Array.from({ length: 101 }, () => SPIKE)));
const spikes = psql(`select jsonb_array_length(spikes) from perf_report where uid = '${WHO}' order by id desc limit 1`);
check('more than a hundred spikes: the minutes kept, the spikes not', spikes === '0', spikes);

for (let i = 0; i < 20; i++) psql(report([MINUTE]));
const heard = Number(psql(`select count(*) from perf_report where uid = '${WHO}' and at > now() - interval '1 hour'`));
check('one account is heard twelve times an hour and no more', heard === 12, `${heard} kept`);

const read = psql(`set role authenticated; select count(*) from perf_report; reset role;`);
check('nobody reads the reports back through the API', read === '0', `${read} rows visible`);
const anon = psql(`select has_function_privilege('anon', 'public.rpc_perf_report(text,text,text,jsonb,jsonb,uuid)', 'execute')`);
check('and only somebody signed in can write one', anon === 'f', anon);

psql(`delete from perf_report where uid = '${WHO}'`);

for (const line of [...ok, ...bad]) console.log(`  ${line}`);
console.log(bad.length ? `\n${bad.length} of ${ok.length + bad.length} went wrong` : `\nhow the Unity client ran — ${ok.length} of ${ok.length}`);
process.exit(bad.length ? 1 : 0);
