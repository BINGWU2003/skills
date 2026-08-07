import path from 'node:path';

import { marked, Renderer } from 'marked';
import sanitizeHtml from 'sanitize-html';

import { fileHref, rawFileHref } from './paths';

type RenderOptions = {
  skillName: string;
  currentPath: string;
  filePaths: Set<string>;
};

type TocItem = {
  depth: number;
  id: string;
  text: string;
};

function slugify(value: string, seen: Map<string, number>): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}
function isExternal(href: string): boolean {
  return /^(?:[a-z]+:|\/\/)/i.test(href);
}

export function renderMarkdown(markdown: string, options: RenderOptions): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const seenSlugs = new Map<string, number>();
  const currentDirectory = path.posix.dirname(options.currentPath);
  const tokens = marked.lexer(markdown, { gfm: true });

  marked.walkTokens(tokens, token => {
    if ((token.type !== 'link' && token.type !== 'image') || !('href' in token)) {
      return;
    }

    const href = String(token.href);
    if (!href || href.startsWith('#') || isExternal(href)) {
      return;
    }

    const [pathname, fragment] = href.split('#', 2);
    const resolvedPath = path.posix.normalize(path.posix.join(currentDirectory, pathname));
    if (resolvedPath === '..' || resolvedPath.startsWith('../') || !options.filePaths.has(resolvedPath)) {
      return;
    }

    token.href = token.type === 'image'
      ? rawFileHref(options.skillName, resolvedPath)
      : fileHref(options.skillName, `${resolvedPath}${fragment ? `#${fragment}` : ''}`);
  });

  const renderer = new Renderer();
  renderer.heading = function ({ tokens: headingTokens, depth }) {
    const text = this.parser.parseInline(headingTokens);
    const plainText = text.replace(/<[^>]+>/g, '');
    const id = slugify(plainText, seenSlugs);
    toc.push({ depth, id, text: plainText });
    return `<h${depth} id="${id}">${text}<a class="heading-anchor" href="#${id}" aria-label="链接到 ${plainText}">#</a></h${depth}>`;
  };

  const renderTable = renderer.table;
  renderer.table = function (token) {
    return `<div class="table-scroll">${renderTable.call(this, token)}</div>`;
  };

  const rendered = marked.parser(tokens, { renderer, gfm: true });
  const html = sanitizeHtml(String(rendered), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'details', 'summary', 'img', 'kbd', 'table', 'thead', 'tbody', 'tfoot',
      'tr', 'th', 'td', 'del', 'input', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['id', 'class'],
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      input: ['type', 'checked', 'disabled'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    transformTags: {
      a: (_tagName, attribs) => {
        const external = isExternal(attribs.href ?? '');
        return {
          tagName: 'a',
          attribs: external
            ? { ...attribs, target: '_blank', rel: 'noreferrer' }
            : attribs,
        };
      },
      img: (_tagName, attribs) => ({
        tagName: 'img',
        attribs: { ...attribs, loading: 'lazy' },
      }),
    },
  });

  return { html, toc };
}
