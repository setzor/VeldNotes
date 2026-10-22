import { describe, expect, it } from "vitest";
import {
  addMonths,
  calendarGrid,
  daysInMonth,
  endOfMonth,
  formatLong,
  isValidDateString,
  monthKey,
  shiftDate,
  startOfMonth,
} from "./dates";

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

describe("month helpers", () => {
  it("extracts the month key", () => {
    expect(monthKey("2024-03-08")).toBe("2024-03");
  });

  it("adds months across year boundaries", () => {
    expect(addMonths("2023-12", 1)).toBe("2024-01");
    expect(addMonths("2024-01", -1)).toBe("2023-12");
    expect(addMonths("2024-07", 6)).toBe("2025-01");
  });

  it("knows month lengths including leap Februaries", () => {
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2023-02")).toBe(28);
    expect(daysInMonth("2024-04")).toBe(30);
  });

  it("computes start and end of month", () => {
    expect(startOfMonth("2024-03")).toBe("2024-03-01");
    expect(endOfMonth("2024-02")).toBe("2024-02-29");
    expect(endOfMonth("2023-02")).toBe("2023-02-28");
  });
});

describe("calendarGrid", () => {
  it("covers every day of the month, Sunday-first", () => {
    const grid = calendarGrid("2024-03", 0);
    expect(grid.length % 7).toBe(0);
    expect(grid.includes("2024-03-01")).toBe(true);
    expect(grid.includes("2024-03-31")).toBe(true);
  });

  it("starts the grid on the requested first weekday", () => {
    const grid = calendarGrid("2024-03", 1);
    expect(grid[0]).toBe("2024-02-26");
  });

  it("starts Sunday-first grids on a Sunday", () => {
    const grid = calendarGrid("2024-03", 0);
    expect(new Date(`${grid[0]}T00:00:00Z`).getUTCDay()).toBe(0);
  });

  it("handles a month that begins on the first weekday exactly", () => {
    const grid = calendarGrid("2023-01", 0);
    expect(grid[0]).toBe("2023-01-01");
    expect(grid.length).toBe(35);
  });
});
