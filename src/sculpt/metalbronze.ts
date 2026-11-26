/**
 * The bronze set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a bronze piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetalbronzehelm-male.json';
import FEMALE_HELM from './assets/lowmetalbronzehelm-female.json';
import MALE_CHEST from './assets/lowmetalbronzechest-male.json';
import FEMALE_CHEST from './assets/lowmetalbronzechest-female.json';
import MALE_MANTLE from './assets/lowmetalbronzemantle-male.json';
import FEMALE_MANTLE from './assets/lowmetalbronzemantle-female.json';
import MALE_LEGS from './assets/lowmetalbronzelegs-male.json';
import FEMALE_LEGS from './assets/lowmetalbronzelegs-female.json';
import MALE_BOOTS from './assets/lowmetalbronzeboots-male.json';
import FEMALE_BOOTS from './assets/lowmetalbronzeboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
