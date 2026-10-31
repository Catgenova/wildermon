/**
 * The soundtrack: a score that reads, notes that make, and a loop that holds.
 *
 * Whether it sounds good is what ears are for. What is measured here:
 *
 *   **Every bar reads, and fits.** Each line of each bar parses, every note
 *   is on an instrument's keys, and nothing written runs past the end of its
 *   bar, so a slip in a score fails here rather than playing a wrong note.
 *
 *   **Every note makes, and makes something sane.** Each instrument is made
 *   at both ends of its range and its touch: finite samples, nothing over
 *   full scale, a start that is not a click and an end that has died away.
 *
 *   **A pass is the same each time it is played, and different each time
 *   round.** Seeded by the round and the bar, so a bug can be heard twice;
 *   not the same notes at the same moments twice round, so a loop is not a
 *   recording on repeat.
 *
 * Needs no database and no browser.
 */
import { celesta, feltPiano, harp, musicBox, NOTE_RATE, STEP, madeFor, type Making } from '../../src/audio/music/instruments';
import { formBars, line, locate, play, type Track } from '../../src/audio/music/score';
import { BLOSSOM } from '../../src/audio/music/tracks/blossom';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const TRACKS: Track[] = [BLOSSOM];
/** The keys each instrument has, low and high, MIDI. */
const RANGE = { piano: [28, 96], musicbox: [72, 100], celesta: [60, 96], harp: [36, 91] } as const;

/* ---- every bar reads, and fits ------------------------------------------- */

for (const t of TRACKS) {
  const problems: string[] = [];
  for (const [name, bars] of Object.entries(t.sections)) {
    bars.forEach((b, i) => {
      const at = `${t.id} ${name}${i + 1}`;
      for (const [who, text] of [['c', b.c.replace(/\|/g, ' ')], ['l', b.l], ['r', b.r], ['b', b.b], ['e', b.e], ['h', b.h]] as const) {
        if (!text) continue;
        try {
          for (const n of line(text, t.beats)) {
            if (n.beat + n.dur > t.beats + 1e-6 && who !== 'c') problems.push(`${at} ${who} runs to beat ${n.beat + n.dur}`);
          }
        } catch (e) {
          problems.push(`${at} ${who}: ${(e as Error).message}`);
        }
      }
    });
  }
  check(`${t.name}: every line of every bar reads and ends inside its bar`, problems.length === 0, problems.slice(0, 5).join('; ') || `${formBars(t)} bars`);

  const off: string[] = [];
  for (let n = 0; n < formBars(t) * 2; n += 1) {
    const { pass, bar } = locate(t, n);
    for (const h of play(t, pass, bar, Math.floor(n / formBars(t))).hits) {
      const [lo, hi] = RANGE[h.kind];
      if (h.m < lo || h.m > hi) off.push(`${h.kind} ${h.m} in bar ${n + 1}`);
      if (!(h.vel > 0 && h.vel <= 1)) off.push(`touch ${h.vel} in bar ${n + 1}`);
      if (h.off < h.beat) off.push(`let go before struck in bar ${n + 1}`);
    }
  }
  check(`${t.name}: every note struck is on its instrument's keys, with a touch, let go after it is struck`, off.length === 0, off.slice(0, 5).join('; ') || 'twice round');

  check(`${t.name}: its sections are whole phrases of four bars`,
    Object.values(t.sections).every((bars) => bars.length % 4 === 0),
    Object.entries(t.sections).map(([k, v]) => `${k} ${v.length}`).join(', '));

  /* ---- the same pass the same, a different round different ---------------- */

  const same = JSON.stringify(play(t, 0, 0, 0)) === JSON.stringify(play(t, 0, 0, 0));
  check(`${t.name}: a pass of a bar is the same each time it is played`, same);
  let differs = 0;
  for (let bar = 0; bar < t.sections[t.form[0].s].length; bar += 1) {
    if (JSON.stringify(play(t, 0, bar, 0)) !== JSON.stringify(play(t, 0, bar, 1))) differs += 1;
  }
  check(`${t.name}: and every bar of it is played differently the second time round`,
    differs === t.sections[t.form[0].s].length, `${differs} of ${t.sections[t.form[0].s].length}`);

  const secs = (() => {
    let s = 0;
    for (let n = 0; n < formBars(t); n += 1) s += (t.beats * 60) / t.bpm;
    return s;
  })();
  check(`${t.name}: a loop runs long enough not to wear thin`, secs > 180, `${(secs / 60).toFixed(1)} min at ${t.bpm} BPM`);
}

/* ---- every note makes, and makes something sane ------------------------- */

const drain = (it: Making): Float32Array => {
  let r = it.next();
  let steps = 0;
  while (!r.done) {
    r = it.next();
    steps += 1;
  }
  if (steps === 0) throw new Error('made in one step: nothing to spread over frames');
  return r.value;
};
const made: string[] = [];
const wrong: string[] = [];
const makers = { piano: feltPiano, musicbox: musicBox, celesta, harp };
for (const [kind, make] of Object.entries(makers) as Array<[keyof typeof makers, typeof feltPiano]>) {
  const [lo, hi] = RANGE[kind];
  for (const m of [lo, Math.round((lo + hi) / 2), hi]) {
    for (const vel of [0, 1]) {
      const d = drain(make(NOTE_RATE, m, vel));
      let peak = 0;
      let finite = true;
      for (const v of d) {
        if (!Number.isFinite(v)) finite = false;
        peak = Math.max(peak, Math.abs(v));
      }
      const tail = Math.max(...Array.from(d.subarray(d.length - 32)).map(Math.abs));
      const start = Math.abs(d[0]);
      const at = `${kind} ${m} touch ${vel}`;
      made.push(at);
      if (!finite) wrong.push(`${at}: not a number in it`);
      if (peak > 1 || peak < 0.1) wrong.push(`${at}: peak ${peak.toFixed(2)}`);
      if (start > 0.05) wrong.push(`${at}: starts at ${start.toFixed(3)}, a click`);
      if (tail > 0.01) wrong.push(`${at}: ends at ${tail.toFixed(3)}, cut off`);
    }
  }
}
check('every instrument makes at both ends of its keys and its touch: finite, under full scale, no click in, no cut-off out',
  wrong.length === 0, wrong.slice(0, 5).join('; ') || `${made.length} notes`);

const roots = new Set<number>();
for (let m = 28; m <= 100; m += 1) {
  const { root } = madeFor('piano', m, 0.5);
  roots.add(root);
  if (Math.abs(root - m) > 1) wrong.push(`${m} played from ${root}`);
}
check(`a note is played from one made at most a semitone off, one made every ${STEP} semitones`,
  wrong.length === 0, `${roots.size} made for 73 keys`);

for (const l of [...ok, ...bad]) console.log(l);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the soundtrack reads, makes and loops — ${ok.length} of ${ok.length}`);
