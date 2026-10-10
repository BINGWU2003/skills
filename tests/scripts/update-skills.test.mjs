import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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
  updateSkill,
} from "../../scripts/update-skills.mjs";

function git(root, args) {
  return runGit(args, {
    repoRoot: root,
    env: { ...process.env, GIT_ALLOW_PROTOCOL: "file" },
  });
}

function commitFixture(root) {
  git(root, ["add", "."]);
  git(root, [
    "-c",
    "user.name=Tests",
    "-c",
    "user.email=tests@example.com",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "test: 创建测试版本",
  ]);
}

describe("update-skills", () => {
  it("parses full, selected, help and invalid arguments", () => {
    const config = { alpha: {}, beta: {} };
    expect(parseArgs([], config)).toEqual({
      help: false,
      skillNames: ["alpha", "beta"],
    });
    expect(parseArgs(["alpha", "alpha"], config)).toEqual({
      help: false,
      skillNames: ["alpha"],
    });
    expect(parseArgs(["--help"], config).help).toBe(true);
    expect(parseArgs(["-h"], config).help).toBe(true);
    expect(() => parseArgs(["--wat"], config)).toThrow("不支持的参数：--wat");
    expect(() => parseArgs(["--update"], config)).toThrow("不支持的参数：--update");
    expect(() => parseArgs(["-u"], config)).toThrow("不支持的参数：-u");
    expect(() => parseArgs(["missing"], config)).toThrow(
      "没有找到 Skill 配置：missing",
    );
  });

  it("always updates submodules from the remote", () => {
    expect(buildSubmoduleArgs("/repo", "sources/alpha")).toEqual([
      "-C",
      "/repo",
      "submodule",
      "update",
      "--init",
      "--remote",
      "--",
      "sources/alpha",
    ]);
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

  it("updates one skill through injected side effects", async () => {
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

    await updateSkill(
      "alpha",
      { submodule: "sources/project", skillPath: "skills/alpha" },
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
      "已更新 alpha@abc1234 并同步到 skills/alpha。",
    );
  });

  it("rejects unsafe source and destination configuration", async () => {
    const repoRoot = path.resolve("fixture-repo");
    await expect(
      updateSkill("alpha", { submodule: "../outside", skillPath: "." }, {
        repoRoot,
      }),
    ).rejects.toThrow("子模块路径超出允许范围");
    await expect(
      updateSkill(
        "alpha",
        { submodule: "sources/project", skillPath: "../../outside" },
        {
          repoRoot,
        },
      ),
    ).rejects.toThrow("Skill 来源路径超出允许范围");
    await expect(
      updateSkill("..", { submodule: "sources/project", skillPath: "." }, {
        repoRoot,
      }),
    ).rejects.toThrow("发布目标路径超出允许范围");
  });

  it("prints help or invokes selected skills through main", async () => {
    const logger = { log: vi.fn() };
    const update = vi.fn();
    const config = {
      alpha: { submodule: "sources/a" },
      beta: { submodule: "sources/b" },
      gamma: { requirements: [] },
    };

    await main(["--help"], { config, logger, update });
    expect(logger.log).toHaveBeenCalledTimes(3);
    expect(logger.log).toHaveBeenCalledWith(
      "用法：pnpm run update [-- <skill-name>...]",
    );
    expect(update).not.toHaveBeenCalled();

    await main(["beta"], { config, logger, update });
    expect(update).toHaveBeenCalledWith("beta", config.beta);
  });

  it("skips repo-maintained skills without a submodule", async () => {
    const logger = { log: vi.fn() };
    const update = vi.fn();
    const config = {
      alpha: { submodule: "sources/a" },
      gamma: { requirements: [] },
    };

    await main([], { config, logger, update });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("alpha", config.alpha);
    expect(logger.log).toHaveBeenCalledWith(
      "gamma 由仓库内维护，没有可更新的子模块来源，已跳过。",
    );

    await main(["gamma"], { config, logger, update });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("reads configuration and uses the default update adapter", async () => {
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
      "已更新 alpha@deadbee 并同步到 skills/alpha。",
    );
  });

  it("fetches a newer upstream commit and replaces published files without committing", async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "skills-update-test-"));
    const upstreamRoot = path.join(fixtureRoot, "upstream");
    const repoRoot = path.join(fixtureRoot, "consumer");

    try {
      await mkdir(upstreamRoot);
      await mkdir(repoRoot);
      git(upstreamRoot, ["init", "-b", "main"]);
      await writeFile(path.join(upstreamRoot, "SKILL.md"), "版本 A\n");
      commitFixture(upstreamRoot);

      git(repoRoot, ["init", "-b", "main"]);
      git(repoRoot, ["submodule", "add", "-b", "main", upstreamRoot, "sources/alpha"]);
      const destination = path.join(repoRoot, "skills", "alpha");
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "SKILL.md"), "版本 A\n");
      await writeFile(path.join(destination, "obsolete.txt"), "过期文件\n");
      commitFixture(repoRoot);
      const recordedCommit = git(repoRoot, ["rev-parse", "HEAD"]);
      const recordedPointer = git(repoRoot, ["ls-files", "--stage", "sources/alpha"]);

      await writeFile(path.join(upstreamRoot, "SKILL.md"), "版本 B\n");
      commitFixture(upstreamRoot);
      const latestCommit = git(upstreamRoot, ["rev-parse", "HEAD"]);

      await main(["alpha"], {
        repoRoot,
        config: { alpha: { submodule: "sources/alpha", skillPath: "." } },
        runGitCommand: (args) => git(repoRoot, args),
        logger: { log: vi.fn() },
      });

      const submoduleRoot = path.join(repoRoot, "sources", "alpha");
      expect(git(submoduleRoot, ["rev-parse", "HEAD"])).toBe(latestCommit);
      const publishedContent = await readFile(path.join(destination, "SKILL.md"), "utf8");
      expect(publishedContent.trim()).toBe("版本 B");
      expect(publishedContent).toBe(await readFile(path.join(submoduleRoot, "SKILL.md"), "utf8"));
      await expect(readFile(path.join(destination, "obsolete.txt"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(readFile(path.join(destination, ".git"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(git(repoRoot, ["rev-parse", "HEAD"])).toBe(recordedCommit);
      expect(git(repoRoot, ["ls-files", "--stage", "sources/alpha"])).toBe(recordedPointer);
      expect(git(repoRoot, ["diff", "--name-only"])).toContain("sources/alpha");
    } finally {
      assertInside(os.tmpdir(), fixtureRoot, "测试清理路径");
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }, 15000);

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
