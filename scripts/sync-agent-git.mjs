#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const supportedArgs = new Set(['--update', '-u', '--help', '-h']);
const unknownArg = args.find(arg => !supportedArgs.has(arg));

if (unknownArg) {
  console.error(`不支持的参数：${unknownArg}`);
  process.exit(1);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log('用法：node scripts/sync-agent-git.mjs [--update|-u]');
  console.log('不带参数时同步当前锁定版本；--update 会先更新子模块。');
  process.exit(0);
}

const shouldUpdate = args.includes('--update') || args.includes('-u');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const submodulePath = path.join(repoRoot, 'sources', 'agent-git');
const sourcePath = path.join(submodulePath, 'packages', 'skill', 'skills', 'agent-git');
const destinationPath = path.join(repoRoot, 'skills', 'agent-git');

function runGit(commandArgs, options = {}) {
  const result = spawnSync('git', commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Git 命令执行失败，退出码：${result.status}`);
  }

  return result.stdout?.trim() ?? '';
}

async function assertSkillExists() {
  try {
    const skillFile = await stat(path.join(sourcePath, 'SKILL.md'));
    if (!skillFile.isFile()) {
      throw new Error('SKILL.md 不是文件。');
    }
  }
  catch (error) {
    throw new Error(`没有找到 agent-git Skill：${sourcePath}`, { cause: error });
  }
}

async function main() {
  const submoduleArgs = ['-C', repoRoot, 'submodule', 'update', '--init'];
  if (shouldUpdate) {
    submoduleArgs.push('--remote');
  }
  submoduleArgs.push('--', 'sources/agent-git');

  runGit(submoduleArgs, { stdio: 'inherit' });
  await assertSkillExists();

  const relativeDestination = path.relative(repoRoot, destinationPath);
  if (relativeDestination.startsWith('..') || path.isAbsolute(relativeDestination)) {
    throw new Error(`目标路径超出仓库范围：${destinationPath}`);
  }

  await rm(destinationPath, { recursive: true, force: true });
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true, force: true });

  const sourceCommit = runGit(['-C', submodulePath, 'rev-parse', '--short', 'HEAD']);
  console.log(`已从 agent-git@${sourceCommit} 同步到 skills/agent-git。`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
