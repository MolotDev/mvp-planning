import { describe, expect, it } from "vitest";
import {
  getEntityState,
  matchesEntityStatusFilter,
  resolvePlanningEntityState,
} from "@/lib/entityState";
import type { CancellationMetadata } from "@/types/cancellation";

const cancellation = (outcome: CancellationMetadata["outcome"]): CancellationMetadata => ({
  reason: "тест",
  initiator: "Черговий центру",
  initiator_role: "CENTER",
  cancel_time: "11:00",
  cancelled_at: "2026-10-28T11:00:00.000Z",
  outcome,
});

describe("entity cancellation status", () => {
  it("prefers cancellation over archived_at for display", () => {
    expect(
      getEntityState({
        archived_at: "2026-10-28T11:00:00.000Z",
        cancellation: cancellation("cancelled_before_exit"),
      }),
    ).toBe("cancelled_before_exit");
  });

  it("matches cancelled filter for cancelled_* outcomes only", () => {
    expect(
      matchesEntityStatusFilter(
        { archived_at: null, cancellation: cancellation("cancelled_before_exit") },
        "cancelled",
      ),
    ).toBe(true);
    expect(
      matchesEntityStatusFilter(
        { archived_at: null, cancellation: cancellation("cancelled_without_launches") },
        "cancelled",
      ),
    ).toBe(true);
    expect(
      matchesEntityStatusFilter(
        { archived_at: null, cancellation: cancellation("partially_completed") },
        "cancelled",
      ),
    ).toBe(false);
    expect(
      matchesEntityStatusFilter({ archived_at: "2026-10-28T11:00:00.000Z" }, "cancelled"),
    ).toBe(false);
  });

  it("excludes cancelled entities from active filter", () => {
    expect(
      matchesEntityStatusFilter(
        { archived_at: null, cancellation: cancellation("cancelled_before_exit") },
        "active",
      ),
    ).toBe(false);
  });

  it("resolves planning chain cancellation first", () => {
    expect(
      resolvePlanningEntityState(
        { archived_at: null, cancellation: cancellation("cancelled_without_launches") },
        { archived_at: null },
      ),
    ).toBe("cancelled_without_launches");
  });
});
