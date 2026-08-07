import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertInside,
  buildSearchIndexEntry,
  createSkillZip,
  isDirectExecution,
  main,
} from '../../scripts/build-site-assets.mjs';

const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'skills-build-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('build-site-assets', () => {
  it('enforces a segment-aware child path', () => {
    const root = path.resolve('public');
    expect(() => assertInside(root, path.join(root, '..downloads'), '目录')).not.toThrow();
    expect(() => assertInside(root, root, '目录')).toThrow('超出允许范围');
    expect(() => assertInside(root, path.resolve(root, '..', 'outside'), '目录')).toThrow('超出允许范围');
  });

  it('builds search entries with upstream and published fallbacks', () => {
    const base = {
      name: 'alpha',
      description: 'Alpha',
      updatedAt: null,
      publishedSourceUrl: 'https://example.com/published',
      files: [{ path: 'SKILL.md' }],
      searchText: 'alpha text',
    };
    expect(buildSearchIndexEntry({ ...base, upstream: { repositoryUrl: 'https://example.com/upstream' } }).source)
      .toBe('https://example.com/upstream');
    expect(buildSearchIndexEntry({ ...base, upstream: null })).toEqual({
      name: 'alpha',
      description: 'Alpha',
      updatedAt: null,
      source: 'https://example.com/published',
      filePaths: ['SKILL.md'],
      text: 'alpha text',
    });
  });

  it('creates a readable zip with stable entry names and contents', async () => {
    const root = await temporaryDirectory();
    const source = path.join(root, 'SKILL.md');
    const destination = path.join(root, 'alpha.zip');
    await writeFile(source, 'hello skill', 'utf8');
    await createSkillZip({ files: [{ path: 'SKILL.md', absolutePath: source }] }, destination);

    const zip = new AdmZip(destination);
    expect(zip.getEntries().map(entry => entry.entryName)).toEqual(['SKILL.md']);
    expect(zip.readAsText('SKILL.md')).toBe('hello skill');
  });

  it('propagates archive and output failures', async () => {
    class BrokenArchive {
      constructor() {
        this.handlers = new Map();
      }

      on(event, handler) { this.handlers.set(event, handler); }
      pipe() {}
      file() {}
      finalize() { this.handlers.get('error')(new Error('archive failed')); }
    }
    const output = { on: vi.fn(), emit: vi.fn() };
    await expect(createSkillZip({ files: [] }, 'unused.zip', {
      Archive: BrokenArchive,
      createOutput: () => output,
    })).rejects.toThrow('archive failed');
  });

  it('builds copied assets, zip and search index in a temporary site', async () => {
    const root = await temporaryDirectory();
    const sourceRoot = path.join(root, 'source');
    const publicRoot = path.join(root, 'site', 'public');
    await mkdir(sourceRoot, { recursive: true });
    const skillFile = path.join(sourceRoot, 'SKILL.md');
    await writeFile(skillFile, 'skill body', 'utf8');
    const logger = { log: vi.fn() };
    const skill = {
      name: 'alpha',
      description: 'Alpha',
      updatedAt: '2026-01-01T00:00:00Z',
      upstream: null,
      publishedSourceUrl: 'https://example.com/alpha',
      files: [{ path: 'SKILL.md', absolutePath: skillFile }],
      searchText: 'alpha searchable',
    };

    await main({ publicRoot, loadCatalogFn: async () => [skill], logger });

    expect(await readFile(path.join(publicRoot, 'downloads', 'skills', 'alpha', 'SKILL.md'), 'utf8')).toBe('skill body');
    expect(new AdmZip(path.join(publicRoot, 'downloads', 'alpha.zip')).readAsText('SKILL.md')).toBe('skill body');
    expect(JSON.parse(await readFile(path.join(publicRoot, 'search-index.json'), 'utf8'))).toEqual([
      buildSearchIndexEntry(skill),
    ]);
    expect(logger.log).toHaveBeenCalledWith('已生成 1 个 Skill 的下载文件与搜索索引。');
  });

  it('uses injected operations and rejects unsafe derived paths', async () => {
    const operations = [];
    await main({
      publicRoot: path.resolve('public'),
      downloadsRoot: path.resolve('public', 'downloads'),
      loadCatalogFn: async () => [],
      removePath: async (...args) => operations.push(['rm', ...args]),
      makeDirectory: async (...args) => operations.push(['mkdir', ...args]),
      writeTextFile: async (...args) => operations.push(['write', ...args]),
      logger: { log: vi.fn() },
    });
    expect(operations.map(([name]) => name)).toEqual(['rm', 'mkdir', 'mkdir', 'write']);

    await expect(main({
      publicRoot: path.resolve('public'),
      downloadsRoot: path.resolve('outside'),
    })).rejects.toThrow('下载目录超出允许范围');

    await expect(main({
      publicRoot: path.resolve('public'),
      loadCatalogFn: async () => [{ name: '..', files: [] }],
    })).rejects.toThrow('下载目录');
  });

  it('recognizes non-direct imports', () => {
    expect(isDirectExecution()).toBe(false);
    expect(isDirectExecution('/different/script.mjs')).toBe(false);
  });
});
