import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeBroadcastChannel {
  static peers: FakeBroadcastChannel[] = [];
  private listeners = new Set<(event: MessageEvent) => void>();

  constructor(readonly name: string) {
    FakeBroadcastChannel.peers.push(this);
  }

  postMessage(data: unknown) {
    FakeBroadcastChannel.peers.forEach((peer) => {
      if (peer !== this && peer.name === this.name) {
        const event = new MessageEvent("message", { data });
        peer.listeners.forEach((listener) => listener(event));
      }
    });
  }

  addEventListener(_type: string, handler: (event: MessageEvent) => void) {
    this.listeners.add(handler);
  }

  removeEventListener(_type: string, handler: (event: MessageEvent) => void) {
    this.listeners.delete(handler);
  }
}

describe("cross tab sync", () => {
  beforeEach(() => {
    FakeBroadcastChannel.peers = [];
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    vi.resetModules();
  });

  it("delivers a sync event to the other tab", async () => {
    const { CrossTabSyncManager } = await import("@/services/crossTabSync");
    const sender = new CrossTabSyncManager();
    const receiver = new CrossTabSyncManager();
    const received: string[] = [];
    const unsubscribe = receiver.subscribe((message) => received.push(message.type));
    sender.notify("SYNC_MISSIONS");
    expect(received).toEqual(["SYNC_MISSIONS"]);
    unsubscribe();
    sender.notify("SYNC_TASKS");
    expect(received).toEqual(["SYNC_MISSIONS"]);
  });

  it("does not echo a sync event while the tab is applying a remote update", async () => {
    const { CrossTabSyncManager, runRemoteSync } = await import("@/services/crossTabSync");
    const sender = new CrossTabSyncManager();
    const receiver = new CrossTabSyncManager();
    const received: string[] = [];
    receiver.subscribe((message) => received.push(message.type));
    await runRemoteSync(async () => {
      sender.notify("SYNC_LAUNCHES");
    });
    expect(received).toEqual([]);
    sender.notify("SYNC_LAUNCHES");
    expect(received).toEqual(["SYNC_LAUNCHES"]);
  });
});
