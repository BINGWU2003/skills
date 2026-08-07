#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.resolve(repoRoot, 'site', 'dist');
const siteOrigin = 'https://example.invalid';

async function collectHtmlFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectHtmlFiles(absolutePath));
    }
    else if (entry.name.endsWith('.html')) {
      result.push(absolutePath);
    }
  }
  return result;
}

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  }
  catch {
    return false;
  }
}

async function resolveBuiltTarget(urlPath) {
  const relativePath = decodeURIComponent(urlPath).replace(/^\/+/, '');

  const candidate = path.resolve(distRoot, ...relativePath.split('/').filter(Boolean));
  const relative = path.relative(distRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  if (await exists(candidate) && path.extname(candidate)) {
    return candidate;
  }
  if (await exists(path.join(candidate, 'index.html'))) {
    return path.join(candidate, 'index.html');
  }
  if (await exists(candidate)) {
    return candidate;
  }
  if (await exists(`${candidate}.html`)) {
    return `${candidate}.html`;
  }
  return null;
}

async function main() {
  const failures = [];
  for (const htmlFile of await collectHtmlFiles(distRoot)) {
    const html = await readFile(htmlFile, 'utf8');
    const currentPath = `/${path.relative(distRoot, htmlFile).replaceAll('\\', '/').replace(/index\.html$/, '')}`;
    const attributePattern = /\b(?:href|src)=(?:"([^"]+)"|'([^']+)')/g;
    for (const match of html.matchAll(attributePattern)) {
      const rawTarget = match[1] ?? match[2];
      if (!rawTarget || rawTarget.startsWith('#') || /^(?:https?:|mailto:|data:|tel:)/i.test(rawTarget)) {
        continue;
      }

      const resolved = new URL(rawTarget, `${siteOrigin}${currentPath}`);
      const builtTarget = await resolveBuiltTarget(resolved.pathname);
      if (!builtTarget) {
        failures.push(`${path.relative(repoRoot, htmlFile)} -> ${rawTarget}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`发现 ${failures.length} 个失效站内链接：\n${failures.join('\n')}`);
  }
  console.log('站内链接检查通过。');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
