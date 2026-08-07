import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkLinks,
  collectHtmlFiles,
  extractTargets,
  isDirectExecution,
  main,
  pathType,
  resolveBuiltTarget,
  shouldSkipTarget,
} from '../../scripts/check-site-links.mjs';

const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'skills-links-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('check-site-links', () => {
  it('collects nested HTML files in deterministic order', async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, 'b'), { recursive: true });
    await writeFile(path.join(root, 'z.txt'), 'ignore');
    await writeFile(path.join(root, 'a.html'), 'a');
    await writeFile(path.join(root, 'b', 'c.html'), 'c');
    expect((await collectHtmlFiles(root)).map(file => path.relative(root, file).replaceAll('\\', '/'))).toEqual([
      'a.html',
      'b/c.html',
    ]);
  });

  it('classifies files, directories, other nodes and missing paths', async () => {
    expect(await pathType('file', async () => ({ isFile: () => true, isDirectory: () => false }))).toBe('file');
    expect(await pathType('dir', async () => ({ isFile: () => false, isDirectory: () => true }))).toBe('directory');
    expect(await pathType('other', async () => ({ isFile: () => false, isDirectory: () => false }))).toBe('other');
    expect(await pathType('missing', async () => { throw new Error('missing'); })).toBeNull();
  });

  it('resolves files, directory indexes and html fallbacks without accepting empty directories', async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await mkdir(path.join(root, 'empty'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), 'home');
    await writeFile(path.join(root, 'docs', 'index.html'), 'docs');
    await writeFile(path.join(root, 'plain'), 'plain');
    await writeFile(path.join(root, 'about.html'), 'about');

    expect(await resolveBuiltTarget('/', { distRoot: root })).toBe(path.join(root, 'index.html'));
    expect(await resolveBuiltTarget('/docs/', { distRoot: root })).toBe(path.join(root, 'docs', 'index.html'));
    expect(await resolveBuiltTarget('/plain', { distRoot: root })).toBe(path.join(root, 'plain'));
    expect(await resolveBuiltTarget('/about', { distRoot: root })).toBe(path.join(root, 'about.html'));
    expect(await resolveBuiltTarget('/empty/', { distRoot: root })).toBeNull();
    expect(await resolveBuiltTarget('/missing', { distRoot: root })).toBeNull();
    expect(await resolveBuiltTarget('/%ZZ', { distRoot: root })).toBeNull();
    expect(await resolveBuiltTarget('/../../outside', { distRoot: root })).toBeNull();
  });

  it('extracts quoted targets and skips fragments and every external scheme', () => {
    expect(extractTargets('<a href="/a"><img src=\'/b.png\'><a href=/ignored>')).toEqual(['/a', '/b.png']);
    for (const target of ['', '#part', '//cdn.example.com/a.js', 'https://example.com', 'mailto:a@example.com', 'data:x']) {
      expect(shouldSkipTarget(target)).toBe(true);
    }
    expect(shouldSkipTarget('/internal')).toBe(false);
    expect(shouldSkipTarget('../relative')).toBe(false);
  });

  it('checks relative and root links while ignoring protocol-relative assets', async () => {
    const root = await temporaryDirectory();
    const distRoot = path.join(root, 'site', 'dist');
    await mkdir(path.join(distRoot, 'guide'), { recursive: true });
    await writeFile(path.join(distRoot, 'index.html'), '<a href="/guide/">Guide</a><script src="//cdn.example.com/x.js"></script>');
    await writeFile(path.join(distRoot, 'guide', 'index.html'), '<a href="../">Home</a><a href="missing">Missing</a>');

    expect(await checkLinks({ repoRoot: root, distRoot })).toEqual([
      `${path.join('site', 'dist', 'guide', 'index.html')} -> missing`,
    ]);
  });

  it('aggregates malformed paths and resolver errors', async () => {
    const failures = await checkLinks({
      repoRoot: path.resolve('repo'),
      distRoot: path.resolve('repo', 'dist'),
      collectFiles: async () => [path.resolve('repo', 'dist', 'index.html')],
      readTextFile: async () => '<a href="/%ZZ">Bad</a><a href="/boom">Boom</a>',
      resolveTarget: async target => {
        if (target === '/boom') throw new Error('resolver failed');
        return null;
      },
    });
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain('/%ZZ');
    expect(failures[1]).toContain('resolver failed');
  });

  it('prints success and throws one aggregated CLI error', async () => {
    const logger = { log: vi.fn() };
    await main({ collectFiles: async () => [], logger, distRoot: path.resolve('dist') });
    expect(logger.log).toHaveBeenCalledWith('站内链接检查通过。');

    await expect(main({
      repoRoot: path.resolve('repo'),
      distRoot: path.resolve('repo', 'dist'),
      collectFiles: async () => [path.resolve('repo', 'dist', 'index.html')],
      readTextFile: async () => '<a href="/missing">Missing</a>',
      resolveTarget: async () => null,
    })).rejects.toThrow('发现 1 个失效站内链接');
  });

  it('recognizes non-direct imports', () => {
    expect(isDirectExecution()).toBe(false);
    expect(isDirectExecution('/different/script.mjs')).toBe(false);
  });
});
