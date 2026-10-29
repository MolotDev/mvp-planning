import { describe, expect, it } from "vitest";
import { createInitialTrackersPool, trackerOptionsForLaunch } from "@/lib/trackerPool";

describe("trackerPool", () => {
  it("creates 40 available trackers TRK-01..TRK-40", () => {
    const pool = createInitialTrackersPool();
    expect(pool).toHaveLength(40);
    expect(pool[0]).toMatchObject({ id: "trk_1", number: "TRK-01", status: "available" });
    expect(pool[39]).toMatchObject({ id: "trk_40", number: "TRK-40", status: "available" });
  });

  it("options include available plus currently selected assigned tracker", () => {
    const pool = createInitialTrackersPool().map((item) =>
      item.number === "TRK-05" ? { ...item, status: "assigned" as const, assigned_launch_id: "l1" } : item,
    );
    const options = trackerOptionsForLaunch(pool, "TRK-05");
    expect(options.some((item) => item.number === "TRK-05")).toBe(true);
    expect(options.every((item) => item.status === "available" || item.number === "TRK-05")).toBe(true);
    expect(trackerOptionsForLaunch(pool, null).some((item) => item.number === "TRK-05")).toBe(false);
  });

  it("hides trackers occupied by other launches", () => {
    const pool = createInitialTrackersPool();
    const options = trackerOptionsForLaunch(pool, "TRK-02", ["TRK-01", "TRK-03"]);
    expect(options.some((item) => item.number === "TRK-01")).toBe(false);
    expect(options.some((item) => item.number === "TRK-03")).toBe(false);
    expect(options.some((item) => item.number === "TRK-02")).toBe(true);
    expect(options.some((item) => item.number === "TRK-04")).toBe(true);
  });
});
