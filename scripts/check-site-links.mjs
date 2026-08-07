#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '..');
const defaultDistRoot = path.resolve(defaultRepoRoot, 'site', 'dist');
const siteOrigin = 'https://example.invalid';

export async function collectHtmlFiles(directory, readDirectory = readdir) {
  const result = [];
  const entries = await readDirectory(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectHtmlFiles(absolutePath, readDirectory));
    }
    else if (entry.name.endsWith('.html')) {
      result.push(absolutePath);
    }
  }
  return result;
}

export async function pathType(candidate, statPath = stat) {
  try {
    const candidateStat = await statPath(candidate);
    if (candidateStat.isFile()) {
      return 'file';
    }
    if (candidateStat.isDirectory()) {
      return 'directory';
    }
    return 'other';
  }
  catch {
    return null;
  }
}

export async function resolveBuiltTarget(urlPath, options = {}) {
  const distRoot = options.distRoot ?? defaultDistRoot;
  const statPath = options.statPath ?? stat;
  let relativePath;
  try {
    relativePath = decodeURIComponent(urlPath).replace(/^\/+/, '');
  }
  catch {
    return null;
  }

  const candidate = path.resolve(distRoot, ...relativePath.split('/').filter(Boolean));
  const relative = path.relative(distRoot, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }

  if (await pathType(candidate, statPath) === 'file') {
    return candidate;
  }
  const indexPath = path.join(candidate, 'index.html');
  if (await pathType(indexPath, statPath) === 'file') {
    return indexPath;
  }
  const htmlPath = `${candidate}.html`;
  if (await pathType(htmlPath, statPath) === 'file') {
    return htmlPath;
  }
  return null;
}

export function extractTargets(html) {
  const targets = [];
  const attributePattern = /\b(?:href|src)=(?:"([^"]+)"|'([^']+)')/g;
  for (const match of html.matchAll(attributePattern)) {
    targets.push(match[1] ?? match[2]);
  }
  return targets;
}

export function shouldSkipTarget(target) {
  return !target
    || target.startsWith('#')
    || target.startsWith('//')
    || /^[A-Za-z][A-Za-z\d+.-]*:/.test(target);
}

export async function checkLinks(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const distRoot = options.distRoot ?? path.resolve(repoRoot, 'site', 'dist');
  const readTextFile = options.readTextFile ?? readFile;
  const collectFiles = options.collectFiles ?? collectHtmlFiles;
  const resolveTarget = options.resolveTarget
    ?? (urlPath => resolveBuiltTarget(urlPath, { distRoot, statPath: options.statPath }));
  const failures = [];

  for (const htmlFile of await collectFiles(distRoot)) {
    const html = await readTextFile(htmlFile, 'utf8');
    const currentPath = `/${path.relative(distRoot, htmlFile).replaceAll('\\', '/').replace(/index\.html$/, '')}`;
    for (const rawTarget of extractTargets(html)) {
      if (shouldSkipTarget(rawTarget)) {
        continue;
      }

      try {
        const resolved = new URL(rawTarget, `${siteOrigin}${currentPath}`);
        const builtTarget = await resolveTarget(resolved.pathname);
        if (!builtTarget) {
          failures.push(`${path.relative(repoRoot, htmlFile)} -> ${rawTarget}`);
        }
      }
      catch (error) {
        failures.push(`${path.relative(repoRoot, htmlFile)} -> ${rawTarget}（${error.message}）`);
      }
    }
  }

  return failures;
}

export async function main(options = {}) {
  const failures = await checkLinks(options);
  if (failures.length > 0) {
    throw new Error(`发现 ${failures.length} 个失效站内链接：\n${failures.join('\n')}`);
  }
  (options.logger ?? console).log('站内链接检查通过。');
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
