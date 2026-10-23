import { useEffect } from "react";
import { crossTabSync, runRemoteSync, type SyncEventType } from "@/services/crossTabSync";
import { useAssetStore } from "@/store/useAssetStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";

const pending = new Set<SyncEventType>();
let scheduled = false;

function wants(types: SyncEventType[], ...expected: SyncEventType[]) {
  return types.some((type) => type === "SYNC_ALL" || expected.includes(type));
}

async function rehydrateStores(types: SyncEventType[]) {
  await runRemoteSync(async () => {
    if (wants(types, "SYNC_MISSIONS")) {
      await useMissionStore.persist.rehydrate();
    }
    if (wants(types, "SYNC_TASKS") || wants(types, "SYNC_MISSIONS")) {
      await useTaskStore.persist.rehydrate();
      await useBattleGroupStore.persist.rehydrate();
    }
    if (wants(types, "SYNC_LAUNCHES")) {
      await useLaunchStore.persist.rehydrate();
      await useBattleGroupStore.persist.rehydrate();
    }
    if (types.includes("SYNC_ALL") || wants(types, "SYNC_TASKS") || wants(types, "SYNC_MISSIONS")) {
      await useTargetStore.persist.rehydrate();
    }
    if (types.includes("SYNC_ALL")) {
      await useAssetStore.persist.rehydrate();
      await useReportStore.persist.rehydrate();
    }
  });
}

function enqueue(type: SyncEventType) {
  pending.add(type);
  if (scheduled) {
    return;
  }
  scheduled = true;
  queueMicrotask(() => {
    const types = [...pending];
    pending.clear();
    scheduled = false;
    void rehydrateStores(types);
  });
}

export function useCrossTabSync() {
  useEffect(() => crossTabSync.subscribe((message) => enqueue(message.type)), []);
}
