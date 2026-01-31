import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { parseNames, parsePortOption, setWorkspaceCwd } from "./utils";

describe("cli utils", () => {
  const originalCwd = process.cwd();
  const originalEnv = process.env.SLIDEV_WORKSPACE_CWD;

  beforeEach(() => {
    process.chdir(originalCwd);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SLIDEV_WORKSPACE_CWD;
    } else {
      process.env.SLIDEV_WORKSPACE_CWD = originalEnv;
    }
  });

  it("parsePortOption returns a valid port", () => {
    expect(parsePortOption("3000")).toBe(3000);
  });

  it("parsePortOption throws on invalid values", () => {
    expect(() => parsePortOption("0")).toThrow();
    expect(() => parsePortOption("-1")).toThrow();
    expect(() => parsePortOption("abc")).toThrow();
  });

  it("parseNames returns undefined for empty input", () => {
    expect(parseNames()).toBeUndefined();
    expect(parseNames([])).toBeUndefined();
  });

  it("parseNames splits comma-separated names", () => {
    expect(parseNames(["alpha,beta", " gamma "])).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("setWorkspaceCwd sets the workspace env", () => {
    setWorkspaceCwd();
    expect(process.env.SLIDEV_WORKSPACE_CWD).toBe(process.cwd());
  });
});
