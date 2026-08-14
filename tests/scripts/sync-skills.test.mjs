import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  assertInside,
  assertSkillExists,
  buildSubmoduleArgs,
  isDirectExecution,
  main,
  parseArgs,
  runGit,
  shouldCopySkillFile,
  syncSkill,
} from "../../scripts/sync-skills.mjs";

describe("sync-skills", () => {
  it("parses full, selected, update, help and invalid arguments", () => {
    const config = { alpha: {}, beta: {} };
    expect(parseArgs([], config)).toEqual({
      help: false,
      shouldUpdate: false,
      skillNames: ["alpha", "beta"],
    });
    expect(parseArgs(["alpha", "alpha", "-u"], config)).toEqual({
      help: false,
      shouldUpdate: true,
      skillNames: ["alpha"],
    });
    expect(parseArgs(["--help"], config).help).toBe(true);
    expect(() => parseArgs(["--wat"], config)).toThrow("不支持的参数：--wat");
    expect(() => parseArgs(["missing"], config)).toThrow(
      "没有找到 Skill 配置：missing",
    );
  });

  it("builds submodule arguments with optional remote update", () => {
    expect(buildSubmoduleArgs("/repo", "sources/alpha", false)).toEqual([
      "-C",
      "/repo",
      "submodule",
      "update",
      "--init",
      "--",
      "sources/alpha",
    ]);
    expect(buildSubmoduleArgs("/repo", "sources/alpha", true)).toContain(
      "--remote",
    );
  });

  it("allows equal and dotted sibling names but rejects actual traversal", () => {
    const root = path.resolve("repo");
    expect(() =>
      assertInside(root, root, "根目录", { allowEqual: true }),
    ).not.toThrow();
    expect(() => assertInside(root, root, "根目录")).toThrow("超出允许范围");
    expect(() =>
      assertInside(root, path.join(root, "..folder"), "目录"),
    ).not.toThrow();
    expect(() =>
      assertInside(root, path.resolve(root, "..", "outside"), "目录"),
    ).toThrow("超出允许范围");
  });

  it("validates SKILL.md and preserves only publishable files", async () => {
    await expect(
      assertSkillExists("/source", "alpha", async () => ({
        isFile: () => true,
      })),
    ).resolves.toBeUndefined();
    await expect(
      assertSkillExists("/source", "alpha", async () => ({
        isFile: () => false,
      })),
    ).rejects.toThrow("没有找到 alpha Skill");
    await expect(
      assertSkillExists("/source", "alpha", async () => {
        throw new Error("missing");
      }),
    ).rejects.toThrow("没有找到 alpha Skill");
    expect(shouldCopySkillFile("/source/.git")).toBe(false);
    expect(shouldCopySkillFile("/source/.gitignore")).toBe(false);
    expect(shouldCopySkillFile("/source/SKILL.md")).toBe(true);
  });

  it("syncs one skill through injected side effects", async () => {
    const repoRoot = path.resolve("fixture-repo");
    const calls = [];
    const runGitCommand = vi.fn((args) => {
      calls.push(args);
      return args.includes("rev-parse") ? "abc1234" : "";
    });
    const removePath = vi.fn();
    const makeDirectory = vi.fn();
    const copyPath = vi.fn();
    const ensureSkillExists = vi.fn();
    const logger = { log: vi.fn() };

    await syncSkill(
      "alpha",
      { submodule: "sources/project", skillPath: "skills/alpha" },
      true,
      {
        repoRoot,
        runGitCommand,
        removePath,
        makeDirectory,
        copyPath,
        ensureSkillExists,
        logger,
      },
    );

    expect(calls[0]).toContain("--remote");
    expect(calls[1]).toEqual([
      "-C",
      path.join(repoRoot, "sources/project"),
      "rev-parse",
      "--short",
      "HEAD",
    ]);
    expect(ensureSkillExists).toHaveBeenCalledWith(
      path.join(repoRoot, "sources/project", "skills/alpha"),
      "alpha",
    );
    expect(removePath).toHaveBeenCalledWith(
      path.join(repoRoot, "skills", "alpha"),
      { recursive: true, force: true },
    );
    expect(makeDirectory).toHaveBeenCalledWith(path.join(repoRoot, "skills"), {
      recursive: true,
    });
    expect(copyPath.mock.calls[0][2].filter("/tmp/.git")).toBe(false);
    expect(logger.log).toHaveBeenCalledWith(
      "已从 alpha@abc1234 同步到 skills/alpha。",
    );
  });

  it("rejects unsafe source and destination configuration", async () => {
    const repoRoot = path.resolve("fixture-repo");
    await expect(
      syncSkill("alpha", { submodule: "../outside", skillPath: "." }, false, {
        repoRoot,
      }),
    ).rejects.toThrow("子模块路径超出允许范围");
    await expect(
      syncSkill(
        "alpha",
        { submodule: "sources/project", skillPath: "../../outside" },
        false,
        {
          repoRoot,
        },
      ),
    ).rejects.toThrow("Skill 来源路径超出允许范围");
    await expect(
      syncSkill("..", { submodule: "sources/project", skillPath: "." }, false, {
        repoRoot,
      }),
    ).rejects.toThrow("发布目标路径超出允许范围");
  });

  it("prints help or invokes selected skills through main", async () => {
    const logger = { log: vi.fn() };
    const sync = vi.fn();
    const config = {
      alpha: { submodule: "sources/a" },
      beta: { submodule: "sources/b" },
      gamma: { requirements: [] },
    };

    await main(["--help"], { config, logger, sync });
    expect(logger.log).toHaveBeenCalledTimes(3);
    expect(sync).not.toHaveBeenCalled();

    await main(["beta", "--update"], { config, logger, sync });
    expect(sync).toHaveBeenCalledWith("beta", config.beta, true);
  });

  it("skips repo-maintained skills without a submodule", async () => {
    const logger = { log: vi.fn() };
    const sync = vi.fn();
    const config = {
      alpha: { submodule: "sources/a" },
      gamma: { requirements: [] },
    };

    await main([], { config, logger, sync });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith("alpha", config.alpha, false);
    expect(logger.log).toHaveBeenCalledWith(
      "gamma 由仓库内维护，没有可同步的子模块来源，已跳过。",
    );

    await main(["gamma"], { config, logger, sync });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("reads configuration and uses the default sync adapter", async () => {
    const readTextFile = vi
      .fn()
      .mockResolvedValue('{"alpha":{"submodule":"sources/a","skillPath":"."}}');
    const runGitCommand = vi.fn((args) =>
      args.includes("rev-parse") ? "deadbee" : "",
    );
    const logger = { log: vi.fn() };
    await main(["alpha"], {
      repoRoot: path.resolve("repo"),
      readTextFile,
      runGitCommand,
      removePath: vi.fn(),
      makeDirectory: vi.fn(),
      copyPath: vi.fn(),
      ensureSkillExists: vi.fn(),
      logger,
    });
    expect(readTextFile).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(
      "已从 alpha@deadbee 同步到 skills/alpha。",
    );
  });

  it("wraps git success, non-zero status and process errors", () => {
    expect(runGit(["--version"])).toMatch(/^git version/);
    expect(() => runGit(["definitely-not-a-command"])).toThrow(
      "Git 命令执行失败",
    );
    expect(() => runGit(["--version"], { repoRoot: "\0invalid" })).toThrow();
  });

  it("recognizes direct execution paths", () => {
    expect(isDirectExecution()).toBe(false);
    expect(isDirectExecution("/definitely/not/the/script.mjs")).toBe(false);
  });
});
