import { useEffect, useMemo, useState } from "react";
import { Divide } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-select";
// import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { crewsForOrganization } from "@/data/crews";
import { DICTIONARY } from "@/constants/dictionary";
// import { ammosForAsset, antennasForAsset } from "@/lib/assets";
import {
  evenDistribution,
  inspectBattleGroup,
  occupiedCrewIds,
  taskAllocatedQuantity,
  taskAllocation,
  taskIdsOnOperationalDay,
  uavName,
  validateBattleGroupInput,
} from "@/lib/battleGroup";
import { remainingModelQuantity } from "@/lib/battleGroupCapacity";
import { parseRequiredNumber } from "@/lib/validation";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { BattleGroup, BattleGroupInput } from "@/types/battleGroup";
import type { UavAsset } from "@/types/mission";

interface BattleGroupModalProps {
  taskId: string;
  organizationId: string;
  taskAssets: UavAsset[];
  battleGroup?: BattleGroup | null;
  onClose: () => void;
}

export function BattleGroupModal({
  taskId,
  organizationId,
  taskAssets,
  battleGroup,
  onClose,
}: BattleGroupModalProps) {
  const isEdit = Boolean(battleGroup);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const createBattleGroup = useBattleGroupStore((state) => state.createBattleGroup);
  const updateBattleGroup = useBattleGroupStore((state) => state.updateBattleGroup);
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const sameDayTaskIds = useMemo(
    () => taskIdsOnOperationalDay(taskId, tasks, missions),
    [taskId, tasks, missions],
  );
  const occupied = useMemo(
    () => occupiedCrewIds(battleGroups, battleGroup?.id, sameDayTaskIds),
    [battleGroups, battleGroup?.id, sameDayTaskIds],
  );

  const [leadCrewId, setLeadCrewId] = useState(battleGroup?.lead_crew_id ?? "");
  const [supportCrewIds, setSupportCrewIds] = useState<string[]>(battleGroup?.support_crew_ids ?? []);
  const [quantity, setQuantity] = useState(battleGroup ? String(battleGroup.uav_quantity) : "");
  const [quantityTouched, setQuantityTouched] = useState(isEdit);
  const taskRecord = tasks.find((item) => item.id === taskId);
  const allocationAssets = taskRecord ? taskAllocation(taskRecord) : [];
  const fixedAssetId = allocationAssets.length === 1 ? allocationAssets[0].asset_id : "";
  const totalQuantity = taskRecord?.allocations.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const remainingQuota = Math.max(0, totalQuantity - taskAllocatedQuantity(battleGroups, taskId));

  const roster = crewsForOrganization(organizationId);
  const eligibleCrews = roster.filter((crew) => !occupied.has(crew.id));
  const availableCrews = roster.filter(
    (crew) => !occupied.has(crew.id) || crew.id === leadCrewId || supportCrewIds.includes(crew.id),
  );
  const supportOptions = availableCrews.filter((crew) => crew.id !== leadCrewId);
  const quantityValue = parseRequiredNumber(quantity);
  const input = {
    task_id: taskId,
    lead_crew_id: leadCrewId,
    support_crew_ids: supportCrewIds,
    asset_id: fixedAssetId,
    uav_quantity: quantityValue ?? 0,
  };
  const inspection = inspectBattleGroup(input, battleGroups, {
    exceptGroupId: battleGroup?.id,
    taskAssets,
    sameDayTaskIds,
  });
  const validationError =
    quantityValue === null ? DICTIONARY.targets_catalog.validation.required : inspection.blocking;
  const leadError = inspection.crewError ?? undefined;
  const quantityError = inspection.capacityError ?? undefined;
  const assetError = inspection.assetError;
  const remaining =
    fixedAssetId === ""
      ? null
      : remainingModelQuantity(taskAssets, battleGroups, taskId, fixedAssetId, battleGroup?.id);

  useEffect(() => {
    if (isEdit || quantityTouched || remaining === null) {
      return;
    }
    setQuantity(String(remaining));
  }, [isEdit, quantityTouched, remaining]);

  const toggleSupport = (crewId: string, checked: boolean) => {
    setSupportCrewIds((current) =>
      checked ? [...current, crewId] : current.filter((id) => id !== crewId),
    );
  };

  const distributeDisabled = remainingQuota === 0 || eligibleCrews.length === 0 || fixedAssetId === "";

  const handleDistribute = () => {
    if (distributeDisabled) {
      return;
    }
    const shares = evenDistribution(
      remainingQuota,
      eligibleCrews.map((crew) => crew.id),
    );
    if (shares.length === 0) {
      return;
    }
    const planned: BattleGroupInput[] = shares.map((share) => ({
      task_id: taskId,
      lead_crew_id: share.crewId,
      support_crew_ids: [],
      asset_id: fixedAssetId,
      uav_quantity: share.quantity,
    }));
    let preview = battleGroups;
    for (const input of planned) {
      const error = validateBattleGroupInput(input, preview, { taskAssets, sameDayTaskIds });
      if (error) {
        notifyError(error);
        return;
      }
      preview = [
        {
          id: `pending-${input.lead_crew_id}`,
          ...input,
          allocation_line_id: null,
          created_at: "",
          updated_at: "",
          archived_at: null,
        },
        ...preview,
      ];
    }
    for (const input of planned) {
      const saved = createBattleGroup(input);
      if (!saved) {
        notifyError(DICTIONARY.common.error);
        return;
      }
    }
    notifySuccess(DICTIONARY.tasks.toasts.evenly_distributed);
    onClose();
  };

  const handleSave = () => {
    if (validationError || quantityValue === null) {
      if (validationError) {
        notifyError(validationError);
      }
      return;
    }
    const saved = isEdit && battleGroup
      ? updateBattleGroup(battleGroup.id, { ...input, uav_quantity: quantityValue })
      : createBattleGroup({ ...input, uav_quantity: quantityValue });
    if (!saved) {
      notifyError(validationError ?? DICTIONARY.common.error);
      return;
    }
    notifySuccess(DICTIONARY.tasks.toasts.battle_group_saved);
    onClose();
  };

  return (
    <Modal
      title={isEdit ? DICTIONARY.tasks.modals.title_edit : DICTIONARY.tasks.modals.title_create}
      confirmLabel={DICTIONARY.tasks.buttons.save_battle_group}
      confirmDisabled={Boolean(validationError)}
      onClose={onClose}
      onConfirm={handleSave}
    >
      <div className="flex flex-col gap-4">
        {isEdit ? null : (
          <Button className="w-full" disabled={distributeDisabled} onClick={handleDistribute}>
            <Divide className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.tasks.allocation.distribute_evenly}
          </Button>
        )}
        <FormField id="lead_crew" label={DICTIONARY.tasks.lead_crew} error={leadError}>
          <FormSelect
            id="lead_crew"
            value={leadCrewId}
            placeholder={DICTIONARY.tasks.select_lead}
            options={availableCrews.map((crew) => ({ value: crew.id, label: crew.name }))}
            onChange={(next) => {
              setLeadCrewId(next);
              setSupportCrewIds((current) => current.filter((id) => id !== next));
            }}
          />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-primitive-neutral-200">{DICTIONARY.tasks.support_crews}</p>
          {supportOptions.map((crew) => (
            <Checkbox
              key={crew.id}
              id={`support-${crew.id}`}
              label={crew.name}
              checked={supportCrewIds.includes(crew.id)}
              onChange={(event) => toggleSupport(crew.id, event.target.checked)}
            />
          ))}
        </div>
        <FormField id="uav_model" label={DICTIONARY.common.asset}>
          <p id="uav_model" className="text-sm text-primitive-neutral-0">
            {uavName(fixedAssetId)}
          </p>
        </FormField>
        {/* {uavModelId ? (
          <>
            <FormField id="asset_antenna" label={DICTIONARY.assets.fields.antenna}>
              <NativeFormSelect
                id="asset_antenna"
                value={linkedAntennas[0]?.id ?? ""}
                disabled
                placeholder={DICTIONARY.assets.select_antenna}
                options={linkedAntennas.map((antenna) => ({ value: antenna.id, label: antenna.name }))}
                onChange={() => undefined}
                className="h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </FormField>
            <FormField id="asset_ammo" label={DICTIONARY.assets.fields.ammo} optional>
              <MultiSelect
                id="asset_ammo"
                values={linkedAmmos.map((ammo) => ammo.id)}
                disabled
                placeholder={DICTIONARY.assets.select_ammo}
                options={linkedAmmos.map((ammo) => ({ value: ammo.id, label: ammo.name, badge: ammo.name }))}
                onChange={() => undefined}
              />
            </FormField>
          </>
        ) : null} */}
        <FormField
          id="uav_quantity"
          label={DICTIONARY.tasks.uav_quantity}
          error={quantityError}
        >
          <Input
            id="uav_quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => {
              setQuantityTouched(true);
              setQuantity(event.target.value);
            }}
          />
        </FormField>
        {assetError ? (
          <p role="alert" className="text-sm text-primitive-red-500">
            {assetError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
