import { describe, expect, it } from "vitest";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { suggestFamiliarity } from "./calibration";
import { answerShare } from "./scoring";
import { buildIndex, closestEntities } from "./match";

const basic = (user: string, pass: string) => `Basic ${btoa(unescape(encodeURIComponent(`${user}:${pass}`)))}`;

describe("isAdminAuthorized", () => {
  it("accepts the right password with any user name", () => {
    expect(isAdminAuthorized(basic("admin", "geheim"), "geheim")).toBe(true);
    expect(isAdminAuthorized(basic("", "geheim"), "geheim")).toBe(true);
  });

  it("rejects wrong or missing credentials", () => {
    expect(isAdminAuthorized(basic("admin", "falsch"), "geheim")).toBe(false);
    expect(isAdminAuthorized(basic("admin", "geheim2"), "geheim")).toBe(false);
    expect(isAdminAuthorized(null, "geheim")).toBe(false);
    expect(isAdminAuthorized("Bearer xyz", "geheim")).toBe(false);
    expect(isAdminAuthorized("Basic !!!kein-base64", "geheim")).toBe(false);
  });

  it("is disabled without a configured password", () => {
    expect(isAdminAuthorized(basic("admin", ""), undefined)).toBe(false);
    expect(isAdminAuthorized(basic("admin", ""), "")).toBe(false);
  });

  it("handles non-ASCII passwords", () => {
    expect(isAdminAuthorized(basic("a", "Glurak-Ä"), "Glurak-Ä")).toBe(true);
  });
});

describe("closestEntities", () => {
  const index = buildIndex([
    { id: "pokemon:charizard", names: { de: "Glurak", en: "Charizard" } },
    { id: "pokemon:charmander", names: { de: "Glumanda", en: "Charmander" } },
    { id: "pokemon:pikachu", names: { de: "Pikachu", en: "Pikachu" } },
  ]);

  it("suggests what a typo probably meant", () => {
    expect(closestEntities(index, "Glurack")[0]).toEqual({ entityId: "pokemon:charizard", distance: 1 });
    expect(closestEntities(index, "Pikatschu")[0].entityId).toBe("pokemon:pikachu");
  });

  it("returns nothing for unrelated input", () => {
    expect(closestEntities(index, "Digimon")).toEqual([]);
  });
});

describe("suggestFamiliarity", () => {
  it("raises answers players name more often than expected", () => {
    expect(suggestFamiliarity(50, 0.01, 0.1)).toBeGreaterThan(50);
  });

  it("lowers answers players name less often", () => {
    expect(suggestFamiliarity(80, 0.2, 0.01)).toBeLessThan(80);
  });

  it("keeps a matching prior", () => {
    expect(suggestFamiliarity(60, 0.05, 0.05)).toBe(60);
  });

  it("stays within 1–100", () => {
    expect(suggestFamiliarity(90, 0.001, 0.9)).toBe(100);
    expect(suggestFamiliarity(5, 0.5, 0)).toBeGreaterThanOrEqual(1);
  });

  it("barely moves on a small sample when fed the smoothed share", () => {
    // 38 answers, none for an answer the prior expects at 11.7 %.
    expect(suggestFamiliarity(90, 0.117, answerShare(0.117, 0, 38))).toBeGreaterThanOrEqual(65);
  });
});
