#!/usr/bin/env node

import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ZipArchive } from 'archiver';

import { loadCatalog, siteRepositoryRoot } from './site-catalog.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = siteRepositoryRoot();

export function assertInside(parentPath, childPath, label) {
  const relativePath = path.relative(parentPath, childPath);
  if (
    !relativePath
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`${label}超出允许范围：${childPath}`);
  }
}

export async function createSkillZip(skill, destinationPath, options = {}) {
  const createOutput = options.createOutput ?? createWriteStream;
  const Archive = options.Archive ?? ZipArchive;
  await new Promise((resolve, reject) => {
    const output = createOutput(destinationPath);
    const archive = new Archive({ zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    for (const file of skill.files) {
      archive.file(file.absolutePath, { name: file.path });
    }
    archive.finalize();
  });
}

export function buildSearchIndexEntry(skill) {
  return {
    name: skill.name,
    description: skill.description,
    updatedAt: skill.updatedAt,
    source: skill.upstream?.repositoryUrl ?? skill.publishedSourceUrl,
    filePaths: skill.files.map(file => file.path),
    text: skill.searchText,
  };
}

export async function main(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const publicRoot = options.publicRoot ?? path.resolve(repoRoot, 'site', 'public');
  const downloadsRoot = options.downloadsRoot ?? path.resolve(publicRoot, 'downloads');
  const removePath = options.removePath ?? rm;
  const makeDirectory = options.makeDirectory ?? mkdir;
  const copyPath = options.copyPath ?? copyFile;
  const writeTextFile = options.writeTextFile ?? writeFile;
  const loadCatalogFn = options.loadCatalogFn ?? loadCatalog;
  const createZip = options.createZip ?? createSkillZip;
  const logger = options.logger ?? console;

  assertInside(publicRoot, downloadsRoot, '下载目录');
  await removePath(downloadsRoot, { recursive: true, force: true });
  await makeDirectory(downloadsRoot, { recursive: true });

  const skills = await loadCatalogFn(options.catalogOptions);
  const searchIndex = [];
  for (const skill of skills) {
    const skillDownloadRoot = path.join(downloadsRoot, 'skills', skill.name);
    assertInside(downloadsRoot, skillDownloadRoot, `${skill.name} 下载目录`);
    for (const file of skill.files) {
      const destination = path.join(skillDownloadRoot, ...file.path.split('/'));
      assertInside(skillDownloadRoot, destination, `${skill.name} 下载文件`);
      await makeDirectory(path.dirname(destination), { recursive: true });
      await copyPath(file.absolutePath, destination);
    }

    await createZip(skill, path.join(downloadsRoot, `${skill.name}.zip`));
    searchIndex.push(buildSearchIndexEntry(skill));
  }

  await makeDirectory(publicRoot, { recursive: true });
  await writeTextFile(
    path.join(publicRoot, 'search-index.json'),
    `${JSON.stringify(searchIndex)}\n`,
    'utf8',
  );

  logger.log(`已生成 ${skills.length} 个 Skill 的下载文件与搜索索引。`);
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
