/**
 * The lead set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a lead piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetalleadhelm-male.json';
import FEMALE_HELM from './assets/lowmetalleadhelm-female.json';
import MALE_CHEST from './assets/lowmetalleadchest-male.json';
import FEMALE_CHEST from './assets/lowmetalleadchest-female.json';
import MALE_MANTLE from './assets/lowmetalleadmantle-male.json';
import FEMALE_MANTLE from './assets/lowmetalleadmantle-female.json';
import MALE_LEGS from './assets/lowmetalleadlegs-male.json';
import FEMALE_LEGS from './assets/lowmetalleadlegs-female.json';
import MALE_BOOTS from './assets/lowmetalleadboots-male.json';
import FEMALE_BOOTS from './assets/lowmetalleadboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
