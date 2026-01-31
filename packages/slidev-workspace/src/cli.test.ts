import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const runVitePreview = vi.fn().mockResolvedValue(undefined);
const runViteBuild = vi.fn().mockResolvedValue(undefined);
const exportOgImages = vi.fn().mockResolvedValue(undefined);
const parseNames = vi.fn((names: string[] | undefined) => names);
const parsePortOption = vi.fn((value: string) => Number(value));
const setWorkspaceCwd = vi.fn();

vi.mock("./cli/vite", () => ({
  runViteBuild,
  runVitePreview,
}));

vi.mock("./cli/slides", () => ({
  exportOgImages,
}));

vi.mock("./cli/utils", () => ({
  parseNames,
  parsePortOption,
  setWorkspaceCwd,
}));

describe("cli entry", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("runs dev command with parsed port", async () => {
    process.argv = ["node", "cli", "dev", "--port", "3100"];

    await import("./cli");

    await vi.waitFor(() => {
      expect(runVitePreview).toHaveBeenCalledWith(3100);
    });
    expect(setWorkspaceCwd).toHaveBeenCalled();
    expect(parsePortOption).toHaveBeenCalledWith("3100");
  });

  it("runs build command with parsed names", async () => {
    parseNames.mockReturnValueOnce(["alpha", "beta"]);
    process.argv = ["node", "cli", "build", "alpha,beta"];

    await import("./cli");

    await vi.waitFor(() => {
      expect(runViteBuild).toHaveBeenCalledWith(["alpha", "beta"]);
    });
    expect(parseNames).toHaveBeenCalledWith(["alpha,beta"]);
    expect(setWorkspaceCwd).toHaveBeenCalled();
  });

  it("runs export-og command", async () => {
    process.argv = ["node", "cli", "export-og"];

    await import("./cli");

    await vi.waitFor(() => {
      expect(exportOgImages).toHaveBeenCalled();
    });
    expect(setWorkspaceCwd).toHaveBeenCalled();
  });

  it("shows help when no args are provided", async () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    process.argv = ["node", "cli"];

    await import("./cli");

    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
