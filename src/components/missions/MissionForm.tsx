import { useEffect, useMemo, useRef } from "react";
import { Crosshair, MapPinned, Plus } from "lucide-react";
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
import { formatStoredAimingPoint } from "@/lib/formatters";
import { assignRowAimingPoint, emptyDetachment, emptyTarget, type TargetDraft } from "@/lib/missionForm";
import type { AimingPoint, Target } from "@/types/target";
import { DETACHMENT_REFS } from "@/data/crews";
import { extractNumeric } from "@/lib/validation";
import DatePicker from "react-datepicker";

interface MissionFormProps {
  missionId?: string;
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
  setDidChange: (didChange: boolean) => void;
}

export function MissionForm({
  missionId,
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
  setDidChange,
}: MissionFormProps) {
  const datepickerRef = useRef<DatePicker | null>(null);
  useEffect(() => {
    if (datepickerRef.current && !readOnly && !scheduledAt) {
      datepickerRef.current.setFocus();
    }
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex gap-2 flex-1">
          <FormField
            id="scheduled_at"
            label={DICTIONARY.missions.fields.scheduled_at}
            // error={readOnly ? undefined : dateError}
            wrapperClassName="flex-1"
            labelClassName="text-zinc-600"
          >
            <AppDatePicker
              inputRef={datepickerRef}
              className="min-h-9 h-9"
              id="mission_scheduled_at_date_picker"
              selected={scheduledAt}
              onChange={(date) => {
                onScheduledAtChange(date);
                setDidChange(true);
              }}
              placeholder={DICTIONARY.missions.fields.scheduled_at}
              disabled={readOnly}
              isError={!!dateError}
              minDate={new Date()}
                        
            />
          </FormField>
          <FormField id="mission_name" label={DICTIONARY.missions.fields.name}
            wrapperClassName="flex-1"
            labelClassName="text-zinc-600">
            <Input
              id="mission_name"
              value={name}
              disabled={readOnly}
              onChange={(event) => {
                onNameChange(event.target.value);
                setDidChange(true);
              }}
              className="min-h-9 h-9"
            />
          </FormField>
        </div>
        <FormField
          id="description"
          label={DICTIONARY.missions.fields.description}
          // error={readOnly ? undefined : descriptionError}
          wrapperClassName="flex-1"
          labelClassName="text-zinc-600"
        >
          <Textarea
            tabIndex={readOnly ? -1 : 0}
            autoFocus={!readOnly}
            id="description"
            value={description}
            disabled={readOnly}
            onChange={(event) => {
              onDescriptionChange(event.target.value);
              setDidChange(true);
            }}
            rows={1}
            data-error={!!descriptionError}
            className="min-h-9 h-9 pt-1.5"
          />
        </FormField>
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-end gap-2">
          {missionId && aimingPoints.length ? (
            <p className="rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
              {DICTIONARY.missions.command.cascade_notice}
            </p>
          ) : null}
        </div>
        {targetDrafts.map((block) => (
          <TargetAssignmentBlock
            key={block.key}
            block={block}
            catalogTargets={catalogTargets}
            aimingPoints={aimingPoints}
            readOnly={readOnly}
              onChange={(next) => {
                onTargetDraftsChange(targetDrafts.map((item) => (item.key === next.key ? next : item)));
                setDidChange(true);
              }}
            onRemove={() =>
              onTargetDraftsChange(targetDrafts.filter((item) => item.key !== block.key))
            }
          />
        ))}
      </section>
      {readOnly ? null : (
        <Button
          className="py-1 h-7 bg-sky-900/50 hover:bg-sky-800/80 transition-all duration-300"
          onClick={() => onTargetDraftsChange([...targetDrafts, emptyTarget()])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {DICTIONARY.missions.add_target}
        </Button>
      )}
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

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 p-3">
      <div className="w-full flex items-center justify-between gap-2 last:mb-0">
        <MapPinned className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
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
        <div className="min-w-8 w-8">
          {readOnly ? null : <DeleteIconButton onClick={onRemove} />}
        </div>
      </div>
      {selectedTarget ? (
      <div className="flex flex-col gap-2">
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
                <div className="flex gap-2 items-end">
                  <Crosshair className="h-4 w-4 shrink-0 text-sky-300/50 mb-2" aria-hidden="true" />
                  <FormField
                    id={`${row.key}-aiming`}
                    label={index === 0 ? DICTIONARY.tasks.aiming_points : ""}
                    wrapperClassName="flex-1"
                    labelClassName="text-zinc-600 text-xs"
                  >
                    <NativeFormSelect
                      autoSelect={false}
                      id={`${row.key}-aiming`}
                      value={row.aiming_point_id ?? ""}
                      disabled={readOnly}
                      placeholder={`${formatStoredAimingPoint(null).badge} — ${DICTIONARY.missions.main_target}`}
                      options={points
                        .filter((point) => point.archived_at === null || point.id === row.aiming_point_id)
                        .map((point) => {
                          const aiming = formatStoredAimingPoint(point);
                          return {
                            value: point.id,
                            label: aiming.label ? `${aiming.badge} — ${aiming.label}` : aiming.badge,
                          };
                        })}
                      onChange={(aimingPointId) => onChange(assignRowAimingPoint(block, row.key, aimingPointId))}
                      className="h-8 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <FormField
                    id={`${row.key}-org`}
                    label={index === 0 ? DICTIONARY.missions.fields.detachment : ""}
                    wrapperClassName="w-28 lx:w-40"
                    labelClassName="text-zinc-600 text-xs"
                  >
                    <NativeFormSelect
                      ariaInvalid={!row.organization_id}
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
                      className="h-8 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <FormField
                    id={`${row.key}-uav`}
                    label={index === 0 ? DICTIONARY.missions.fields.assets : ""}
                    wrapperClassName="w-28 lx:w-40"
                    labelClassName="text-zinc-600 text-xs"
                  >
                    <NativeFormSelect
                      ariaInvalid={!row.asset_id}
                      id={`${row.key}-uav`}
                      value={row.asset_id}
                      disabled={readOnly}
                      tabIndex={row.quantity ? -1 : 0}
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
                      className="h-8 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <div className="flex items-end gap-1">
                    <FormField
                      id={`${row.key}-qty`}
                      label={index === 0 ? DICTIONARY.missions.quantity : ""}
                      wrapperClassName="w-fit"
                      labelClassName="w-fit text-zinc-600 text-xs"
                    >
                      <Input
                        data-error={!row.quantity}
                        id={`${row.key}-qty`}
                        // type="number"
                          // min={1}
                        tabIndex={row.quantity ? -1 : 0}
                        autoFocus={!readOnly && !row.quantity}
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
                        className="max-w-16 h-8"
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
                className="py-1 h-7 mt-2"
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
