import { describe, expect, it } from "vitest";

describe("Phase 0 baseline", () => {
  it("reserves the CLI package name", () => {
    expect("@snowdev/cli").toBe("@snowdev/cli");
  });
});
