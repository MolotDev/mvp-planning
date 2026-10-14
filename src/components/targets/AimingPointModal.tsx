import { useMemo, useState } from "react";
import { AimingPointForm } from "@/components/targets/AimingPointForm";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { emptyAimingPointForm, validateAimingPointForm, type FieldErrors } from "@/lib/targetForm";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { parseRequiredNumber } from "@/lib/validation";
import { useTargetStore } from "@/store/useTargetStore";
import type { AimingPoint, AimingPointFormValues } from "@/types/target";

interface AimingPointModalProps {
  targetId: string;
  aimingPoint?: AimingPoint | null;
  onClose: () => void;
}

function toFormValues(point?: AimingPoint | null): AimingPointFormValues {
  if (!point) {
    return emptyAimingPointForm();
  }
  return {
    displayed_id: point.displayed_id,
    name: point.name,
    mgrs: point.mgrs,
    feat_hgt_msl: String(point.feat_hgt_msl),
    agl_msl: String(point.agl_msl),
  };
}

export function AimingPointModal({ targetId, aimingPoint, onClose }: AimingPointModalProps) {
  const isEdit = Boolean(aimingPoint);
  const nextLabel = useTargetStore((state) => `AP${state.aimingPointSeq + 1}`);
  const createAimingPoint = useTargetStore((state) => state.createAimingPoint);
  const updateAimingPoint = useTargetStore((state) => state.updateAimingPoint);
  const [values, setValues] = useState<AimingPointFormValues>(() => toFormValues(aimingPoint));
  const errors = useMemo(
    () => validateAimingPointForm(values, targetId, aimingPoint?.id),
    [values, targetId, aimingPoint?.id],
  );

  const confirmDisabled = hasBlockingErrors(errors);

  const handleChange = (field: keyof AimingPointFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const feat = parseRequiredNumber(values.feat_hgt_msl);
    const agl = parseRequiredNumber(values.agl_msl);
    if (feat !== null && agl !== null && agl > feat) {
      notifyError(DICTIONARY.targets_catalog.validation.elevation);
      return;
    }
    const nextErrors = validateAimingPointForm(values, targetId, aimingPoint?.id);
    if (hasErrors(nextErrors) || feat === null || agl === null) {
      return;
    }
    const payload = {
      displayed_id: values.displayed_id,
      name: values.name,
      mgrs: values.mgrs,
      feat_hgt_msl: feat,
      agl_msl: agl,
    };
    if (aimingPoint) {
      updateAimingPoint(aimingPoint.id, payload);
    } else {
      createAimingPoint(targetId, payload);
    }
    notifySuccess(DICTIONARY.targets_catalog.toasts.aiming_point.saved);
    onClose();
  };

  return (
    <Modal
      title={
        isEdit
          ? DICTIONARY.targets_catalog.modals.aiming_point.title_edit
          : DICTIONARY.targets_catalog.modals.aiming_point.title_create
      }
      subtitle={isEdit ? undefined : nextLabel}
      confirmLabel={DICTIONARY.targets_catalog.buttons.save_aiming_point}
      confirmDisabled={confirmDisabled}
      onClose={onClose}
      onConfirm={handleSave}
    >
      <AimingPointForm values={values} errors={errors} onChange={handleChange} />
    </Modal>
  );
}

function hasErrors(errors: FieldErrors<AimingPointFormValues>): boolean {
  return Object.values(errors).some(Boolean);
}

function hasBlockingErrors(errors: FieldErrors<AimingPointFormValues>): boolean {
  return Object.entries(errors).some(
    ([field, message]) =>
      Boolean(message) &&
      !(
        field === "agl_msl" &&
        message === DICTIONARY.targets_catalog.validation.elevation
      ),
  );
}
