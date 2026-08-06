#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const configPath = path.join(repoRoot, 'skills.config.json');

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

function assertInside(parentPath, childPath, label) {
  const relativePath = path.relative(parentPath, childPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`${label}超出允许范围：${childPath}`);
  }
}

async function assertSkillExists(sourcePath, skillName) {
  try {
    const skillFile = await stat(path.join(sourcePath, 'SKILL.md'));
    if (!skillFile.isFile()) {
      throw new Error('SKILL.md 不是文件。');
    }
  }
  catch (error) {
    throw new Error(`没有找到 ${skillName} Skill：${sourcePath}`, { cause: error });
  }
}

async function syncSkill(skillName, config, shouldUpdate) {
  const submodulePath = path.resolve(repoRoot, config.submodule);
  const sourcePath = path.resolve(submodulePath, config.skillPath);
  const destinationPath = path.resolve(repoRoot, 'skills', skillName);

  assertInside(repoRoot, submodulePath, '子模块路径');
  assertInside(submodulePath, sourcePath, 'Skill 来源路径');
  assertInside(repoRoot, destinationPath, '发布目标路径');

  const submoduleArgs = ['-C', repoRoot, 'submodule', 'update', '--init'];
  if (shouldUpdate) {
    submoduleArgs.push('--remote');
  }
  submoduleArgs.push('--', config.submodule);

  runGit(submoduleArgs, { stdio: 'inherit' });
  await assertSkillExists(sourcePath, skillName);

  await rm(destinationPath, { recursive: true, force: true });
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, {
    recursive: true,
    force: true,
    filter: candidatePath => !['.git', '.gitignore'].includes(path.basename(candidatePath)),
  });

  const sourceCommit = runGit(['-C', submodulePath, 'rev-parse', '--short', 'HEAD']);
  console.log(`已从 ${skillName}@${sourceCommit} 同步到 skills/${skillName}。`);
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const args = process.argv.slice(2);
  const unknownOption = args.find(arg => arg.startsWith('-') && !['--update', '-u', '--help', '-h'].includes(arg));

  if (unknownOption) {
    throw new Error(`不支持的参数：${unknownOption}`);
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法：node scripts/sync-skills.mjs [skill-name...] [--update|-u]');
    console.log(`可用 Skill：${Object.keys(config).join(', ')}`);
    console.log('不指定 Skill 时同步全部；--update 会先更新对应子模块。');
    return;
  }

  const shouldUpdate = args.includes('--update') || args.includes('-u');
  const requestedNames = [...new Set(args.filter(arg => !arg.startsWith('-')))];
  const skillNames = requestedNames.length > 0 ? requestedNames : Object.keys(config);
  const unknownSkill = skillNames.find(skillName => !config[skillName]);

  if (unknownSkill) {
    throw new Error(`没有找到 Skill 配置：${unknownSkill}`);
  }

  for (const skillName of skillNames) {
    await syncSkill(skillName, config[skillName], shouldUpdate);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
