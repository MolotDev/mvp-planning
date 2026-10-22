import { useMemo, useState } from "react";
import { Crosshair, MapPinned, Plus } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { TargetSearchCombobox } from "@/components/missions/TargetSearchCombobox";
import { Button } from "@/components/ui/button";
import { NativeFormSelect } from "@/components/ui/form-select";
import { DeleteIconButton } from "@/components/ui/icon-buttons";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import {
  assignCrewAsset,
  assignPlanAimingPoint,
  assignPlanAsset,
  crewAssetId,
  crewOptionState,
  emptyForceRow,
  emptyPlanTarget,
  externalAimingUsage,
  type PlanTargetBlock,
} from "@/lib/detachmentPlan";
import { extractNumeric } from "@/lib/validation";
import type { Crew } from "@/types/battleGroup";
import type { Task } from "@/types/mission";
import type { Asset } from "@/types/asset";
import type { AimingPoint, Target } from "@/types/target";

interface DetachmentPlanFormProps {
  blocks: PlanTargetBlock[];
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  crews: Crew[];
  assets: Asset[];
  tasks: Task[];
  organizationId: string;
  occupiedCrewIds: ReadonlySet<string>;
  onChange: (blocks: PlanTargetBlock[]) => void;
}

export function DetachmentPlanForm({
  blocks,
  catalogTargets,
  aimingPoints,
  crews,
  assets,
  tasks,
  organizationId,
  occupiedCrewIds,
  onChange,
}: DetachmentPlanFormProps) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const replace = (next: PlanTargetBlock) => {
    onChange(blocks.map((block) => (block.key === next.key ? next : block)));
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <TargetBlock
          key={block.key}
          block={block}
          blocks={blocks}
          catalogTargets={catalogTargets}
          aimingPoints={aimingPoints}
          crews={crews}
          assets={assets}
          tasks={tasks}
          organizationId={organizationId}
          occupiedCrewIds={occupiedCrewIds}
          selectedRowKey={selectedRowKey}
          onSelectRow={setSelectedRowKey}
          onChange={replace}
          onChangeAll={onChange}
          onRemove={() => onChange(blocks.filter((item) => item.key !== block.key))}
        />
      ))}
      <Button
        className="h-7 bg-sky-900/50 py-1 transition-all duration-300 hover:bg-sky-800/80"
        onClick={() => onChange([...blocks, emptyPlanTarget()])}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {DICTIONARY.missions.add_target}
      </Button>
    </div>
  );
}

function TargetBlock({
  block,
  blocks,
  catalogTargets,
  aimingPoints,
  crews,
  assets,
  tasks,
  organizationId,
  occupiedCrewIds,
  selectedRowKey,
  onSelectRow,
  onChange,
  onChangeAll,
  onRemove,
}: {
  block: PlanTargetBlock;
  blocks: PlanTargetBlock[];
  catalogTargets: Target[];
  aimingPoints: AimingPoint[];
  crews: Crew[];
  assets: Asset[];
  tasks: Task[];
  organizationId: string;
  occupiedCrewIds: ReadonlySet<string>;
  selectedRowKey: string | null;
  onSelectRow: (rowKey: string) => void;
  onChange: (block: PlanTargetBlock) => void;
  onChangeAll: (blocks: PlanTargetBlock[]) => void;
  onRemove: () => void;
}) {
  const text = DICTIONARY.tasks.details;
  const selectedTarget = catalogTargets.find((target) => target.id === block.targetId);
  const points = useMemo(
    () =>
      aimingPoints.filter((point) => {
        if (point.target_id !== block.targetId) {
          return false;
        }
        return point.archived_at === null || block.rows.some((row) => row.aimingPointId === point.id);
      }),
    [aimingPoints, block.rows, block.targetId],
  );

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 p-3">
      <div className="flex w-full items-center justify-between gap-2">
        <MapPinned className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
        <TargetSearchCombobox
          id={`target-${block.key}`}
          value={block.targetId}
          targets={catalogTargets}
          onChange={(targetId) =>
            onChange({
              ...block,
              targetId,
              rows: block.rows.map((row) => ({ ...row, aimingPointId: "" })),
            })
          }
        />
        <div className="w-8 min-w-8">
          <DeleteIconButton onClick={onRemove} />
        </div>
      </div>
      {selectedTarget ? (
        <div>
          {block.rows.map((row, index) => {
            const shared =
              selectedRowKey === row.key && row.aimingPointId
                ? externalAimingUsage(tasks, row.aimingPointId, organizationId, uavName)
                : [];
            return (
              <div
                key={row.key}
                className={index === block.rows.length - 1 ? "py-1" : "border-b border-primitive-neutral-800 py-2"}
                onClick={() => onSelectRow(row.key)}
                onFocus={() => onSelectRow(row.key)}
              >
                <div className="flex items-end gap-2">
                  <Crosshair className="mb-2 h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                  <FormField
                    id={`${row.key}-aiming`}
                    label={index === 0 ? DICTIONARY.tasks.aiming_points : ""}
                    wrapperClassName="flex-1"
                    labelClassName="text-xs text-zinc-600"
                  >
                    <NativeFormSelect
                      autoSelect={false}
                      id={`${row.key}-aiming`}
                      value={row.aimingPointId}
                      placeholder={DICTIONARY.missions.main_target}
                      options={points
                        .filter((point) => point.archived_at === null || point.id === row.aimingPointId)
                        .map((point) => ({ value: point.id, label: `${point.name} - ${point.mgrs}` }))}
                      onChange={(aimingPointId) => onChange(assignPlanAimingPoint(block, row.key, aimingPointId))}
                      className="h-7 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <FormField
                    id={`${row.key}-crew`}
                    label={index === 0 ? text.crews_column : ""}
                    wrapperClassName="w-28 lx:w-40"
                    labelClassName="text-xs text-zinc-600"
                  >
                    <NativeFormSelect
                      ariaInvalid={!row.crewId}
                      id={`${row.key}-crew`}
                      value={row.crewId}
                      placeholder={DICTIONARY.auth.select_crew}
                      options={crews.map((crew) => {
                        const state = crewOptionState(crew, row, block.targetId, blocks, occupiedCrewIds, uavName);
                        return { value: crew.id, label: state.label, disabled: state.disabled && crew.id !== row.crewId };
                      })}
                      onChange={(crewId) => {
                        const lockedAsset = crewAssetId(blocks, crewId, row.key);
                        const withCrew = {
                          ...block,
                          rows: block.rows.map((item) => (item.key === row.key ? { ...item, crewId } : item)),
                        };
                        onChange(lockedAsset ? assignPlanAsset(withCrew, row.key, lockedAsset) : withCrew);
                      }}
                      className="h-7 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <FormField
                    id={`${row.key}-uav`}
                    label={index === 0 ? DICTIONARY.missions.fields.assets : ""}
                    wrapperClassName="w-28 lx:w-40"
                    labelClassName="text-xs text-zinc-600"
                  >
                    <NativeFormSelect
                      ariaInvalid={!row.assetId}
                      id={`${row.key}-uav`}
                      value={row.assetId}
                      placeholder={DICTIONARY.missions.select_asset}
                      options={assets
                        .filter((asset) => asset.archived_at === null || asset.id === row.assetId)
                        .map((asset) => {
                          const lockedAsset = crewAssetId(blocks, row.crewId, row.key);
                          return {
                            value: asset.id,
                            label: asset.label,
                            disabled: Boolean(lockedAsset && asset.id !== lockedAsset),
                          };
                        })}
                      onChange={(assetId) =>
                        row.crewId
                          ? onChangeAll(assignCrewAsset(blocks, row.crewId, assetId))
                          : onChange(assignPlanAsset(block, row.key, assetId))
                      }
                      className="h-7 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormField>
                  <div className="flex items-end gap-1">
                    <FormField
                      id={`${row.key}-qty`}
                      label={index === 0 ? DICTIONARY.missions.quantity : ""}
                      wrapperClassName="w-fit"
                      labelClassName="w-fit text-xs text-zinc-600"
                    >
                      <Input
                        data-error={!row.quantity}
                        id={`${row.key}-qty`}
                        pattern="^[1-9][0-9]*$"
                        value={row.quantity}
                        onChange={(event) =>
                          onChange({
                            ...block,
                            rows: block.rows.map((item) =>
                              item.key === row.key ? { ...item, quantity: extractNumeric(event.target.value) } : item,
                            ),
                          })
                        }
                        className="h-7 max-w-16"
                      />
                    </FormField>
                    <DeleteIconButton
                      onClick={() => onChange({ ...block, rows: block.rows.filter((item) => item.key !== row.key) })}
                    />
                  </div>
                </div>
                {shared.map((item) => (
                  <span
                    key={`${item.detachmentId}:${item.droneModel}`}
                    className="mt-1 inline-flex rounded border border-amber-600/50 bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                  >
                    {`⚠️ ${fillTemplate(text.shared_aiming, {
                      detachment: item.detachmentName,
                      count: item.droneCount,
                      model: item.droneModel,
                    })}`}
                  </span>
                ))}
              </div>
            );
          })}
          <Button
            variant="ghost"
            className="mt-2 h-7 py-1"
            onClick={() => onChange({ ...block, rows: [...block.rows, emptyForceRow()] })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.missions.add_detachment}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
