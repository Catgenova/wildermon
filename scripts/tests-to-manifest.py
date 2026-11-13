#!/usr/bin/env python3
"""Fold the rules job's one-test steps into supabase/test/manifest.json.

A step of `rules` in .github/workflows/island.yml that is nothing but

    npx esbuild supabase/test/X.ts --bundle --platform=node --format=esm [flags] \
      --outfile=node_modules/.cache/X.mjs --log-level=error
    node [node flags] node_modules/.cache/X.mjs

(with a name, an optional `if: matrix.shard == N` and optional env) becomes a
manifest entry, and the step is taken out of the workflow. Anything else stays
a step. Run again after a merge that brought new steps in: entries already in
the manifest are kept as they are, new ones are appended.

    python3 scripts/tests-to-manifest.py [--check]

--check changes nothing and exits 1 when a step is still to be folded.
"""
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / '.github/workflows/island.yml'
MANIFEST = ROOT / 'supabase/test/manifest.json'

ESBUILD = re.compile(
    r'^npx esbuild (?P<file>supabase/test/[\w.-]+\.ts) --bundle --platform=node --format=esm'
    r'(?P<flags>(?: --(?:external:[\w@/.-]+|packages=external))*)'
    r' --outfile=(?P<out>node_modules/\.cache/[\w.-]+\.mjs) --log-level=error$')
NODE = re.compile(r'^node(?P<flags>(?: --max-old-space-size=\d+)*) (?P<out>node_modules/\.cache/[\w.-]+\.mjs)$')
SHARD = re.compile(r'^matrix\.shard == (\d+)$')
BARE = re.compile(r"""(?:from|import)\s*\(?\s*'([^.'/][^']*)'""")


def commands(run):
    """The run's commands, comments dropped and continuations joined."""
    out, cur = [], ''
    for line in run.split('\n'):
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        if s.endswith('\\'):
            cur += s[:-1].strip() + ' '
            continue
        cur += s
        out.extend(c.strip() for c in cur.split(' && '))
        cur = ''
    if cur:
        out.append(cur.strip())
    return [re.sub(r'\s+', ' ', c) for c in out]


def comment(run, above):
    lines = [l.strip()[1:].strip() for l in above] + [
        l.strip()[1:].strip() for l in run.split('\n') if l.strip().startswith('#')]
    return ' '.join(l for l in lines if l)


def packages_of(file):
    """The packages a test imports itself: what `--packages=external` left to node_modules."""
    src = (ROOT / file).read_text()
    names = {m.split('/')[0] if not m.startswith('@') else '/'.join(m.split('/')[:2])
             for m in BARE.findall(src) if not m.startswith('node:')}
    return sorted(n for n in names if (ROOT / 'node_modules' / n).exists() or n in ('esbuild', 'playwright-core'))


def entry(step, above, shard):
    if set(step) - {'name', 'if', 'run', 'env'} or 'name' not in step or 'run' not in step:
        return None
    cmds = commands(step['run'])
    if len(cmds) != 2:
        return None
    b, n = ESBUILD.match(cmds[0]), NODE.match(cmds[1])
    if not b or not n or b['out'] != n['out']:
        return None
    if step.get('if') is not None and not SHARD.match(str(step['if'])):
        return None
    e = {'file': b['file'], 'title': step['name']}
    e['shard'] = int(SHARD.match(step['if'])[1]) if step.get('if') is not None else shard
    flags = b['flags'].split()
    external = [f.split(':', 1)[1] for f in flags if f.startswith('--external:')]
    if '--packages=external' in flags:
        external += packages_of(b['file'])
    if external:
        e['external'] = sorted(set(external))
    if step.get('env'):
        e['env'] = {k: str(v) for k, v in step['env'].items()}
    if n['flags'].strip():
        e['node'] = n['flags'].split()
    e['why'] = comment(step['run'], above)
    return e


def main():
    check = '--check' in sys.argv
    text = WORKFLOW.read_text()
    lines = text.split('\n')
    doc = yaml.safe_load(text)
    steps = doc['jobs']['rules']['steps']

    start = next(i for i, l in enumerate(lines) if l == '  rules:')
    end = next(i for i in range(start + 1, len(lines)) if re.match(r'^  \S', lines[i]))
    first = next(i for i in range(start, end) if lines[i] == '    steps:') + 1
    # Each step's lines: its own, and the comment lines straight above it.
    heads = [i for i in range(first, end) if lines[i].startswith('      - ')]
    if len(heads) != len(steps):
        sys.exit(f'{len(heads)} step heads in the text, {len(steps)} steps in the YAML')
    blocks = []
    for k, h in enumerate(heads):
        top = h
        while top - 1 >= first and lines[top - 1].startswith('      #'):
            top -= 1
        stop = heads[k + 1] if k + 1 < len(heads) else end
        while stop - 1 > h and lines[stop - 1].startswith('      #'):
            stop -= 1
        blocks.append((top, h, stop))

    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    seen = {(t['file'], json.dumps(t.get('env', {}), sort_keys=True)) for t in manifest}
    drop, added, shard = set(), [], 1
    for (top, h, stop), step in zip(blocks, steps):
        e = entry(step, lines[top:h], shard)
        if not e:
            continue
        shard = e['shard']
        drop.update(range(top, stop))
        key = (e['file'], json.dumps(e.get('env', {}), sort_keys=True))
        if key in seen:
            sys.exit(f"{e['file']} is in the manifest already and still a step: take one out")
        seen.add(key)
        added.append(e)

    print(f'{len(steps)} steps in rules, {len(added)} to fold, {len(manifest)} in the manifest already')
    if check:
        sys.exit(1 if added else 0)
    if not added:
        return
    # Out with the folded steps, and no run of blank lines left where they were.
    out, gap = [], False
    for i, l in enumerate(lines):
        if i in drop:
            gap = True
            continue
        if l == '' and gap and out and out[-1] == '':
            continue
        gap = False
        out.append(l)
    WORKFLOW.write_text('\n'.join(out))
    MANIFEST.write_text(json.dumps(manifest + added, indent=2, ensure_ascii=False) + '\n')
    after = yaml.safe_load(WORKFLOW.read_text())
    folded = {id(step) for (top, h, stop), step in zip(blocks, steps) if top in drop}
    if after['jobs']['rules']['steps'] != [s for s in steps if id(s) not in folded]:
        sys.exit('the steps left are not the steps that were not folded')
    for job in doc['jobs']:
        if job != 'rules' and after['jobs'][job] != doc['jobs'][job]:
            sys.exit(f'job {job} changed')
    print(f"{len(after['jobs']['rules']['steps'])} steps left in rules, {len(manifest) + len(added)} in the manifest")

if __name__ == '__main__':
    main()
