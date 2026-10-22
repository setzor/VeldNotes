import { describe, expect, it } from "vitest";
import { formatLong, isValidDateString, shiftDate } from "./dates";

describe("isValidDateString", () => {
  it("accepts canonical dates", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2024-01-05")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    for (const bad of [
      "2024-13-01",
      "2023-02-29",
      "2024-1-5",
      "2024/01/05",
      "../2024-01-01",
      "",
      "not-a-date",
    ]) {
      expect(isValidDateString(bad)).toBe(false);
    }
  });
});

describe("shiftDate", () => {
  it("shifts across month and year boundaries", () => {
    expect(shiftDate("2024-01-01", -1)).toBe("2023-12-31");
    expect(shiftDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDate("2024-12-31", 1)).toBe("2025-01-01");
  });
});

describe("formatLong", () => {
  it("produces a human readable date", () => {
    const s = formatLong("2024-03-08");
    expect(s).toContain("2024");
    expect(s).toContain("8");
  });
});
