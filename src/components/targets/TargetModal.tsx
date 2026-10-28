import { useMemo, useState } from "react";
import { AlertTriangle, CornerUpRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TargetForm } from "@/components/targets/TargetForm";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { emptyTargetForm, validateTargetForm, type FieldErrors } from "@/lib/targetForm";
import { formatMGRSDisplay, isMGRSValid, parseRequiredNumber } from "@/lib/validation";
import { notifySuccess } from "@/lib/toasts";
import { useTargetStore } from "@/store/useTargetStore";
import type { Target, TargetFormValues } from "@/types/target";

interface TargetModalProps {
  target?: Target | null;
  onClose: () => void;
  onSaved?: (target: Target) => void;
  onSelectExisting?: (target: Target) => void;
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

export function TargetModal({ target, onClose, onSaved, onSelectExisting }: TargetModalProps) {
  const isEdit = Boolean(target);
  const nextLabel = useTargetStore((state) => `MT${state.targetSeq + 1}`);
  const createTarget = useTargetStore((state) => state.createTarget);
  const updateTarget = useTargetStore((state) => state.updateTarget);
  const [values, setValues] = useState<TargetFormValues>(() => toFormValues(target));
  const validation = useMemo(() => validateTargetForm(values, target?.id), [values, target?.id]);
  const { errors, duplicateTarget, nameCollision, mgrsCollision } = validation;
  const validationCopy = DICTIONARY.targets_catalog.validation;

  const handleChange = (field: keyof TargetFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const next = validateTargetForm(values, target?.id);
    if (hasErrors(next.errors) || next.duplicateTarget) {
      return;
    }
    const distance = parseRequiredNumber(values.distance_from_hot_line);
    if (distance === null) {
      return;
    }
    if (!isMGRSValid(values.mgrs)) {
      return;
    }
    const payload = {
      displayed_id: values.displayed_id,
      name: values.name,
      address: values.address,
      type: values.type,
      mgrs: formatMGRSDisplay(values.mgrs),
      distance_from_hot_line: distance,
      image_url: values.image_url.trim() ? values.image_url.trim() : null,
    };
    const saved = target ? updateTarget(target.id, payload) : createTarget(payload);
    if (!saved) {
      return;
    }
    notifySuccess(DICTIONARY.targets_catalog.toasts.target.saved);
    onSaved?.(saved);
    onClose();
  };

  const handleUseExisting = () => {
    if (!duplicateTarget || !onSelectExisting) {
      return;
    }
    onSelectExisting(duplicateTarget);
    onClose();
  };

  const footerCollision = duplicateTarget ? (
    <div
      role="alert"
      className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-amber-600/40 bg-amber-950/30 p-2.5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs font-medium text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="shrink-0">{validationCopy.duplicate_exists_label}</span>
        <span className="min-w-0 truncate text-primitive-neutral-200" title={duplicateTarget.name}>
          {duplicateTarget.name}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-primitive-neutral-400" title={duplicateTarget.mgrs}>
          ({duplicateTarget.mgrs})
        </span>
      </div>
      {onSelectExisting ? (
        <Button
          type="button"
          variant="ghost"
          className="h-7 shrink-0 gap-1 border border-amber-500/50 bg-amber-600/20 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-600/30 hover:text-primitive-neutral-0 hover:shadow-md"
          onClick={handleUseExisting}
          title={validationCopy.use_existing_target}
        >
          <CornerUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          {validationCopy.use_existing_target_short}
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <Modal
      title={
        isEdit
          ? DICTIONARY.targets_catalog.modals.target.title_edit
          : DICTIONARY.targets_catalog.modals.target.title_create
      }
      subtitle={isEdit ? undefined : nextLabel}
      confirmLabel={DICTIONARY.targets_catalog.buttons.save_target}
      confirmDisabled={hasErrors(errors) || Boolean(duplicateTarget)}
      onClose={onClose}
      onConfirm={handleSave}
      footerStart={footerCollision}
      className="w-full max-w-[540px] overflow-x-hidden"
    >
      <TargetForm
        values={values}
        errors={errors}
        nameCollision={nameCollision}
        mgrsCollision={mgrsCollision}
        onChange={handleChange}
      />
    </Modal>
  );
}

function hasErrors(errors: FieldErrors<TargetFormValues>): boolean {
  return Object.values(errors).some(Boolean);
}
