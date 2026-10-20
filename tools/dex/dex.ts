/**
 * The wildermon dex, worked out in a browser: every kind that can be kept, one row each, with what each stage looks like
 * going through its moves, what it is and does, and how it takes to you; and every trait in its grades. Run by
 * tools/dex/build.mjs, which writes the page.
 *
 * Each stage's moves are drawn once, here, with the game's own renderer, as a strip of frames the page plays through;
 * everything written on the page is read off the rules, so a rebuild is all it takes to bring it up to date.
 */
import { WILDERMON, WILDERMON_STAGES } from '../../src/render/wildermon';
import { ACT_SECS, drawKind, evolveBurst, extentOf, kitOf, paletteFor, type Anim, type Kind } from '../../src/render/beasts';
import { abilityName, abilitySays, EVOLVE_AT, HUNT_SIGHT, NIP_EVERY, SPECIES, STAGE_MUL, STANCE_NAMES, STYLE_SAYS, type SpeciesDef } from '../../src/game/creatures';
import { guidePage, keepable } from '../../src/game/guide';
import { FIGHTING, gradeId, TIERS, TRAIT_BY_ID, TRAIT_SLOTS, TRAITS, traitSays, WILD_ODDS, type TraitTier } from '../../src/game/traits';
import { WOUND_KINDS } from '../../src/game/wounds';
import { capital, percent } from '../../src/game/words';

/** Frames a second the strips are drawn at and played at. */
export const FPS = 12;
/** A frame's side, in pixels. */
const SIDE = 168;

interface Frame { label: string; a: Partial<Anim> }
/** One run of frames of one move, in the order they are played. */
export interface Segment { label: string; frames: number }
export interface StageOut {
  name: string;
  /** The level it is reached at; nought for the first. */
  at: number;
  /** Its strip, a webp data URL, or nothing where no model has been made for it yet. */
  strip: string | null;
  segments: Segment[];
  health: number;
  attack: number;
  speed: number;
}
export interface RowOut {
  id: string;
  name: string;
  was: string[];
  /** `line`: a model for every stage; `named`: three names, one model so far; `single`: one name, one model. */
  status: 'line' | 'named' | 'single';
  stages: StageOut[];
  tame: string;
  wound: string;
  trade: string[];
  temper: { label: string; lines: string[] };
}
export interface TraitOut { name: string; note: string; aura: boolean; fighting: boolean; grades: Partial<Record<TraitTier, string>> }

const still: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0.3 };

/** Every frame of a stage, move after move: standing, a stride of its walk and of its run, and each act it has. */
function plan(kind: Kind, stage: number): Frame[] {
  const out: Frame[] = [];
  const run = (label: string, n: number, at: (i: number) => Partial<Anim>): void => {
    for (let i = 0; i < n; i++) out.push({ label, a: at(i) });
  };
  run('Stand', FPS, (i) => ({ t: i / FPS, breath: i / FPS }));
  run('Walk', FPS, (i) => ({ go: 1, gait: 0, u: i / FPS, t: i / FPS }));
  run('Run', 10, (i) => ({ go: 1, gait: 1, u: i / 10, t: i / 10 }));
  const acts = kind.acts ?? [];
  const act = (k: 'strike' | 'work' | 'cast', label: string): void => {
    const n = Math.round(ACT_SECS[k] * FPS);
    run(label, n, (i) => ({ act: { kind: k, t: i / n } }));
  };
  if (acts.includes('strike')) act('strike', 'Strike');
  if (acts.includes('work')) act('work', 'Work');
  else run('Graze', FPS, (i) => ({ graze: Math.sin((i / FPS) * Math.PI) }));
  if (acts.includes('cast')) act('cast', 'Ability');
  if (stage > 0) {
    const n = Math.round(ACT_SECS.evolve * FPS);
    run('Evolve', n, (i) => ({ act: { kind: 'evolve', t: i / n } }));
  }
  return out;
}

/** A stage's model and the key its pieces and colours are kept under. */
function modelOf(id: string, stage: number): { kind: Kind; key: string } | null {
  if (stage === 0) return { kind: WILDERMON[id], key: id };
  const kind = WILDERMON_STAGES[id]?.[stage - 1];
  return kind ? { kind, key: `${id}@${stage}` } : null;
}

/** The pixels a unit is drawn at for a whole line, off its biggest stage standing, so the stages show their sizes. */
function scaleOf(models: { kind: Kind; key: string }[]): number {
  let k = Infinity;
  for (const m of models) {
    const e = extentOf(m.kind, kitOf(m.key, m.kind, 1), 1, still);
    const bw = e.x1 - e.x0;
    const bh = Math.max(e.y1, 0) - e.y0;
    k = Math.min(k, (SIDE * 0.6) / Math.max(1, bw), (SIDE * 0.58) / Math.max(1, bh));
  }
  return k;
}

/** A stage's strip: its frames side by side, each drawn as the game draws it. */
function strip(def: SpeciesDef, m: { kind: Kind; key: string }, stage: number, k: number): { url: string; segments: Segment[] } {
  const frames = plan(m.kind, stage);
  const cv = document.createElement('canvas');
  cv.width = SIDE * frames.length;
  cv.height = SIDE;
  const g = cv.getContext('2d')!;
  const kit = kitOf(m.key, m.kind, 1);
  const pal = paletteFor(m.key, m.kind, def.variants[0]);
  const e = extentOf(m.kind, kit, 1, still);
  const bh = Math.max(e.y1, 0) - e.y0;
  frames.forEach((f, i) => {
    const a: Anim = { ...still, ...f.a };
    g.save();
    g.beginPath();
    g.rect(i * SIDE, 0, SIDE, SIDE);
    g.clip();
    g.translate(i * SIDE + SIDE / 2 - ((e.x0 + e.x1) / 2) * k, SIDE * 0.84);
    g.scale(k, k);
    if (a.act?.kind === 'evolve') evolveBurst(g, m.key, m.kind, pal, a.act.t, true);
    drawKind(g, m.kind, kit, pal, 1, a, Math.max(0.9, 1.2 * Math.min(1, 40 / (bh * k))) / k, 1 / k);
    if (a.act?.kind === 'evolve') evolveBurst(g, m.key, m.kind, pal, a.act.t, false);
    g.restore();
  });
  const segments: Segment[] = [];
  for (const f of frames) {
    const last = segments[segments.length - 1];
    if (last && last.label === f.label) last.frames++;
    else segments.push({ label: f.label, frames: 1 });
  }
  return { url: cv.toDataURL('image/webp', 0.86), segments };
}

/** How it takes to you, wild and kept, in the rules' own numbers. */
function temper(def: SpeciesDef): { label: string; lines: string[] } {
  const lines: string[] = [];
  let label = 'Docile';
  if (def.hunter) {
    label = 'Hunter';
    lines.push(`Wild, it comes for you on sight from ${def.notice ?? HUNT_SIGHT} tiles off`);
  } else if (def.defensive) {
    label = 'Strikes back';
  } else if (def.timid) {
    label = 'Skittish';
  }
  if (def.timid) lines.push('Wild, it bolts when struck');
  if (def.defensive) lines.push('Strikes back every time it is struck');
  if (!def.timid && !def.defensive && !def.hunter) lines.push('Wild, it neither bolts nor strikes back');
  if (def.unruly) {
    if (label === 'Docile') label = 'Unruly';
    lines.push(`Kept, it rounds on you when you stand beside it: ${percent(def.unruly)} odds every ${NIP_EVERY} seconds`);
  }
  lines.push(`Tamed, it starts out ${STANCE_NAMES[def.defaultStance ?? 'defensive'].toLowerCase()}`);
  return { label, lines };
}

/** Its trade, what it gives and carries, and what it does in a fight beyond a blow. */
function trade(def: SpeciesDef): string[] {
  const kept = guidePage(def).find((s) => s.head === 'Kept')?.lines ?? [];
  // Its temper, a kept one's nip among it, is the next column's.
  const lines = kept.filter((l) => !l.includes('on whoever stands beside it'));
  if (def.style) lines.push(`In a fight, ${STYLE_SAYS[def.style]}`);
  if (def.ability) lines.push(`${abilityName(def.ability)}: ${abilitySays(def.ability)}`);
  return lines;
}

function rows(): RowOut[] {
  return Object.values(SPECIES).filter(keepable).map((def): RowOut => {
    const names = [def.name, ...(def.stages ?? []).map((s) => s.name)];
    const models = names.map((_, s) => modelOf(def.id, s));
    const made = models.filter((m): m is { kind: Kind; key: string } => !!m);
    const k = scaleOf(made);
    const stages = names.map((name, s): StageOut => {
      const m = models[s];
      const drawn = m ? strip(def, m, s, k) : null;
      const mul = (ch: 'hardy' | 'tough' | 'speed'): number => (STAGE_MUL[ch] ?? 1) ** s;
      return {
        name,
        at: s === 0 ? 0 : EVOLVE_AT[s - 1],
        strip: drawn?.url ?? null,
        segments: drawn?.segments ?? [],
        health: Math.round(def.health * mul('hardy')),
        attack: Math.round(def.attack * mul('tough') * 10) / 10,
        speed: Math.round(def.speed * mul('speed') * 100) / 100,
      };
    });
    const status = WILDERMON_STAGES[def.id] ? 'line' : def.stages ? 'named' : 'single';
    return {
      id: def.id,
      name: def.name,
      was: [...(def.was ?? [])],
      status,
      stages,
      tame: `Taming ${def.tameLevel}, ${percent(def.tameChance)} base chance an offering`,
      wound: capital(WOUND_KINDS[def.wound ?? 'bite'].name),
      trade: trade(def),
      temper: temper(def),
    };
  });
}

/** Every trait, a plain one at its one grade and fighting blood at all four, each as a card prints it. */
function traits(): TraitOut[] {
  const plain = TRAITS.filter((t) => !t.family).map((t): TraitOut => ({
    name: t.name, note: '', aura: !!t.aura, fighting: false, grades: { [t.tier]: traitSays(t) },
  }));
  const fighting = FIGHTING.map((f): TraitOut => ({
    name: f.name, note: '', aura: !!f.aura, fighting: true,
    grades: Object.fromEntries(TIERS.map((tier) => [tier, traitSays(TRAIT_BY_ID.get(gradeId(f.id, tier))!)])),
  }));
  return [...plain, ...fighting];
}

const w = window as unknown as { DEX?: unknown; DONE?: boolean; DEX_ERROR?: string };
try {
  w.DEX = { fps: FPS, side: SIDE, evolveAt: EVOLVE_AT, stageMul: STAGE_MUL, traitSlots: TRAIT_SLOTS, wildOdds: WILD_ODDS, rows: rows(), traits: traits() };
} catch (e) {
  w.DEX_ERROR = String((e as Error).stack ?? e);
}
w.DONE = true;
