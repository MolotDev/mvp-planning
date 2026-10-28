import { describe, expect, it } from "vitest";
import {
  nextLaunchTimeSortDirection,
  sanitizeRouteNumber,
  sortLaunchesByLaunchTime,
} from "@/lib/reportFormat";

describe("report launch order helpers", () => {
  it("cycles sort direction default → asc → desc → default", () => {
    expect(nextLaunchTimeSortDirection("default")).toBe("asc");
    expect(nextLaunchTimeSortDirection("asc")).toBe("desc");
    expect(nextLaunchTimeSortDirection("desc")).toBe("default");
  });

  it("sorts by HH:MM and sinks empty times to the end", () => {
    const launches = [{ id: "c" }, { id: "a" }, { id: "b" }, { id: "d" }];
    const times = {
      a: "2026-10-28T08:30:00.000Z",
      b: "2026-10-28T07:15:00.000Z",
      c: "",
      d: "2026-10-28T09:00:00.000Z",
    };
    expect(sortLaunchesByLaunchTime(launches, times, "default").map((item) => item.id)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
    expect(sortLaunchesByLaunchTime(launches, times, "asc").map((item) => item.id)).toEqual([
      "b",
      "a",
      "d",
      "c",
    ]);
    expect(sortLaunchesByLaunchTime(launches, times, "desc").map((item) => item.id)).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps digits-only route numbers", () => {
    expect(sanitizeRouteNumber("12ab")).toBe("12");
    expect(sanitizeRouteNumber("1-2")).toBe("12");
    expect(sanitizeRouteNumber("12345")).toBe("1234");
  });
});
