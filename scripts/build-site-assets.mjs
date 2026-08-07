#!/usr/bin/env node

import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { ZipArchive } from 'archiver';

import { loadCatalog, siteRepositoryRoot } from './site-catalog.mjs';

const repoRoot = siteRepositoryRoot();
const publicRoot = path.resolve(repoRoot, 'site', 'public');
const downloadsRoot = path.resolve(publicRoot, 'downloads');

function assertInside(parentPath, childPath, label) {
  const relativePath = path.relative(parentPath, childPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`${label}超出允许范围：${childPath}`);
  }
}

async function createSkillZip(skill, destinationPath) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(destinationPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
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

async function main() {
  assertInside(publicRoot, downloadsRoot, '下载目录');
  await rm(downloadsRoot, { recursive: true, force: true });
  await mkdir(downloadsRoot, { recursive: true });

  const skills = await loadCatalog();
  const searchIndex = [];
  for (const skill of skills) {
    const skillDownloadRoot = path.join(downloadsRoot, 'skills', skill.name);
    assertInside(downloadsRoot, skillDownloadRoot, `${skill.name} 下载目录`);
    for (const file of skill.files) {
      const destination = path.join(skillDownloadRoot, ...file.path.split('/'));
      assertInside(skillDownloadRoot, destination, `${skill.name} 下载文件`);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(file.absolutePath, destination);
    }

    await createSkillZip(skill, path.join(downloadsRoot, `${skill.name}.zip`));
    searchIndex.push({
      name: skill.name,
      description: skill.description,
      updatedAt: skill.updatedAt,
      source: skill.upstream?.repositoryUrl ?? skill.publishedSourceUrl,
      filePaths: skill.files.map(file => file.path),
      text: skill.searchText,
    });
  }

  await mkdir(publicRoot, { recursive: true });
  await import('node:fs/promises').then(({ writeFile }) => writeFile(
    path.join(publicRoot, 'search-index.json'),
    `${JSON.stringify(searchIndex)}\n`,
    'utf8',
  ));

  console.log(`已生成 ${skills.length} 个 Skill 的下载文件与搜索索引。`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
