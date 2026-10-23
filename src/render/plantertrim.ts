import { CROP_LIST, CROP_STAGES, type CropDef } from '../game/farming';

/**
 * What a planter is drawn holding, as the one number its bake is kept under
 * (the piece's `trim`): nought for bare earth, and otherwise which crop and
 * at what stage. The model reads it back with `planterHolds`.
 */
export const planterTrim = (cropId: string, stage: number): number => {
  const i = CROP_LIST.findIndex((c) => c.id === cropId);
  return i < 0 ? 0 : 1 + i * CROP_STAGES + Math.max(0, Math.min(CROP_STAGES - 1, stage));
};
export const planterHolds = (trim: number | undefined): { crop: CropDef; stage: number } | null => {
  if (!trim || trim < 1 || !Number.isInteger(trim)) return null;
  const crop = CROP_LIST[Math.floor((trim - 1) / CROP_STAGES)];
  return crop ? { crop, stage: (trim - 1) % CROP_STAGES } : null;
};
