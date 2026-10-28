import { describe, expect, it } from "vitest";
import {
  formatMGRSDisplay,
  isMGRSValid,
  sanitizeMGRSInput,
  sameMgrs,
} from "@/lib/validation";

describe("sanitizeMGRSInput", () => {
  it("uppercases, strips non-latin/spaces, and keeps structure zone+letters+digits", () => {
    expect(sanitizeMGRSInput("36u ev 45210 88320")).toBe("36UEV4521088320");
    expect(sanitizeMGRSInput("абв36u!!!")).toBe("36U");
    expect(sanitizeMGRSInput("UEV")).toBe("");
  });

  it("blocks a 4th letter and letters after coordinate digits", () => {
    expect(sanitizeMGRSInput("36UEVX")).toBe("36UEV");
    expect(sanitizeMGRSInput("36UEV45A")).toBe("36UEV45");
    expect(sanitizeMGRSInput("36UEV45210883209999")).toBe("36UEV4521088320");
  });

  it("caps zone at 60", () => {
    expect(sanitizeMGRSInput("61U")).toBe("61");
    expect(sanitizeMGRSInput("60UEV12")).toBe("60UEV12");
  });
});

describe("formatMGRSDisplay", () => {
  it("formats complete and partial values", () => {
    expect(formatMGRSDisplay("36uev4521088320")).toBe("36U EV 45210 88320");
    expect(formatMGRSDisplay("36UEV452883")).toBe("36U EV 452 883");
    expect(formatMGRSDisplay("36UEV")).toBe("36U EV");
    expect(formatMGRSDisplay("36UEV4521")).toBe("36U EV 45 21");
    expect(formatMGRSDisplay("36UEV452")).toBe("36U EV 452");
  });
});

describe("isMGRSValid", () => {
  it("accepts even digit counts 2–10 with 3 letters", () => {
    expect(isMGRSValid("36U EV 45210 88320")).toBe(true);
    expect(isMGRSValid("36UEV4521088320")).toBe(true);
    expect(isMGRSValid("36UEV45")).toBe(true);
    expect(isMGRSValid("36UEV4521")).toBe(true);
    expect(isMGRSValid("36UEV452883")).toBe(true);
  });

  it("rejects incomplete letters, odd digits, and junk", () => {
    expect(isMGRSValid("")).toBe(false);
    expect(isMGRSValid("36U EV")).toBe(false);
    expect(isMGRSValid("36UEV452")).toBe(false);
    expect(isMGRSValid("36I EV 45210 88320")).toBe(false);
    expect(isMGRSValid("invalid")).toBe(false);
  });

  it("compares MGRS ignoring spacing and case", () => {
    expect(sameMgrs("36U EV 45210 88320", "36uev4521088320")).toBe(true);
  });
});
