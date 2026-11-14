import type { HybridLook } from './hybridblend';

/**
 * Each hybrid's big shapes from its markings parent (`game/hybridlist.ts`), carried over whole onto its body parent
 * (`HybridPart`): asked for, "at thumbnail size, someone who knows both parents must see at least one big shape from
 * each parent, such as a tail, a shell, antlers, ears, a hat or a back piece". Its markings parent's head things and
 * back go over without being named here (`graft`); this names what else does, by the markings parent's piece keys.
 * A hybrid not named takes its head things and back alone.
 */
const range = (stem: string, n: number, from = 0): string[] => Array.from({ length: n - from }, (_, i) => `${stem}${i + from}`);

export const HYBRID_LOOKS: Readonly<Record<string, HybridLook>> = {
  // Pailbara's water bucket and vines over the Reedpup.
  pailreed: { parts: [{ keys: ['v0i', 'v0', 'w0'], to: 'body' }, { keys: ['vines', 'leaves'], to: 'body' }] },
  // The Brickling's big round head and its brick back on the Kilnlet's body and tail.
  bricklekiln: { parts: [{ keys: ['head'], to: 'head', drop: ['head'], scale: 1.25 }] },
  // The Logkit's fan tail behind the Chipkin's stone body.
  sawchip: { parts: [{ keys: ['tail'], to: 'tail', scale: 1.3 }] },
  // The Logkit's pine-cone tail and quills on the Sapgnaw.
  fellsaw: { parts: [{ keys: ['tail'], to: 'tail' }, { keys: ['quills', 'moss'], to: 'body' }] },
  // The Lognib's shell on the Sapgnaw's back.
  gnawbeam: { parts: [{ keys: ['shell'], to: 'body', fit: 'whole', tilt: 30, shift: [0, -0.25, 0.1], scale: 1.35 }] },
  // The Pipseed's wings and tail on the Sapgnaw.
  seedgnaw: { parts: [{ keys: ['wing0', 'wing1'], to: 'body' }, { keys: ['tail'], to: 'tail' }] },
  // The Sprigkit's calico tail and cape on the Snaileaf.
  mulchkit: { parts: [{ keys: range('tail', 7), to: 'tail' }, { keys: ['cape'], to: 'body' }] },
  // The Sprindle's leaf cloak on the Clothkit.
  yarnkit: { parts: [{ keys: ['cloak'], to: 'body', fit: 'whole' }] },
  // The Herbpup's tail and herb bags on the Clothkit.
  salvecloth: { parts: [{ keys: range('t0_', 6), to: 'tail' }, { keys: ['bags', 'garland'], to: 'body' }] },
  // The Sablekit's quiver pack and plume on the Spiralcalf.
  arrowcalf: { parts: [{ keys: ['pack', 'plume', 'mantle'], to: 'body', fit: 'whole' }] },
  // The Spiralcalf's mossy coat over the Lognib's shell.
  beamspiral: { parts: [{ keys: ['coat', 'moss'], to: 'body', fit: 'whole' }] },
  // The Wheatley's millstones at the Brothlet's cheeks.
  flourbroth: { parts: [{ keys: ['stone0', 'stone1'], to: 'head' }] },
  // The Brewtoad's cask on the Puddlehop's back.
  barrelhop: { parts: [{ keys: ['cask', 'tap'], to: 'body' }] },
  // The Nailsprout's pack of nails on the Ironemole's back.
  nailmole: { parts: [{ keys: ['pack', 'heap', 'nails'], to: 'body' }] },
  // The Ribbonip's coiled tail and scales on the Nailsprout.
  tinsprout: { parts: [{ keys: range('tail', 11), to: 'tail', scale: 2.6, shift: [0.15, -0.05, 0.35] }, { keys: range('scales', 8), to: 'body', fit: 'whole', scale: 1.2, shift: [0, -0.1, 0.05] }] },
  // The Shearling's crown, fleece cape, patches and mane on the Sprindle, which keeps its own big leaf ears.
  shearspin: { ears: false, parts: [{ keys: ['cape', 'patches', 'mane'], to: 'body', fit: 'whole' }] },
  // The Mossnib's mossy shell on the Sprigmant's back.
  mossmant: { parts: [{ keys: ['shell', 'moss'], to: 'body', fit: 'whole' }] },
  // The Wallkit's brush tail and leaves on the Mossnib.
  scrubnib: { parts: [{ keys: ['tail0'], to: 'tail' }, { keys: ['leaves'], to: 'body' }] },
  // The Glimmoth's wings and candle on the Snailglow.
  candleglow: { parts: [{ keys: ['fw0', 'fw1', 'hw0', 'hw1'], to: 'body' }, { keys: ['candle', 'flame'], to: 'body' }] },
  // The Kintsu's shell and pack on the Stitchkit.
  kintstitch: { parts: [{ keys: ['shell'], to: 'body', fit: 'whole', tilt: 80, shift: [0, -0.3, 0] }, { keys: ['pack', 'load'], to: 'body', fit: 'whole', shift: [0, -0.3, 0] }] },
  // The Padbloom's lily pads, shell and bloom on the Reedpup.
  lilyreed: { parts: [{ keys: ['shell', 'hang', 'pads0a', 'pads0b', 'pads1a', 'pads1b'], to: 'body' }, { keys: ['flora0'], to: 'body' }] },
};
