import { useMemo } from "react";
import { Minus, Plus, X } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { AppDatePicker } from "@/components/ui/date-picker";
import { NativeFormSelect } from "@/components/ui/form-select";
import { DeleteIconButton } from "@/components/ui/icon-buttons";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DICTIONARY } from "@/constants/dictionary";
import { DETACHMENT_REFS } from "@/data/crews";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { assignRowAimingPoint, emptyDetachment, emptyTarget, type TargetDraft } from "@/lib/missionForm";
import { extractNumeric, parseRequiredNumber } from "@/lib/validation";
import { useAssetStore } from "@/store/useAssetStore";
import type { AimingPoint, Target } from "@/types/target";

const selectClassName =
  "h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

interface MissionInlineFormProps {
  scheduledAt: Date | null;
  name: string;
  description: string;
  targetDrafts: TargetDraft[];
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  dateError?: string;
  descriptionError?: string;
  onScheduledAtChange: (date: Date | null) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTargetDraftsChange: (drafts: TargetDraft[]) => void;
  setDidChange: (didChange: boolean) => void;
}

export function MissionInlineForm({
  scheduledAt,
  name,
  description,
  targetDrafts,
  catalogTargets,
  aimingPoints,
  dateError,
  descriptionError,
  onScheduledAtChange,
  onNameChange,
  onDescriptionChange,
  onTargetDraftsChange,
  setDidChange,
}: MissionInlineFormProps) {
  const text = DICTIONARY.missions.command;
  const replaceBlock = (next: TargetDraft) => {
    onTargetDraftsChange(targetDrafts.map((item) => (item.key === next.key ? next : item)));
    setDidChange(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <FormField id="scheduled_at" label={DICTIONARY.missions.fields.scheduled_at} error={dateError}>
          <AppDatePicker
            id="scheduled_at"
            selected={scheduledAt}
            onChange={(date) => {
              onScheduledAtChange(date);
              setDidChange(true);
            }}
            placeholder={DICTIONARY.missions.fields.scheduled_at}
            isError={!!dateError}
          />
        </FormField>
        <FormField id="mission_name" label={DICTIONARY.missions.fields.name}>
          <Input
            id="mission_name"
            value={name}
            onChange={(event) => {
              onNameChange(event.target.value);
              setDidChange(true);
            }}
          />
        </FormField>
        <FormField id="description" label={DICTIONARY.missions.fields.description} error={descriptionError}>
          <Textarea
            id="description"
            value={description}
            onChange={(event) => {
              onDescriptionChange(event.target.value);
              setDidChange(true);
            }}
            rows={2}
            data-error={!!descriptionError}
          />
        </FormField>
      </div>
      {targetDrafts.map((block) => (
        <TargetBlock
          key={block.key}
          block={block}
          catalogTargets={catalogTargets}
          aimingPoints={aimingPoints}
          onChange={replaceBlock}
          onRemove={() => {
            onTargetDraftsChange(targetDrafts.filter((item) => item.key !== block.key));
            setDidChange(true);
          }}
        />
      ))}
      <Button
        variant="ghost"
        className="w-fit border border-primitive-neutral-700"
        onClick={() => {
          onTargetDraftsChange([...targetDrafts, emptyTarget()]);
          setDidChange(true);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {text.add_target}
      </Button>
      <p className="rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
        {text.cascade_notice}
      </p>
    </div>
  );
}

function TargetBlock({
  block,
  catalogTargets,
  aimingPoints,
  onChange,
  onRemove,
}: {
  block: TargetDraft;
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  onChange: (block: TargetDraft) => void;
  onRemove: () => void;
}) {
  const text = DICTIONARY.missions.command;
  const catalogAssets = useAssetStore((state) => state.assets);
  const selectedTarget = catalogTargets.find((target) => target.id === block.target_id);
  const points = useMemo(
    () =>
      aimingPoints.filter((point) => {
        if (point.target_id !== block.target_id) {
          return false;
        }
        return point.archived_at === null || block.aiming_point_ids.includes(point.id);
      }),
    [aimingPoints, block.aiming_point_ids, block.target_id],
  );

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 p-3">
      <div className="flex items-end gap-2">
        <FormField id={`target-${block.key}`} label={DICTIONARY.missions.fields.target} wrapperClassName="min-w-0 flex-1">
          <NativeFormSelect
            id={`target-${block.key}`}
            value={block.target_id}
            autoSelect={false}
            placeholder={DICTIONARY.missions.select_target}
            options={catalogTargets.map((target) => ({
              value: target.id,
              label: `${target.name} (${formattingMGRS.spacing(target.mgrs)})`,
            }))}
            onChange={(targetId) =>
              onChange({
                ...block,
                target_id: targetId,
                aiming_point_ids: [],
                detachments: block.detachments.map((row) => ({ ...row, aiming_point_id: "" })),
              })
            }
            className={selectClassName}
          />
        </FormField>
        <DeleteIconButton onClick={onRemove} />
      </div>
      {selectedTarget ? (
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
                <col className="w-[5%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-primitive-neutral-800 text-left text-xs text-primitive-neutral-400">
                  <th className="px-1 py-2 font-medium">{text.column_aiming}</th>
                  <th className="px-1 py-2 font-medium">{text.column_detachment}</th>
                  <th className="px-1 py-2 font-medium">{text.column_asset}</th>
                  <th className="px-1 py-2 font-medium">{text.column_quantity}</th>
                  <th className="px-1 py-2 font-medium">
                    <span className="sr-only">{text.column_actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {block.detachments.map((row) => {
                  const current = parseRequiredNumber(row.quantity) ?? 0;
                  return (
                    <tr key={row.key} className="border-b border-primitive-neutral-800">
                      <td className="px-1 py-2 align-top">
                        <NativeFormSelect
                          id={`${row.key}-aiming`}
                          value={row.aiming_point_id ?? ""}
                          autoSelect={false}
                          placeholder={DICTIONARY.missions.main_target}
                          ariaLabel={text.column_aiming}
                          options={points
                            .filter((point) => point.archived_at === null || point.id === row.aiming_point_id)
                            .map((point) => ({
                              value: point.id,
                              label: `${formattingMGRS.spacing(point.mgrs)} — ${point.name}`,
                            }))}
                          onChange={(aimingPointId) => onChange(assignRowAimingPoint(block, row.key, aimingPointId))}
                          className={selectClassName}
                        />
                      </td>
                      <td className="px-1 py-2 align-top">
                        <NativeFormSelect
                          id={`${row.key}-org`}
                          value={row.organization_id}
                          autoSelect={false}
                          placeholder={DICTIONARY.missions.select_detachment}
                          ariaLabel={text.column_detachment}
                          options={DETACHMENT_REFS.map((item) => ({ value: item.id, label: item.name }))}
                          onChange={(organizationId) =>
                            onChange({
                              ...block,
                              detachments: block.detachments.map((item) =>
                                item.key === row.key ? { ...item, organization_id: organizationId } : item,
                              ),
                            })
                          }
                          className={selectClassName}
                        />
                      </td>
                      <td className="px-1 py-2 align-top">
                        <NativeFormSelect
                          id={`${row.key}-uav`}
                          value={row.asset_id}
                          autoSelect={false}
                          placeholder={DICTIONARY.missions.select_asset}
                          ariaLabel={text.column_asset}
                          options={catalogAssets
                            .filter((asset) => asset.archived_at === null || asset.id === row.asset_id)
                            .map((asset) => ({ value: asset.id, label: asset.label }))}
                          onChange={(assetId) =>
                            onChange({
                              ...block,
                              detachments: block.detachments.map((item) =>
                                item.key === row.key ? { ...item, asset_id: assetId } : item,
                              ),
                            })
                          }
                          className={selectClassName}
                        />
                      </td>
                      <td className="px-1 py-2 align-top">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 border border-primitive-neutral-700 px-0"
                            aria-label={DICTIONARY.tasks.crew_allocation.decrease}
                            disabled={current <= 1}
                            onClick={() =>
                              onChange({
                                ...block,
                                detachments: block.detachments.map((item) =>
                                  item.key === row.key ? { ...item, quantity: String(current - 1) } : item,
                                ),
                              })
                            }
                          >
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Input
                            id={`${row.key}-qty`}
                            type="text"
                            inputMode="numeric"
                            pattern="^[1-9][0-9]*$"
                            aria-label={text.column_quantity}
                            value={row.quantity}
                            onChange={(event) => {
                              const next = extractNumeric(event.target.value).replace(/^0+/, "");
                              onChange({
                                ...block,
                                detachments: block.detachments.map((item) =>
                                  item.key === row.key ? { ...item, quantity: next } : item,
                                ),
                              });
                            }}
                            className="h-8 w-12 px-1 text-center"
                          />
                          <Button
                            variant="ghost"
                            className="h-8 w-8 border border-primitive-neutral-700 px-0"
                            aria-label={DICTIONARY.tasks.crew_allocation.increase}
                            onClick={() =>
                              onChange({
                                ...block,
                                detachments: block.detachments.map((item) =>
                                  item.key === row.key ? { ...item, quantity: String(current + 1) } : item,
                                ),
                              })
                            }
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-1 py-2 align-top">
                        <Button
                          variant="icon"
                          size="icon"
                          className="h-8 w-8"
                          title={text.remove_allocation}
                          aria-label={text.remove_allocation}
                          onClick={() =>
                            onChange({
                              ...block,
                              detachments: block.detachments.filter((item) => item.key !== row.key),
                              aiming_point_ids: block.aiming_point_ids.filter((id) =>
                                block.detachments.some(
                                  (item) => item.key !== row.key && item.aiming_point_id === id,
                                ),
                              ),
                            })
                          }
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button
            variant="ghost"
            className="w-fit"
            onClick={() => onChange({ ...block, detachments: [...block.detachments, emptyDetachment()] })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {text.add_allocation}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
