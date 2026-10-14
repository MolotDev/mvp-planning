import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { TargetForm } from "@/components/targets/TargetForm";
import { DICTIONARY } from "@/constants/dictionary";
import { emptyTargetForm, validateTargetForm, type FieldErrors } from "@/lib/targetForm";
import { parseRequiredNumber } from "@/lib/validation";
import { notifySuccess } from "@/lib/toasts";
import { useTargetStore } from "@/store/useTargetStore";
import type { Target, TargetFormValues } from "@/types/target";

interface TargetModalProps {
  target?: Target | null;
  onClose: () => void;
}

function toFormValues(target?: Target | null): TargetFormValues {
  if (!target) {
    return emptyTargetForm();
  }
  return {
    displayed_id: target.displayed_id,
    name: target.name,
    address: target.address,
    type: target.type,
    mgrs: target.mgrs,
    distance_from_hot_line: String(target.distance_from_hot_line),
    image_url: target.image_url ?? "",
  };
}

export function TargetModal({ target, onClose }: TargetModalProps) {
  const isEdit = Boolean(target);
  const nextLabel = useTargetStore((state) => `MT${state.targetSeq + 1}`);
  const createTarget = useTargetStore((state) => state.createTarget);
  const updateTarget = useTargetStore((state) => state.updateTarget);
  const [values, setValues] = useState<TargetFormValues>(() => toFormValues(target));
  const errors = useMemo(
    () => validateTargetForm(values, target?.id),
    [values, target?.id],
  );

  const handleChange = (field: keyof TargetFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const nextErrors = validateTargetForm(values, target?.id);
    if (hasErrors(nextErrors)) {
      return;
    }
    const distance = parseRequiredNumber(values.distance_from_hot_line);
    if (distance === null) {
      return;
    }
    const payload = {
      displayed_id: values.displayed_id,
      name: values.name,
      address: values.address,
      type: values.type,
      mgrs: values.mgrs,
      distance_from_hot_line: distance,
      image_url: values.image_url.trim() ? values.image_url.trim() : null,
    };
    if (target) {
      updateTarget(target.id, payload);
    } else {
      createTarget(payload);
    }
    notifySuccess(DICTIONARY.targets_catalog.toasts.target.saved);
    onClose();
  };

  return (
    <Modal
      title={
        isEdit
          ? DICTIONARY.targets_catalog.modals.target.title_edit
          : DICTIONARY.targets_catalog.modals.target.title_create
      }
      subtitle={isEdit ? undefined : nextLabel}
      confirmLabel={DICTIONARY.targets_catalog.buttons.save_target}
      confirmDisabled={hasErrors(errors)}
      onClose={onClose}
      onConfirm={handleSave}
    >
      <TargetForm values={values} errors={errors} onChange={handleChange} />
    </Modal>
  );
}

function hasErrors(errors: FieldErrors<TargetFormValues>): boolean {
  return Object.values(errors).some(Boolean);
}
