import { useMemo } from "react";
import { Plus } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { AppDatePicker } from "@/components/ui/date-picker";
import { DeleteIconButton } from "@/components/ui/icon-buttons";
import { TargetSearchCombobox } from "@/components/missions/TargetSearchCombobox";
import { NativeFormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DICTIONARY } from "@/constants/dictionary";
import { useAssetStore } from "@/store/useAssetStore";
import { assignRowAimingPoint, emptyDetachment, emptyTarget, type TargetDraft } from "@/lib/missionForm";
import type { AimingPoint, Target } from "@/types/target";
import { DETACHMENT_REFS } from "@/data/crews";
import { extractNumeric } from "@/lib/validation";

interface MissionFormProps {
  scheduledAt: Date | null;
  name: string;
  description: string;
  targetDrafts: TargetDraft[];
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  dateError?: string;
  descriptionError?: string;
  readOnly: boolean;
  onScheduledAtChange: (date: Date | null) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetDraftsChange: (drafts: TargetDraft[]) => void;
}

export function MissionForm({
  scheduledAt,
  name,
  description,
  targetDrafts,
  catalogTargets,
  aimingPoints,
  dateError,
  descriptionError,
  readOnly,
  onScheduledAtChange,
  onNameChange,
  onDescriptionChange,
  onTargetDraftsChange,
}: MissionFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <FormField
          id="scheduled_at"
          label={DICTIONARY.missions.fields.scheduled_at}
          // error={readOnly ? undefined : dateError}
          wrapperClassName="min-w-fit"
        >
          <AppDatePicker
            id="scheduled_at"
            selected={scheduledAt}
            onChange={onScheduledAtChange}
            placeholder={DICTIONARY.missions.fields.scheduled_at}
            disabled={readOnly}
            isError={!!dateError}
          />
        </FormField>
        <FormField id="mission_name" label={DICTIONARY.missions.fields.name}
          wrapperClassName="min-w-fit">
          <Input
            id="mission_name"
            value={name}
            disabled={readOnly}
            onChange={(event) => onNameChange(event.target.value)}
            className="min-h-[38px]"
          />
        </FormField>
        <FormField
          id="description"
          label={DICTIONARY.missions.fields.description}
          // error={readOnly ? undefined : descriptionError}
          wrapperClassName="w-full"
        >
          <Textarea
            id="description"
            value={description}
            disabled={readOnly}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={1}
            data-error={!!descriptionError}
            className="min-h-[38px]"
          />
        </FormField>
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-primitive-neutral-0">{DICTIONARY.missions.tasks_title}</h3>
          {readOnly ? null : (
            <Button onClick={() => onTargetDraftsChange([...targetDrafts, emptyTarget()])}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {DICTIONARY.missions.add_target}
            </Button>
          )}
        </div>
        {targetDrafts.map((block) => (
          <TargetAssignmentBlock
            key={block.key}
            block={block}
            catalogTargets={catalogTargets}
            aimingPoints={aimingPoints}
            readOnly={readOnly}
            onChange={(next) =>
              onTargetDraftsChange(targetDrafts.map((item) => (item.key === next.key ? next : item)))
            }
            onRemove={() =>
              onTargetDraftsChange(targetDrafts.filter((item) => item.key !== block.key))
            }
          />
        ))}
      </section>
    </div>
  );
}

function TargetAssignmentBlock({
  block,
  catalogTargets,
  aimingPoints,
  readOnly,
  onChange,
  onRemove,
}: {
  block: TargetDraft;
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  readOnly: boolean;
  onChange: (block: TargetDraft) => void;
  onRemove: () => void;
}) {
  const catalogAssets = useAssetStore((state) => state.assets);
  const selectedTarget = catalogTargets.find((target) => target.id === block.target_id);
  const points = useMemo(() => {
    return aimingPoints.filter((point) => {
      if (point.target_id !== block.target_id) {
        return false;
      }
      if (readOnly) {
        return true;
      }
      return point.archived_at === null || block.aiming_point_ids.includes(point.id);
    });
  }, [aimingPoints, block.aiming_point_ids, block.target_id, readOnly]);
  // const assignedPoints = useMemo(() => {
  //   const fromRows = block.detachments
  //     .map((row) => row.aiming_point_id)
  //     .filter((id): id is string => Boolean(id));
  //   const ids = fromRows.length > 0 ? [...new Set(fromRows)] : block.aiming_point_ids;
  //   return ids
  //     .map((id) => points.find((point) => point.id === id))
  //     .filter((point): point is AimingPoint => Boolean(point));
  // }, [block.aiming_point_ids, block.detachments, points]);

  // const [assignedPoints, setAssignedPoints] = useState<AimingPoint[]>([]);
  // useEffect(() => {
  //   setAssignedPoints(points.filter((point) => block.aiming_point_ids.includes(point.id)) ?? []);
  // }, [block.aiming_point_ids, points]);

  return (
    <article className="rounded-lg border border-primitive-neutral-800 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <FormField id={`target-${block.key}`} label={DICTIONARY.missions.fields.target} wrapperClassName="w-full">
          <TargetSearchCombobox
            id={`target-${block.key}`}
            value={block.target_id}
            disabled={readOnly}
            targets={catalogTargets}
            onChange={(targetId) =>
              onChange({
                ...block,
                target_id: targetId,
                aiming_point_ids: [],
                detachments: block.detachments.map((row) => ({ ...row, aiming_point_id: "" })),
              })
            }
          />
        </FormField>
        {readOnly ? null : <DeleteIconButton onClick={onRemove} />}
      </div>
      {/* {selectedTarget ? (
        <div className="mb-3 flex items-center gap-1.5 min-h-7">
          <span className="text-sm text-primitive-neutral-300">{DICTIONARY.missions.assigned_aiming_points}</span>
          <div className="flex flex-wrap gap-1">
            {assignedPoints.length === 0 ? (
              <span className="text-sm text-primitive-neutral-500">—</span>
            ) : (
              assignedPoints.map((point) => (
                <span
                  key={point.id}
                  title={`${point.name} — ${point.mgrs}`}
                  className="rounded-md border border-primitive-neutral-700 px-2 py-1 text-xs text-primitive-neutral-100"
                >
                  {point.displayed_id || point.label || "—"} — {point.mgrs}
                </span>
              ))
            )}
          </div>
        </div>
      ) : null} */}
      {selectedTarget ? (
      <div className="flex flex-col gap-2 mt-8">
        <h3 className="text-sm font-semibold text-primitive-neutral-0">{DICTIONARY.missions.assignment_title}</h3>
        <div>
            {block.detachments.map((row, index) => (
              <div
                key={row.key}
                className={
                  index === block.detachments.length - 1
                    ? "py-1"
                    : "border-b border-primitive-neutral-800 py-2"
                }
              >
                <div className="flex gap-2">
                  <FormField
                    id={`${row.key}-aiming`}
                    label={index === 0 ? DICTIONARY.tasks.aiming_points : ""}
                    wrapperClassName="flex-1"
                  >
                    <NativeFormSelect
                      autoSelect={false}
                      id={`${row.key}-aiming`}
                      value={row.aiming_point_id ?? ""}
                      disabled={readOnly}
                      placeholder={DICTIONARY.missions.main_target}
                      options={points
                        .filter((point) => point.archived_at === null || point.id === row.aiming_point_id)
                        .map((point) => ({
                          value: point.id,
                          label: `${point.mgrs} - ${point.name}`,
                        }))}
                      onChange={(aimingPointId) => onChange(assignRowAimingPoint(block, row.key, aimingPointId))}
                      className="h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <FormField id={`${row.key}-org`} label={index === 0 ? DICTIONARY.missions.fields.detachment : ""} wrapperClassName="w-28 lg:w-40">
                    <NativeFormSelect
                      id={`${row.key}-org`}
                      value={row.organization_id}
                      disabled={readOnly}
                      placeholder={DICTIONARY.missions.select_detachment}
                      options={DETACHMENT_REFS.map((item) => ({ value: item.id, label: item.name }))}
                      onChange={(organizationId) =>
                        onChange({
                          ...block,
                          detachments: block.detachments.map((item) =>
                            item.key === row.key ? { ...item, organization_id: organizationId } : item,
                          ),
                        })
                      }
                      className="h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <FormField id={`${row.key}-uav`} label={index === 0 ? DICTIONARY.missions.fields.assets : ""} wrapperClassName="w-28 lg:w-40">
                    <NativeFormSelect
                      id={`${row.key}-uav`}
                      value={row.asset_id}
                      disabled={readOnly}
                      placeholder={DICTIONARY.missions.select_asset}
                      options={catalogAssets
                        .filter((asset) => asset.archived_at === null || asset.id === row.asset_id)
                        .map((asset) => ({ value: asset.id, label: asset.label }))}
                      onChange={(uavModelId) =>
                        onChange({
                          ...block,
                          detachments: block.detachments.map((item) =>
                            item.key === row.key ? { ...item, asset_id: uavModelId } : item,
                          ),
                        })
                      }
                      className="h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <div className="flex items-end gap-1">
                    <FormField id={`${row.key}-qty`} label={index === 0 ? DICTIONARY.missions.quantity : ""} wrapperClassName="w-full">
                      <Input
                        id={`${row.key}-qty`}
                        // type="number"
                        // min={1}
                        pattern="^[1-9][0-9]*$"
                        value={row.quantity}
                        disabled={readOnly}
                        onChange={(event) =>
                          onChange({
                            ...block,
                            detachments: block.detachments.map((item) =>
                              item.key === row.key ? { ...item, quantity: extractNumeric(event.target.value) } : item,
                            ),
                          })
                        }
                        className="max-w-20"
                      />
                    </FormField>
                    {readOnly ? null : (
                      <DeleteIconButton
                        onClick={() =>
                          onChange({
                            ...block,
                            detachments: block.detachments.filter((item) => item.key !== row.key),
                            aiming_point_ids: block.aiming_point_ids.filter((id) => id !== row.aiming_point_id),
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {readOnly ? null : (
              <Button
                variant="ghost"
                onClick={() => onChange({ ...block, detachments: [...block.detachments, emptyDetachment()] })}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {DICTIONARY.missions.add_detachment}
              </Button>
            )}
        </div>
      </div>
      ) : null}
    </article>
  );
}
