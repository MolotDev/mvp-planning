import { DICTIONARY } from "@/constants/dictionary";
import { mgrsError, parseRequiredNumber, requiredError } from "@/lib/validation";
import { useTargetStore } from "@/store/useTargetStore";
import type { AimingPointFormValues, TargetFormValues } from "@/types/target";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

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

export function validateTargetForm(
  values: TargetFormValues,
  excludeId?: string,
): FieldErrors<TargetFormValues> {
  const store = useTargetStore.getState();
  const errors: FieldErrors<TargetFormValues> = {};

  // const displayedId = values.displayed_id.trim();
  // if (!displayedId) {
  //   errors.displayed_id = DICTIONARY.targets_catalog.validation.required;
  // } else if (!isValidTargetDisplayedId(displayedId)) {
  //   errors.displayed_id = DICTIONARY.targets_catalog.validation.displayed_id_target;
  // } else if (store.isTargetDisplayedIdTaken(displayedId, excludeId)) {
  //   errors.displayed_id = DICTIONARY.targets_catalog.validation.unique_displayed_id;
  // }

  const name = values.name.trim();
  if (!name) {
    errors.name = DICTIONARY.targets_catalog.validation.required;
  } else if (store.isTargetNameTaken(name, excludeId)) {
    errors.name = DICTIONARY.targets_catalog.validation.unique_name;
  }

  const addressError = requiredError(values.address);
  if (addressError) {
    errors.address = addressError;
  }

  const typeError = requiredError(values.type);
  if (typeError) {
    errors.type = typeError;
  }

  const mgrs = values.mgrs.trim();
  const mgrsFieldError = mgrsError(values.mgrs);
  if (mgrsFieldError) {
    errors.mgrs = mgrsFieldError;
  } else if (store.isTargetMgrsTaken(mgrs, excludeId)) {
    errors.mgrs = DICTIONARY.targets_catalog.validation.unique_mgrs;
  }

  const distance = parseRequiredNumber(values.distance_from_hot_line);
  if (values.distance_from_hot_line.trim() === "") {
    errors.distance_from_hot_line = DICTIONARY.targets_catalog.validation.required;
  } else if (distance === null) {
    errors.distance_from_hot_line = DICTIONARY.targets_catalog.validation.number;
  }

  return errors;
}

export function validateAimingPointForm(
  values: AimingPointFormValues,
  _targetId: string,
  excludeId?: string,
): FieldErrors<AimingPointFormValues> {
  const store = useTargetStore.getState();
  const errors: FieldErrors<AimingPointFormValues> = {};

  // const displayedId = values.displayed_id.trim();
  // if (!displayedId) {
  //   errors.displayed_id = DICTIONARY.targets_catalog.validation.required;
  // } else if (!isValidAimingPointDisplayedId(displayedId)) {
  //   errors.displayed_id = DICTIONARY.targets_catalog.validation.displayed_id_aiming_point;
  // } else if (store.isAimingPointDisplayedIdTaken(targetId, displayedId, excludeId)) {
  //   errors.displayed_id = DICTIONARY.targets_catalog.validation.unique_displayed_id;
  // }

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
