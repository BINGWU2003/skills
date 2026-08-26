import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '../../site/src/lib/markdown.ts';

const options = {
  skillName: 'example-skill',
  currentPath: 'SKILL.md',
  filePaths: new Set(['SKILL.md']),
};

describe('renderMarkdown', () => {
  it('preserves ordered-list numbering after a fenced code block', () => {
    const markdown = [
      '1. First step',
      '2. Second step',
      '',
      '```sh',
      'echo test',
      '```',
      '',
      '3. Third step',
    ].join('\n');

    const { html } = renderMarkdown(markdown, options);

    expect(html).toContain('<ol start="3">');
    expect(html).toContain('<li>Third step</li>');
  });
});
