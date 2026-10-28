import { DICTIONARY } from "@/constants/dictionary";
import {
  formatMGRSDisplay,
  isMGRSValid,
  mgrsError,
  parseRequiredNumber,
  requiredError,
} from "@/lib/validation";
import { useTargetStore } from "@/store/useTargetStore";
import type { AimingPointFormValues, Target, TargetFormValues } from "@/types/target";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export interface TargetFormValidation {
  errors: FieldErrors<TargetFormValues>;
  /** Existing catalog target that collides by name and/or MGRS. */
  duplicateTarget: Target | null;
  nameCollision: boolean;
  mgrsCollision: boolean;
}

export function emptyTargetForm(): TargetFormValues {
  return {
    displayed_id: "",
    name: "",
    address: "",
    type: "",
    mgrs: "",
    distance_from_hot_line: "",
    image_url: "",
  };
}

export function emptyAimingPointForm(): AimingPointFormValues {
  return {
    displayed_id: "",
    name: "",
    mgrs: "",
    feat_hgt_msl: "",
    agl_msl: "",
  };
}

export function emptyTargetFormValidation(): TargetFormValidation {
  return {
    errors: {},
    duplicateTarget: null,
    nameCollision: false,
    mgrsCollision: false,
  };
}

export function validateTargetForm(
  values: TargetFormValues,
  excludeId?: string,
): TargetFormValidation {
  const store = useTargetStore.getState();
  const errors: FieldErrors<TargetFormValues> = {};
  let nameCollision = false;
  let mgrsCollision = false;
  let duplicateByName: Target | null = null;
  let duplicateByMgrs: Target | null = null;

  const name = values.name.trim();
  if (!name) {
    errors.name = DICTIONARY.targets_catalog.validation.required;
  } else if (store.isTargetNameTaken(name, excludeId)) {
    nameCollision = true;
    duplicateByName =
      store.targets.find(
        (target) =>
          target.archived_at === null &&
          target.id !== excludeId &&
          target.name.trim().toLowerCase() === name.toLowerCase(),
      ) ?? null;
  }

  const addressError = requiredError(values.address);
  if (addressError) {
    errors.address = addressError;
  }

  const typeError = requiredError(values.type);
  if (typeError) {
    errors.type = typeError;
  }

  const mgrsFieldError = mgrsError(values.mgrs);
  if (mgrsFieldError) {
    errors.mgrs = mgrsFieldError;
  } else if (isMGRSValid(values.mgrs)) {
    const collision = store.findTargetByMgrs(formatMGRSDisplay(values.mgrs), excludeId);
    if (collision) {
      mgrsCollision = true;
      duplicateByMgrs = collision;
    }
  }

  const distance = parseRequiredNumber(values.distance_from_hot_line);
  if (values.distance_from_hot_line.trim() === "") {
    errors.distance_from_hot_line = DICTIONARY.targets_catalog.validation.required;
  } else if (distance === null) {
    errors.distance_from_hot_line = DICTIONARY.targets_catalog.validation.number;
  }

  return {
    errors,
    duplicateTarget: duplicateByMgrs ?? duplicateByName,
    nameCollision,
    mgrsCollision,
  };
}

export function validateAimingPointForm(
  values: AimingPointFormValues,
  _targetId: string,
  excludeId?: string,
): FieldErrors<AimingPointFormValues> {
  const store = useTargetStore.getState();
  const errors: FieldErrors<AimingPointFormValues> = {};

  const nameError = requiredError(values.name);
  if (nameError) {
    errors.name = nameError;
  }

  const mgrs = values.mgrs.trim();
  const mgrsFieldError = mgrsError(values.mgrs);
  if (mgrsFieldError) {
    errors.mgrs = mgrsFieldError;
  } else if (store.isAimingPointMgrsTaken(mgrs, excludeId)) {
    errors.mgrs = DICTIONARY.targets_catalog.validation.unique_mgrs;
  }

  const feat = parseRequiredNumber(values.feat_hgt_msl);
  if (values.feat_hgt_msl.trim() === "") {
    errors.feat_hgt_msl = DICTIONARY.targets_catalog.validation.required;
  } else if (feat === null) {
    errors.feat_hgt_msl = DICTIONARY.targets_catalog.validation.number;
  }

  const agl = parseRequiredNumber(values.agl_msl);
  if (values.agl_msl.trim() === "") {
    errors.agl_msl = DICTIONARY.targets_catalog.validation.required;
  } else if (agl === null) {
    errors.agl_msl = DICTIONARY.targets_catalog.validation.number;
  } else if (feat !== null && agl > feat) {
    errors.agl_msl = DICTIONARY.targets_catalog.validation.elevation;
  }

  return errors;
}
