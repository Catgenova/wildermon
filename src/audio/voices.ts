import type { BeastAct } from '../game/events';

/**
 * Wildermon voices.
 *
 * Every sound on the island is made as it is played, out of oscillators and
 * filtered noise (`./kit`), and so is a wildermon's: a voice is a few cues,
 * one for each act it has a sound for -- a strike, a go at its task, its
 * ability, evolving -- each played where it stands, at the stage it is at
 * (a bigger body, a deeper voice) and with a little variety (`v`, nought to
 * one) so a herd is not one animal repeated. A kind with no voice here is
 * heard as it always was: its blows and its work, and nothing of its own.
 */
export type Cue = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number) => void;
export type Voice = Partial<Record<BeastAct, Cue>>;

/** Each kind's voice, by species, fetched the first time it is wanted (`voiceOf`), as its models are (`render/wildermon.ts`). */
const VOICES: Partial<Record<string, () => Promise<Voice>>> = {
  // The Snufflet, the Snuffroot and the Snuffthorn.
  rabba: () => import('./voice-snuff').then((m) => m.SNUFF_VOICE),
  // The Ironemole, the Ferrodrill and the Oremander.
  mola: () => import('./voice-iron').then((m) => m.IRON_VOICE),
  // The Chiptail, the Quarrybash and the Monolithump.
  quarra: () => import('./voice-chip').then((m) => m.CHIP_VOICE),
  // The Sporeling, the Sporekin and the Sporelord.
  vola: () => import('./voice-spore').then((m) => m.SPORE_VOICE),
  // The Skylooklet, the Skywarden and the Skyrange.
  warda: () => import('./voice-sky').then((m) => m.SKY_VOICE),
  // The Cloudlet, the Cloudram and the Cloudborne.
  woola: () => import('./voice-cloud').then((m) => m.CLOUD_VOICE),
  // The Sandpip, the Sandpincher and the Sandpinnacle.
  crawler: () => import('./voice-sand').then((m) => m.SAND_VOICE),
  // The Pigroot, the Plowhog and the Harvestusk.
  seavic: () => import('./voice-pig').then((m) => m.PIG_VOICE),
  // The Mudlet, the Clayburrow and the Terramole.
  noot: () => import('./voice-clay').then((m) => m.CLAY_VOICE),
  // The Sapgnaw, the Logchewer and the Timberlord.
  bevere: () => import('./voice-gnaw').then((m) => m.GNAW_VOICE),
  // The Sluglow, the Slugember and the Slugferno.
  embra: () => import('./voice-slug').then((m) => m.SLUG_VOICE),
  // The Whispet, the Lanternveil and the Hallowmire.
  whispet: () => import('./voice-ghost').then((m) => m.GHOST_VOICE),
  // The Brickling, the Mortarback and the Bastiondrake.
  cobbe: () => import('./voice-brick').then((m) => m.BRICK_VOICE),
  // The Cartling, the Wagonox and the Haulhorn.
  roxxen: () => import('./voice-haul').then((m) => m.HAUL_VOICE),
  // The Stitchkit, the Patchcoon and the Mendermask.
  tinka: () => import('./voice-mend').then((m) => m.MEND_VOICE),
  // The Thistlekit, the Bunnycourser and the Moonhare.
  orse: () => import('./voice-hare').then((m) => m.HARE_VOICE),
  // The Reedpup, the Reedweaver and the Marshreaper.
  sedra: () => import('./voice-reed').then((m) => m.REED_VOICE),
  // The Puddlehop, the Springcarrier and the Aquavoyager.
  holla: () => import('./voice-frog').then((m) => m.FROG_VOICE),
  // The Zephlet, the Galecrest and the Tempestwyrm.
  stona: () => import('./voice-zephyr').then((m) => m.ZEPHYR_VOICE),
  // The Mosskip, the Craghopper and the Bastiontoad.
  bogga: () => import('./voice-toad').then((m) => m.TOAD_VOICE),
  // The Glimmoth, the Lurewing and the Noctilure.
  wicka: () => import('./voice-moth').then((m) => m.MOTH_VOICE),
  // The Pipseed, the Sprigwing and the Arborcrest.
  sappa: () => import('./voice-pip').then((m) => m.PIP_VOICE),
  // The Lemlet, the Lemleaf and the Lemorian.
  sprigga: () => import('./voice-lemur').then((m) => m.LEMUR_VOICE),
  // The Dirtlet, the Tunnelclaw and the Earthrend.
  snout: () => import('./voice-badger').then((m) => m.BADGER_VOICE),
  // The Snarepup, the Lashrunner and the Vinehunter.
  rowl: () => import('./voice-vine').then((m) => m.VINE_VOICE),
  // The Blushkit, the Briarpounce and the Thornlance.
  lungra: () => import('./voice-briar').then((m) => m.BRIAR_VOICE),
  // The Vanari, the Orchibelle and the Arboanari.
  plucka: () => import('./voice-vanari').then((m) => m.VANARI_VOICE),
  // The Pebbletooth, the Shaleclaw and the Cragjaws.
  thumpa: () => import('./voice-crag').then((m) => m.CRAG_VOICE),
  // The Chestkit, the Lootvent and the Hoardback.
  magga: () => import('./voice-chest').then((m) => m.CHEST_VOICE),
  // The Sprigmant, the Petalblade and the Bloomreaper.
  grazza: () => import('./voice-mantis').then((m) => m.MANTIS_VOICE),
  // The Pebblebeak, the Soilwhistle and the Wormheron.
  wurla: () => import('./voice-curlew').then((m) => m.CURLEW_VOICE),
  // The Budscarab, the Blossomhorn and the Florantler.
  grubba: () => import('./voice-petal').then((m) => m.PETAL_VOICE),
  // The Sliplet, the Wheelmote and the Rollterra.
  mudda: () => import('./voice-clayroll').then((m) => m.CLAYROLL_VOICE),
  // The Pailbara, the Caskybara and the Reservara.
  dippa: () => import('./voice-capy').then((m) => m.CAPY_VOICE),
  // The Snaileaf, the Middunsnail and the Hearthsnail.
  middun: () => import('./voice-snail').then((m) => m.SNAIL_VOICE),
  // The Dummicub, the Dummibear and the Dummititan.
  sparra: () => import('./voice-dummy').then((m) => m.DUMMY_VOICE),
  // The Wheatley, the Wheatwhirl and the Wheatcheeks.
  grista: () => import('./voice-hamster').then((m) => m.HAMSTER_VOICE),
  // The Kintsu, the Relicrawler and the Aureliax.
  relka: () => import('./voice-relic').then((m) => m.RELIC_VOICE),
  // The Finlet, the Reeffin and the Tideharvest.
  wadd: () => import('./voice-penguin').then((m) => m.PENGUIN_VOICE),
  // The Nailsprout, the Hammertin and the Nailwright.
  dowse: () => import('./voice-nail').then((m) => m.NAIL_VOICE),
  // The Buzzlet, the Combworker and the Hivemaster.
  vesp: () => import('./voice-bee').then((m) => m.BEE_VOICE),
  // The Sprigkit, the Bloomwhisk and the Floramane.
  bedda: () => import('./voice-calico').then((m) => m.CALICO_VOICE),
  // The Ribbonip, the Stripforge and the Metallocurl.
  siffa: () => import('./voice-ribbon').then((m) => m.RIBBON_VOICE),
  // The Saplet, the Mapletap and the Tapsylvan.
  ambra: () => import('./voice-maple').then((m) => m.MAPLE_VOICE),
  // The Sprindle, the Webloom and the Silkward.
  ulva: () => import('./voice-spider').then((m) => m.SPIDER_VOICE),
  // The Briarling, the Meadowtide and the Floracrux.
  petta: () => import('./voice-goat').then((m) => m.GOAT_VOICE),
  // The Whispling, the Hushwing and the Songroost.
  kemma: () => import('./voice-owl').then((m) => m.OWL_VOICE),
  // The Kilnlet, the Terrabrick and the Kilnspire.
  potta: () => import('./voice-kiln').then((m) => m.KILN_VOICE),
  // The Logkit, the Sawquill and the Timberback.
  rippa: () => import('./voice-timber').then((m) => m.TIMBER_VOICE),
  // The Reedling, the Papyruskin and the Pressmere.
  papra: () => import('./voice-papyrus').then((m) => m.PAPYRUS_VOICE),
  // The Springlet, the Springsail and the Tidecourser.
  springlet: () => import('./voice-tide').then((m) => m.TIDE_VOICE),
  // The Glimmip, the Glascade and the Prismetail.
  glimmip: () => import('./voice-glass').then((m) => m.GLASS_VOICE),
  // The Saplingreach, the Canopyshaper and the Grovemaster.
  snedda: () => import('./voice-giraffe').then((m) => m.GIRAFFE_VOICE),
  // The Shearling, the Clipperoo and the Shearlord.
  sheela: () => import('./voice-shear').then((m) => m.SHEAR_VOICE),
  // The Peltling, the Peltipede and the Hideweaver.
  tanna: () => import('./voice-pelt').then((m) => m.PELT_VOICE),
  // The Mossnib, the Mossshear and the Mossreaver.
  dulla: () => import('./voice-moss').then((m) => m.MOSS_VOICE),
  // The Lognib, the Timbersplit and the Beammaster.
  carra: () => import('./voice-log').then((m) => m.LOG_VOICE),
  // The Spiralcalf, the Spiraltrunk and the Spiralphant.
  awla: () => import('./voice-spiral').then((m) => m.SPIRAL_VOICE),
  // The Packlet, the Haulbud and the Cargocrest.
  bura: () => import('./voice-pack').then((m) => m.PACK_VOICE),
  // The Emberkit, the Emberbrush and the Ashsweeper.
  cindra: () => import('./voice-ember').then((m) => m.EMBER_VOICE),
  // The Creamcalf, the Milkmere and the Lactisovereign.
  cudda: () => import('./voice-cow').then((m) => m.COW_VOICE),
  // The Peachick, the Plumecrest and the Featherbourne.
  quill: () => import('./voice-peafowl').then((m) => m.PEAFOWL_VOICE),
  // The Sablekit, the Sableplume and the Fletchercrest.
  flecha: () => import('./voice-sable').then((m) => m.SABLE_VOICE),
  // The Wallkit, the Bristleward and the Stonepolish.
  scurra: () => import('./voice-wall').then((m) => m.WALL_VOICE),
};

/** Each voice that is in, by species; nothing for one that failed to come, until it is asked for again. */
const heard = new Map<string, Voice | null>();

/**
 * A kind's voice, or nothing while it is on its way: asked for, it is fetched, so a cue asked for before it is in goes
 * unplayed and the next is heard (`sound.ts` asks for the voices of the kinds in earshot before they act).
 */
export function voiceOf(species: string): Voice | undefined {
  const had = heard.get(species);
  if (had !== undefined) return had ?? undefined;
  const load = VOICES[species];
  if (!load) return undefined;
  heard.set(species, null);
  load().then((v) => heard.set(species, v), () => heard.delete(species));
  return undefined;
}

/** Every voice, for a tool that plays them. */
export async function loadAllVoices(): Promise<Partial<Record<string, Voice>>> {
  const out: Partial<Record<string, Voice>> = {};
  await Promise.all(Object.entries(VOICES).map(async ([species, load]) => { if (load) out[species] = await load(); }));
  return out;
}
