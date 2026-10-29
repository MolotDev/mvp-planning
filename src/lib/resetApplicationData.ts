import { notifyCrossTab } from "@/services/crossTabSync";
import { resetAssetStore } from "@/store/useAssetStore";
import { useAssetFilterStore } from "@/store/useAssetFilterStore";
import { resetBattleGroupStore } from "@/store/useBattleGroupStore";
import { resetLaunchFilterStore } from "@/store/useLaunchFilterStore";
import { resetLaunchStore } from "@/store/useLaunchStore";
import { resetMissionFilterStore } from "@/store/useMissionFilterStore";
import { resetMissionStore } from "@/store/useMissionStore";
import { resetReportFilterStore } from "@/store/useReportFilterStore";
import { reconcileAllocatedReports, resetReportStore } from "@/store/useReportStore";
import { reconcileLaunchesWithBattleGroups } from "@/store/storeBridge";
import { resetTargetFilterStore } from "@/store/useTargetFilterStore";
import { resetTargetStore } from "@/store/useTargetStore";
import { resetTaskFilterStore } from "@/store/useTaskFilterStore";
import { resetTaskStore } from "@/store/useTaskStore";
import { resetTrackerStore } from "@/store/useTrackerStore";

export function resetApplicationData() {
  resetMissionStore();
  resetTaskStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTargetStore();
  resetAssetStore();
  resetReportStore();
  resetTrackerStore();
  resetMissionFilterStore();
  resetTaskFilterStore();
  resetLaunchFilterStore();
  resetTargetFilterStore();
  resetReportFilterStore();
  useAssetFilterStore.getState().reset();
  reconcileLaunchesWithBattleGroups();
  reconcileAllocatedReports();
  notifyCrossTab("SYNC_ALL");
}
