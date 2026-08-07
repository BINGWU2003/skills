#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const defaultRepoRoot = path.resolve(scriptDir, '..');

export function runGit(commandArgs, options = {}) {
  const { repoRoot = defaultRepoRoot, ...spawnOptions } = options;
  const result = spawnSync('git', commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...spawnOptions,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Git 命令执行失败，退出码：${result.status}`);
  }

  return result.stdout?.trim() ?? '';
}

export function assertInside(parentPath, childPath, label, options = {}) {
  const relativePath = path.relative(parentPath, childPath);
  if (
    (!options.allowEqual && !relativePath)
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`${label}超出允许范围：${childPath}`);
  }
}

export async function assertSkillExists(sourcePath, skillName, statFile = stat) {
  try {
    const skillFile = await statFile(path.join(sourcePath, 'SKILL.md'));
    if (!skillFile.isFile()) {
      throw new Error('SKILL.md 不是文件。');
    }
  }
  catch (error) {
    throw new Error(`没有找到 ${skillName} Skill：${sourcePath}`, { cause: error });
  }
}

export function shouldCopySkillFile(candidatePath) {
  return !['.git', '.gitignore'].includes(path.basename(candidatePath));
}

export function buildSubmoduleArgs(repoRoot, submodule, shouldUpdate) {
  const args = ['-C', repoRoot, 'submodule', 'update', '--init'];
  if (shouldUpdate) {
    args.push('--remote');
  }
  args.push('--', submodule);
  return args;
}

export function parseArgs(args, config) {
  const allowedOptions = new Set(['--update', '-u', '--help', '-h']);
  const unknownOption = args.find(arg => arg.startsWith('-') && !allowedOptions.has(arg));
  if (unknownOption) {
    throw new Error(`不支持的参数：${unknownOption}`);
  }

  const help = args.includes('--help') || args.includes('-h');
  const shouldUpdate = args.includes('--update') || args.includes('-u');
  const requestedNames = [...new Set(args.filter(arg => !arg.startsWith('-')))];
  const skillNames = requestedNames.length > 0 ? requestedNames : Object.keys(config);
  const unknownSkill = skillNames.find(skillName => !config[skillName]);
  if (unknownSkill) {
    throw new Error(`没有找到 Skill 配置：${unknownSkill}`);
  }

  return { help, shouldUpdate, skillNames };
}

export async function syncSkill(skillName, config, shouldUpdate, options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const runGitCommand = options.runGitCommand
    ?? ((args, gitOptions) => runGit(args, { repoRoot, ...gitOptions }));
  const removePath = options.removePath ?? rm;
  const makeDirectory = options.makeDirectory ?? mkdir;
  const copyPath = options.copyPath ?? cp;
  const ensureSkillExists = options.ensureSkillExists ?? assertSkillExists;
  const logger = options.logger ?? console;
  const submodulePath = path.resolve(repoRoot, config.submodule);
  const sourcePath = path.resolve(submodulePath, config.skillPath);
  const destinationPath = path.resolve(repoRoot, 'skills', skillName);

  assertInside(repoRoot, submodulePath, '子模块路径');
  assertInside(submodulePath, sourcePath, 'Skill 来源路径', { allowEqual: true });
  assertInside(repoRoot, destinationPath, '发布目标路径', { allowEqual: false });

  runGitCommand(buildSubmoduleArgs(repoRoot, config.submodule, shouldUpdate), { stdio: 'inherit' });
  await ensureSkillExists(sourcePath, skillName);

  await removePath(destinationPath, { recursive: true, force: true });
  await makeDirectory(path.dirname(destinationPath), { recursive: true });
  await copyPath(sourcePath, destinationPath, {
    recursive: true,
    force: true,
    filter: shouldCopySkillFile,
  });

  const sourceCommit = runGitCommand(['-C', submodulePath, 'rev-parse', '--short', 'HEAD']);
  logger.log(`已从 ${skillName}@${sourceCommit} 同步到 skills/${skillName}。`);
}

export async function main(args = process.argv.slice(2), options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const readTextFile = options.readTextFile ?? readFile;
  const config = options.config
    ?? JSON.parse(await readTextFile(path.join(repoRoot, 'skills.config.json'), 'utf8'));
  const logger = options.logger ?? console;
  const parsed = parseArgs(args, config);

  if (parsed.help) {
    logger.log('用法：node scripts/sync-skills.mjs [skill-name...] [--update|-u]');
    logger.log(`可用 Skill：${Object.keys(config).join(', ')}`);
    logger.log('不指定 Skill 时同步全部；--update 会先更新对应子模块。');
    return;
  }

  const sync = options.sync ?? ((skillName, skillConfig, shouldUpdate) => syncSkill(
    skillName,
    skillConfig,
    shouldUpdate,
    { ...options, repoRoot, logger },
  ));
  for (const skillName of parsed.skillNames) {
    await sync(skillName, config[skillName], parsed.shouldUpdate);
  }
}

export function isDirectExecution(argvPath = process.argv[1]) {
  return Boolean(argvPath) && path.resolve(argvPath) === path.resolve(scriptPath);
}

/* v8 ignore start -- CLI bootstrap is covered through exported main() */
if (isDirectExecution()) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
/* v8 ignore stop */
