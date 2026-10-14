import { useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BattleGroupSummary } from "@/components/tasks/BattleGroupSummary";
import { LaunchProgressBadge } from "@/components/tasks/LaunchProgressBadge";
import { QuantityDiscrepancy } from "@/components/tasks/QuantityDiscrepancy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteIconButton, EditIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { assetLimitBreaches, assetLimitMessage, fillTemplate, remainingTaskAssets } from "@/lib/battleGroupCapacity";
import { quantityDiscrepancy } from "@/lib/launches";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { UavAsset } from "@/types/mission";
import { cn } from "@/lib/utils";

function GroupDiscrepancy({ group, launches }: { group: BattleGroup; launches: Launch[] }) {
  const discrepancy = quantityDiscrepancy(group.uav_quantity, launches, group.id);
  if (!discrepancy) {
    return null;
  }
  return <QuantityDiscrepancy planned={discrepancy.planned} actual={discrepancy.actual} />;
}

interface BattleGroupPanelProps {
  groups: BattleGroup[];
  taskAssets: UavAsset[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (group: BattleGroup) => void;
}

export function BattleGroupPanel({ groups, taskAssets, canEdit, onAdd, onEdit }: BattleGroupPanelProps) {
  const navigate = useNavigate();
  const archiveBattleGroup = useBattleGroupStore((state) => state.archiveBattleGroup);
  const launches = useLaunchStore((state) => state.launches);
  const [pendingDelete, setPendingDelete] = useState<BattleGroup | null>(null);
  const remaining = remainingTaskAssets(taskAssets, groups);

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    const removed = archiveBattleGroup(pendingDelete.id);
    if (!removed) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    notifySuccess(DICTIONARY.tasks.toasts.battle_group_deleted);
    setPendingDelete(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h5 className="text-lg font-semibold text-primitive-neutral-0">
          {DICTIONARY.tasks.battle_groups_title}:
        </h5>
        {canEdit ? (
          <Button className="hover:shadow-md" onClick={onAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.tasks.add_battle_group}
          </Button>
        ) : null}
      </div>
      <p className={cn("mb-3 text-sm", !remaining ? "text-primitive-green-500" : "text-primitive-red-500")}>
        {fillTemplate(DICTIONARY.tasks.unallocated_assets, { quantity: remaining })}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1">
        {assetLimitBreaches(groups, taskAssets).map((breach) => (
          <p key={breach.uavModelId} role="alert" className="mb-2 text-sm text-primitive-red-500">
            {assetLimitMessage(breach.currentSum, breach.taskLimit)}
          </p>
        ))}
        {groups.length === 0 ? (
          <Badge className="w-fit bg-primitive-red-500/20 font-medium text-primitive-red-500">
            {DICTIONARY.tasks.no_crews_assigned}
          </Badge>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {groups.map((group) => (
              <Card key={group.id} className="min-w-0 gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <BattleGroupSummary group={group} />
                    <LaunchProgressBadge
                      launches={launches.filter((launch) => launch.battle_group_id === group.id)}
                    />
                    <GroupDiscrepancy group={group} launches={launches} />
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <EditIconButton onClick={() => onEdit(group)} />
                      <DeleteIconButton onClick={() => setPendingDelete(group)} />
                    </div>
                  ) : null}
                </div>
                <div className="flex justify-end">
                  <PreviewActionButton
                    label={DICTIONARY.common.actions.preview_launches}
                    onClick={() => navigate(`/planning/launches/${group.id}`)}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {pendingDelete ? (
        <Modal
          title={DICTIONARY.tasks.modals.title_delete}
          confirmLabel={DICTIONARY.common.actions.delete}
          onClose={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.tasks.confirm_delete}</p>
        </Modal>
      ) : null}
    </div>
  );
}
