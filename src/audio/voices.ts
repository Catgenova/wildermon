import type { BeastAct } from '../game/events';
import { BADGER_VOICE } from './voice-badger';
import { BRICK_VOICE } from './voice-brick';
import { CHEST_VOICE } from './voice-chest';
import { CALICO_VOICE } from './voice-calico';
import { CAPY_VOICE } from './voice-capy';
import { CHIP_VOICE } from './voice-chip';
import { CLOUD_VOICE } from './voice-cloud';
import { CLAY_VOICE } from './voice-clay';
import { CLAYROLL_VOICE } from './voice-clayroll';
import { CRAG_VOICE } from './voice-crag';
import { CURLEW_VOICE } from './voice-curlew';
import { DUMMY_VOICE } from './voice-dummy';
import { FROG_VOICE } from './voice-frog';
import { TOAD_VOICE } from './voice-toad';
import { VANARI_VOICE } from './voice-vanari';
import { VINE_VOICE } from './voice-vine';
import { BRIAR_VOICE } from './voice-briar';
import { GNAW_VOICE } from './voice-gnaw';
import { GHOST_VOICE } from './voice-ghost';
import { HAUL_VOICE } from './voice-haul';
import { HAMSTER_VOICE } from './voice-hamster';
import { HARE_VOICE } from './voice-hare';
import { IRON_VOICE } from './voice-iron';
import { LEMUR_VOICE } from './voice-lemur';
import { MANTIS_VOICE } from './voice-mantis';
import { MEND_VOICE } from './voice-mend';
import { MOTH_VOICE } from './voice-moth';
import { NAIL_VOICE } from './voice-nail';
import { SLUG_VOICE } from './voice-slug';
import { PENGUIN_VOICE } from './voice-penguin';
import { BEE_VOICE } from './voice-bee';
import { PETAL_VOICE } from './voice-petal';
import { PIG_VOICE } from './voice-pig';
import { PIP_VOICE } from './voice-pip';
import { REED_VOICE } from './voice-reed';
import { RELIC_VOICE } from './voice-relic';
import { SAND_VOICE } from './voice-sand';
import { SKY_VOICE } from './voice-sky';
import { SNAIL_VOICE } from './voice-snail';
import { SNUFF_VOICE } from './voice-snuff';
import { SPORE_VOICE } from './voice-spore';
import { ZEPHYR_VOICE } from './voice-zephyr';

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

/** Each kind's voice, by species. */
export const VOICES: Partial<Record<string, Voice>> = {
  // The Snufflet, the Snuffroot and the Snuffthorn.
  rabba: SNUFF_VOICE,
  // The Ironemole, the Ferrodrill and the Oremander.
  mola: IRON_VOICE,
  // The Chiptail, the Quarrybash and the Monolithump.
  quarra: CHIP_VOICE,
  // The Sporeling, the Sporekin and the Sporelord.
  vola: SPORE_VOICE,
  // The Skylooklet, the Skywarden and the Skyrange.
  warda: SKY_VOICE,
  // The Cloudlet, the Cloudram and the Cloudborne.
  woola: CLOUD_VOICE,
  // The Sandpip, the Sandpincher and the Sandpinnacle.
  crawler: SAND_VOICE,
  // The Pigroot, the Plowhog and the Harvestusk.
  seavic: PIG_VOICE,
  // The Mudlet, the Clayburrow and the Terramole.
  noot: CLAY_VOICE,
  // The Sapgnaw, the Logchewer and the Timberlord.
  bevere: GNAW_VOICE,
  // The Sluglow, the Slugember and the Slugferno.
  embra: SLUG_VOICE,
  // The Whispet, the Lanternveil and the Hallowmire.
  whispet: GHOST_VOICE,
  // The Brickling, the Mortarback and the Bastiondrake.
  cobbe: BRICK_VOICE,
  // The Cartling, the Wagonox and the Haulhorn.
  roxxen: HAUL_VOICE,
  // The Stitchkit, the Patchcoon and the Mendermask.
  tinka: MEND_VOICE,
  // The Thistlekit, the Bunnycourser and the Moonhare.
  orse: HARE_VOICE,
  // The Reedpup, the Reedweaver and the Marshreaper.
  sedra: REED_VOICE,
  // The Puddlehop, the Springcarrier and the Aquavoyager.
  holla: FROG_VOICE,
  // The Zephlet, the Galecrest and the Tempestwyrm.
  stona: ZEPHYR_VOICE,
  // The Mosskip, the Craghopper and the Bastiontoad.
  bogga: TOAD_VOICE,
  // The Glimmoth, the Lurewing and the Noctilure.
  wicka: MOTH_VOICE,
  // The Pipseed, the Sprigwing and the Arborcrest.
  sappa: PIP_VOICE,
  // The Lemlet, the Lemleaf and the Lemorian.
  sprigga: LEMUR_VOICE,
  // The Dirtlet, the Tunnelclaw and the Earthrend.
  snout: BADGER_VOICE,
  // The Snarepup, the Lashrunner and the Vinehunter.
  rowl: VINE_VOICE,
  // The Blushkit, the Briarpounce and the Thornlance.
  lungra: BRIAR_VOICE,
  // The Vanari, the Orchibelle and the Arboanari.
  plucka: VANARI_VOICE,
  // The Pebbletooth, the Shaleclaw and the Cragjaws.
  thumpa: CRAG_VOICE,
  // The Chestkit, the Lootvent and the Hoardback.
  magga: CHEST_VOICE,
  // The Sprigmant, the Petalblade and the Bloomreaper.
  grazza: MANTIS_VOICE,
  // The Pebblebeak, the Soilwhistle and the Wormheron.
  wurla: CURLEW_VOICE,
  // The Budscarab, the Blossomhorn and the Florantler.
  grubba: PETAL_VOICE,
  // The Sliplet, the Wheelmote and the Rollterra.
  mudda: CLAYROLL_VOICE,
  // The Pailbara, the Caskybara and the Reservara.
  dippa: CAPY_VOICE,
  // The Snaileaf, the Middunsnail and the Hearthsnail.
  middun: SNAIL_VOICE,
  // The Dummicub, the Dummibear and the Dummititan.
  sparra: DUMMY_VOICE,
  // The Wheatley, the Wheatwhirl and the Wheatcheeks.
  grista: HAMSTER_VOICE,
  // The Kintsu, the Relicrawler and the Aureliax.
  relka: RELIC_VOICE,
  // The Finlet, the Reeffin and the Tideharvest.
  wadd: PENGUIN_VOICE,
  // The Nailsprout, the Hammertin and the Nailwright.
  dowse: NAIL_VOICE,
  // The Buzzlet, the Combworker and the Hivemaster.
  vesp: BEE_VOICE,
  // The Sprigkit, the Bloomwhisk and the Floramane.
  bedda: CALICO_VOICE,
};
