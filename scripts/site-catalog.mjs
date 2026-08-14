import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';

export function findRepositoryRoot(cwd = process.cwd(), modulePath = fileURLToPath(import.meta.url)) {
  const candidates = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(path.dirname(modulePath), '..'),
  ];
  const root = candidates.find(candidate => existsSync(path.join(candidate, 'skills.config.json')));
  if (!root) {
    throw new Error('无法定位 Skills 仓库根目录。');
  }
  return root;
}

const defaultRepoRoot = findRepositoryRoot();
const textExtensions = new Set([
  '.css', '.csv', '.html', '.ini', '.js', '.json', '.jsx', '.md', '.mjs',
  '.ps1', '.py', '.sh', '.sql', '.toml', '.ts', '.tsx', '.txt', '.xml',
  '.yaml', '.yml',
]);
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

export function runGit(args, options = {}) {
  const { repoRoot = defaultRepoRoot, allowFailure = false, ...spawnOptions } = options;
  let result;
  try {
    result = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      ...spawnOptions,
    });
  }
  catch (error) {
    if (allowFailure) {
      return '';
    }
    throw error;
  }

  if (result.error || result.status !== 0) {
    if (allowFailure) {
      return '';
    }
    throw result.error ?? new Error(`Git 命令执行失败：git ${args.join(' ')}`);
  }

  return result.stdout?.trim() ?? '';
}

export function parseGitmodules(source) {
  const modules = new Map();
  let current = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const section = rawLine.match(/^\[submodule "(.+)"\]$/);
    if (section) {
      current = { name: section[1] };
      continue;
    }

    if (!current) {
      continue;
    }

    const entry = rawLine.match(/^\s*(path|url)\s*=\s*(.+)$/);
    if (!entry) {
      continue;
    }

    current[entry[1]] = entry[2].trim();
    if (current.path && current.url) {
      modules.set(current.path.replaceAll('\\', '/'), current);
    }
  }

  return modules;
}

export function repositoryWebUrl(gitUrl) {
  if (!gitUrl) {
    return null;
  }

  if (gitUrl.startsWith('git@')) {
    const [host, repository] = gitUrl.slice(4).split(':');
    return `https://${host}/${repository.replace(/\.git$/, '')}`;
  }

  return gitUrl.replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
}

export function directoryPermalink(repositoryUrl, commit, directory) {
  if (!repositoryUrl || !commit) {
    return repositoryUrl;
  }

  const normalizedPath = directory === '.' ? '' : `/${directory.replace(/^\/+|\/+$/g, '')}`;
  if (repositoryUrl.includes('gitlab.com')) {
    return `${repositoryUrl}/-/tree/${commit}${normalizedPath}`;
  }
  return `${repositoryUrl}/tree/${commit}${normalizedPath}`;
}

export function classifyFile(filePath, size) {
  const extension = path.posix.extname(filePath).toLowerCase();
  if (imageExtensions.has(extension)) {
    return { kind: 'image', previewable: true };
  }
  if (textExtensions.has(extension) && size <= 512 * 1024) {
    return { kind: extension === '.md' ? 'markdown' : 'text', previewable: true };
  }
  return { kind: 'binary', previewable: false };
}

export function assertSafeRelativePath(candidate, label) {
  const normalized = path.posix.normalize(candidate.replaceAll('\\', '/'));
  if (
    normalized === '..'
    || normalized.startsWith('../')
    || path.posix.isAbsolute(normalized)
    || /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(`${label}超出 Skill 目录：${candidate}`);
  }
  return normalized;
}

export function simpleMetadata(frontmatter) {
  const omitted = new Set(['name', 'description']);
  return Object.entries(frontmatter)
    .filter(([key, value]) => !omitted.has(key) && value !== undefined && value !== null)
    .map(([key, value]) => ({ key, value }));
}

export function assertInside(parentPath, childPath, label) {
  const relativePath = path.relative(parentPath, childPath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`${label}超出 Skill 目录：${childPath}`);
  }
}

export async function readTrackedSkillFiles(
  repoRoot = defaultRepoRoot,
  runGitCommand = args => runGit(args, { repoRoot }),
  fileExists = existsSync,
) {
  const output = runGitCommand(['ls-files', '-z', '--', 'skills']);
  return output
    .split('\0')
    .filter(Boolean)
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => fileExists(path.join(repoRoot, ...file.split('/'))));
}

export async function readTextForSearch(absolutePath, size, readTextFile = readFile) {
  if (size > 512 * 1024 || !textExtensions.has(path.extname(absolutePath).toLowerCase())) {
    return '';
  }
  return readTextFile(absolutePath, 'utf8');
}

export function siteRepositoryRoot() {
  return defaultRepoRoot;
}

export async function loadCatalog(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const readTextFile = options.readTextFile ?? readFile;
  const statPath = options.statPath ?? stat;
  const lstatPath = options.lstatPath ?? lstat;
  const resolveRealPath = options.resolveRealPath ?? realpath;
  const runGitCommand = options.runGitCommand
    ?? ((args, gitOptions) => runGit(args, { repoRoot, ...gitOptions }));
  const [trackedFiles, configSource, gitmodulesSource] = await Promise.all([
    readTrackedSkillFiles(repoRoot, runGitCommand, options.fileExists ?? existsSync),
    readTextFile(path.join(repoRoot, 'skills.config.json'), 'utf8'),
    readTextFile(path.join(repoRoot, '.gitmodules'), 'utf8'),
  ]);
  const config = JSON.parse(configSource);
  const gitmodules = parseGitmodules(gitmodulesSource);
  const originUrl = repositoryWebUrl(runGitCommand(['remote', 'get-url', 'origin'], { allowFailure: true }))
    ?? 'https://github.com/BINGWU2003/skills';
  const filesBySkill = new Map();

  for (const trackedFile of trackedFiles) {
    const [, skillName, ...relativeParts] = trackedFile.split('/');
    if (!skillName || relativeParts.length === 0) {
      continue;
    }
    const relativePath = relativeParts.join('/');
    const files = filesBySkill.get(skillName) ?? [];
    files.push({ trackedFile, relativePath });
    filesBySkill.set(skillName, files);
  }

  const skills = [];
  for (const [skillName, trackedEntries] of [...filesBySkill.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const skillEntry = trackedEntries.find(file => file.relativePath === 'SKILL.md');
    if (!skillEntry) {
      continue;
    }

    const skillFilePath = path.join(repoRoot, ...skillEntry.trackedFile.split('/'));
    const skillSource = await readTextFile(skillFilePath, 'utf8');
    const parsed = matter(skillSource);
    if (parsed.data.name !== skillName) {
      throw new Error(`Skill 名称不一致：skills/${skillName}/SKILL.md 声明为 ${parsed.data.name ?? '空'}`);
    }
    if (typeof parsed.data.description !== 'string' || !parsed.data.description.trim()) {
      throw new Error(`Skill 缺少 description：${skillName}`);
    }

    const files = [];
    const searchableParts = [parsed.data.name, parsed.data.description];
    for (const entry of trackedEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      const safePath = assertSafeRelativePath(entry.relativePath, `${skillName} 文件路径`);
      const absolutePath = path.join(repoRoot, ...entry.trackedFile.split('/'));
      const linkStat = await lstatPath(absolutePath);
      if (linkStat.isSymbolicLink()) {
        const resolvedPath = await resolveRealPath(absolutePath);
        assertInside(path.join(repoRoot, 'skills', skillName), resolvedPath, `${skillName} 符号链接`);
      }
      const fileStat = await statPath(absolutePath);
      const classification = classifyFile(safePath, fileStat.size);
      const searchText = await readTextForSearch(absolutePath, fileStat.size, readTextFile);
      if (searchText) {
        searchableParts.push(safePath, searchText);
      }
      files.push({
        path: safePath,
        absolutePath,
        size: fileStat.size,
        ...classification,
      });
    }

    const skillConfig = config[skillName] ?? {};
    const skillDependencies = skillConfig.skillDependencies ?? [];
    for (const dependency of skillDependencies) {
      const dependencyEntries = filesBySkill.get(dependency);
      if (!dependencyEntries?.some(entry => entry.relativePath === 'SKILL.md')) {
        throw new Error(`${skillName} 引用了不存在的 Skill 依赖：${dependency}`);
      }
    }

    const requirements = skillConfig.requirements ?? [];
    for (const requirement of requirements) {
      const unsupportedField = Object.keys(requirement)
        .find(field => !['title', 'description', 'url'].includes(field));
      if (unsupportedField) {
        throw new Error(`${skillName} 的运行要求包含不支持的字段：${unsupportedField}`);
      }
      if (requirement.url) {
        new URL(requirement.url);
      }
    }

    let upstream = null;
    if (skillConfig.submodule) {
      const module = gitmodules.get(skillConfig.submodule.replaceAll('\\', '/'));
      if (!module) {
        throw new Error(`${skillName} 的子模块未登记在 .gitmodules：${skillConfig.submodule}`);
      }
      const repositoryUrl = repositoryWebUrl(module.url);
      const treeEntry = runGitCommand(['ls-tree', 'HEAD', '--', skillConfig.submodule], { allowFailure: true });
      const pinnedCommit = treeEntry.split(/\s+/)[2] ?? '';
      const commit = runGitCommand(['-C', path.join(repoRoot, skillConfig.submodule), 'rev-parse', 'HEAD'], { allowFailure: true })
        || pinnedCommit;
      if (!commit) {
        throw new Error(`无法获取 ${skillName} 的上游提交：${skillConfig.submodule}`);
      }
      upstream = {
        repositoryUrl,
        commit,
        directoryUrl: directoryPermalink(repositoryUrl, commit, skillConfig.skillPath),
      };
    }

    const updatedAt = runGitCommand(['log', '-1', '--format=%cI', '--', `skills/${skillName}`], { allowFailure: true }) || null;
    skills.push({
      name: skillName,
      description: parsed.data.description.trim(),
      frontmatter: parsed.data,
      metadata: simpleMetadata(parsed.data),
      markdown: parsed.content.trim(),
      files,
      updatedAt,
      installCommand: `npx skills add BINGWU2003/skills --skill ${[skillName, ...skillDependencies].join(' ')}`,
      skillDependencies,
      requirements,
      publishedSourceUrl: `${originUrl}/tree/main/skills/${skillName}`,
      upstream,
      searchText: searchableParts.join('\n'),
    });
  }

  return skills;
}
