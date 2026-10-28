const CHANNEL_NAME = "flight_operations_cross_tab_channel";

export type SyncEventType = "SYNC_MISSIONS" | "SYNC_TASKS" | "SYNC_LAUNCHES" | "SYNC_ALL";

export interface SyncMessage {
  type: SyncEventType;
  timestamp: number;
}

let remoteDepth = 0;

export function isApplyingRemoteSync(): boolean {
  return remoteDepth > 0;
}

export async function runRemoteSync(work: () => Promise<void>): Promise<void> {
  remoteDepth += 1;
  try {
    await work();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
  } finally {
    remoteDepth -= 1;
  }
}

export class CrossTabSyncManager {
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
    }
  }

  notify(type: SyncEventType) {
    if (remoteDepth > 0 || !this.channel) {
      return;
    }
    const message: SyncMessage = { type, timestamp: Date.now() };
    this.channel.postMessage(message);
  }

  subscribe(callback: (message: SyncMessage) => void) {
    if (!this.channel) {
      return () => undefined;
    }
    const handler = (event: MessageEvent<SyncMessage>) => {
      callback(event.data);
    };
    this.channel.addEventListener("message", handler);
    return () => {
      this.channel?.removeEventListener("message", handler);
    };
  }
}

export const crossTabSync = new CrossTabSyncManager();

export function notifyCrossTab(...types: SyncEventType[]) {
  types.forEach((type) => crossTabSync.notify(type));
}

/** Same-tab signal after domain localStorage writes so open screens can rehydrate. */
export const DOMAIN_STORAGE_UPDATE_EVENT = "storage-update";

export function notifyDomainStorageUpdate() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(DOMAIN_STORAGE_UPDATE_EVENT));
}
