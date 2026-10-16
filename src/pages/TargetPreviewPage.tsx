import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AimingPointCard } from "@/components/targets/AimingPointCard";
import { AimingPointModal } from "@/components/targets/AimingPointModal";
import { TargetForm } from "@/components/targets/TargetForm";
import { TargetIdBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { StatusToggle } from "@/components/ui/status-toggle";
import { DICTIONARY } from "@/constants/dictionary";
import { getEntityState } from "@/lib/entityState";
import { emptyTargetForm, validateTargetForm, type FieldErrors } from "@/lib/targetForm";
import { notifySuccess } from "@/lib/toasts";
import { parseRequiredNumber } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { useTargetStore } from "@/store/useTargetStore";
import type { AimingPoint, StatusFilter, Target, TargetFormValues } from "@/types/target";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";

function valuesFromTarget(target: Target): TargetFormValues {
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

export function TargetPreviewPage() {
  const { targetId = "" } = useParams();
  const navigate = useNavigate();
  const target = useTargetStore((state) => state.targets.find((item) => item.id === targetId));
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const updateTarget = useTargetStore((state) => state.updateTarget);
  const archiveAimingPoint = useTargetStore((state) => state.archiveAimingPoint);
  const restoreAimingPoint = useTargetStore((state) => state.restoreAimingPoint);

  const targetPoints = useMemo(
    () => aimingPoints.filter((point) => point.target_id === targetId),
    [aimingPoints, targetId],
  );
  const isArchived = target?.archived_at !== null;
  const [isEditMode, setIsEditMode] = useState(false);
  const [status, setStatus] = useState<StatusFilter>(isArchived ? "archived" : "active");
  const [values, setValues] = useState<TargetFormValues>(emptyTargetForm());
  const [modalPoint, setModalPoint] = useState<AimingPoint | null | undefined>(undefined);

  useEffect(() => {
    if (target) {
      setValues(valuesFromTarget(target));
      if (target.archived_at !== null) {
        setIsEditMode(false);
        setStatus("archived");
      }
    }
  }, [target]);

  const errors = useMemo(
    () => (isEditMode && target ? validateTargetForm(values, target.id) : {}),
    [isEditMode, values, target],
  ) as FieldErrors<TargetFormValues>;

  const visiblePoints = targetPoints.filter((point) => {
    if (status === "all") {
      return true;
    }
    if (status === "archived") {
      return point.archived_at !== null;
    }
    return point.archived_at === null;
  });

  if (!target) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/catalogs/targets")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.targets_catalog.not_found}</h1>
        </div>
      </section>
    );
  }

  const entityState = getEntityState(target);

  const handleChange = (field: keyof TargetFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const canSave = isEditMode && !Object.values(errors).some(Boolean);

  const handleSave = () => {
    const nextErrors = validateTargetForm(values, target.id);
    const distance = parseRequiredNumber(values.distance_from_hot_line);
    if (Object.values(nextErrors).some(Boolean) || distance === null) {
      return;
    }
    updateTarget(target.id, {
      displayed_id: values.displayed_id,
      name: values.name,
      address: values.address,
      type: values.type,
      mgrs: values.mgrs,
      distance_from_hot_line: distance,
      image_url: values.image_url.trim() ? values.image_url.trim() : null,
    });
    notifySuccess(DICTIONARY.targets_catalog.toasts.target.saved);
    setIsEditMode(false);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GoBackIconButton onClick={() => navigate(-1)} />
          <EntityStatusBadge status={entityState} />
          <TargetIdBadge>{target.displayed_id || target.label || "—"}</TargetIdBadge>
          <h4 className="truncate text-lg font-semibold text-primitive-neutral-0" title={target.name}>
            {target.name}
          </h4>
        </div>
        <label className="flex items-center gap-2 text-sm text-primitive-neutral-200">
          <span>{DICTIONARY.targets_catalog.edit_toggle}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isEditMode}
            disabled={isArchived}
            onClick={() => setIsEditMode((current) => !current)}
            className={cn(
              "relative h-6 w-11 rounded-full hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
              isEditMode ? "bg-primitive-blue-500" : "bg-primitive-neutral-700",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-primitive-neutral-0 transition-transform",
                isEditMode ? "left-5" : "left-0.5",
              )}
            />
          </button>
        </label>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4">
          <TargetForm values={values} errors={isEditMode ? errors : {}} readOnly={!isEditMode} onChange={handleChange} />
          {isEditMode ? (
            <div className="mt-auto flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setValues(valuesFromTarget(target));
                  setIsEditMode(false);
                }}
              >
                {DICTIONARY.common.actions.cancel}
              </Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {DICTIONARY.targets_catalog.buttons.save_target}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-lg font-semibold text-primitive-neutral-0">{DICTIONARY.targets_catalog.aiming_points_count}:</h5>
            <div className="flex gap-2">
              <StatusToggle
                value={status}
                onChange={(value) => {
                  if (value === "reported") {
                    return;
                  }
                  setStatus(value);
                }}
              />
              <Button onClick={() => setModalPoint(null)} disabled={isArchived}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {DICTIONARY.targets_catalog.buttons.create_aiming_point}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1">
            {visiblePoints.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center text-primitive-neutral-300">
                {DICTIONARY.targets_catalog.aiming_points_empty}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visiblePoints.map((point) => (
                  <AimingPointCard
                    key={point.id}
                    point={point}
                    onPreview={setModalPoint}
                    onArchive={(item) => {
                      archiveAimingPoint(item.id);
                      notifySuccess(DICTIONARY.targets_catalog.toasts.aiming_point.archived);
                    }}
                    onRestore={(item) => {
                      restoreAimingPoint(item.id);
                      notifySuccess(DICTIONARY.targets_catalog.toasts.aiming_point.reset);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {modalPoint !== undefined ? (
        <AimingPointModal
          targetId={target.id}
          aimingPoint={modalPoint}
          onClose={() => setModalPoint(undefined)}
        />
      ) : null}
    </section>
  );
}
