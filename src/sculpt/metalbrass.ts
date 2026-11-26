/**
 * The brass set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a brass piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetalbrasshelm-male.json';
import FEMALE_HELM from './assets/lowmetalbrasshelm-female.json';
import MALE_CHEST from './assets/lowmetalbrasschest-male.json';
import FEMALE_CHEST from './assets/lowmetalbrasschest-female.json';
import MALE_MANTLE from './assets/lowmetalbrassmantle-male.json';
import FEMALE_MANTLE from './assets/lowmetalbrassmantle-female.json';
import MALE_LEGS from './assets/lowmetalbrasslegs-male.json';
import FEMALE_LEGS from './assets/lowmetalbrasslegs-female.json';
import MALE_BOOTS from './assets/lowmetalbrassboots-male.json';
import FEMALE_BOOTS from './assets/lowmetalbrassboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
