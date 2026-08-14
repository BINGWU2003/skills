import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertInside,
  assertSafeRelativePath,
  classifyFile,
  directoryPermalink,
  findRepositoryRoot,
  loadCatalog,
  parseGitmodules,
  readTextForSearch,
  readTrackedSkillFiles,
  repositoryWebUrl,
  runGit,
  simpleMetadata,
  siteRepositoryRoot,
} from '../../scripts/site-catalog.mjs';

const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'skills-catalog-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFiles(root, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split('/'));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents, typeof contents === 'string' ? 'utf8' : undefined);
  }
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

async function createGitFixture(files, config = {}) {
  const root = await temporaryDirectory();
  await writeFiles(root, {
    '.gitmodules': '',
    'skills.config.json': JSON.stringify(config),
    ...files,
  });
  git(root, ['init']);
  git(root, ['config', 'user.email', 'tests@example.com']);
  git(root, ['config', 'user.name', 'Tests']);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'fixture']);
  git(root, ['remote', 'add', 'origin', 'git@github.com:example/catalog.git']);
  return root;
}

async function createMockFixture({ files, config = {}, gitmodules = '', gitResponses = {} }) {
  const root = await temporaryDirectory();
  await writeFiles(root, {
    '.gitmodules': gitmodules,
    'skills.config.json': JSON.stringify(config),
    ...files,
  });
  const tracked = Object.keys(files).filter(file => file.startsWith('skills/')).join('\0');
  const runGitCommand = vi.fn(args => {
    const key = args.join(' ');
    if (args[0] === 'ls-files') return tracked;
    if (args[0] === 'remote') return gitResponses.origin ?? '';
    if (args[0] === 'ls-tree') return gitResponses.tree ?? '';
    if (args[0] === '-C') return gitResponses.worktreeCommit ?? '';
    if (args[0] === 'log') return gitResponses.updatedAt ?? '';
    return gitResponses[key] ?? '';
  });
  return { root, runGitCommand };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('site-catalog helpers', () => {
  it('finds a repository root from cwd, parent or module path', async () => {
    const root = await temporaryDirectory();
    const child = path.join(root, 'child');
    await mkdir(child);
    await writeFile(path.join(root, 'skills.config.json'), '{}');
    expect(findRepositoryRoot(root, path.join(root, 'scripts', 'x.mjs'))).toBe(root);
    expect(findRepositoryRoot(child, path.join(root, 'elsewhere', 'x.mjs'))).toBe(root);
    const repositoryRoot = siteRepositoryRoot();
    expect(path.isAbsolute(repositoryRoot)).toBe(true);
    expect(findRepositoryRoot(repositoryRoot, path.join(repositoryRoot, 'scripts', 'x.mjs'))).toBe(repositoryRoot);
    const emptyRoot = await temporaryDirectory();
    expect(() => findRepositoryRoot(
      path.join(emptyRoot, 'missing', 'deep'),
      path.join(emptyRoot, 'other', 'x.mjs'),
    )).toThrow(
      '无法定位 Skills 仓库根目录',
    );
  });

  it('wraps git success, allowed failures and hard failures', () => {
    expect(runGit(['--version'])).toMatch(/^git version/);
    expect(runGit(['definitely-not-a-command'], { allowFailure: true })).toBe('');
    expect(() => runGit(['definitely-not-a-command'])).toThrow('Git 命令执行失败');
    expect(runGit(['--version'], { repoRoot: '\0invalid', allowFailure: true })).toBe('');
  });

  it('parses CRLF gitmodules and ignores incomplete sections', () => {
    const modules = parseGitmodules([
      '[submodule "one"]',
      '  path = sources/one',
      '  url = git@github.com:example/one.git',
      '[submodule "incomplete"]',
      '  path = sources/incomplete',
      'ignored = value',
    ].join('\r\n'));
    expect(modules.get('sources/one')).toEqual({
      name: 'one',
      path: 'sources/one',
      url: 'git@github.com:example/one.git',
    });
    expect(modules.has('sources/incomplete')).toBe(false);
  });

  it('normalizes repository URLs and builds provider-specific permalinks', () => {
    expect(repositoryWebUrl()).toBeNull();
    expect(repositoryWebUrl('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo');
    expect(repositoryWebUrl('git://github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
    expect(directoryPermalink(null, 'abc', 'path')).toBeNull();
    expect(directoryPermalink('https://github.com/o/r', '', 'path')).toBe('https://github.com/o/r');
    expect(directoryPermalink('https://github.com/o/r', 'abc', '.')).toBe('https://github.com/o/r/tree/abc');
    expect(directoryPermalink('https://gitlab.com/o/r', 'abc', '/skills/a/')).toBe(
      'https://gitlab.com/o/r/-/tree/abc/skills/a',
    );
  });

  it('classifies text, markdown, image, oversized and binary files', () => {
    expect(classifyFile('README.MD', 10)).toEqual({ kind: 'markdown', previewable: true });
    expect(classifyFile('code.ts', 512 * 1024)).toEqual({ kind: 'text', previewable: true });
    expect(classifyFile('large.ts', 512 * 1024 + 1)).toEqual({ kind: 'binary', previewable: false });
    expect(classifyFile('image.PNG', 10)).toEqual({ kind: 'image', previewable: true });
    expect(classifyFile('archive.gz', 10)).toEqual({ kind: 'binary', previewable: false });
  });

  it('normalizes safe paths and rejects POSIX, traversal and Windows absolute paths', () => {
    expect(assertSafeRelativePath('references\\guide.md', '路径')).toBe('references/guide.md');
    expect(assertSafeRelativePath('..guide/file.md', '路径')).toBe('..guide/file.md');
    expect(() => assertSafeRelativePath('../secret', '路径')).toThrow('超出 Skill 目录');
    expect(() => assertSafeRelativePath('/secret', '路径')).toThrow('超出 Skill 目录');
    expect(() => assertSafeRelativePath('C:\\secret.txt', '路径')).toThrow('超出 Skill 目录');
  });

  it('checks resolved containment by complete path segments', () => {
    const root = path.resolve('root');
    expect(() => assertInside(root, path.join(root, '..safe', 'file'), '链接')).not.toThrow();
    expect(() => assertInside(root, path.resolve(root, '..', 'outside'), '链接')).toThrow('超出 Skill 目录');
  });

  it('creates simple metadata without reserved or empty fields', () => {
    expect(simpleMetadata({ name: 'a', description: 'b', flag: false, count: 0, empty: null, missing: undefined }))
      .toEqual([{ key: 'flag', value: false }, { key: 'count', value: 0 }]);
  });

  it('filters deleted tracked files and reads only searchable text', async () => {
    const files = await readTrackedSkillFiles('/repo', () => 'skills/a/SKILL.md\0skills/deleted/SKILL.md\0', file => {
      return file.endsWith(path.join('a', 'SKILL.md'));
    });
    expect(files).toEqual(['skills/a/SKILL.md']);
    const reader = vi.fn().mockResolvedValue('content');
    await expect(readTextForSearch('/tmp/file.md', 10, reader)).resolves.toBe('content');
    await expect(readTextForSearch('/tmp/file.bin', 10, reader)).resolves.toBe('');
    await expect(readTextForSearch('/tmp/file.md', 512 * 1024 + 1, reader)).resolves.toBe('');
    expect(reader).toHaveBeenCalledOnce();
  });
});

describe('loadCatalog', () => {
  it('loads a real temporary Git catalog with dependencies and requirements', async () => {
    const root = await createGitFixture({
      'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha description\ndisable-model-invocation: true\n---\n\nAlpha body\n',
      'skills/alpha/README.md': '# Alpha setup\n',
      'skills/beta/SKILL.md': '---\nname: beta\ndescription: Beta description\n---\n\nBeta body\n',
    }, {
      alpha: {
        skillDependencies: ['beta'],
        requirements: [
          { title: 'Setup', url: 'https://example.com/setup' },
          { title: 'Docs', url: 'https://example.com/docs' },
        ],
      },
      beta: {},
    });

    const catalog = await loadCatalog({ repoRoot: root });
    expect(catalog.map(skill => skill.name)).toEqual(['alpha', 'beta']);
    expect(catalog[0]).toMatchObject({
      name: 'alpha',
      markdown: 'Alpha body',
      skillDependencies: ['beta'],
      installCommand: 'npx skills add BINGWU2003/skills --skill alpha beta',
      publishedSourceUrl: 'https://github.com/example/catalog/tree/main/skills/alpha',
    });
    expect(catalog[0].metadata).toEqual([{ key: 'disable-model-invocation', value: true }]);
    expect(catalog[0].files.map(file => file.path)).toEqual(['README.md', 'SKILL.md']);
    expect(catalog[0].searchText).toContain('Alpha setup');
    expect(catalog[0].updatedAt).toMatch(/^\d{4}-/);
  });

  it('builds upstream metadata from a checked-out or pinned submodule commit', async () => {
    const gitmodules = '[submodule "source"]\n  path = sources/source\n  url = https://gitlab.com/example/source.git\n';
    const files = {
      'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha\n---\nBody\n',
    };
    const config = { alpha: { submodule: 'sources/source', skillPath: 'skills/alpha' } };
    const checkedOut = await createMockFixture({
      files,
      config,
      gitmodules,
      gitResponses: {
        origin: 'https://github.com/example/catalog.git',
        tree: '160000 commit pinned123\tsources/source',
        worktreeCommit: 'checked456',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    const [skill] = await loadCatalog({ repoRoot: checkedOut.root, runGitCommand: checkedOut.runGitCommand });
    expect(skill.upstream).toEqual({
      repositoryUrl: 'https://gitlab.com/example/source',
      commit: 'checked456',
      directoryUrl: 'https://gitlab.com/example/source/-/tree/checked456/skills/alpha',
    });

    const pinned = await createMockFixture({
      files,
      config,
      gitmodules,
      gitResponses: { tree: '160000 commit pinned123\tsources/source' },
    });
    const [pinnedSkill] = await loadCatalog({ repoRoot: pinned.root, runGitCommand: pinned.runGitCommand });
    expect(pinnedSkill.upstream.commit).toBe('pinned123');
  });

  it('rejects invalid frontmatter names and missing descriptions', async () => {
    const wrongName = await createMockFixture({
      files: { 'skills/alpha/SKILL.md': '---\nname: other\ndescription: Alpha\n---\n' },
    });
    await expect(loadCatalog({ repoRoot: wrongName.root, runGitCommand: wrongName.runGitCommand })).rejects.toThrow(
      'Skill 名称不一致',
    );

    const missingDescription = await createMockFixture({
      files: { 'skills/alpha/SKILL.md': '---\nname: alpha\n---\n' },
    });
    await expect(loadCatalog({
      repoRoot: missingDescription.root,
      runGitCommand: missingDescription.runGitCommand,
    })).rejects.toThrow('Skill 缺少 description');
  });

  it('rejects dependencies without a live SKILL.md', async () => {
    const fixture = await createMockFixture({
      files: {
        'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha\n---\n',
        'skills/beta/README.md': '# not a skill',
      },
      config: { alpha: { skillDependencies: ['beta'] } },
    });
    await expect(loadCatalog({ repoRoot: fixture.root, runGitCommand: fixture.runGitCommand })).rejects.toThrow(
      'alpha 引用了不存在的 Skill 依赖：beta',
    );
  });

  it('rejects unsupported requirement fields and invalid requirement URLs', async () => {
    const unsupportedField = await createMockFixture({
      files: { 'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha\n---\n' },
      config: { alpha: { requirements: [{ title: 'Setup', file: 'README.md' }] } },
    });
    await expect(loadCatalog({
      repoRoot: unsupportedField.root,
      runGitCommand: unsupportedField.runGitCommand,
    })).rejects.toThrow(
      '运行要求包含不支持的字段：file',
    );

    const invalidUrl = await createMockFixture({
      files: { 'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha\n---\n' },
      config: { alpha: { requirements: [{ url: 'not a url' }] } },
    });
    await expect(loadCatalog({ repoRoot: invalidUrl.root, runGitCommand: invalidUrl.runGitCommand })).rejects.toThrow();
  });

  it('rejects unregistered or unresolved submodules', async () => {
    const files = { 'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha\n---\n' };
    const missingModule = await createMockFixture({
      files,
      config: { alpha: { submodule: 'sources/missing', skillPath: '.' } },
    });
    await expect(loadCatalog({ repoRoot: missingModule.root, runGitCommand: missingModule.runGitCommand })).rejects.toThrow(
      '子模块未登记',
    );

    const unresolved = await createMockFixture({
      files,
      config: { alpha: { submodule: 'sources/source', skillPath: '.' } },
      gitmodules: '[submodule "source"]\n  path = sources/source\n  url = https://github.com/example/source.git\n',
    });
    await expect(loadCatalog({ repoRoot: unresolved.root, runGitCommand: unresolved.runGitCommand })).rejects.toThrow(
      '无法获取 alpha 的上游提交',
    );
  });

  it('rejects symbolic links that resolve outside the skill directory', async () => {
    const fixture = await createMockFixture({
      files: { 'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha\n---\n' },
    });
    await expect(loadCatalog({
      repoRoot: fixture.root,
      runGitCommand: fixture.runGitCommand,
      lstatPath: async () => ({ isSymbolicLink: () => true }),
      resolveRealPath: async () => path.resolve(fixture.root, '..', 'secret.md'),
    })).rejects.toThrow('符号链接超出 Skill 目录');
  });
});
