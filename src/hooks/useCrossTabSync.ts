import { useEffect } from "react";
import { crossTabSync, runRemoteSync, type SyncEventType } from "@/services/crossTabSync";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";

const pending = new Set<SyncEventType>();
let scheduled = false;

function wants(types: SyncEventType[], ...expected: SyncEventType[]) {
  return types.some((type) => type === "SYNC_ALL" || expected.includes(type));
}

async function rehydrateStores(types: SyncEventType[]) {
  await runRemoteSync(async () => {
    const jobs: Array<Promise<void> | void> = [];
    if (wants(types, "SYNC_MISSIONS")) {
      jobs.push(useMissionStore.persist.rehydrate());
    }
    if (wants(types, "SYNC_TASKS")) {
      jobs.push(useTaskStore.persist.rehydrate());
      jobs.push(useBattleGroupStore.persist.rehydrate());
    }
    if (wants(types, "SYNC_LAUNCHES")) {
      jobs.push(useLaunchStore.persist.rehydrate());
      jobs.push(useBattleGroupStore.persist.rehydrate());
    }
    if (types.includes("SYNC_ALL")) {
      jobs.push(useTargetStore.persist.rehydrate());
    }
    await Promise.all(jobs);
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
