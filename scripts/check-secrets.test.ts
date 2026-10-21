import { describe, expect, it } from "vitest";
import { findSecrets } from "./check-secrets";

// Test values are assembled at runtime so this file doesn't trip the scanner itself.
const fake = (...parts: string[]) => parts.join("");

describe("findSecrets", () => {
  it("finds typical secrets", () => {
    const text = [
      `SUPABASE_SERVICE_ROLE_KEY=${fake("sb_", "secret_", "N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz")}`,
      `const key = "${fake("eyJ", "hbGciOiJIUzI1NiIs", ".eyJ", "pc3MiOiJzdXBhYmFzZSIs", ".EGIM96RAZx35lJzdJsyH")}";`,
      `token: ${fake("gh", "p_", "a".repeat(36))}`,
      fake("-----BEGIN ", "RSA PRIVATE KEY-----"),
      `CRON_SECRET=${fake("super", "secret", "value")}`,
    ].join("\n");
    const rules = findSecrets("src/x.ts", text).map((f) => f.rule);
    expect(rules).toContain("Supabase secret key");
    expect(rules).toContain("JWT (z. B. Supabase service_role/anon key)");
    expect(rules).toContain("GitHub token");
    expect(rules).toContain("Private key");
    expect(rules).toContain("Secret-Variable mit Wert");
  });

  it("masks the excerpt", () => {
    const [finding] = findSecrets("a.ts", fake("sb_", "secret_", "N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"));
    expect(finding.excerpt).not.toContain("N7UND0Ugj");
  });

  it("ignores empty placeholders and the local default DB password", () => {
    const text = [
      "SUPABASE_SERVICE_ROLE_KEY=",
      "CRON_SECRET=",
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "const SCORING = { masterballPoints: 100 };",
    ].join("\n");
    expect(findSecrets(".env.example", text)).toEqual([]);
  });

  it("blocks env files except the example", () => {
    expect(findSecrets(".env.local", "")).toHaveLength(1);
    expect(findSecrets("apps/web/.env", "")).toHaveLength(1);
    expect(findSecrets(".env.example", "")).toHaveLength(0);
  });

  it("respects the allow marker", () => {
    const line = `${fake("sb_", "secret_", "N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz")} // check-secrets: allow`;
    expect(findSecrets("docs/x.md", line)).toEqual([]);
  });
});
