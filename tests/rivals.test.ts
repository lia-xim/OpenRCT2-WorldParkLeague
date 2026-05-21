import { describe, expect, it } from "vitest";
import { createInitialRivals } from "../src/domain/rivals";

describe("createInitialRivals", () => {
  it("creates a deterministic rival field for a given seed", () => {
    const first = createInitialRivals(12345, 4);
    const second = createInitialRivals(12345, 4);

    expect(first).toEqual(second);
  });

  it("creates the requested rival count with unique ids", () => {
    const rivals = createInitialRivals(99, 12);
    const ids = new Set(rivals.map((rival) => rival.id));

    expect(rivals).toHaveLength(12);
    expect(ids.size).toBe(12);
  });

  it("creates a wider field with meaningful low-end variance", () => {
    const rivals = createInitialRivals(2026, 50);
    const scores = rivals.map((rival) => rival.derived.score);
    const values = rivals.map((rival) => rival.finance.companyValue);

    expect(Math.min(...scores)).toBeLessThan(52);
    expect(Math.max(...scores)).toBeGreaterThan(68);
    expect(Math.min(...values)).toBeLessThan(220_000);
  });
});
