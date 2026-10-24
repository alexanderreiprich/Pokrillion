import { describe, expect, it } from "vitest";
import { pickEndlessQuestion } from "./endless";

const ids = ["a", "b", "c", "d"];

describe("pickEndlessQuestion", () => {
  it("never repeats a question within a run", () => {
    const asked = new Set(["a", "b", "c"]);
    expect(pickEndlessQuestion(ids, asked, new Set())).toBe("d");
  });

  it("avoids today's daily questions", () => {
    for (let i = 0; i < 20; i++) {
      expect(["c", "d"]).toContain(pickEndlessQuestion(ids, new Set(), new Set(["a", "b"])));
    }
  });

  it("falls back to daily questions when nothing else is left", () => {
    expect(pickEndlessQuestion(ids, new Set(["c", "d"]), new Set(["a", "b"]), () => 0)).toBe("a");
  });

  it("returns null when the bank is exhausted", () => {
    expect(pickEndlessQuestion(ids, new Set(ids), new Set())).toBeNull();
  });

  it("uses the random source", () => {
    expect(pickEndlessQuestion(ids, new Set(), new Set(), () => 0.99)).toBe("d");
    expect(pickEndlessQuestion(ids, new Set(), new Set(), () => 0)).toBe("a");
  });
});
